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

  console.log('--- Test 1: session.replaced displacement notification ---');
  sendNotifCalled = 0;
  lastNotificationPayload = null;
  
  const targetUserId = '22222222-2222-4222-8222-222222222222';
  
  app.eventBus.emit('session.replaced', {
    eventId: 'evt-displaced-1',
    eventType: 'session.replaced',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      user_id: targetUserId,
      old_session_id: 'old-sess-uuid',
      new_session_id: 'new-sess-uuid',
      new_ip_address: '192.168.1.5',
    },
  });

  await new Promise((r) => setTimeout(r, 500));

  if (sendNotifCalled !== 1) {
    throw new Error(`Test 1 Failed: sendNotification called ${sendNotifCalled} times, expected 1`);
  }
  if (lastNotificationPayload?.recipientUserId !== targetUserId) {
    throw new Error(`Test 1 Failed: expected recipientUserId "${targetUserId}", got ${lastNotificationPayload?.recipientUserId}`);
  }
  if (lastNotificationPayload?.templateData?.oldSessionId !== 'old-sess-uuid') {
    throw new Error(`Test 1 Failed: expected oldSessionId "old-sess-uuid", got ${lastNotificationPayload?.templateData?.oldSessionId}`);
  }
  if (lastNotificationPayload?.templateData?.newIpAddress !== '192.168.1.5') {
    throw new Error(`Test 1 Failed: expected newIpAddress "192.168.1.5", got ${lastNotificationPayload?.templateData?.newIpAddress}`);
  }
  console.log('Test 1 Passed: Displaced user notified with correct payload fields.');

  console.log('--- Test 2: Fallback for missing IP Address ---');
  sendNotifCalled = 0;
  lastNotificationPayload = null;
  
  app.eventBus.emit('session.replaced', {
    eventId: 'evt-displaced-2',
    eventType: 'session.replaced',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    cityId: 'city-1',
    payload: {
      user_id: targetUserId,
      old_session_id: 'old-sess-uuid-2',
      new_session_id: 'new-sess-uuid-2',
      new_ip_address: null, // intentionally null
    },
  });

  await new Promise((r) => setTimeout(r, 500));

  if (sendNotifCalled !== 1) {
    throw new Error(`Test 2 Failed: sendNotification called ${sendNotifCalled} times, expected 1`);
  }
  if (lastNotificationPayload?.templateData?.newIpAddress !== 'unknown location') {
    throw new Error(`Test 2 Failed: expected newIpAddress "unknown location", got ${lastNotificationPayload?.templateData?.newIpAddress}`);
  }
  console.log('Test 2 Passed: Null IP address handled gracefully.');

  await app.close();
}

main().catch(console.error);
