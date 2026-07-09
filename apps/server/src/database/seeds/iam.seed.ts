import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, roles, permissions, rolePermissions } from '@batac/database/schema/iam.schema.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// ────────── CONSTANTS ────────────────────────────────────────────────────────
const CITY_ID  = '00000000-0000-4000-8000-000000000001';
const SYS_USER = '00000000-0000-0000-0000-000000000001'; // sentinel for assigned_by

// Inline definition of organization.cross_office_grants for compile-time safety
// since the organization module migrations/schemas are in a different task (TASK-ORG-001)
const organizationSchema = pgSchema('organization');
const crossOfficeGrants = organizationSchema.table('cross_office_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').notNull(),
  officeScope: text('office_scope').notNull(),
  accessLevel: text('access_level').notNull(),
  resourceTypes: text('resource_types').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ────────── ROLE DEFINITIONS ──────────────────────────────────────────────────
const ROLE_DEFINITIONS = [
  { code: 'sys_admin', name: 'System Administrator', typeCode: 'sys_admin', isSystemRole: true, isPlatformAdmin: false, description: 'Infrastructure; no document content access' },
  { code: 'plat_admin', name: 'Platform Administrator', typeCode: 'platform_admin', isSystemRole: true, isPlatformAdmin: true, description: 'Configuration; no document processing' },
  { code: 'records_officer', name: 'Records Officer', typeCode: 'auditor', isSystemRole: false, isPlatformAdmin: false, description: 'Archiving, retention, disposition' },
  { code: 'dept_encoder', name: 'Department Encoder', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Create and submit documents for their office' },
  { code: 'dept_approver', name: 'Department Approver', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Approve documents at their office level' },
  { code: 'sp_secretary', name: 'SP Secretary', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Full SP legislative document lifecycle' },
  { code: 'sp_member', name: 'SP Member', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Review, comment, vote on legislative documents' },
  { code: 'sp_presiding_officer', name: 'SP Presiding Officer', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Certify SP legislative output' },
  { code: 'mayor', name: 'Mayor', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Highest executive approval authority' },
  { code: 'brgy_encoder', name: 'Barangay Encoder', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Submit documents on behalf of a barangay' },
  { code: 'brgy_captain', name: 'Barangay Captain', typeCode: 'document_processor', isSystemRole: false, isPlatformAdmin: false, description: 'Approve and sign barangay-originated documents' },
  { code: 'auditor', name: 'Auditor', typeCode: 'auditor', isSystemRole: false, isPlatformAdmin: false, description: 'Read-only: finalized documents and audit logs' },
  { code: 'citizen', name: 'Citizen', typeCode: 'citizen', isSystemRole: false, isPlatformAdmin: false, description: 'Public portal; own submitted requests and complaints only' },
];

// ────────── PERMISSION MATRIX MAPPING RULES ────────────────────────────────────
interface PermRule {
  resource: string;
  action: string;
  roles: Record<string, { decision: 'allow' | 'deny' | 'conditional'; conditionReference?: string }>;
}

const ALL_ROLES_LIST = ROLE_DEFINITIONS.map(r => r.code);

const buildRule = (
  resource: string,
  action: string,
  allowedRoles: Record<string, 'allow' | { decision: 'conditional'; conditionReference: string }>,
  naRoles: string[] = []
): PermRule => {
  const rolesMap: Record<string, { decision: 'allow' | 'deny' | 'conditional'; conditionReference?: string }> = {};

  for (const roleCode of ALL_ROLES_LIST) {
    if (naRoles.includes(roleCode)) {
      // N/A cell - omit from database
      continue;
    }

    const val = allowedRoles[roleCode];
    if (val === 'allow') {
      rolesMap[roleCode] = { decision: 'allow' };
    } else if (val && typeof val === 'object' && val.decision === 'conditional') {
      rolesMap[roleCode] = { decision: 'conditional', conditionReference: val.conditionReference };
    } else {
      rolesMap[roleCode] = { decision: 'deny' };
    }
  }

  return { resource, action, roles: rolesMap };
};

const PERMISSION_RULES: PermRule[] = [
  // ─── Section 1: IAM ────────────────────────────────────────────────────────
  buildRule('iam_user', 'create', { sys_admin: 'allow' }),
  buildRule('iam_user', 'read', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', sp_secretary: 'allow',
    sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§1-note-1' },
    dept_approver: { decision: 'conditional', conditionReference: 'I2-§1-note-1' },
    sp_member: { decision: 'conditional', conditionReference: 'I2-§1-note-1' }
  }),
  buildRule('iam_user', 'update', { sys_admin: 'allow', plat_admin: 'allow' }),
  buildRule('iam_user', 'deactivate', { sys_admin: 'allow', plat_admin: 'allow' }),
  buildRule('iam_user', 'view_directory', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', sp_secretary: 'allow',
    sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§1-note-1' },
    dept_approver: { decision: 'conditional', conditionReference: 'I2-§1-note-1' },
    sp_member: { decision: 'conditional', conditionReference: 'I2-§1-note-1' }
  }),
  buildRule('iam_user', 'view_own_profile', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', dept_encoder: 'allow',
    dept_approver: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow', auditor: 'allow', citizen: 'allow'
  }),
  buildRule('iam_user', 'edit_own_profile', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', dept_encoder: 'allow',
    dept_approver: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow', auditor: 'allow', citizen: 'allow'
  }),
  buildRule('iam_user', 'change_own_password', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', dept_encoder: 'allow',
    dept_approver: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow', auditor: 'allow', citizen: 'allow'
  }),
  buildRule('session', 'read_own', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', dept_encoder: 'allow',
    dept_approver: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow', auditor: 'allow', citizen: 'allow'
  }),
  buildRule('session', 'read_all', { sys_admin: 'allow' }),
  buildRule('session', 'force_terminate', { sys_admin: 'allow' }),
  buildRule('session', 'register_citizen', { citizen: 'allow', sp_secretary: 'allow' }, ['sys_admin', 'plat_admin', 'records_officer', 'dept_encoder', 'dept_approver', 'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain', 'auditor']),
  buildRule('role', 'assign', { plat_admin: 'allow' }),
  buildRule('role', 'revoke', { plat_admin: 'allow' }),

  // ─── Section 2: Organization Structure ─────────────────────────────────────────
  buildRule('organization', 'create_office', { plat_admin: 'allow' }),
  buildRule('organization', 'edit_office', { plat_admin: 'allow' }),
  buildRule('organization', 'deactivate_office', { plat_admin: 'allow' }),
  buildRule('organization', 'create_position', { plat_admin: 'allow' }),
  buildRule('organization', 'edit_position', { plat_admin: 'allow' }),
  buildRule('organization', 'create_employee', { plat_admin: 'allow' }),
  buildRule('organization', 'edit_employee', { plat_admin: 'allow' }),
  buildRule('organization', 'assign_employee', { plat_admin: 'allow' }),
  buildRule('organization', 'view_org_chart', {
    sys_admin: 'allow', plat_admin: 'allow', records_officer: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§2-note-2' },
    dept_approver: { decision: 'conditional', conditionReference: 'I2-§2-note-2' }
  }),
  buildRule('delegation_grant', 'create', {
    sp_secretary: { decision: 'conditional', conditionReference: 'I2-§2-note-3' },
    mayor: { decision: 'conditional', conditionReference: 'I2-§2-note-3' }
  }),
  buildRule('delegation_grant', 'revoke_early', {
    sp_secretary: { decision: 'conditional', conditionReference: 'I2-§2-note-4' },
    sp_presiding_officer: { decision: 'conditional', conditionReference: 'I2-§2-note-4' },
    mayor: { decision: 'conditional', conditionReference: 'I2-§2-note-4' }
  }),
  buildRule('delegation_grant', 'read', {
    sys_admin: 'allow', plat_admin: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', auditor: 'allow'
  }),

  // ─── Section 3: Platform Configuration ─────────────────────────────────────────
  buildRule('platform', 'manage_document_types', { plat_admin: 'allow' }),
  buildRule('platform', 'manage_workflows', { plat_admin: 'allow' }),
  buildRule('platform', 'manage_roles', { plat_admin: 'allow' }),
  buildRule('platform', 'manage_sla', { plat_admin: 'allow' }),
  buildRule('platform', 'manage_notifications', { plat_admin: 'allow' }),
  buildRule('platform', 'manage_retention', {
    plat_admin: 'allow',
    records_officer: { decision: 'conditional', conditionReference: 'I2-§3-note-5' }
  }),
  buildRule('platform', 'manage_visibility_rules', { plat_admin: 'allow' }),
  buildRule('platform', 'manage_committees', { plat_admin: 'allow' }),
  buildRule('platform', 'health_metrics', { sys_admin: 'allow' }),
  buildRule('platform', 'manage_keys', { sys_admin: 'allow' }),
  buildRule('platform', 'run_migrations', { sys_admin: 'allow' }),
  buildRule('platform', 'manage_backups', { sys_admin: 'allow' }),

  // ─── Section 4: Document Creation and Submission ─────────────────────────────────────────
  buildRule('document', 'create', {
    dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow',
    brgy_encoder: 'allow', brgy_captain: 'allow'
  }),
  buildRule('document', 'update', {
    dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow',
    sp_member: { decision: 'conditional', conditionReference: 'I2-§4-note-6' }
  }),
  buildRule('document', 'cancel', {
    dept_approver: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow', mayor: 'allow',
    brgy_captain: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§4-note-7' },
    brgy_encoder: { decision: 'conditional', conditionReference: 'I2-§4-note-7' }
  }),
  buildRule('document', 'submit', {
    dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow',
    brgy_encoder: 'allow', brgy_captain: 'allow'
  }),
  buildRule('document', 'number_assign', { sp_secretary: 'allow' }),
  buildRule('document', 'number_promote', { sp_secretary: 'allow' }),
  buildRule('document', 'certify_urgent', { sp_secretary: 'allow' }),

  // ─── Section 5: Document Viewing and Search ─────────────────────────────────────────
  buildRule('document', 'read_metadata', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow', auditor: 'allow'
  }),
  buildRule('document', 'read_file', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow',
    auditor: 'allow',
    sp_member: { decision: 'conditional', conditionReference: 'I2-§5-note-8' },
    citizen: { decision: 'conditional', conditionReference: 'I2-§5-note-11' }
  }),

  // ─── Section 6: Workflow Execution ─────────────────────────────────────────
  buildRule('workflow_instance', 'read', {
    plat_admin: 'allow', records_officer: 'allow', sp_secretary: 'allow',
    sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    dept_approver: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    sp_member: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    brgy_encoder: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    brgy_captain: { decision: 'conditional', conditionReference: 'I2-§6-note-10' }
  }),
  buildRule('workflow_instance', 'migrate', { plat_admin: 'allow' }),
  buildRule('workflow_step_instance', 'read', {
    plat_admin: 'allow', records_officer: 'allow', sp_secretary: 'allow',
    sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    dept_approver: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    sp_member: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    brgy_encoder: { decision: 'conditional', conditionReference: 'I2-§6-note-10' },
    brgy_captain: { decision: 'conditional', conditionReference: 'I2-§6-note-10' }
  }),
  buildRule('workflow_step_instance', 'complete_action', {
    dept_approver: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_captain: 'allow',
    dept_encoder: { decision: 'conditional', conditionReference: 'I2-§6-note-12' },
    brgy_encoder: { decision: 'conditional', conditionReference: 'I2-§6-note-12' }
  }),
  buildRule('workflow_step_instance', 'approve', { dept_approver: 'allow', sp_secretary: 'allow', mayor: 'allow', brgy_captain: 'allow' }),
  buildRule('workflow_step_instance', 'reject', { dept_approver: 'allow', sp_secretary: 'allow', mayor: 'allow', brgy_captain: 'allow' }),
  buildRule('workflow_step_instance', 'return', { dept_approver: 'allow', sp_secretary: 'allow', mayor: 'allow', brgy_captain: 'allow' }),
  buildRule('workflow_step_instance', 'certify', { sp_presiding_officer: 'allow' }),
  buildRule('workflow_step_instance', 'mayor_sign', { mayor: 'allow' }),
  buildRule('workflow_step_instance', 'mayor_veto', { mayor: 'allow' }),
  buildRule('workflow_step_instance', 'submit_committee_report', {
    sp_secretary: 'allow',
    sp_member: { decision: 'conditional', conditionReference: 'I2-§6-note-14' }
  }),
  buildRule('workflow_step_instance', 'advance', { sp_secretary: 'allow' }),
  buildRule('workflow_step_instance', 'secretariat_decision', { sp_secretary: 'allow' }),
  buildRule('workflow_step_instance', 'panlalawigan_review', { sp_secretary: 'allow' }),

  // ─── Section 7: Document Tracking (DTS) ─────────────────────────────────────────
  buildRule('tracking_record', 'read', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow', auditor: 'allow'
  }),
  buildRule('tracking_record', 'scan_qr_internal', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow', auditor: 'allow'
  }),
  buildRule('tracking_record', 'scan_qr_public', { citizen: 'allow' }, ['sys_admin', 'plat_admin', 'records_officer', 'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain', 'auditor']),
  buildRule('routing_entry', 'create', { sp_secretary: 'allow' }),
  buildRule('qr_code', 'print', { sp_secretary: 'allow' }),

  // ─── Section 8: Session Attendance and Order of Business ─────────────────────────────────────────
  buildRule('session_attendance', 'manage', { sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),
  buildRule('order_of_business', 'manage', { sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),

  // ─── Section 9: Signature Recording ─────────────────────────────────────────
  buildRule('signature', 'upload', { dept_approver: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_captain: 'allow' }),
  buildRule('signature', 'validate', {
    records_officer: 'allow', sp_secretary: 'allow',
    dept_encoder: 'allow', dept_approver: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_encoder: 'allow', brgy_captain: 'allow', auditor: 'allow'
  }),

  // ─── Section 10: Records Management (RMS) ─────────────────────────────────────────
  buildRule('records', 'promote', { records_officer: 'allow', sp_secretary: 'allow' }),
  buildRule('records', 'set_retention', { records_officer: 'allow', plat_admin: 'allow', sp_secretary: 'allow', auditor: 'allow' }),
  buildRule('records', 'archive', { records_officer: 'allow', sp_secretary: 'allow' }),
  buildRule('records', 'legal_hold', { records_officer: 'allow' }),
  buildRule('records', 'bulk_export', {
    records_officer: { decision: 'conditional', conditionReference: 'I2-§10-note-16' }
  }),
  buildRule('records', 'pii_erase', {
    records_officer: { decision: 'conditional', conditionReference: 'I2-§10-note-17' }
  }),
  buildRule('document', 'archive', { records_officer: 'allow', sp_secretary: 'allow' }),
  buildRule('document', 'export', { records_officer: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),
  buildRule('document', 'bulk_archive', { records_officer: 'allow' }),
  buildRule('document', 'bulk_export', {
    records_officer: { decision: 'conditional', conditionReference: 'I2-§10-note-16' }
  }),

  // ─── Section 11: Notifications ─────────────────────────────────────────
  buildRule('notification', 'receive', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow',
    citizen: { decision: 'conditional', conditionReference: 'I2-§11-note-18' }
  }, ['sys_admin', 'plat_admin', 'auditor']),
  buildRule('notification', 'manage_preferences', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow', citizen: 'allow', auditor: 'allow'
  }, ['sys_admin', 'plat_admin']),
  buildRule('notification', 'configure_templates', { plat_admin: 'allow', sys_admin: 'allow' }),

  // ─── Section 12: Citizen Complaints ─────────────────────────────────────────
  buildRule('complaint', 'file', { citizen: 'allow', sp_secretary: 'allow' }),
  buildRule('complaint', 'assign', { sp_secretary: 'allow' }),
  buildRule('complaint', 'set_outcome', {
    sp_secretary: 'allow',
    sp_member: { decision: 'conditional', conditionReference: 'I2-§12-note-14' }
  }),
  buildRule('complaint', 'read_own', { citizen: 'allow' }),
  buildRule('complaint', 'read_respondent', {
    citizen: { decision: 'conditional', conditionReference: 'I2-§12-note-18' }
  }),
  buildRule('complaint', 'read_all', {
    sp_secretary: 'allow', sp_presiding_officer: 'allow', auditor: 'allow',
    sp_member: { decision: 'conditional', conditionReference: 'I2-§12-note-14' }
  }),

  // ─── Section 13: Document and Records Request ─────────────────────────────────────────
  buildRule('document_request', 'create_self', { citizen: 'allow' }),
  buildRule('document_request', 'create_assisted', { sp_secretary: 'allow', citizen: 'allow' }),
  buildRule('document_request', 'approve_vice_mayor', { sp_presiding_officer: 'allow' }),
  buildRule('document_request', 'approve_secretary', { sp_secretary: 'allow' }),
  buildRule('document_request', 'release_copy', { sp_secretary: 'allow', sp_presiding_officer: 'allow', auditor: 'allow' }),

  // ─── Section 14: Public Portal Access ─────────────────────────────────────────
  buildRule('portal', 'view_public', { citizen: 'allow' }, ['sys_admin', 'plat_admin', 'records_officer', 'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain', 'auditor']),
  buildRule('portal', 'publish', { sp_secretary: 'allow' }),
  buildRule('portal', 'post_announcement', { plat_admin: 'allow', sp_secretary: 'allow' }),

  // ─── Section 15: Audit Log ─────────────────────────────────────────
  buildRule('audit_event', 'write', {}),
  buildRule('audit_event', 'read_own', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow', auditor: 'allow'
  }),
  buildRule('audit_event', 'read_office', {
    records_officer: 'allow', dept_approver: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow',
    mayor: 'allow', brgy_captain: 'allow', auditor: 'allow'
  }),
  buildRule('audit_event', 'read_full', { sys_admin: 'allow', auditor: 'allow' }),
  buildRule('audit_event', 'validate_chain', { sys_admin: 'allow', auditor: 'allow' }),
  buildRule('audit_event', 'export', { auditor: 'allow' }),

  // ─── Section 16: Reporting and Dashboards ─────────────────────────────────────────
  buildRule('report', 'view_dashboard', { sp_secretary: 'allow', mayor: 'allow' }),
  buildRule('report', 'view_task_inbox', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow'
  }),
  buildRule('report', 'view_sla', { records_officer: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),
  buildRule('report', 'view_panlalawigan_summary', { records_officer: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),
  buildRule('report', 'view_index', { records_officer: 'allow', sp_secretary: 'allow', sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),
  buildRule('report', 'create_definition', { plat_admin: 'allow' }),
  buildRule('report', 'run', { plat_admin: 'allow', records_officer: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow' }),
  buildRule('report', 'export', {
    plat_admin: 'allow', sp_secretary: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', auditor: 'allow',
    records_officer: { decision: 'conditional', conditionReference: 'I2-§16-note-16' }
  }),

  // ─── Section 17: OCR and File Processing ─────────────────────────────────────────
  buildRule('ocr', 'view_quality', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow'
  }),
  buildRule('ocr', 'reupload', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow'
  }),
  buildRule('ocr', 'retrigger', { records_officer: 'allow', sp_secretary: 'allow' }),
  buildRule('ocr', 'view_extracted_text', {
    records_officer: 'allow', dept_encoder: 'allow', dept_approver: 'allow', sp_secretary: 'allow',
    sp_member: 'allow', sp_presiding_officer: 'allow', mayor: 'allow', brgy_encoder: 'allow',
    brgy_captain: 'allow', auditor: 'allow'
  }),
];

// ────────── CROSS OFFICE GRANTS ────────────────────────────────────────────────
const CROSS_OFFICE_GRANTS = [
  {
    roleCode: 'records_officer',
    officeScope: 'all',
    accessLevel: 'metadata_only',
    resourceTypes: ['document'],
  },
  {
    roleCode: 'sp_secretary',
    officeScope: 'all',
    accessLevel: 'full',
    resourceTypes: ['document', 'workflow_step_instance'],
  },
  {
    roleCode: 'plat_admin',
    officeScope: 'all',
    accessLevel: 'metadata_only',
    resourceTypes: ['organization', 'workflow_definition'],
  },
  {
    roleCode: 'sys_admin',
    officeScope: 'all',
    accessLevel: 'metadata_only',
    resourceTypes: ['audit_event', 'session'],
  },
] as const;

import { fileURLToPath } from 'node:url';

// ────────── MAIN SEED FUNCTION ─────────────────────────────────────────────────
export async function seedIam(db: any) {
  await db.transaction(async (tx: any) => {
    console.log('[seed] Step 1: Inserting system user sentinel...');
      await tx.insert(users).values({
        id: SYS_USER,
        cityId: CITY_ID,
        username: 'system',
        email: 'system@internal.batac.gov.ph',
        status: 'inactive',
      }).onConflictDoNothing();

      console.log('[seed] Step 2: Inserting roles...');
      const roleMap: Record<string, string> = {};
      let rolesSeeded = 0;

      for (const roleDef of ROLE_DEFINITIONS) {
        // Query if role already exists to fetch its UUID, ensuring idempotency
        const existing = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(sql`${roles.code} = ${roleDef.code}`)
          .limit(1);

        const firstRole = existing[0];
        if (firstRole) {
          roleMap[roleDef.code] = firstRole.id;
        } else {
          const newId = randomUUID();
          await tx.insert(roles).values({
            id: newId,
            cityId: CITY_ID,
            name: roleDef.name,
            code: roleDef.code,
            typeCode: roleDef.typeCode,
            isSystemRole: roleDef.isSystemRole,
            isPlatformAdmin: roleDef.isPlatformAdmin,
            description: roleDef.description,
          });
          roleMap[roleDef.code] = newId;
          rolesSeeded++;
        }
      }

      console.log('[seed] Step 3: Inserting permissions catalog...');
      const permMap: Record<string, string> = {};
      let permsSeeded = 0;

      for (const rule of PERMISSION_RULES) {
        const permKey = `${rule.resource}:${rule.action}`;
        const existing = await tx
          .select({ id: permissions.id })
          .from(permissions)
          .where(sql`${permissions.resource} = ${rule.resource} AND ${permissions.action} = ${rule.action}`)
          .limit(1);

        const firstPerm = existing[0];
        if (firstPerm) {
          permMap[permKey] = firstPerm.id;
        } else {
          const newId = randomUUID();
          await tx.insert(permissions).values({
            id: newId,
            cityId: CITY_ID,
            resource: rule.resource,
            action: rule.action,
            description: `Allows action ${rule.action} on resource ${rule.resource}`,
          });
          permMap[permKey] = newId;
          permsSeeded++;
        }
      }

      console.log('[seed] Step 4: Inserting role permissions matrix entries...');
      let matrixEntriesSeeded = 0;

      for (const rule of PERMISSION_RULES) {
        const permKey = `${rule.resource}:${rule.action}`;
        const permId = permMap[permKey];

        for (const [roleCode, dec] of Object.entries(rule.roles)) {
          const roleId = roleMap[roleCode];

          if (!roleId || !permId) {
            continue;
          }

          // Use ON CONFLICT DO NOTHING for idempotency
          await tx.insert(rolePermissions).values({
            roleId,
            permissionId: permId,
            decision: dec.decision,
            conditionReference: dec.conditionReference || null,
          }).onConflictDoNothing();

          matrixEntriesSeeded++;
        }
      }

      console.log('[seed] Step 5: Seeding cross-office grants...');
      // Safely check if organization schema and cross_office_grants table exist in the DB
      const tableCheck = await tx.execute(sql`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'organization' 
            AND table_name = 'cross_office_grants'
        ) as exists;
      `);
      
      const tableExists = tableCheck[0]?.['exists'] === true;

      if (!tableExists) {
        console.warn(
          '[seed] Warning: Table "organization.cross_office_grants" does not exist yet. ' +
          'Skipping step 5 cross-office grants seeding (expected if TASK-ORG-001 has not run).'
        );
      } else {
        let grantsSeeded = 0;
        for (const grant of CROSS_OFFICE_GRANTS) {
          const roleId = roleMap[grant.roleCode];
          if (!roleId) {
            console.error(`[seed] Role code "${grant.roleCode}" not found in role map, cannot seed cross-office grant.`);
            continue;
          }

          // We insert into organization.cross_office_grants
          await tx.insert(crossOfficeGrants).values({
            roleId,
            officeScope: grant.officeScope,
            accessLevel: grant.accessLevel,
            resourceTypes: grant.resourceTypes as unknown as string[],
          }).onConflictDoNothing();
          grantsSeeded++;
        }
        console.log(`[seed] Seeded: ${grantsSeeded} cross-office grants.`);
      }

      console.log(`Seeded: ${rolesSeeded} new roles (total ${Object.keys(roleMap).length} mapped), ${permsSeeded} new permissions (total ${Object.keys(permMap).length} cataloged), ${matrixEntriesSeeded} role_permission entries.`);
  });
}

async function main() {
  const databaseUrl = process.env['DATABASE_URL_MIGRATE'] || process.env['DATABASE_URL_APP'];
  if (!databaseUrl) {
    console.error('[seed] Error: DATABASE_URL_MIGRATE or DATABASE_URL_APP environment variable is not set.');
    process.exit(1);
  }
  console.log('[seed] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    await seedIam(db);
  } catch (error) {
    console.error('[seed] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[seed] Unhandled error during seeding:', err);
    process.exit(1);
  });
}
