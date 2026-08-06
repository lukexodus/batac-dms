import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { templates } from '@batac/database/schema/notifications.schema.js';
import { fileURLToPath } from 'url';

const CITY_ID = '00000000-0000-4000-8000-000000000001';

export async function seedNotificationTemplates(db: any) {
  console.log('🌱 Seeding notifications.templates...');

  const seedRows = [
    {
      cityId: CITY_ID,
      name: 'notif.workflow.step_assignment.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'You have been assigned to step "{{stepKey}}" ({{stepType}}) for document {{documentId}}. Due: {{dueAt}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.document.state_changed.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Document {{documentId}} state changed from {{fromState}} to {{toState}} by {{actorId}}. Reason: {{reason}}',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.sla_warning.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Warning: SLA deadline {{slaDeadline}} is approaching ({{percentElapsed}}%). Instance: {{instanceId}}',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.sla_breach.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Breach: SLA deadline {{slaDeadline}} was breached at {{breachedAt}} (detected: {{breachDetectedAt}}). Instance: {{instanceId}}',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.sla_critical.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Critical: SLA deadline {{slaDeadline}} is critically overdue ({{percentElapsed}}%). Instance: {{instanceId}}',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.mayor_lapse.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Mayor approval has lapsed (deadline was {{deadlineWas}}). Please confirm docketing. Legal basis: {{legalBasis}} (RA 7160 Section 47)',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.panlalawigan_deemed_approved.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Panlalawigan approval is deemed approved (transmitted: {{transmissionDate}}, deadline was {{deadlineWas}}). Please record as Lapsed 30 days. Legal basis: {{legalBasis}} (RA 7160 Section 56(d))',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.complaint.respondent_notice.email',
      channel: 'email',
      subjectTemplate: 'Notice Regarding Complaint {{complaintReference}} — {{lguOffice}}',
      bodyTemplate: 'Dear {{respondentName}},\n\nA complaint ({{complaintReference}}) regarding "{{complaintSubject}}" has been filed at {{lguOffice}}. Please contact the secretariat at {{secretariatContactInfo}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.iam.session_displaced.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Your previous session ({{oldSessionId}}) was terminated because a new login was detected from IP {{newIpAddress}} (new session: {{newSessionId}}). If you did not initiate this login, please contact IT Admin immediately.',
      isActive: true,
    }
  ];

  await db
    .insert(templates)
    .values(seedRows)
    .onConflictDoUpdate({
      target: [templates.cityId, templates.name, templates.channel],
      set: { isActive: true },
    });
}

async function main() {
  const databaseUrl = process.env['DATABASE_URL_MIGRATE'];
  if (!databaseUrl) {
    console.error(
      '[seed:notifications] Error: DATABASE_URL_MIGRATE environment variable is not set.',
    );
    process.exit(1);
  }

  console.log('[seed:notifications] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await seedNotificationTemplates(db);
    console.log('[seed:notifications] Seeding completed successfully.');
  } catch (error) {
    console.error('[seed:notifications] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// @ts-ignore
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[seed:notifications] Unhandled error during seeding:', err);
    process.exit(1);
  });
}
