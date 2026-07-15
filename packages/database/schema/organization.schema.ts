import {
  pgSchema,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  unique,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { roles } from './iam.schema.js';

/**
 * The `organization` PostgreSQL schema.
 *
 * Offices, positions, employees, assignments, delegation grants, committees,
 * committee memberships, and cross-office grants.
 *
 * Sources:
 *   C1 Part 4 DDL (L469–L695)
 *   B5 §6.5 / ADR-AUTH-009 (cross_office_grants + has_cross_office_read_grant)
 *   ADR-AUTH-011 (is_primary flag on assignments)
 */
export const organizationSchema = pgSchema('organization');

// ---------------------------------------------------------------------------
// organization.offices
// Self-referencing hierarchy of LGU offices.
// ---------------------------------------------------------------------------
export const offices = organizationSchema.table(
  'offices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    name: text('name').notNull(),
    code: text('code').notNull(),
    officeType: text('office_type').notNull(),
    /** Self-referencing FK for hierarchy. Same-schema FK is permitted. */
    parentOfficeId: uuid('parent_office_id').references((): AnyPgColumn => offices.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_offices_city_code').on(table.cityId, table.code),
    check('ck_offices_not_self_parent', sql`${table.id} <> ${table.parentOfficeId}`),
    check(
      'ck_offices_office_type',
      sql`${table.officeType} IN ('executive','legislative','department','barangay','external')`,
    ),
    index('idx_offices_parent').on(table.parentOfficeId),
  ],
);

// ---------------------------------------------------------------------------
// organization.positions
// Plantilla positions within an office.
// ---------------------------------------------------------------------------
export const positions = organizationSchema.table(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id),
    title: text('title').notNull(),
    code: text('code').notNull(),
    authorityLevel: text('authority_level').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_positions_city_code').on(table.cityId, table.code),
    check(
      'ck_positions_authority_level',
      sql`${table.authorityLevel} IN ('executive', 'managerial', 'staff', 'support')`,
    ),
    index('idx_positions_office').on(table.officeId),
  ],
);

// ---------------------------------------------------------------------------
// organization.employees
// City employees. Not every employee has a platform (IAM) account.
// employee_number NOT NULL (Decision 3.8). email NULL.
// ---------------------------------------------------------------------------
export const employees = organizationSchema.table(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id'), // logical FK → iam.users.id (cross-schema)
    employeeNumber: text('employee_number').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phoneNumber: text('phone_number'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_employees_city_number').on(table.cityId, table.employeeNumber),
    // One iam.users account maps to at most one employee (partial unique index).
    uniqueIndex('uq_employees_user_id')
      .on(table.userId)
      .where(sql`user_id IS NOT NULL AND deleted_at IS NULL`),
  ],
);

// ---------------------------------------------------------------------------
// organization.assignments
// Maps employees to positions/offices. is_primary ADR-AUTH-011.
// At most one active primary assignment per employee — enforced by partial
// unique index uq_assignments_one_primary_per_employee.
// ---------------------------------------------------------------------------
export const assignments = organizationSchema.table(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    positionId: uuid('position_id')
      .notNull()
      .references(() => positions.id),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isActive: boolean('is_active').notNull().default(true),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    check(
      'ck_assignments_dates',
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
    index('idx_assignments_employee').on(table.employeeId),
    index('idx_assignments_position').on(table.positionId),
    index('idx_assignments_office').on(table.officeId),
    // DB-level safety net for one-primary-per-employee invariant.
    uniqueIndex('uq_assignments_one_primary_per_employee')
      .on(table.employeeId)
      .where(sql`is_primary = true AND is_active = true AND deleted_at IS NULL`),
  ],
);

// ---------------------------------------------------------------------------
// organization.delegation_grants
// Temporary authority delegation. end_date NOT NULL (Decision 3.9).
// Table name is delegation_grants (not "delegations" — B2 stale reference).
// ---------------------------------------------------------------------------
export const delegationGrants = organizationSchema.table(
  'delegation_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    delegatingEmployeeId: uuid('delegating_employee_id')
      .notNull()
      .references(() => employees.id),
    delegatedToEmployeeId: uuid('delegated_to_employee_id')
      .notNull()
      .references(() => employees.id),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id),
    positionId: uuid('position_id')
      .notNull()
      .references(() => positions.id),
    /** logical FK → documents.documents.id (cross-schema) */
    designationDocumentId: uuid('designation_document_id'),
    scopeDescription: text('scope_description').notNull(),
    /**
     * Required shape: { "roles": [...], "office_ids": [...], "actions": [...] }
     * per B5 §5.7 ADR-AUTH-06.
     */
    scope: jsonb('scope')
      .notNull()
      .default(sql`'{}'::jsonb`),
    legalBasis: text('legal_basis'),
    startDate: date('start_date').notNull(),
    /** Open-ended delegations prohibited (Decision 3.9). */
    endDate: date('end_date').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    revokedBy: uuid('revoked_by'), // logical FK → iam.users.id (cross-schema)
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    check('ck_delegation_dates', sql`${table.endDate} > ${table.startDate}`),
    check(
      'ck_delegation_not_self',
      sql`${table.delegatingEmployeeId} <> ${table.delegatedToEmployeeId}`,
    ),
    check(
      'ck_delegation_revocation_consistency',
      sql`(${table.revokedAt} IS NULL) = (${table.isActive} = true) OR ${table.revokedAt} IS NOT NULL`,
    ),
    // Invariant #16: at most one active delegation per person at any time.
    uniqueIndex('uq_delegation_one_active_per_delegatee')
      .on(table.delegatedToEmployeeId)
      .where(sql`is_active = true AND deleted_at IS NULL`),
    index('idx_delegation_delegator').on(table.delegatingEmployeeId),
    index('idx_delegation_delegatee').on(table.delegatedToEmployeeId),
  ],
);

// ---------------------------------------------------------------------------
// organization.committees
// Legislative committees chaired by an employee.
// ---------------------------------------------------------------------------
export const committees = organizationSchema.table(
  'committees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    name: text('name').notNull(),
    code: text('code').notNull(),
    description: text('description'),
    chairedByEmployeeId: uuid('chaired_by_employee_id')
      .notNull()
      .references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [unique('uq_committees_city_code').on(table.cityId, table.code)],
);

// ---------------------------------------------------------------------------
// organization.committee_memberships
// Members within a committee with their role.
// ---------------------------------------------------------------------------
export const committeeMemberships = organizationSchema.table(
  'committee_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    committeeId: uuid('committee_id')
      .notNull()
      .references(() => committees.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    committeeRole: text('committee_role').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    check(
      'ck_committee_memberships_role',
      sql`${table.committeeRole} IN ('chairman','vice_chairman','member')`,
    ),
    // Exactly one active membership per person per committee at any time.
    uniqueIndex('uq_committee_membership_active')
      .on(table.committeeId, table.employeeId)
      .where(sql`is_active = true AND deleted_at IS NULL`),
    index('idx_committee_memberships_employee').on(table.employeeId),
  ],
);

// ---------------------------------------------------------------------------
// organization.cross_office_grants
// Security configuration table — INTENTIONAL convention deviations:
//   - No city_id (security config is global, not tenant-scoped)
//   - No updated_at / deleted_at / deleted_by (rows replaced, not soft-deleted)
//   - No fn_set_updated_at() trigger (no updated_at column)
//   - Cross-schema FK to iam.roles(id) is authorized exception per ADR-AUTH-009
// Seed data (4 rows from B5 §5.6) inserted by TASK-IAM-013.
// ---------------------------------------------------------------------------
export const crossOfficeGrants = organizationSchema.table(
  'cross_office_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Cross-schema FK to iam.roles(id) — authorized exception per ADR-AUTH-009. */
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    officeScope: text('office_scope').notNull(),
    accessLevel: text('access_level').notNull(),
    resourceTypes: text('resource_types').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('ck_cross_office_grants_office_scope', sql`${table.officeScope} IN ('all')`),
    check(
      'ck_cross_office_grants_access_level',
      sql`${table.accessLevel} IN ('metadata_only', 'full')`,
    ),
  ],
);
