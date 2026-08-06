import { buildApp } from './app.js';
import { notificationEvents, deliveryLog, templates } from '@batac/database/schema/notifications.schema.js';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const app = await buildApp();

  let sendEmailCalled = 0;
  let lastSendEmailInput: any = null;
  let sendEmailShouldThrow = false;

  // Monkey-patch app.mailer.sendEmail
  const originalSendEmail = app.mailer.sendEmail;
  app.mailer.sendEmail = async (input: any) => {
    sendEmailCalled++;
    lastSendEmailInput = input;
    console.log('Intercepted mailer.sendEmail with:', JSON.stringify(input, null, 2));
    if (sendEmailShouldThrow) {
      throw new Error('Simulated SMTP rejection');
    }
    return { messageId: 'mock-message-id', accepted: [input.to], rejected: [] };
  };

  try {
    console.log('--- Test 1: Email success path ---');
    sendEmailCalled = 0;
    lastSendEmailInput = null;
    sendEmailShouldThrow = false;

    await app.notificationsService.sendNotification({
      channel: 'email',
      templateId: 'notif.complaint.respondent_notice.email',
      recipientEmail: 'respondent@example.com',
      templateData: {
        complaintReference: 'COMP-2024-001',
        respondentName: 'Jane Doe',
        complaintSubject: 'Noise Complaint',
        lguOffice: 'Mayor Office',
        secretariatContactInfo: '123-4567',
      },
    });

    let latestEvent = await app.db
      .select()
      .from(notificationEvents)
      .orderBy(desc(notificationEvents.createdAt))
      .limit(1)
      .then((r: any[]) => r[0]);

    let latestLog = await app.db
      .select()
      .from(deliveryLog)
      .where(eq(deliveryLog.notificationEventId, latestEvent.id))
      .orderBy(desc(deliveryLog.createdAt))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (latestEvent?.status !== 'sent') {
      throw new Error(`Test 1 Failed: expected event status "sent", got "${latestEvent?.status}"`);
    }
    if (latestLog?.status !== 'delivered' || latestLog?.deliveredAt === null) {
      throw new Error(
        `Test 1 Failed: expected delivery log status "delivered" with non-null deliveredAt. Got status="${latestLog?.status}", deliveredAt=${latestLog?.deliveredAt}`,
      );
    }
    if (sendEmailCalled !== 1) {
      throw new Error(`Test 1 Failed: expected mailer.sendEmail to be called 1 time, got ${sendEmailCalled}`);
    }
    if (!lastSendEmailInput?.subject?.includes('COMP-2024-001')) {
      throw new Error(
        `Test 1 Failed: expected mailer.sendEmail subject to contain "COMP-2024-001", got "${lastSendEmailInput?.subject}"`,
      );
    }
    console.log('Test 1 Passed: Email success path verified in database and mock.');

    console.log('--- Test 2: Email failure path ---');
    sendEmailCalled = 0;
    lastSendEmailInput = null;
    sendEmailShouldThrow = true;

    await app.notificationsService.sendNotification({
      channel: 'email',
      templateId: 'notif.complaint.respondent_notice.email',
      recipientEmail: 'fail@example.com',
      templateData: {
        complaintReference: 'COMP-2024-002',
        respondentName: 'John Smith',
        complaintSubject: 'Traffic',
        lguOffice: 'Traffic Office',
        secretariatContactInfo: '098-7654',
      },
    });

    latestEvent = await app.db
      .select()
      .from(notificationEvents)
      .orderBy(desc(notificationEvents.createdAt))
      .limit(1)
      .then((r: any[]) => r[0]);

    latestLog = await app.db
      .select()
      .from(deliveryLog)
      .where(eq(deliveryLog.notificationEventId, latestEvent.id))
      .orderBy(desc(deliveryLog.createdAt))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (latestEvent?.status !== 'failed') {
      throw new Error(`Test 2 Failed: expected event status "failed", got "${latestEvent?.status}"`);
    }
    if (latestLog?.status !== 'failed' || !latestLog?.errorMessage) {
      throw new Error(
        `Test 2 Failed: expected delivery log status "failed" with non-empty errorMessage. Got status="${latestLog?.status}", errorMessage="${latestLog?.errorMessage}"`,
      );
    }
    if (sendEmailCalled !== 1) {
      throw new Error(`Test 2 Failed: expected mailer.sendEmail to be called 1 time, got ${sendEmailCalled}`);
    }
    console.log('Test 2 Passed: Email failure path verified in database.');

    console.log('--- Test 3: SMS phone-fallback path ---');
    const testSmsTemplateName = 'test.notif010.sms_verification.sms';

    // Insert throwaway template row
    await app.db.insert(templates).values({
      cityId: '00000000-0000-4000-8000-000000000001',
      name: testSmsTemplateName,
      channel: 'sms',
      isActive: true,
      subjectTemplate: null,
      bodyTemplate: 'Test SMS: {{smsToken}}',
    });

    sendEmailCalled = 0;
    lastSendEmailInput = null;
    sendEmailShouldThrow = false;

    await app.notificationsService.sendNotification({
      channel: 'sms',
      templateId: testSmsTemplateName,
      recipientPhone: '+639123456789',
      templateData: { smsToken: 'hello_sms' },
    });

    latestEvent = await app.db
      .select()
      .from(notificationEvents)
      .orderBy(desc(notificationEvents.createdAt))
      .limit(1)
      .then((r: any[]) => r[0]);

    latestLog = await app.db
      .select()
      .from(deliveryLog)
      .where(eq(deliveryLog.notificationEventId, latestEvent.id))
      .orderBy(desc(deliveryLog.createdAt))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (latestEvent?.status !== 'sent') {
      throw new Error(`Test 3 Failed: expected event status "sent", got "${latestEvent?.status}"`);
    }
    if (latestLog?.status !== 'delivered' || latestLog?.errorMessage !== 'phone_call_required') {
      throw new Error(
        `Test 3 Failed: expected delivery log status "delivered" with errorMessage "phone_call_required". Got status="${latestLog?.status}", errorMessage="${latestLog?.errorMessage}"`,
      );
    }
    if (sendEmailCalled !== 0) {
      throw new Error(`Test 3 Failed: expected mailer.sendEmail to be called 0 times, got ${sendEmailCalled}`);
    }

    // Clean up throwaway row
    await app.db.delete(templates).where(eq(templates.name, testSmsTemplateName));

    console.log('Test 3 Passed: SMS phone-fallback path verified in database.');
  } finally {
    await app.close();
  }
}

main().catch(console.error);
