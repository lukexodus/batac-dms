import { randomUUID } from 'crypto';
import { buildApp } from './app.js';
import { notificationsRouter } from './modules/notifications/notifications.router.js';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { templates, notificationEvents, deliveryLog } from '@batac/database/schema/notifications.schema.js';

async function main() {
  const app = await buildApp();

  const callerFactory = notificationsRouter.createCaller;

  const createCtx = (userId: string, roles: string[]) => ({
    auth: { userId, roles, effectiveRoles: [] },
    req: { server: app } as any,
    db: app.db,
    requestId: 'test-req',
  } as any);

  const sysAdminId = randomUUID();
  const recordsOfficerId = randomUUID();
  const otherUserId = randomUUID();

  const sysAdminCaller = callerFactory(createCtx(sysAdminId, ['sys_admin']));
  const recordsOfficerCaller = callerFactory(createCtx(recordsOfficerId, ['records_officer']));
  const otherUserCaller = callerFactory(createCtx(otherUserId, ['records_officer']));

  // --- Seed Data for Testing ---
  const repo = app.notificationsRepository;



  // Insert template
  const template = await repo.insertTemplate({
    name: `test.template.${Date.now()}`, // unique
    channel: 'in_app',
    subjectTemplate: 'Hello {{name}}',
    bodyTemplate: 'You have {{count}} new messages',
  });

  // Insert notification events for recordsOfficer
  const evnt1 = await repo.insertNotificationEvent({
    templateId: template.id,
    channel: 'in_app',
    recipientUserId: recordsOfficerId,
    templateData: { name: 'Alice', count: '1' },
    status: 'pending',
  });

  const evnt2 = await repo.insertNotificationEvent({
    templateId: template.id,
    channel: 'in_app',
    recipientUserId: recordsOfficerId,
    templateData: { name: 'Alice', count: '2' },
    status: 'pending',
  });

  const evnt3 = await repo.insertNotificationEvent({
    templateId: template.id,
    channel: 'in_app',
    recipientUserId: recordsOfficerId,
    templateData: { name: 'Alice', count: '3' },
    status: 'pending',
  });

  // Insert delivery log for evnt1
  await repo.insertDeliveryLogEntry({
    notificationEventId: evnt1.id,
    status: 'delivered',
  });
  await repo.insertDeliveryLogEntry({
    notificationEventId: evnt2.id,
    status: 'delivered',
  });
  await repo.insertDeliveryLogEntry({
    notificationEventId: evnt3.id,
    status: 'delivered',
  });

  console.log('--- Test 1: listMine cursor pagination ---');
  // pageSize 2
  const page1 = await recordsOfficerCaller.listMine({ pageSize: 2 });
  if (page1.items.length !== 2) throw new Error('Test 1 failed: Expected 2 items on first page');
  if (!page1.nextCursor) throw new Error('Test 1 failed: Expected nextCursor to be returned');
  
  const page2 = await recordsOfficerCaller.listMine({ pageSize: 2, cursor: page1.nextCursor });
  if (page2.items.length !== 1) throw new Error('Test 1 failed: Expected 1 item on second page');
  if (page2.nextCursor) throw new Error('Test 1 failed: Expected nextCursor to be null on last page');
  console.log('Test 1 Passed: Cursor pagination works across pages.');

  console.log('--- Test 2: listMine unreadOnly ---');
  const unreadOnly = await recordsOfficerCaller.listMine({ unreadOnly: true, pageSize: 10 });
  if (unreadOnly.items.length !== 3) throw new Error('Test 2 failed');
  console.log('Test 2 Passed');

  console.log('--- Test 3: markAsRead cross-user throws FORBIDDEN ---');
  try {
    await otherUserCaller.markAsRead({ notificationId: evnt1.id });
    throw new Error('Test 3 failed: should have thrown FORBIDDEN');
  } catch (err: any) {
    if (err.code !== 'FORBIDDEN') throw new Error(`Test 3 failed: expected FORBIDDEN, got ${err.code}`);
  }
  // Check that row is NOT updated
  const checkStatus = await recordsOfficerCaller.listMine({ unreadOnly: true, pageSize: 10 });
  if (!checkStatus.items.some((i: any) => i.notificationId === evnt1.id)) {
    throw new Error('Test 3 failed: Row was silently marked read despite FORBIDDEN');
  }
  console.log('Test 3 Passed: Cross-user markAsRead throws and prevents update.');

  console.log('--- Test 4: listDeliveryLogs ABAC & filtering ---');
  try {
    await recordsOfficerCaller.listDeliveryLogs({ pageSize: 10 });
    throw new Error('Test 4 failed: non-admin was able to call listDeliveryLogs');
  } catch (err: any) {
    if (err.code !== 'FORBIDDEN') throw new Error(`Test 4 failed: expected FORBIDDEN, got ${err.code}`);
  }

  const adminLogs = await sysAdminCaller.listDeliveryLogs({ pageSize: 2 });
  if (adminLogs.items.length !== 2) throw new Error('Test 4 failed: Expected 2 items on page 1');
  if (!adminLogs.nextCursor) throw new Error('Test 4 failed: Expected nextCursor on page 1');

  // Verify date range
  const now = new Date();
  const past = new Date(now.getTime() - 1000000);
  const future = new Date(now.getTime() + 1000000);
  const adminLogsRanged = await sysAdminCaller.listDeliveryLogs({ pageSize: 10, from: past, to: future });
  if (adminLogsRanged.items.length < 3) throw new Error('Test 4 failed: Expected date range to include items');
  console.log('Test 4 Passed: listDeliveryLogs enforces ABAC and cursor + date filters work.');

  console.log('--- Test 5: updateOwnPreferences / getOwnPreferences ---');
  await recordsOfficerCaller.updateOwnPreferences({
    channel: 'in_app',
    templateCategory: 'general',
    enabled: false
  });
  const prefs = await recordsOfficerCaller.getOwnPreferences();
  if (prefs.preferences.length !== 1 || prefs.preferences[0]!.enabled !== false) {
    throw new Error('Test 5 failed: Preferences not updated/retrieved correctly');
  }
  console.log('Test 5 Passed: Preferences work correctly.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
