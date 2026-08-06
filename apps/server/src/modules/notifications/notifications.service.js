import { pushToUser } from './notifications.sse.js';
export function createNotificationsService(deps) {
    return {
        async sendNotification(input) {
            try {
                const { repository, logger } = deps;
                // 1. Look up template
                let template = await repository.findActiveTemplateByNameAndChannel(input.templateId, input.channel);
                if (!template) {
                    logger.warn(`No active template found for name: ${input.templateId} and channel: ${input.channel}`);
                    // Fallback to find any template (e.g. inactive) to satisfy the FK constraint for logging
                    let fallback = await repository.findTemplateByNameAndChannel(input.templateId, input.channel);
                    if (!fallback) {
                        // Create a system fallback template on the fly if it literally doesn't exist
                        // This is required because notification_events.template_id is NOT NULL
                        fallback = await repository.insertTemplate({
                            name: input.templateId,
                            channel: input.channel,
                            bodyTemplate: 'Fallback system template for missing template errors',
                            isActive: false,
                        });
                    }
                    const event = await repository.insertNotificationEvent({
                        templateId: fallback.id,
                        channel: input.channel,
                        recipientUserId: input.recipientUserId ?? null,
                        recipientEmail: input.recipientEmail ?? null,
                        recipientPhone: input.recipientPhone ?? null,
                        templateData: input.templateData,
                        status: 'failed',
                        sourceEventType: null, // As requested in the missing template case
                    });
                    await repository.insertDeliveryLogEntry({
                        notificationEventId: event.id,
                        status: 'failed',
                        errorMessage: `No active template for ${input.templateId}/${input.channel}`,
                    });
                    return; // Do not throw
                }
                // 2. Render body: substitute {{variableName}} tokens
                let renderedBody = template.bodyTemplate;
                const matches = renderedBody.match(/\{\{([^}]+)\}\}/g);
                if (matches) {
                    for (const match of matches) {
                        const key = match.slice(2, -2).trim(); // Remove {{ and }}
                        if (key in input.templateData) {
                            renderedBody = renderedBody.replace(match, input.templateData[key]);
                        }
                        else {
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
                }
                else {
                    // 'email' / 'sms': delegate to TASK-NOTIF-010's channel handler
                    // Stub for TASK-NOTIF-010:
                    // TODO: channel handler logic goes here
                    // The handler will call back into this same notification_events row via its id
                }
            }
            catch (err) {
                // Log the error but do not throw (B3 §2.4/§9 Rule 5: downstream handler failures must not propagate back)
                deps.logger.error({ err }, 'Error in sendNotification');
            }
        },
    };
}
