import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCertificationUrgencyEvent } from './certified-urgent-bypass.handler.js';
import * as StepResolution from './step-resolution.js';

describe('Certified Urgent Bypass Handler', () => {
  let mockDeps: any;
  let mockTrx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default transaction mock that just executes the callback
    mockTrx = { _isMockTrx: true };
    const dbMock = {
      transaction: vi.fn(async (cb) => {
        return cb(mockTrx);
      }),
    };

    mockDeps = {
      db: dbMock,
      workflowRepository: {
        getInstanceById: vi.fn(),
        updateInstanceContext: vi.fn(),
        createWorkflowEvent: vi.fn(),
        getMultiReferralStepInstanceForInstance: vi.fn(),
        updateStepInstance: vi.fn(),
        createPendingBypass: vi.fn(),
        getStepInstanceById: vi.fn(),
      },
      documentsService: {},
      eventBus: {},
      orgService: {},
      delegationService: {},
    };

    // Spy on resolveNextStep
    vi.spyOn(StepResolution, 'resolveNextStep').mockResolvedValue(undefined);
  });

  it('CU-05: non-Running (inactive) instance emits already_inactive and skips', async () => {
    mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
      id: 'inst-1',
      status: 'completed',
      context: {},
    });

    await processCertificationUrgencyEvent(
      {
        certificationDocumentId: 'doc-cert-1',
        associatedInstanceIds: ['inst-1'],
        loggedBy: 'user-1',
        loggedAt: new Date().toISOString(),
      },
      mockDeps,
    );

    // Should emit already_inactive
    expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'workflow.certification_urgency.already_inactive',
        payload: expect.objectContaining({
          instanceStatus: 'completed',
        }),
      }),
      mockTrx,
    );

    // Should not update context or step
    expect(mockDeps.workflowRepository.updateInstanceContext).not.toHaveBeenCalled();
    expect(mockDeps.workflowRepository.updateStepInstance).not.toHaveBeenCalled();
  });

  it('CU-02 (Case A): active committee_referral step bypassed immediately', async () => {
    const instanceId = 'inst-2';
    const stepInstanceId = 'step-inst-2';

    mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
      id: instanceId,
      status: 'active',
      context: {},
    });

    mockDeps.workflowRepository.getMultiReferralStepInstanceForInstance.mockResolvedValue({
      id: stepInstanceId,
      status: 'active',
    });

    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue({
      id: stepInstanceId,
      status: 'bypassed',
    });

    await processCertificationUrgencyEvent(
      {
        certificationDocumentId: 'doc-cert-1',
        associatedInstanceIds: [instanceId],
        loggedBy: 'user-1',
        loggedAt: new Date().toISOString(),
      },
      mockDeps,
    );

    // Context updated
    expect(mockDeps.workflowRepository.updateInstanceContext).toHaveBeenCalledWith(
      instanceId,
      {
        certified_urgent: true,
        certified_urgent_document_id: 'doc-cert-1',
      },
      mockTrx,
    );

    // context.updated event emitted
    expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.context.updated' }),
      mockTrx,
    );

    // Step instance updated to bypassed
    expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
      stepInstanceId,
      expect.objectContaining({
        status: 'bypassed',
        bypassedBy: null,
        bypassReason: 'CERTIFIED_URGENT',
        outcome: 'BYPASSED_CERTIFIED_URGENT',
      }),
      mockTrx,
    );

    // Events emitted
    expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.step.bypassed' }),
      mockTrx,
    );
    expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.certification_urgency.bypass_applied' }),
      mockTrx,
    );

    // resolveNextStep called
    expect(StepResolution.resolveNextStep).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: stepInstanceId }),
      'BYPASSED_CERTIFIED_URGENT',
      mockDeps,
      mockTrx,
    );
  });

  it('CU-03 (Case B): pending step creates pending bypass row', async () => {
    const instanceId = 'inst-3';
    const stepInstanceId = 'step-inst-3';

    mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
      id: instanceId,
      status: 'active',
      context: {},
    });

    mockDeps.workflowRepository.getMultiReferralStepInstanceForInstance.mockResolvedValue({
      id: stepInstanceId,
      status: 'pending',
    });

    await processCertificationUrgencyEvent(
      {
        certificationDocumentId: 'doc-cert-1',
        associatedInstanceIds: [instanceId],
        loggedBy: 'user-1',
        loggedAt: new Date().toISOString(),
      },
      mockDeps,
    );

    // Context updated
    expect(mockDeps.workflowRepository.updateInstanceContext).toHaveBeenCalled();

    // Pending bypass created
    expect(mockDeps.workflowRepository.createPendingBypass).toHaveBeenCalledWith(
      {
        instanceId,
        stepKey: 'committee_referral',
        certificationDocumentId: 'doc-cert-1',
      },
      mockTrx,
    );

    // deferred event emitted
    expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.certification_urgency.bypass_deferred' }),
      mockTrx,
    );

    // Should NOT update step instance or call resolveNextStep
    expect(mockDeps.workflowRepository.updateStepInstance).not.toHaveBeenCalled();
    expect(StepResolution.resolveNextStep).not.toHaveBeenCalled();
  });

  it('CU-04 (Case C): already bypassed/completed step emits already_past_referral', async () => {
    const instanceId = 'inst-4';
    const stepInstanceId = 'step-inst-4';

    mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
      id: instanceId,
      status: 'active',
      context: {},
    });

    mockDeps.workflowRepository.getMultiReferralStepInstanceForInstance.mockResolvedValue({
      id: stepInstanceId,
      status: 'completed',
    });

    await processCertificationUrgencyEvent(
      {
        certificationDocumentId: 'doc-cert-1',
        associatedInstanceIds: [instanceId],
        loggedBy: 'user-1',
        loggedAt: new Date().toISOString(),
      },
      mockDeps,
    );

    // Context updated
    expect(mockDeps.workflowRepository.updateInstanceContext).toHaveBeenCalled();

    // already_past_referral emitted
    expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'workflow.certification_urgency.already_past_referral',
      }),
      mockTrx,
    );

    // No updates to step
    expect(mockDeps.workflowRepository.updateStepInstance).not.toHaveBeenCalled();
  });

  it('processes each instance independently in its own transaction', async () => {
    // We will provide 3 instance IDs. The second one will throw an error,
    // the first and third should succeed.

    mockDeps.workflowRepository.getInstanceById.mockImplementation(async (id: string) => {
      if (id === 'fail-inst') throw new Error('Simulated DB failure');
      return { id, status: 'active', context: {} };
    });

    mockDeps.workflowRepository.getMultiReferralStepInstanceForInstance.mockResolvedValue({
      id: 'dummy-step',
      status: 'active',
    });
    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue({
      id: 'dummy-step',
      status: 'bypassed',
    });

    await processCertificationUrgencyEvent(
      {
        certificationDocumentId: 'doc-cert-batch',
        associatedInstanceIds: ['inst-A', 'fail-inst', 'inst-B'],
        loggedBy: 'user-1',
        loggedAt: new Date().toISOString(),
      },
      mockDeps,
    );

    // Transaction should have been opened 3 times
    expect(mockDeps.db.transaction).toHaveBeenCalledTimes(3);

    // updateInstanceContext should have been called for inst-A and inst-B, but not fail-inst
    expect(mockDeps.workflowRepository.updateInstanceContext).toHaveBeenCalledTimes(2);
    expect(mockDeps.workflowRepository.updateInstanceContext).toHaveBeenCalledWith(
      'inst-A',
      expect.anything(),
      mockTrx,
    );
    expect(mockDeps.workflowRepository.updateInstanceContext).toHaveBeenCalledWith(
      'inst-B',
      expect.anything(),
      mockTrx,
    );
  });
});
