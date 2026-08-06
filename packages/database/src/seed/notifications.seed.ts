import { sql } from 'drizzle-orm';
import { templates } from '../../schema/notifications.schema.js';

export async function seedNotifications(db: any) {
  console.log('🌱 Seeding notifications.templates...');

  const CITY_ID = '00000000-0000-4000-8000-000000000001';

  const seedRows = [
    {
      cityId: CITY_ID,
      name: 'notif.workflow.step_assignment.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'You have been assigned to a step: {{stepType}} ({{stepKey}}) for Document #{{documentSeriesNumber}} ({{documentTitle}}). Due: {{dueAt}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.document.state_changed.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Document #{{documentId}} state changed from {{fromState}} to {{toState}} by {{actorId}}. Reason: {{reason}}',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.sla_warning.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'SLA Warning (80% elapsed): Step {{stepInstanceId}} is due at {{slaDeadline}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.sla_breach.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'SLA Breach (100% elapsed): Step {{stepInstanceId}} was due at {{slaDeadline}}. Breached at {{breachedAt}} (detected at {{breachDetectedAt}}).',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.sla_critical.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'SLA Critical (150% elapsed): Step {{stepInstanceId}} is critically overdue since {{slaDeadline}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.mayor_lapse.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Mayor Approval Lapsed for step {{stepInstanceId}}. Deadline was {{deadlineWas}}. Legal Basis: {{legalBasis}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.workflow.panlalawigan_deemed_approved.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'Panlalawigan Deemed Approved for step {{stepInstanceId}}. Transmission Date was {{transmissionDate}}. Deadline was {{deadlineWas}}. Legal Basis: {{legalBasis}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.complaint.respondent_notice.email',
      channel: 'email',
      subjectTemplate: 'Notice Regarding Complaint {{complaintReference}} — {{lguOffice}}',
      bodyTemplate: 'Dear {{respondentName}},\n\nThis is a formal notice regarding Complaint {{complaintReference}} ({{complaintSubject}}). Please contact the {{lguOffice}} at {{secretariatContactInfo}}.',
      isActive: true,
    },
    {
      cityId: CITY_ID,
      name: 'notif.iam.session_displaced.in_app',
      channel: 'in_app',
      subjectTemplate: null,
      bodyTemplate: 'A new login has replaced your previous session (from {{newIpAddress}}). If this wasn\'t you, please contact IT Admin immediately.',
      isActive: true,
    },
  ];

  for (const row of seedRows) {
    await db.insert(templates).values(row).onConflictDoUpdate({
      target: [templates.cityId, templates.name, templates.channel],
      set: {
        isActive: true,
      },
    });
  }

  console.log('✅ Seeded notifications.templates');
}
