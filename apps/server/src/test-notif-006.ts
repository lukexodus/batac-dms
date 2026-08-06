import { buildApp } from './app.js';
import { env } from './config/env.js';

async function main() {
  const app = await buildApp();

  let sendNotifCalled = 0;
  // Monkey-patch sendNotification to intercept
  const originalSendNotif = app.notificationsService.sendNotification;
  app.notificationsService.sendNotification = async (input) => {
    sendNotifCalled++;
    console.log('Intercepted sendNotification with:', JSON.stringify(input, null, 2));
    return originalSendNotif.call(app.notificationsService, input);
  };

  // Setup mock document in DB via documentsService if it doesn't exist, or just mock getDocumentById
  const originalGetDoc = app.documentsService.getDocumentById;
  app.documentsService.getDocumentById = async (id) => {
    if (id === 'doc-not-found') return null;
    return {
      documentId: id,
      title: 'Resolution to Test Assignment',
      documentTypeCode: 'RES',
      lifecycleState: 'in_workflow',
      preliminaryNumber: 'PRE-1234',
      finalNumber: 'RES-2026-001',
      classificationLevel: 'public',
      originatingOfficeId: 'office-1',
      createdAt: new Date(),
    };
  };

  console.log('--- Test 1: system-executed step (assignedTo is null) ---');
  app.eventBus.emit('workflow.step.started', {
    eventId: 'evt-1',
    eventType: 'workflow.step.started',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: '11111111-1111-4111-8111-111111111111',
      stepInstanceId: '22222222-2222-4222-8222-222222222222',
      stepType: 'decision',
      stepKey: 'auto.approve',
      assignedTo: null,
      documentId: 'doc-1',
      dueAt: null,
    }
  });
  
  await new Promise((r) => setTimeout(r, 1000));
  
  if (sendNotifCalled !== 0) {
    throw new Error(`Test 1 Failed: sendNotification called ${sendNotifCalled} times`);
  }
  console.log('Test 1 Passed: sendNotification not called.');

  console.log('--- Test 2: document lookup fails ---');
  app.eventBus.emit('workflow.step.started', {
    eventId: 'evt-2',
    eventType: 'workflow.step.started',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: '33333333-3333-4333-8333-333333333333',
      stepInstanceId: '44444444-4444-4444-8444-444444444444',
      stepType: 'action',
      stepKey: 'manual.review',
      assignedTo: ['88888888-8888-4888-8888-888888888888'],
      documentId: 'doc-not-found',
      dueAt: null,
    }
  });
  await new Promise((r) => setTimeout(r, 1000));
  if (sendNotifCalled !== 0) {
    throw new Error(`Test 2 Failed: sendNotification called ${sendNotifCalled} times`);
  }
  console.log('Test 2 Passed: exception caught locally and sendNotification not called.');

  console.log('--- Test 3: happy path (dueAt is null) ---');
  app.eventBus.emit('workflow.step.started', {
    eventId: 'evt-3',
    eventType: 'workflow.step.started',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: '55555555-5555-4555-8555-555555555555',
      stepInstanceId: '66666666-6666-4666-8666-666666666666',
      stepType: 'action',
      stepKey: 'manual.review',
      assignedTo: ['77777777-7777-4777-8777-777777777777'],
      documentId: 'doc-3',
      dueAt: null,
    }
  });
  await new Promise((r) => setTimeout(r, 1000));
  if ((sendNotifCalled as number) !== 1) {
    throw new Error(`Test 3 Failed: sendNotification called ${sendNotifCalled} times, expected 1`);
  }
  console.log('Test 3 Passed: sendNotification called exactly once.');

  console.log('--- Test 4: assignedTo is empty array ---');
  sendNotifCalled = 0;
  app.eventBus.emit('workflow.step.started', {
    eventId: 'evt-4',
    eventType: 'workflow.step.started',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: '77777777-7777-4777-8777-777777777777',
      stepInstanceId: '88888888-8888-4888-8888-888888888888',
      stepType: 'action',
      stepKey: 'manual.review',
      assignedTo: [],
      documentId: 'doc-3',
      dueAt: null,
    }
  });
  await new Promise((r) => setTimeout(r, 1000));
  if (sendNotifCalled !== 0) {
    throw new Error(`Test 4 Failed: sendNotification called ${sendNotifCalled} times, expected 0`);
  }
  console.log('Test 4 Passed: sendNotification not called.');

  console.log('--- Test 5: multi-assignee array ---');
  sendNotifCalled = 0;
  app.eventBus.emit('workflow.step.started', {
    eventId: 'evt-5',
    eventType: 'workflow.step.started',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: '99999999-9999-4999-8999-999999999999',
      stepInstanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      stepType: 'action',
      stepKey: 'manual.review',
      assignedTo: ['user-a', 'user-b'],
      documentId: 'doc-3',
      dueAt: new Date(),
    }
  });
  await new Promise((r) => setTimeout(r, 1000));
  if (sendNotifCalled !== 2) {
    throw new Error(`Test 5 Failed: sendNotification called ${sendNotifCalled} times, expected 2`);
  }
  console.log('Test 5 Passed: sendNotification called exactly twice.');

  await app.close();
}

main().catch(console.error);
