import type { FastifyBaseLogger } from 'fastify';
import type { NotificationInput, NotificationsPublicAPI } from './notifications.types.js';
import type { NotificationsRepository } from './notifications.repository.js';
import { pushToUser } from './notifications.sse.js';

export interface NotificationsServiceDeps {
  repository: NotificationsRepository;
  logger: FastifyBaseLogger;
}

export function createNotificationsService(deps: NotificationsServiceDeps): NotificationsPublicAPI {
  return {
    async sendNotification(input: NotificationInput): Promise<void> {
      try {
        const { repository, logger } = deps;

        // 1. Look up template
        let template = await repository.findActiveTemplateByNameAndChannel(
          input.templateId,
          input.channel,
        );

        if (!template) {
          // No active template exists for this templateId/channel pair. Per
          // project-owner decision, this case writes nothing to either
          // notification_events or delivery_log — the missing-template
          // condition is logged and dispatch is abandoned for this call.
          // Do not attempt to synthesize a template row to satisfy any
          // foreign key; notifications.templates is an administrator-managed
          // table (H4 §8.1) and must not receive application-generated rows.
          logger.warn(`No active template found for name: ${input.templateId} and channel: ${input.channel}`);
          return; // Do not throw
        }

        // 2. Render body: substitute {{variableName}} tokens
        let renderedBody = template.bodyTemplate;
        const matches = renderedBody.match(/\{\{([^}]+)\}\}/g);
        
        if (matches) {
          for (const match of matches) {
            const key = match.slice(2, -2).trim(); // Remove {{ and }}
            if (key in input.templateData) {
              renderedBody = renderedBody.replace(match, input.templateData[key]!);
            } else {
              logger.warn(`Unmatched template variable: ${key} in template ${input.templateId}`);
            }
          }
        }

        // 3. Insert notification_events row
        const event = await repository.insertNotificationEvent({
          templateId: template.id,
          channel: input.channel,
          recipientUserId: input.recipientUserId ?? null,
          recipientEmail: input.recipientEmail ?? null,
          recipientPhone: input.recipientPhone ?? null,
          templateData: input.templateData,
          status: 'pending',
          sourceEventType: input.sourceEventType ?? null,
        });

        // 4. Dispatch by channel
        if (input.channel === 'in_app') {
          if (input.recipientUserId) {
            pushToUser(input.recipientUserId, {
              notificationId: event.id,
              renderedBody,
              templateData: input.templateData,
            });
          }
          
          // 5. Update notification_events.status = 'sent'
          await repository.updateNotificationEventStatus(event.id, 'sent');
          
          // 6. Insert delivery_log row
          await repository.insertDeliveryLogEntry({
            notificationEventId: event.id,
            status: 'delivered',
            deliveredAt: new Date(),
          });
        } else {
          // 'email' / 'sms': delegate to TASK-NOTIF-010's channel handler
          // Stub for TASK-NOTIF-010:
          // TODO: channel handler logic goes here
          // The handler will call back into this same notification_events row via its id
        }

      } catch (err) {
        // Log the error but do not throw (B3 §2.4/§9 Rule 5: downstream handler failures must not propagate back)
        deps.logger.error({ err }, 'Error in sendNotification');
      }
    },
  };
}
