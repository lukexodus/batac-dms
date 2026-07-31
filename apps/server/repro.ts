import { db } from './src/db.js';
import { WorkflowRepository } from './src/modules/workflow/workflow.repository.js';
import { submitStepAction } from './src/modules/workflow/engine/step-handlers/action.handler.js';
import { resolveNextStep } from './src/modules/workflow/engine/step-resolution.js';

async function main() {
  console.log('Starting repro...');
  const workflowRepository = new WorkflowRepository(db);
  const stepInstanceId = 'b3028890-6e12-4b34-8f1a-11d1a83ef538';
  const actorId = '838ca605-3b6c-4fe9-958c-f207473c4f18'; 

  const stepInstance = await workflowRepository.getStepInstanceById(stepInstanceId);
  if (!stepInstance) {
    console.log('Step instance not found');
    return;
  }
  const instance = await workflowRepository.getInstanceById(stepInstance.instanceId);
  if (!instance) {
    console.log('Instance not found');
    return;
  }
  
  console.log('Found instance', instance.id, 'stepInstance', stepInstance.id);
  
  const deps = {
    db,
    workflowRepository,
    documentsService: {} as any,
    eventBus: null as any,
    orgService: {} as any,
    delegationService: {} as any,
    iamService: {
      getUsersByRole: async (role: string) => {
        console.log('MOCK getUsersByRole called with', role);
        return [{ userId: 'mock-user-123' }];
      }
    } as any,
  };

  try {
    await db.transaction(async (tx) => {
      console.log('Calling submitStepAction...');
      await submitStepAction(
        instance,
        stepInstance,
        actorId,
        'Test comment',
        { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
        tx
      );
      console.log('submitStepAction complete. Calling resolveNextStep...');
      await resolveNextStep(instance, stepInstance, 'DONE', deps, tx);
      console.log('resolveNextStep complete.');
      // Rollback intentionally to not pollute DB
      throw new Error('ROLLBACK');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK') {
      console.log('Transaction rolled back successfully after running the code.');
    } else {
      console.error('Error during execution:', err);
    }
  }
  
  process.exit(0);
}

main().catch(console.error);
