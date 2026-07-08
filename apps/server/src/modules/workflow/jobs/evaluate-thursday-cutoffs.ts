import type { WorkflowRepository } from '../workflow.repository.js';

export type EvaluateThursdayCutoffsDeps = {
  workflowRepository: WorkflowRepository;
};

/**
 * Gets the most recent Thursday 23:59:59 PHT (Asia/Manila) relative to `now`.
 * If it's Thursday 23:59:59 exactly, it returns that time.
 * If it's Friday 00:00:00 PHT, it returns Thursday 23:59:59 PHT (1 second ago).
 */
export function getLatestThursdayCutoffPHT(now: Date = new Date()): Date {
  // PHT is UTC+8. We shift the time by +8 hours to work with UTC methods 
  // as if they were local PHT.
  const phtTime = new Date(now.getTime() + 8 * 3600 * 1000);
  
  const cutoffPht = new Date(phtTime);
  // Find most recent Thursday (day 4)
  let daysToSubtract = phtTime.getUTCDay() - 4;
  if (daysToSubtract < 0) daysToSubtract += 7;
  
  cutoffPht.setUTCHours(23, 59, 59, 0);
  cutoffPht.setUTCDate(phtTime.getUTCDate() - daysToSubtract);
  
  // If the computed cutoff is in the future relative to `now`'s PHT time,
  // we must go back exactly one week.
  if (cutoffPht.getTime() > phtTime.getTime()) {
    cutoffPht.setUTCDate(cutoffPht.getUTCDate() - 7);
  }
  
  // Shift back from PHT-aligned UTC to actual UTC
  return new Date(cutoffPht.getTime() - 8 * 3600 * 1000);
}

function getEligibleDate(cutoffTs: Date): string {
  // cutoffTs is Thursday 23:59:59 PHT. We need PHT date + 5 days.
  const phtTime = new Date(cutoffTs.getTime() + 8 * 3600 * 1000);
  phtTime.setUTCDate(phtTime.getUTCDate() + 5);
  
  const y = phtTime.getUTCFullYear();
  const m = String(phtTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(phtTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function evaluateThursdayCutoffs(
  deps: EvaluateThursdayCutoffsDeps,
  options?: { cutoffTs?: Date; now?: Date }
): Promise<void> {
  const cutoffTs = options?.cutoffTs || getLatestThursdayCutoffPHT(options?.now || new Date());

  const instancesAndSteps = await deps.workflowRepository.getActiveInstancesByDefinitionAndStepConfig({
    stepType: 'multi_referral',
    configKey: 'thursday_cutoff_enabled',
    configValue: 'true'
  });

  for (const { instance, stepInstance } of instancesAndSteps) {
    const metadata = (stepInstance.metadata as Record<string, any>) || {};
    
    // Idempotency guard: K2 THU-09
    const lastEvaluatedAtStr = metadata['last_cutoff_evaluated_at'];
    if (lastEvaluatedAtStr) {
      const lastEvaluatedAt = new Date(lastEvaluatedAtStr);
      if (lastEvaluatedAt.getTime() >= cutoffTs.getTime()) {
        continue;
      }
    }

    const assignedCommittees = (metadata['assigned_committees'] as Array<{ committee_id: string }>) || [];
    const submissions = (metadata['submissions'] as Array<any>) || [];
    const allSubmittedAtStr = metadata['all_submitted_at'];

    if (!allSubmittedAtStr) {
      // Missing cutoff (K2 THU-03)
      const missingCommitteeIds = assignedCommittees
        .filter(ac => !submissions.some(s => s.committee_id === ac.committee_id))
        .map(ac => ac.committee_id);

      const missedCount = (metadata['thursday_cutoffs_missed'] || 0) + 1;
      metadata['thursday_cutoffs_missed'] = missedCount;
      metadata['last_cutoff_evaluated_at'] = cutoffTs.toISOString();

      await deps.workflowRepository.updateStepInstance(stepInstance.id, { metadata });
      
      await deps.workflowRepository.createWorkflowEvent({
        instanceId: instance.id,
        eventType: 'workflow.multi_referral.cutoff_missed',
        actorType: 'system',
        actorId: null,
        payload: {
          stepInstanceId: stepInstance.id,
          cutoffTimestamp: cutoffTs.toISOString(),
          missingCommitteeIds,
          cutoffNumber: missedCount,
        }
      });
    } else {
      const allSubmittedAt = new Date(allSubmittedAtStr);
      // K2 THU-02: <= means exactly-23:59:59 submissions count as before cutoff
      if (allSubmittedAt.getTime() <= cutoffTs.getTime() && !metadata['second_reading_eligible_date']) {
        const eligibleDate = getEligibleDate(cutoffTs);
        metadata['second_reading_eligible_date'] = eligibleDate;
        metadata['last_cutoff_evaluated_at'] = cutoffTs.toISOString();

        await deps.workflowRepository.updateStepInstance(stepInstance.id, { metadata });
        
        await deps.workflowRepository.updateInstanceContext(instance.id, {
          second_reading_eligible_date: eligibleDate
        });

        await deps.workflowRepository.createWorkflowEvent({
          instanceId: instance.id,
          eventType: 'workflow.multi_referral.second_reading_eligible',
          actorType: 'system',
          actorId: null,
          payload: {
            stepInstanceId: stepInstance.id,
            eligibleDate,
            cutoffTimestampCleared: cutoffTs.toISOString(),
          }
        });
      }
    }
  }
}
