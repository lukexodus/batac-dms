import { buildApp } from './app.js';

async function main() {
  const app = await buildApp();

  let sendNotifCalled = 0;
  let interceptedPayload: any = null;

  // Monkey-patch sendNotification to intercept
  const originalSendNotif = app.notificationsService.sendNotification;
  app.notificationsService.sendNotification = async (input) => {
    sendNotifCalled++;
    interceptedPayload = input;
    console.log('Intercepted sendNotification with:', JSON.stringify(input, null, 2));
    return originalSendNotif.call(app.notificationsService, input);
  };

  // Mock getDocumentById
  const originalGetDoc = app.documentsService.getDocumentById;
  app.documentsService.getDocumentById = async (id) => {
    if (id === 'doc-not-found') return null;
    return {
      documentId: id,
      title: 'Test Document',
      documentTypeCode: 'RES',
      lifecycleState: 'submitted',
      preliminaryNumber: 'PRE-123',
      finalNumber: null,
      classificationLevel: 'public',
      originatingOfficeId: 'office-1',
      createdAt: new Date(),
    };
  };

  // Mock getUserByOfficeRole
  (app.organizationService as any).getUserByOfficeRole = async (officeId: string, role: string) => {
    return [{ userId: '88888888-8888-4888-8888-888888888888' }];
  };

  console.log('--- Test 1: Happy path (actorId != recipient, missing reason) ---');
  app.eventBus.emit('document.state_changed', {
    eventId: 'evt-notif-007-1',
    eventType: 'document.state_changed',
    timestamp: new Date(),
    actorId: '99999999-9999-4999-8999-999999999999',
    cityId: 'city-1',
    payload: {
      documentId: 'doc-1',
      fromState: 'Draft',
      toState: 'Submitted',
      actorId: '99999999-9999-4999-8999-999999999999',
      // reason is missing
    },
  });

  await new Promise((r) => setTimeout(r, 1000));

  if (sendNotifCalled !== 1) {
    throw new Error(`Test 1 Failed: sendNotification called ${sendNotifCalled} times`);
  }
  
  if (interceptedPayload.recipientUserId === '99999999-9999-4999-8999-999999999999') {
    throw new Error('Test 1 Failed: actorId used as recipient');
  }

  if (interceptedPayload.templateData.fromState !== 'Draft' || interceptedPayload.templateData.toState !== 'Submitted') {
    throw new Error('Test 1 Failed: incorrect fromState or toState in templateData');
  }
  
  if (interceptedPayload.templateData.reason !== '') {
    throw new Error('Test 1 Failed: reason not correctly defaulted to empty string');
  }

  console.log('Test 1 Passed: sendNotification called successfully and actorId != recipient.');

  console.log('--- Test 2: Actor is the recipient (should skip) ---');
  sendNotifCalled = 0;
  // Make the actor the same as the resolved user
  app.eventBus.emit('document.state_changed', {
    eventId: 'evt-notif-007-2',
    eventType: 'document.state_changed',
    timestamp: new Date(),
    actorId: '88888888-8888-4888-8888-888888888888',
    cityId: 'city-1',
    payload: {
      documentId: 'doc-1',
      fromState: 'Submitted',
      toState: 'In-Workflow',
      actorId: '88888888-8888-4888-8888-888888888888',
    },
  });

  await new Promise((r) => setTimeout(r, 1000));

  if (sendNotifCalled !== 0) {
    throw new Error(`Test 2 Failed: sendNotification called ${sendNotifCalled} times, expected 0`);
  }
  console.log('Test 2 Passed: notification skipped because actor is recipient.');

  console.log('--- Test 3: document lookup fails ---');
  sendNotifCalled = 0;
  app.eventBus.emit('document.state_changed', {
    eventId: 'evt-notif-007-3',
    eventType: 'document.state_changed',
    timestamp: new Date(),
    actorId: 'system',
    cityId: 'city-1',
    payload: {
      documentId: 'doc-not-found',
      fromState: 'Draft',
      toState: 'Submitted',
      actorId: 'system',
    },
  });

  await new Promise((r) => setTimeout(r, 1000));
  if (sendNotifCalled !== 0) {
    throw new Error(`Test 3 Failed: sendNotification called ${sendNotifCalled} times`);
  }
  console.log('Test 3 Passed: exception caught locally and sendNotification not called.');

  await app.close();
}

main().catch(console.error);
