import type { InferSelectModel } from 'drizzle-orm';
import {
  templates,
  notificationEvents,
  deliveryLog,
} from '@batac/database/schema/notifications.schema.js';

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
}

export interface NotificationsPublicAPI {
  // To be implemented in TASK-NOTIF-004
}
