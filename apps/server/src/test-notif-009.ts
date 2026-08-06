import { buildApp } from './app.js';
import type { FastifyInstance } from 'fastify';

async function main() {
  const app = await buildApp();

  let sendNotifCalled = 0;
  let lastNotificationPayload: any = null;

  // Monkey-patch sendNotification to intercept
  const originalSendNotif = app.notificationsService.sendNotification;
  app.notificationsService.sendNotification = async (input) => {
    sendNotifCalled++;
    lastNotificationPayload = input;
    console.log('Intercepted sendNotification with:', JSON.stringify(input, null, 2));
    return originalSendNotif.call(app.notificationsService, input);
  };

  // Setup mock IAM Service for sp_secretary
  const originalGetUsersByRole = app.iamService.getUsersByRole;
  app.iamService.getUsersByRole = async (role) => {
    if (role === 'sp_secretary') {
      return [
        {
          userId: '11111111-1111-4111-8111-111111111111',
          email: 'secretary@example.com',
          firstName: 'Sangguniang',
          lastName: 'Secretary',
          displayName: 'Sangguniang Secretary',
          officeId: 'office-sp',
          positionTitle: 'SP Secretary',
          isActive: true,
          roles: ['sp_secretary'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }
    return [];
  };

  console.log('--- Test 1: Mayor 10-day lapse timer ---');
  sendNotifCalled = 0;
  lastNotificationPayload = null;
  app.eventBus.emit('workflow.approval.lapsed', {
    eventId: 'evt-lapse-1',
    eventType: 'workflow.approval.lapsed',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: 'inst-1',
      stepInstanceId: 'step-1',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: new Date().toISOString(),
    },
  });

  await new Promise((r) => setTimeout(r, 500));

  if (sendNotifCalled !== 1) {
    throw new Error(`Test 1 Failed: sendNotification called ${sendNotifCalled} times, expected 1`);
  }
  if (lastNotificationPayload?.templateData?.legalBasis !== 'RA 7160 Section 47') {
    throw new Error(`Test 1 Failed: expected legalBasis "RA 7160 Section 47", got ${lastNotificationPayload?.templateData?.legalBasis}`);
  }
  console.log('Test 1 Passed: SP Secretary notified with correct verbatim string.');

  console.log('--- Test 2: Panlalawigan 30-day deemed approved timer ---');
  sendNotifCalled = 0;
  lastNotificationPayload = null;
  const testDate = new Date().toISOString();
  app.eventBus.emit('workflow.panlalawigan.deemed_approved', {
    eventId: 'evt-lapse-2',
    eventType: 'workflow.panlalawigan.deemed_approved',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: 'inst-2',
      documentId: 'doc-2',
      stepInstanceId: 'step-2',
      legalBasis: 'RA 7160 Section 56(d)',
      transmissionDate: testDate,
      deadlineWas: testDate,
    },
  });

  await new Promise((r) => setTimeout(r, 500));

  if (sendNotifCalled !== 1) {
    throw new Error(`Test 2 Failed: sendNotification called ${sendNotifCalled} times, expected 1`);
  }
  if (lastNotificationPayload?.templateData?.legalBasis !== 'RA 7160 Section 56(d)') {
    throw new Error(`Test 2 Failed: expected legalBasis "RA 7160 Section 56(d)", got ${lastNotificationPayload?.templateData?.legalBasis}`);
  }
  if (
    lastNotificationPayload?.templateData?.transmissionDate !== testDate ||
    lastNotificationPayload?.templateData?.deadlineWas !== testDate
  ) {
    throw new Error(`Test 2 Failed: missing or incorrect date fields`);
  }
  console.log('Test 2 Passed: SP Secretary notified with correct verbatim string and date fields.');

  console.log('--- Test 3: No SP Secretary gracefully skipped ---');
  sendNotifCalled = 0;
  lastNotificationPayload = null;
  app.iamService.getUsersByRole = async () => []; // return none
  
  app.eventBus.emit('workflow.approval.lapsed', {
    eventId: 'evt-lapse-3',
    eventType: 'workflow.approval.lapsed',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      instanceId: 'inst-3',
      stepInstanceId: 'step-3',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: new Date().toISOString(),
    },
  });

  await new Promise((r) => setTimeout(r, 500));

  if (sendNotifCalled !== 0) {
    throw new Error(`Test 3 Failed: sendNotification called ${sendNotifCalled} times, expected 0`);
  }
  console.log('Test 3 Passed: SP Secretary missing handled gracefully.');

  await app.close();
}

main().catch(console.error);
