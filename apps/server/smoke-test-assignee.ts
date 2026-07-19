import { buildApp } from './src/app.js';
import { sql } from 'drizzle-orm';
import { stepInstances, instances } from '@batac/database/schema/workflow.schema.js';
import crypto from 'crypto';

async function run() {
  console.log('Building app...');
  const app = await buildApp();
  await app.ready();

  console.log('App ready. Emitting document.created event...');

  const documentId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  
  // Need to insert a dummy document first if the workflow depends on it?
  // The event listener for 'document.created' in workflow plugin just needs the ID and type.
  const documentTypesResult = await app.db.execute(sql`SELECT id FROM documents.document_types WHERE code = 'SP_RESOLUTION'`);
  const documentTypeId = documentTypesResult[0]?.id as string;
  if (!documentTypeId) throw new Error('Document type SP_RESOLUTION not found');

  app.eventBus.emit('document.created', {
    eventId,
    eventType: 'document.created',
    occurredAt: new Date().toISOString(),
    cityId: '00000000-0000-4000-8000-000000000001',
    schemaVersion: 1,
    payload: {
      documentId: documentId,
      documentTypeId: documentTypeId,
      actorId: '00000000-0000-0000-0000-000000000001', // system user id
    }
  });

  // Wait a bit for the async event handler to process
  console.log('Waiting for event handler to finish...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Querying DB for workflow instance...');
  const result = await app.db.select().from(instances).where(sql`${instances.documentId} = ${documentId}`);
  
  if (result.length === 0) {
    console.log('❌ No workflow instance found for document', documentId);
  } else {
    console.log('✅ Workflow instance created:', result[0].id);
    
    // Get steps
    const steps = await app.db.select().from(stepInstances).where(sql`${stepInstances.instanceId} = ${result[0].id}`);
    console.log(`Found ${steps.length} steps.`);
    
    // Get assignees for the first step
    const activeStep = steps.find(s => s.status === 'pending' || s.status === 'active');
    if (activeStep) {
      console.log('Active step:', activeStep.stepKey);
      console.log('Assignees:', activeStep.assignedTo);
      if (activeStep.assignedTo) {
         console.log('✅ Assignees successfully resolved!');
      } else {
         console.log('❌ No assignees resolved for the active step.');
      }
    }
  }

  await app.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
