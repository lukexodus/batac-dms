/**
 * TASK-NOTIF-014-FIX-02: notifications.router.test.ts
 *
 * Tests the notificationsRouter tRPC procedures via a real tRPC caller
 * (notificationsRouter.createCaller), the same mechanism already proven
 * against this exact router in apps/server/src/test-notif-012.ts (a
 * manual verification script run against a live DB during TASK-NOTIF-012).
 * This exercises Zod input/output validation and the protectedProcedure
 * middleware chain (apps/server/src/trpc/trpc.ts) — including the
 * UNAUTHORIZED-for-no-session case, which the previous _def.procedures-based
 * version could not reach.
 *
 * ABAC is inline role-check logic (not requireRole/requirePolicy —
 * those functions do not exist in this codebase; see TASK-NOTIF-012 correction).
 *
 * Dependency injection: notifications.router.ts reads its repository from
 * ctx.req.server.notificationsRepository (no deps-factory parameter, unlike
 * organization.router.ts's createOrgRouter(deps)). This file's makeCtx()
 * builds that exact shape directly rather than mocking a factory parameter
 * that doesn't exist on this router.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Context, AuthContext } from '../../iam/iam.types.js';
import { notificationsRouter } from '../notifications.router.js';

// ---------------------------------------------------------------------------
// Helper: build a mock repository with every method the router calls
// ---------------------------------------------------------------------------
function makeRepo(overrides: Record<string, any> = {}) {
  const baseRepo = {
    listNotificationsForUser: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue(true),
    getOwnPreferences: vi.fn().mockResolvedValue([]),
    updateOwnPreferences: vi.fn().mockResolvedValue(undefined),
    listDeliveryLogs: vi.fn().mockResolvedValue([]),
  };
  return { ...baseRepo, ...overrides };
}

// ---------------------------------------------------------------------------
// Helper: build a full Context, matching AuthContext's required shape
// (apps/server/src/modules/iam/iam.types.ts, lines 84-97 — all 12 fields
// required, no optional markers on the type).
// ---------------------------------------------------------------------------
function makeCtx(
  roles: string[],
  repoOverrides: Record<string, any> = {},
  opts?: { effectiveRoles?: string[]; userId?: string },
): { ctx: Context; repo: ReturnType<typeof makeRepo> } {
  const repo = makeRepo(repoOverrides);
  const userId = opts?.userId ?? 'user-router-test';
  const auth: AuthContext = {
    userId,
    sessionId: 'sess-router-test',
    officeId: null,
    cityId: 'city-1',
    roles,
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: [],
    effectiveRoles: opts?.effectiveRoles ?? roles,
    isItAdmin: false,
    isPlatformAdmin: false,
  };
  const ctx = {
    auth,
    db: {} as any,
    req: { server: { notificationsRepository: repo } } as any,
    requestId: 'req-router-test',
  } as Context;
  return { ctx, repo };
}

function makeUnauthenticatedCtx(): Context {
  return {
    auth: null,
    db: {} as any,
    req: { server: { notificationsRepository: makeRepo() } } as any,
    requestId: 'req-router-test-unauth',
  } as Context;
}

// ---------------------------------------------------------------------------
// Tests: listMine
// ---------------------------------------------------------------------------
describe('Router: listMine (NOTIF-ROUTER-01)', () => {
  it('ROUTER-01-01: allowed role (dept_encoder) can list notifications', async () => {
    const { ctx, repo } = makeCtx(['dept_encoder']);
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.listMine({ pageSize: 20, unreadOnly: false });
    expect(result).toMatchObject({ items: [], nextCursor: null });
    expect(repo.listNotificationsForUser).toHaveBeenCalledWith(
      'user-router-test',
      expect.objectContaining({ pageSize: 20, unreadOnly: false }),
    );
  });

  it('ROUTER-01-02: unauthorized role throws FORBIDDEN', async () => {
    const { ctx } = makeCtx(['sys_admin']); // sys_admin is not in allowedRoles for listMine
    const caller = notificationsRouter.createCaller(ctx);
    await expect(
      caller.listMine({ pageSize: 20, unreadOnly: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('ROUTER-01-03: sp_secretary can list notifications', async () => {
    const { ctx } = makeCtx(['sp_secretary']);
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.listMine({ pageSize: 5, unreadOnly: false });
    expect(result.items).toEqual([]);
  });

  it('ROUTER-01-04: user with effectiveRoles containing an allowed role passes ABAC gate', async () => {
    const { ctx } = makeCtx([], {}, { effectiveRoles: ['sp_member'] });
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.listMine({ pageSize: 20, unreadOnly: false });
    expect(result).toBeDefined();
  });

  // TASK-NOTIF-012 correction: real cursor pagination
  it('ROUTER-01-05: real second page — nextCursor is non-null when rows === pageSize, null on last page', async () => {
    const now = new Date('2024-03-01T10:00:00Z');
    // Page 1: pageSize = 2, returns exactly 2 rows → nextCursor is set
    const page1Rows = [
      { id: 'a0000001-0000-4000-8000-000000000001', createdAt: now, isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'Body 1', templateName: 'tmpl.a' },
      { id: 'a0000001-0000-4000-8000-000000000002', createdAt: new Date(now.getTime() - 1000), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'Body 2', templateName: 'tmpl.b' },
    ];
    const { ctx: ctx1 } = makeCtx(['dept_encoder'], {
      listNotificationsForUser: vi.fn().mockResolvedValue(page1Rows),
    });
    const caller1 = notificationsRouter.createCaller(ctx1);
    const result1 = await caller1.listMine({ pageSize: 2, unreadOnly: false });
    expect(result1.nextCursor).not.toBeNull();
    expect(result1.items).toHaveLength(2);

    // Page 2: with the cursor, returns 1 row (< pageSize) → nextCursor is null
    const page2Rows = [
      { id: 'a0000001-0000-4000-8000-000000000003', createdAt: new Date(now.getTime() - 2000), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'Body 3', templateName: 'tmpl.c' },
    ];
    const { ctx: ctx2 } = makeCtx(['dept_encoder'], {
      listNotificationsForUser: vi.fn().mockResolvedValue(page2Rows),
    });
    const caller2 = notificationsRouter.createCaller(ctx2);
    const result2 = await caller2.listMine({
      pageSize: 2,
      unreadOnly: false,
      cursor: result1.nextCursor,
    });
    expect(result2.nextCursor).toBeNull();
    expect(result2.items).toHaveLength(1);

    // Assert the items on page 1 and page 2 do not overlap
    const page1Ids = result1.items.map((i) => i.notificationId);
    const page2Ids = result2.items.map((i) => i.notificationId);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
  });

  it('ROUTER-01-06: two distinct users see only their own notifications (ABAC scoping)', async () => {
    const user1Rows = [{ id: 'b0000001-0000-4000-8000-000000000001', createdAt: new Date(), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'B1', templateName: 't1' }];
    const user2Rows = [{ id: 'b0000001-0000-4000-8000-000000000002', createdAt: new Date(), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'B2', templateName: 't2' }];

    const { ctx: ctxUser1, repo: repoUser1 } = makeCtx(
      ['dept_encoder'],
      { listNotificationsForUser: vi.fn().mockResolvedValue(user1Rows) },
      { userId: 'user-1' },
    );
    const { ctx: ctxUser2, repo: repoUser2 } = makeCtx(
      ['dept_encoder'],
      { listNotificationsForUser: vi.fn().mockResolvedValue(user2Rows) },
      { userId: 'user-2' },
    );

    const r1 = await notificationsRouter.createCaller(ctxUser1).listMine({ pageSize: 20, unreadOnly: false });
    const r2 = await notificationsRouter.createCaller(ctxUser2).listMine({ pageSize: 20, unreadOnly: false });

    // user-1's repo was called with user-1's userId
    expect(repoUser1.listNotificationsForUser).toHaveBeenCalledWith('user-1', expect.anything());
    // user-2's repo was called with user-2's userId
    expect(repoUser2.listNotificationsForUser).toHaveBeenCalledWith('user-2', expect.anything());
    // No overlap
    const ids1 = r1.items.map((i) => i.notificationId);
    const ids2 = r2.items.map((i) => i.notificationId);
    expect(ids1).not.toEqual(expect.arrayContaining(ids2));
  });

  it('ROUTER-01-07: unauthenticated caller (no session) throws UNAUTHORIZED', async () => {
    const caller = notificationsRouter.createCaller(makeUnauthenticatedCtx());
    await expect(
      caller.listMine({ pageSize: 20, unreadOnly: false }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ---------------------------------------------------------------------------
// Tests: markAsRead
// ---------------------------------------------------------------------------
describe('Router: markAsRead (NOTIF-ROUTER-02)', () => {
  it('ROUTER-02-01: owner marks own notification — returns { success: true }', async () => {
    const { ctx } = makeCtx(['dept_encoder'], {
      markNotificationRead: vi.fn().mockResolvedValue(true),
    });
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.markAsRead({
      notificationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result).toEqual({ success: true });
  });

  it('ROUTER-02-02: unauthorized role throws FORBIDDEN without calling repo', async () => {
    const { ctx, repo } = makeCtx(['plat_admin'], { markNotificationRead: vi.fn() }, { userId: 'user-X' });
    const caller = notificationsRouter.createCaller(ctx);
    await expect(
      caller.markAsRead({ notificationId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.markNotificationRead).not.toHaveBeenCalled();
  });

  // TASK-NOTIF-012 correction: cross-user attempt must throw FORBIDDEN, not silent no-op
  it('ROUTER-02-03: cross-user attempt throws FORBIDDEN', async () => {
    // repo.markNotificationRead returns false when WHERE id=X AND recipient_user_id=Y matches nothing
    const { ctx, repo } = makeCtx(
      ['dept_encoder'],
      { markNotificationRead: vi.fn().mockResolvedValue(false) },
      { userId: 'attacker-user' },
    );
    const caller = notificationsRouter.createCaller(ctx);
    await expect(
      caller.markAsRead({ notificationId: '22222222-2222-4222-8222-222222222222' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // markNotificationRead was called with attacker's userId — the WHERE clause enforced the scoping
    expect(repo.markNotificationRead).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'attacker-user',
    );
  });

  it('ROUTER-02-04: unauthenticated caller (no session) throws UNAUTHORIZED', async () => {
    const caller = notificationsRouter.createCaller(makeUnauthenticatedCtx());
    await expect(
      caller.markAsRead({ notificationId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ---------------------------------------------------------------------------
// Tests: listDeliveryLogs
// ---------------------------------------------------------------------------
describe('Router: listDeliveryLogs (NOTIF-ROUTER-03)', () => {
  it('ROUTER-03-01: sys_admin can list delivery logs', async () => {
    const { ctx } = makeCtx(['sys_admin']);
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.listDeliveryLogs({ pageSize: 20 });
    expect(result).toMatchObject({ items: [], nextCursor: null });
  });

  it('ROUTER-03-02: plat_admin can list delivery logs', async () => {
    const { ctx } = makeCtx(['plat_admin']);
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.listDeliveryLogs({ pageSize: 20 });
    expect(result).toBeDefined();
  });

  it('ROUTER-03-03: non-admin role throws FORBIDDEN', async () => {
    const { ctx } = makeCtx(['dept_encoder']);
    const caller = notificationsRouter.createCaller(ctx);
    await expect(
      caller.listDeliveryLogs({ pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // TASK-NOTIF-012 correction: real second-page cursor test
  it('ROUTER-03-04: real second page — nextCursor is set on full page, null on final page', async () => {
    const baseDate = new Date('2024-04-01T12:00:00Z');
    const page1Logs = [
      { deliveryLogId: 'c0000001-0000-4000-8000-000000000001', recipientUserId: 'd0000001-0000-4000-8000-000000000001', recipientEmail: null, channel: 'in_app', status: 'delivered', sentAt: baseDate },
      { deliveryLogId: 'c0000001-0000-4000-8000-000000000002', recipientUserId: 'd0000001-0000-4000-8000-000000000002', recipientEmail: null, channel: 'in_app', status: 'delivered', sentAt: new Date(baseDate.getTime() - 1000) },
    ];
    const { ctx: ctx1 } = makeCtx(['sys_admin'], { listDeliveryLogs: vi.fn().mockResolvedValue(page1Logs) });
    const r1 = await notificationsRouter.createCaller(ctx1).listDeliveryLogs({ pageSize: 2 });
    expect(r1.nextCursor).not.toBeNull();

    const page2Logs = [
      { deliveryLogId: 'c0000001-0000-4000-8000-000000000003', recipientUserId: 'd0000001-0000-4000-8000-000000000003', recipientEmail: null, channel: 'email', status: 'failed', sentAt: new Date(baseDate.getTime() - 2000) },
    ];
    const { ctx: ctx2 } = makeCtx(['sys_admin'], { listDeliveryLogs: vi.fn().mockResolvedValue(page2Logs) });
    const r2 = await notificationsRouter.createCaller(ctx2).listDeliveryLogs({
      pageSize: 2,
      cursor: r1.nextCursor,
    });
    expect(r2.nextCursor).toBeNull();
    expect(r2.items[0]?.deliveryLogId).toBe('c0000001-0000-4000-8000-000000000003');
  });

  it('ROUTER-03-05: unauthenticated caller (no session) throws UNAUTHORIZED', async () => {
    const caller = notificationsRouter.createCaller(makeUnauthenticatedCtx());
    await expect(caller.listDeliveryLogs({ pageSize: 20 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: getOwnPreferences / updateOwnPreferences
// ---------------------------------------------------------------------------
describe('Router: preferences procedures (NOTIF-ROUTER-04)', () => {
  it('ROUTER-04-01: getOwnPreferences returns the repo result', async () => {
    const prefs = [{ templateCategory: 'workflow', channel: 'in_app', enabled: true }];
    const { ctx } = makeCtx(['dept_encoder'], { getOwnPreferences: vi.fn().mockResolvedValue(prefs) });
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.getOwnPreferences();
    expect(result).toEqual({ preferences: prefs });
  });

  it('ROUTER-04-02: updateOwnPreferences calls updateOwnPreferences on repo then returns updated prefs', async () => {
    const updatedPrefs = [{ templateCategory: 'workflow', channel: 'in_app', enabled: false }];
    const { ctx, repo } = makeCtx(
      ['dept_encoder'],
      {
        updateOwnPreferences: vi.fn().mockResolvedValue(undefined),
        getOwnPreferences: vi.fn().mockResolvedValue(updatedPrefs),
      },
      { userId: 'user-prefs' },
    );
    const caller = notificationsRouter.createCaller(ctx);
    const result = await caller.updateOwnPreferences({
      channel: 'in_app',
      templateCategory: 'workflow',
      enabled: false,
    });
    expect(repo.updateOwnPreferences).toHaveBeenCalledWith('user-prefs', [
      { channel: 'in_app', templateCategory: 'workflow', enabled: false },
    ]);
    expect(result.preferences).toEqual(updatedPrefs);
  });

  it('ROUTER-04-03: unauthenticated caller (no session) throws UNAUTHORIZED', async () => {
    const caller = notificationsRouter.createCaller(makeUnauthenticatedCtx());
    await expect(caller.getOwnPreferences()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
