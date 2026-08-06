import type { InferSelectModel } from 'drizzle-orm';
import {
  templates,
  notificationEvents,
  deliveryLog,
} from '@batac/database/schema/notifications.schema.js';
import type { MailerService } from '../../infrastructure/mailer.service.js';

export type TemplateRecord = InferSelectModel<typeof templates>;
export type NotificationEventRecord = InferSelectModel<typeof notificationEvents>;
export type DeliveryLogRecord = InferSelectModel<typeof deliveryLog>;

export interface NotificationInput {
  recipientUserId?: string;       // for authenticated internal system users
  recipientEmail?: string;        // for external recipients (e.g. complaint respondents)
  recipientPhone?: string;        // Phase 3 — SMS gateway; Phase 1/2 logs phone_call_required
  templateId: string;             // the template's `name` column value (H4 calls this "template_key"), e.g. 'notif.workflow.step_assignment.in_app'
  templateData: Record<string, string>;  // variable substitutions for the template body
  channel: 'in_app' | 'email' | 'sms';
  sourceEventType?: string;       // caller-supplied optional source event type
}

export interface NotificationsPublicAPI {
  /**
   * Send a notification programmatically from outside the event bus flow.
   * Most notifications are triggered by event bus subscriptions (TASK-NOTIF-006
   * through -011). This method is the synchronous path for cases where the
   * caller needs delivery confirmation before proceeding, or where there is no
   * associated domain event. Primary caller: Portal module's Respondent Notice
   * Service (not yet built — Portal is Wave G; this API surface must exist and
   * be stable before that module's Step 2 pass runs).
   */
  sendNotification(input: NotificationInput): Promise<void>;
}
