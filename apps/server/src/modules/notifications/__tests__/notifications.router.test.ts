/**
 * TASK-NOTIF-014: notifications.router.test.ts
 *
 * Tests the notificationsRouter tRPC procedures. Pattern follows
 * organization.router.test.ts / tracking.router.test.ts — construct a ctx
 * with a roles array and call the procedure's resolver directly.
 *
 * ABAC is inline role-check logic (not requireRole/requirePolicy —
 * those functions do not exist in this codebase; see TASK-NOTIF-012 correction).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { notificationsRouter } from '../notifications.router.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal tRPC ctx
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

function makeCtx(
  roles: string[],
  repoOverrides: Record<string, any> = {},
  effectiveRoles?: string[],
) {
  const repo = makeRepo(repoOverrides);
  return {
    auth: {
      userId: 'user-router-test',
      roles,
      effectiveRoles: effectiveRoles ?? roles,
    },
    req: {
      server: {
        notificationsRepository: repo,
      },
    },
    _repo: repo, // convenience for assertions
  };
}

// Helper to extract the procedure query/mutation fn directly
// (mirrors how workflow.router.test.ts invokes procedures)
async function callQuery(procedure: any, ctx: any, input: any = {}) {
  return procedure._def.query({ ctx, input });
}

async function callMutation(procedure: any, ctx: any, input: any = {}) {
  return procedure._def.mutation({ ctx, input });
}

// ---------------------------------------------------------------------------
// Tests: listMine
// ---------------------------------------------------------------------------
describe('Router: listMine (NOTIF-ROUTER-01)', () => {
  it('ROUTER-01-01: allowed role (dept_encoder) can list notifications', async () => {
    const ctx = makeCtx(['dept_encoder']);
    const result = await callQuery(notificationsRouter._def.procedures.listMine, ctx, {
      pageSize: 20,
      unreadOnly: false,
    });
    expect(result).toMatchObject({ items: [], nextCursor: null });
    expect((ctx as any)._repo.listNotificationsForUser).toHaveBeenCalledWith(
      'user-router-test',
      expect.objectContaining({ pageSize: 20, unreadOnly: false }),
    );
  });

  it('ROUTER-01-02: unauthenticated / unauthorized role throws FORBIDDEN', async () => {
    const ctx = makeCtx(['sys_admin']); // sys_admin is not in allowedRoles for listMine
    await expect(
      callQuery(notificationsRouter._def.procedures.listMine, ctx, { pageSize: 20, unreadOnly: false }),
    ).rejects.toThrow(TRPCError);

    try {
      await callQuery(notificationsRouter._def.procedures.listMine, ctx, { pageSize: 20, unreadOnly: false });
    } catch (e: any) {
      expect(e.code).toBe('FORBIDDEN');
    }
  });

  it('ROUTER-01-03: sp_secretary can list notifications', async () => {
    const ctx = makeCtx(['sp_secretary']);
    const result = await callQuery(notificationsRouter._def.procedures.listMine, ctx, {
      pageSize: 5,
      unreadOnly: false,
    });
    expect(result.items).toEqual([]);
  });

  it('ROUTER-01-04: user with effectiveRoles containing an allowed role passes ABAC gate', async () => {
    const ctx = makeCtx([], {}, ['sp_member']);
    const result = await callQuery(notificationsRouter._def.procedures.listMine, ctx, {
      pageSize: 20,
      unreadOnly: false,
    });
    expect(result).toBeDefined();
  });

  // TASK-NOTIF-012 correction: real cursor pagination
  it('ROUTER-01-05: real second page — nextCursor is non-null when rows === pageSize, null on last page', async () => {
    const now = new Date('2024-03-01T10:00:00Z');
    // Page 1: pageSize = 2, returns exactly 2 rows → nextCursor is set
    const page1Rows = [
      { id: 'evt-01', createdAt: now, isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'Body 1', templateName: 'tmpl.a' },
      { id: 'evt-02', createdAt: new Date(now.getTime() - 1000), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'Body 2', templateName: 'tmpl.b' },
    ];
    const ctx1 = makeCtx(['dept_encoder'], {
      listNotificationsForUser: vi.fn().mockResolvedValue(page1Rows),
    });
    const result1 = await callQuery(notificationsRouter._def.procedures.listMine, ctx1, {
      pageSize: 2,
      unreadOnly: false,
    });
    expect(result1.nextCursor).not.toBeNull();
    expect(result1.items).toHaveLength(2);

    // Page 2: with the cursor, returns 1 row (< pageSize) → nextCursor is null
    const page2Rows = [
      { id: 'evt-03', createdAt: new Date(now.getTime() - 2000), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'Body 3', templateName: 'tmpl.c' },
    ];
    const ctx2 = makeCtx(['dept_encoder'], {
      listNotificationsForUser: vi.fn().mockResolvedValue(page2Rows),
    });
    const result2 = await callQuery(notificationsRouter._def.procedures.listMine, ctx2, {
      pageSize: 2,
      unreadOnly: false,
      cursor: result1.nextCursor,
    });
    expect(result2.nextCursor).toBeNull();
    expect(result2.items).toHaveLength(1);

    // Assert the items on page 1 and page 2 do not overlap
    const page1Ids = result1.items.map((i: any) => i.notificationId);
    const page2Ids = result2.items.map((i: any) => i.notificationId);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it('ROUTER-01-06: two distinct users see only their own notifications (ABAC scoping)', async () => {
    const user1Rows = [{ id: 'evt-u1', createdAt: new Date(), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'B1', templateName: 't1' }];
    const user2Rows = [{ id: 'evt-u2', createdAt: new Date(), isRead: false, templateData: {}, subjectTemplate: null, bodyTemplate: 'B2', templateName: 't2' }];

    const repoUser1 = makeRepo({ listNotificationsForUser: vi.fn().mockResolvedValue(user1Rows) });
    const ctxUser1 = {
      auth: { userId: 'user-1', roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] },
      req: { server: { notificationsRepository: repoUser1 } },
    };
    const repoUser2 = makeRepo({ listNotificationsForUser: vi.fn().mockResolvedValue(user2Rows) });
    const ctxUser2 = {
      auth: { userId: 'user-2', roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] },
      req: { server: { notificationsRepository: repoUser2 } },
    };

    const r1 = await callQuery(notificationsRouter._def.procedures.listMine, ctxUser1, { pageSize: 20, unreadOnly: false });
    const r2 = await callQuery(notificationsRouter._def.procedures.listMine, ctxUser2, { pageSize: 20, unreadOnly: false });

    // user-1's repo was called with user-1's userId
    expect(repoUser1.listNotificationsForUser).toHaveBeenCalledWith('user-1', expect.anything());
    // user-2's repo was called with user-2's userId
    expect(repoUser2.listNotificationsForUser).toHaveBeenCalledWith('user-2', expect.anything());
    // No overlap
    const ids1 = r1.items.map((i: any) => i.notificationId);
    const ids2 = r2.items.map((i: any) => i.notificationId);
    expect(ids1).not.toEqual(expect.arrayContaining(ids2));
  });
});

// ---------------------------------------------------------------------------
// Tests: markAsRead
// ---------------------------------------------------------------------------
describe('Router: markAsRead (NOTIF-ROUTER-02)', () => {
  it('ROUTER-02-01: owner marks own notification — returns { success: true }', async () => {
    const ctx = makeCtx(['dept_encoder'], {
      markNotificationRead: vi.fn().mockResolvedValue(true),
    });
    const result = await callMutation(notificationsRouter._def.procedures.markAsRead, ctx, {
      notificationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result).toEqual({ success: true });
  });

  it('ROUTER-02-02: unauthorized role throws FORBIDDEN without calling repo', async () => {
    const repo = makeRepo({ markNotificationRead: vi.fn() });
    const ctx = {
      auth: { userId: 'user-X', roles: ['plat_admin'], effectiveRoles: ['plat_admin'] },
      req: { server: { notificationsRepository: repo } },
    };
    await expect(
      callMutation(notificationsRouter._def.procedures.markAsRead, ctx, {
        notificationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.markNotificationRead).not.toHaveBeenCalled();
  });

  // TASK-NOTIF-012 correction: cross-user attempt must throw FORBIDDEN, not silent no-op
  it('ROUTER-02-03: cross-user attempt throws FORBIDDEN', async () => {
    // repo.markNotificationRead returns false when WHERE id=X AND recipient_user_id=Y matches nothing
    const repo = makeRepo({ markNotificationRead: vi.fn().mockResolvedValue(false) });
    const ctx = {
      auth: { userId: 'attacker-user', roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] },
      req: { server: { notificationsRepository: repo } },
    };
    await expect(
      callMutation(notificationsRouter._def.procedures.markAsRead, ctx, {
        notificationId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // markNotificationRead was called with attacker's userId — the WHERE clause enforced the scoping
    expect(repo.markNotificationRead).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'attacker-user',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: listDeliveryLogs
// ---------------------------------------------------------------------------
describe('Router: listDeliveryLogs (NOTIF-ROUTER-03)', () => {
  it('ROUTER-03-01: sys_admin can list delivery logs', async () => {
    const ctx = makeCtx(['sys_admin']);
    const result = await callQuery(notificationsRouter._def.procedures.listDeliveryLogs, ctx, {
      pageSize: 20,
    });
    expect(result).toMatchObject({ items: [], nextCursor: null });
  });

  it('ROUTER-03-02: plat_admin can list delivery logs', async () => {
    const ctx = makeCtx(['plat_admin']);
    const result = await callQuery(notificationsRouter._def.procedures.listDeliveryLogs, ctx, {
      pageSize: 20,
    });
    expect(result).toBeDefined();
  });

  it('ROUTER-03-03: non-admin role throws FORBIDDEN', async () => {
    const ctx = makeCtx(['dept_encoder']);
    await expect(
      callQuery(notificationsRouter._def.procedures.listDeliveryLogs, ctx, { pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // TASK-NOTIF-012 correction: real second-page cursor test
  it('ROUTER-03-04: real second page — nextCursor is set on full page, null on final page', async () => {
    const baseDate = new Date('2024-04-01T12:00:00Z');
    const page1Logs = [
      { deliveryLogId: 'log-01', recipientUserId: 'u1', recipientEmail: null, channel: 'in_app', status: 'delivered', sentAt: baseDate },
      { deliveryLogId: 'log-02', recipientUserId: 'u2', recipientEmail: null, channel: 'in_app', status: 'delivered', sentAt: new Date(baseDate.getTime() - 1000) },
    ];
    const ctx1 = makeCtx(['sys_admin'], { listDeliveryLogs: vi.fn().mockResolvedValue(page1Logs) });
    const r1 = await callQuery(notificationsRouter._def.procedures.listDeliveryLogs, ctx1, { pageSize: 2 });
    expect(r1.nextCursor).not.toBeNull();

    const page2Logs = [
      { deliveryLogId: 'log-03', recipientUserId: 'u3', recipientEmail: null, channel: 'email', status: 'failed', sentAt: new Date(baseDate.getTime() - 2000) },
    ];
    const ctx2 = makeCtx(['sys_admin'], { listDeliveryLogs: vi.fn().mockResolvedValue(page2Logs) });
    const r2 = await callQuery(notificationsRouter._def.procedures.listDeliveryLogs, ctx2, {
      pageSize: 2,
      cursor: r1.nextCursor,
    });
    expect(r2.nextCursor).toBeNull();
    expect(r2.items[0]?.deliveryLogId).toBe('log-03');
  });
});

// ---------------------------------------------------------------------------
// Tests: getOwnPreferences / updateOwnPreferences
// ---------------------------------------------------------------------------
describe('Router: preferences procedures (NOTIF-ROUTER-04)', () => {
  it('ROUTER-04-01: getOwnPreferences returns the repo result', async () => {
    const prefs = [{ templateCategory: 'workflow', channel: 'in_app', enabled: true }];
    const ctx = makeCtx(['dept_encoder'], { getOwnPreferences: vi.fn().mockResolvedValue(prefs) });
    const result = await callQuery(notificationsRouter._def.procedures.getOwnPreferences, ctx);
    expect(result).toEqual({ preferences: prefs });
  });

  it('ROUTER-04-02: updateOwnPreferences calls updateOwnPreferences on repo then returns updated prefs', async () => {
    const updatedPrefs = [{ templateCategory: 'workflow', channel: 'in_app', enabled: false }];
    const repo = makeRepo({
      updateOwnPreferences: vi.fn().mockResolvedValue(undefined),
      getOwnPreferences: vi.fn().mockResolvedValue(updatedPrefs),
    });
    const ctx = {
      auth: { userId: 'user-prefs', roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] },
      req: { server: { notificationsRepository: repo } },
    };
    const result = await callMutation(notificationsRouter._def.procedures.updateOwnPreferences, ctx, {
      channel: 'in_app',
      templateCategory: 'workflow',
      enabled: false,
    });
    expect(repo.updateOwnPreferences).toHaveBeenCalledWith('user-prefs', [
      { channel: 'in_app', templateCategory: 'workflow', enabled: false },
    ]);
    expect(result.preferences).toEqual(updatedPrefs);
  });
});
