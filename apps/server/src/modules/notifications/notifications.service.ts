import type { FastifyBaseLogger } from 'fastify';
import type { NotificationInput, NotificationsPublicAPI } from './notifications.types.js';
import type { NotificationsRepository } from './notifications.repository.js';
import { pushToUser } from './notifications.sse.js';

export interface NotificationsServiceDeps {
  repository: NotificationsRepository;
  logger: FastifyBaseLogger;
  mailer: import('../../infrastructure/mailer.service.js').MailerService;
}

export function createNotificationsService(deps: NotificationsServiceDeps): NotificationsPublicAPI {
  return {
    async sendNotification(input: NotificationInput): Promise<void> {
      // 1. Validation for email/sms channels
      if (input.channel === 'email' && !input.recipientEmail) {
        throw new Error("recipientEmail is required for 'email' channel");
      }
      if (input.channel === 'sms' && !input.recipientPhone) {
        throw new Error("recipientPhone is required for 'sms' channel");
      }

      try {
        const { repository, logger, mailer } = deps;

        // 2. Look up template
        let template = await repository.findActiveTemplateByNameAndChannel(
          input.templateId,
          input.channel,
        );

        if (!template) {
          logger.warn(`No active template found for name: ${input.templateId} and channel: ${input.channel}`);
          return; 
        }

        // 3. Render template strings: substitute {{variableName}} tokens
        const renderTemplate = (text: string | null) => {
          if (!text) return '';
          let rendered = text;
          const matches = rendered.match(/\{\{([^}]+)\}\}/g);
          if (matches) {
            for (const match of matches) {
              const key = match.slice(2, -2).trim();
              if (key in input.templateData) {
                rendered = rendered.replace(match, input.templateData[key]!);
              } else {
                logger.warn(`Unmatched template variable: ${key} in template ${input.templateId}`);
              }
            }
          }
          return rendered;
        };

        const renderedBody = renderTemplate(template.bodyTemplate);
        const renderedSubject = renderTemplate(template.subjectTemplate);

        // 4. Insert notification_events row
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

        // 5. Dispatch by channel
        if (input.channel === 'in_app') {
          if (input.recipientUserId) {
            pushToUser(input.recipientUserId, {
              notificationId: event.id,
              renderedBody,
              templateData: input.templateData,
            });
          }
          
          await repository.updateNotificationEventStatus(event.id, 'sent');
          await repository.insertDeliveryLogEntry({
            notificationEventId: event.id,
            status: 'delivered',
            deliveredAt: new Date(),
          });
        } else if (input.channel === 'email') {
          try {
            await mailer.sendEmail({
              to: input.recipientEmail!,
              subject: renderedSubject,
              text: renderedBody,
            });

            await repository.updateNotificationEventStatus(event.id, 'sent');
            await repository.insertDeliveryLogEntry({
              notificationEventId: event.id,
              status: 'delivered',
              deliveredAt: new Date(),
            });
          } catch (err: any) {
            await repository.updateNotificationEventStatus(event.id, 'failed');
            await repository.insertDeliveryLogEntry({
              notificationEventId: event.id,
              status: 'failed',
              errorMessage: err.message || 'Unknown email error',
            });
          }
        } else if (input.channel === 'sms') {
          // No SMS gateway exists in Phase 1 (H4 §3.3)
          await repository.updateNotificationEventStatus(event.id, 'sent');
          await repository.insertDeliveryLogEntry({
            notificationEventId: event.id,
            status: 'delivered',
            errorMessage: 'phone_call_required',
            deliveredAt: new Date(),
          });
        }

      } catch (err) {
        deps.logger.error({ err }, 'Error in sendNotification');
      }
    },
  };
}

