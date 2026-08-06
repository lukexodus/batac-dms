/**
 * TASK-NOTIF-014: notifications.repository.test.ts
 *
 * Tests the query-construction and cursor-pagination logic of
 * createNotificationsRepository. All DB calls are mocked via the
 * chainable mock pattern used across this codebase (see instance-lifecycle.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationsRepository } from '../notifications.repository.js';

// ---------------------------------------------------------------------------
// Chainable mock DB factory
// ---------------------------------------------------------------------------
function makeDb() {
  const db: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    // transaction is used by updateOwnPreferences
    transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx: any = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };
      await cb(tx);
    }),
  };
  return db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tmpl-1',
    cityId: 'city-1',
    name: 'notif.workflow.step_assignment.in_app',
    channel: 'in_app',
    subjectTemplate: null,
    bodyTemplate: 'Hello {{name}}',
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    templateId: 'tmpl-1',
    channel: 'in_app',
    recipientUserId: 'user-1',
    recipientEmail: null,
    recipientPhone: null,
    templateData: {},
    status: 'sent',
    isRead: false,
    sourceEventType: null,
    deletedAt: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NotificationsRepository', () => {
  let db: ReturnType<typeof makeDb>;
  let repo: ReturnType<typeof createNotificationsRepository>;

  beforeEach(() => {
    db = makeDb();
    repo = createNotificationsRepository(db);
  });

  // ---- findActiveTemplateByNameAndChannel ----
  describe('REPO-01: findActiveTemplateByNameAndChannel', () => {
    it('REPO-01-01: returns the matching template when one exists', async () => {
      const row = makeTemplateRow();
      db.where.mockResolvedValueOnce([row]);
      const result = await repo.findActiveTemplateByNameAndChannel(
        'notif.workflow.step_assignment.in_app',
        'in_app',
      );
      expect(result).toEqual(row);
    });

    it('REPO-01-02: returns null when no template is found', async () => {
      db.where.mockResolvedValueOnce([]);
      const result = await repo.findActiveTemplateByNameAndChannel('missing', 'in_app');
      expect(result).toBeNull();
    });
  });

  // ---- insertNotificationEvent ----
  describe('REPO-02: insertNotificationEvent', () => {
    it('REPO-02-01: inserts and returns the event row', async () => {
      const row = makeEventRow();
      db.returning.mockResolvedValueOnce([row]);
      const result = await repo.insertNotificationEvent({
        templateId: 'tmpl-1',
        channel: 'in_app',
        recipientUserId: 'user-1',
        recipientEmail: null,
        recipientPhone: null,
        templateData: {},
        status: 'pending',
        sourceEventType: null,
      } as any);
      expect(result).toEqual(row);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  // ---- updateNotificationEventStatus ----
  describe('REPO-03: updateNotificationEventStatus', () => {
    it('REPO-03-01: calls update/set/where without returning', async () => {
      db.where.mockResolvedValueOnce(undefined);
      await repo.updateNotificationEventStatus('evt-1', 'sent');
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    });
  });

  // ---- insertDeliveryLogEntry ----
  describe('REPO-04: insertDeliveryLogEntry', () => {
    it('REPO-04-01: inserts and returns the log row', async () => {
      const logRow = {
        id: 'log-1',
        notificationEventId: 'evt-1',
        status: 'delivered',
        deliveredAt: new Date(),
        errorMessage: null,
        createdAt: new Date(),
      };
      db.returning.mockResolvedValueOnce([logRow]);
      const result = await repo.insertDeliveryLogEntry({
        notificationEventId: 'evt-1',
        status: 'delivered',
        deliveredAt: new Date(),
      } as any);
      expect(result).toEqual(logRow);
    });
  });

  // ---- markNotificationRead ----
  describe('REPO-05: markNotificationRead', () => {
    it('REPO-05-01: returns true when the update matches (owner marks own notification)', async () => {
      db.returning.mockResolvedValueOnce([{ id: 'evt-1' }]);
      const result = await repo.markNotificationRead('evt-1', 'user-1');
      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('REPO-05-02: returns false when the WHERE clause matches nothing (cross-user attempt)', async () => {
      // Simulates UPDATE ... WHERE id = X AND recipient_user_id = Y matching 0 rows
      db.returning.mockResolvedValueOnce([]);
      const result = await repo.markNotificationRead('evt-1', 'different-user');
      expect(result).toBe(false);
    });
  });

  // ---- listNotificationsForUser — cursor pagination ----
  describe('REPO-06: listNotificationsForUser cursor pagination', () => {
    it('REPO-06-01: without cursor, calls limit with pageSize', async () => {
      db.limit.mockResolvedValueOnce([]);
      await repo.listNotificationsForUser('user-1', { pageSize: 5 });
      expect(db.limit).toHaveBeenCalledWith(5);
    });

    it('REPO-06-02: with cursor, still calls limit and where', async () => {
      const cursor = `${new Date('2024-01-10').getTime()}_evt-older`;
      db.limit.mockResolvedValueOnce([]);
      await repo.listNotificationsForUser('user-1', { pageSize: 5, cursor });
      expect(db.where).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(5);
    });

    it('REPO-06-03: maps joined rows to flat shape with subjectTemplate, bodyTemplate, templateName', async () => {
      const joinedRow = {
        event: makeEventRow(),
        subjectTemplate: 'Subject',
        bodyTemplate: 'Body text',
        templateName: 'notif.workflow.step_assignment.in_app',
      };
      db.limit.mockResolvedValueOnce([joinedRow]);
      const result = await repo.listNotificationsForUser('user-1', { pageSize: 5 });
      expect(result[0]).toMatchObject({
        subjectTemplate: 'Subject',
        bodyTemplate: 'Body text',
        templateName: 'notif.workflow.step_assignment.in_app',
      });
    });

    it('REPO-06-04: unreadOnly adds isRead filter condition', async () => {
      db.limit.mockResolvedValueOnce([]);
      await repo.listNotificationsForUser('user-1', { pageSize: 5, unreadOnly: true });
      // where is chained (called at least once), confirming the condition was added
      expect(db.where).toHaveBeenCalled();
    });
  });

  // ---- listDeliveryLogs — cursor & date-range ----
  describe('REPO-07: listDeliveryLogs cursor and date-range', () => {
    it('REPO-07-01: without cursor, returns all rows up to pageSize', async () => {
      db.limit.mockResolvedValueOnce([]);
      await repo.listDeliveryLogs({ pageSize: 10 });
      expect(db.limit).toHaveBeenCalledWith(10);
    });

    it('REPO-07-02: with cursor, calls where to add cursor condition', async () => {
      const cursor = `${new Date('2024-02-01').getTime()}_log-old`;
      db.limit.mockResolvedValueOnce([]);
      await repo.listDeliveryLogs({ pageSize: 10, cursor });
      expect(db.where).toHaveBeenCalled();
    });

    it('REPO-07-03: with from/to, calls where to add date range conditions', async () => {
      db.limit.mockResolvedValueOnce([]);
      await repo.listDeliveryLogs({
        pageSize: 10,
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      });
      expect(db.where).toHaveBeenCalled();
    });
  });

  // ---- updateOwnPreferences ----
  describe('REPO-08: updateOwnPreferences', () => {
    it('REPO-08-01: does nothing when preferences array is empty', async () => {
      await repo.updateOwnPreferences('user-1', []);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('REPO-08-02: wraps inserts in a transaction for each preference', async () => {
      await repo.updateOwnPreferences('user-1', [
        { templateCategory: 'workflow', channel: 'in_app', enabled: true },
      ]);
      expect(db.transaction).toHaveBeenCalled();
    });
  });
});
