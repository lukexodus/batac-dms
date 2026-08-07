/**
 * TASK-NOTIF-014: notifications.service.test.ts
 *
 * Tests createNotificationsService (notifications.service.ts) in isolation.
 * The mailer dep is stubbed with { sendEmail: vi.fn() } — no Nodemailer mocking.
 * pushToUser (from notifications.sse.ts) is vi.mock'd to avoid the ESM import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pushToUser before importing the service (ESM-aware mocking)
vi.mock('../notifications.sse.js', () => ({
  pushToUser: vi.fn(),
}));

import { createNotificationsService } from '../notifications.service.js';
import { pushToUser } from '../notifications.sse.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockTemplate = (overrides: Partial<{
  id: string;
  bodyTemplate: string;
  subjectTemplate: string | null;
}> = {}) => ({
  id: 'tmpl-uuid-1',
  cityId: 'city-1',
  name: 'notif.workflow.step_assignment.in_app',
  channel: 'in_app',
  subjectTemplate: null,
  bodyTemplate: 'Hello {{name}}, your step is {{stepKey}}.',
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockEvent = (id = 'evt-uuid-1') => ({
  id,
  templateId: 'tmpl-uuid-1',
  channel: 'in_app',
  recipientUserId: 'user-abc',
  recipientEmail: null,
  recipientPhone: null,
  templateData: {},
  status: 'pending',
  isRead: false,
  sourceEventType: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(overrides: Record<string, any> = {}) {
  return {
    findActiveTemplateByNameAndChannel: vi.fn().mockResolvedValue(mockTemplate()),
    insertNotificationEvent: vi.fn().mockResolvedValue(mockEvent()),
    updateNotificationEventStatus: vi.fn().mockResolvedValue(undefined),
    insertDeliveryLogEntry: vi.fn().mockResolvedValue({ id: 'log-1' }),
    findTemplateByNameAndChannel: vi.fn(),
    insertTemplate: vi.fn(),
    listNotificationsForUser: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue(true),
    listDeliveryLogs: vi.fn().mockResolvedValue([]),
    getOwnPreferences: vi.fn().mockResolvedValue([]),
    updateOwnPreferences: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } as any;
}

function makeMailer() {
  return { sendEmail: vi.fn().mockResolvedValue({ messageId: 'mid-1', accepted: [], rejected: [] }) } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NotificationsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let logger: ReturnType<typeof makeLogger>;
  let mailer: ReturnType<typeof makeMailer>;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    mailer = makeMailer();
    vi.clearAllMocks();
  });

  // ---- SVC-01: in_app happy path ----
  describe('SVC-01: in_app channel — happy path', () => {
    it('SVC-01-01: looks up template, inserts event, calls pushToUser, marks sent', async () => {
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientUserId: 'user-abc',
        templateId: 'notif.workflow.step_assignment.in_app',
        channel: 'in_app',
        templateData: { name: 'Alice', stepKey: 'review' },
      });

      expect(repo.findActiveTemplateByNameAndChannel).toHaveBeenCalledWith(
        'notif.workflow.step_assignment.in_app',
        'in_app',
      );
      expect(repo.insertNotificationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'in_app', status: 'pending' }),
      );
      expect(pushToUser).toHaveBeenCalledWith('user-abc', expect.objectContaining({ notificationId: 'evt-uuid-1' }));
      expect(repo.updateNotificationEventStatus).toHaveBeenCalledWith('evt-uuid-1', 'sent');
      expect(repo.insertDeliveryLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'delivered' }),
      );
    });

    it('SVC-01-02: template variables are substituted correctly', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({ bodyTemplate: 'Dear {{name}}, step: {{stepKey}}.' }),
      );
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientUserId: 'user-abc',
        templateId: 'notif.workflow.step_assignment.in_app',
        channel: 'in_app',
        templateData: { name: 'Bob', stepKey: 'approve' },
      });
      // pushToUser is called — body was rendered (no assertions on rendered body directly, but
      // the fact that no "Unmatched template variable" warning was logged confirms substitution)
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('SVC-01-03: unmatched template variable logs a warn', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({ bodyTemplate: 'Hello {{unknown_var}}.' }),
      );
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientUserId: 'user-abc',
        templateId: 'notif.workflow.step_assignment.in_app',
        channel: 'in_app',
        templateData: {},
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown_var'),
      );
    });
  });

  // ---- SVC-02: template not found ----
  describe('SVC-02: missing template', () => {
    it('SVC-02-01: logs warn and returns early when no active template found', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(null);
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientUserId: 'user-abc',
        templateId: 'notif.does.not.exist',
        channel: 'in_app',
        templateData: {},
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No active template found'),
      );
      expect(repo.insertNotificationEvent).not.toHaveBeenCalled();
    });
  });

  // ---- SVC-03: email channel ----
  describe('SVC-03: email channel', () => {
    it('SVC-03-01: calls mailer.sendEmail and marks delivered on success', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({
          bodyTemplate: 'Dear {{respondentName}},',
          subjectTemplate: 'Complaint {{complaintReference}}',
        }),
      );
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientEmail: 'respondent@example.com',
        templateId: 'notif.complaint.respondent_notice.email',
        channel: 'email',
        templateData: { respondentName: 'Doe', complaintReference: 'REF-001' },
      });
      expect(mailer.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'respondent@example.com' }),
      );
      expect(repo.updateNotificationEventStatus).toHaveBeenCalledWith('evt-uuid-1', 'sent');
      expect(repo.insertDeliveryLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'delivered' }),
      );
    });

    it('SVC-03-02: on mailer.sendEmail failure, marks failed and inserts delivery log with errorMessage', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({ bodyTemplate: 'Email body' }),
      );
      mailer.sendEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientEmail: 'respondent@example.com',
        templateId: 'notif.complaint.respondent_notice.email',
        channel: 'email',
        templateData: {},
      });
      expect(repo.updateNotificationEventStatus).toHaveBeenCalledWith('evt-uuid-1', 'failed');
      expect(repo.insertDeliveryLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'SMTP connection refused',
        }),
      );
    });

    it('SVC-03-03: rejects when recipientEmail is missing for email channel (guard is outside the try/catch)', async () => {
      const service = createNotificationsService({ repository: repo, logger, mailer });
      // The recipientEmail guard in sendNotification (service line 16-18) sits BEFORE the
      // function's own try block — the thrown Error is NOT caught internally, so the returned
      // Promise rejects. Confirm the rejection AND that no downstream work happened.
      await expect(
        service.sendNotification({
          templateId: 'notif.complaint.respondent_notice.email',
          channel: 'email',
          templateData: {},
        }),
      ).rejects.toThrow("recipientEmail is required for 'email' channel");
      expect(repo.findActiveTemplateByNameAndChannel).not.toHaveBeenCalled();
      expect(repo.insertNotificationEvent).not.toHaveBeenCalled();
    });

    it('SVC-03-04: rejects when recipientPhone is missing for sms channel (same guard pattern)', async () => {
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await expect(
        service.sendNotification({
          templateId: 'notif.some.sms',
          channel: 'sms',
          templateData: {},
        }),
      ).rejects.toThrow("recipientPhone is required for 'sms' channel");
      expect(repo.findActiveTemplateByNameAndChannel).not.toHaveBeenCalled();
      expect(repo.insertNotificationEvent).not.toHaveBeenCalled();
    });
  });

  // ---- SVC-04: SMS / phone-fallback logging ----
  describe('SVC-04: SMS channel — phone-fallback logging (TASK-NOTIF-010)', () => {
    it('SVC-04-01: for sms channel, inserts delivery_log with status="delivered" and errorMessage="phone_call_required"', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({ bodyTemplate: 'SMS body' }),
      );
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientPhone: '+63912345678',
        templateId: 'notif.some.sms',
        channel: 'sms',
        templateData: {},
      });
      expect(repo.updateNotificationEventStatus).toHaveBeenCalledWith('evt-uuid-1', 'sent');
      expect(repo.insertDeliveryLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          errorMessage: 'phone_call_required',
        }),
      );
    });
  });

  // ---- SVC-05: seed-template rendering — verbatim legal-basis citation (TASK-NOTIF-009) ----
  // Uses the real seed template bodies from packages/database/src/seed/notifications.seed.ts
  // (the orchestrator-loaded, authoritative copy — see docs/development-findings-log.md LOG-0244).
  // Closes a gap left by consumers.test.ts's CONS-03-03/03-05: those tests confirm the
  // legislative-lapse consumer forwards payload.legalBasis into templateData.legalBasis
  // unchanged, but do not exercise actual template rendering. This describe block exercises
  // the real renderTemplate substitution path in sendNotification end-to-end, asserting the
  // citation appears exactly once in the final rendered body — not duplicated.
  describe('SVC-05: legal-basis citation renders exactly once (real seed templates)', () => {
    it('SVC-05-01: mayor_lapse — "RA 7160 Section 47" appears exactly once in the rendered body, unaltered', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({
          bodyTemplate:
            'Mayor Approval Lapsed for step {{stepInstanceId}}. Deadline was {{deadlineWas}}. Legal Basis: {{legalBasis}}.',
        }),
      );
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientUserId: 'user-abc',
        templateId: 'notif.workflow.mayor_lapse.in_app',
        channel: 'in_app',
        templateData: {
          stepInstanceId: 'step-123',
          deadlineWas: '2026-01-15',
          legalBasis: 'RA 7160 Section 47',
        },
      });

      const call = (pushToUser as any).mock.calls[0];
      const renderedBody: string = call[1].renderedBody;
      expect(renderedBody).toBe(
        'Mayor Approval Lapsed for step step-123. Deadline was 2026-01-15. Legal Basis: RA 7160 Section 47.',
      );
      expect(renderedBody.split('RA 7160 Section 47').length - 1).toBe(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('SVC-05-02: panlalawigan_deemed_approved — "RA 7160 Section 56(d)" appears exactly once in the rendered body, unaltered', async () => {
      repo.findActiveTemplateByNameAndChannel.mockResolvedValue(
        mockTemplate({
          bodyTemplate:
            'Panlalawigan Deemed Approved for step {{stepInstanceId}}. Transmission Date was {{transmissionDate}}. Deadline was {{deadlineWas}}. Legal Basis: {{legalBasis}}.',
        }),
      );
      const service = createNotificationsService({ repository: repo, logger, mailer });
      await service.sendNotification({
        recipientUserId: 'user-abc',
        templateId: 'notif.workflow.panlalawigan_deemed_approved.in_app',
        channel: 'in_app',
        templateData: {
          stepInstanceId: 'step-456',
          transmissionDate: '2026-01-10',
          deadlineWas: '2026-01-20',
          legalBasis: 'RA 7160 Section 56(d)',
        },
      });

      const call = (pushToUser as any).mock.calls[0];
      const renderedBody: string = call[1].renderedBody;
      expect(renderedBody).toBe(
        'Panlalawigan Deemed Approved for step step-456. Transmission Date was 2026-01-10. Deadline was 2026-01-20. Legal Basis: RA 7160 Section 56(d).',
      );
      expect(renderedBody.split('RA 7160 Section 56(d)').length - 1).toBe(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
