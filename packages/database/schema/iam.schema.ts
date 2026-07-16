import {
  pgSchema,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  inet,
  unique,
  index,
  uniqueIndex,
  primaryKey,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `iam` PostgreSQL schema.
 *
 * Authentication, session control, JWT token storage, and role/permission resolution.
 *
 * Sources: C1 Part 3 DDL, B5 Authentication and Authorization Architecture.
 */
export const iamSchema = pgSchema('iam');

/**
 * iam.users table
 * Login-capable identities.
 */
export const users = iamSchema.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    username: text('username').notNull(),
    email: text('email').notNull(),
    status: text('status').notNull().default('active'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    loginFailureCount: integer('login_failure_count').notNull().default(0),
    loginLockedUntil: timestamp('login_locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_users_city_username').on(table.cityId, table.username),
    unique('uq_users_city_email').on(table.cityId, table.email),
    check(
      'users_status_check',
      sql`${table.status} IN ('active','inactive','suspended','deactivated')`,
    ),
  ],
);

/**
 * iam.credentials table
 * 1:1 with iam.users.
 */
export const credentials = iamSchema.table(
  'credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    passwordHash: text('password_hash').notNull(),
    lastChangedAt: timestamp('last_changed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [unique('uq_credentials_user').on(table.userId)],
);

/**
 * iam.sessions table
 * One active session per user enforced via partial unique index.
 */
export const sessions = iamSchema.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    sessionTokenHash: text('session_token_hash').notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    locked_at: timestamp('locked_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    terminatedAt: timestamp('terminated_at', { withTimezone: true }),
    terminatedBy: uuid('terminated_by').references(() => users.id),
    terminationReason: text('termination_reason'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_sessions_token_hash').on(table.sessionTokenHash),
    check(
      'ck_sessions_termination_consistency',
      sql`(${table.terminatedAt} IS NULL) = (${table.terminationReason} IS NULL)`,
    ),
    check(
      'sessions_termination_reason_check',
      sql`${table.terminationReason} IN ('logout','inactivity','forced','replaced','expired','lock')`,
    ),
    uniqueIndex('idx_sessions_one_active_per_user')
      .on(table.userId)
      .where(sql`active = true AND deleted_at IS NULL`),
    index('idx_sessions_user').on(table.userId),
  ],
);

/**
 * iam.refresh_tokens table
 * Server-side DB, hashed + salted value for token rotation.
 */
export const refreshTokens = iamSchema.table(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    tokenHash: text('token_hash').notNull(),
    salt: text('salt').notNull(),
    familyId: uuid('family_id').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
    replacedBy: uuid('replaced_by').references((): AnyPgColumn => refreshTokens.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_refresh_tokens_hash').on(table.tokenHash),
    check(
      'refresh_tokens_revocation_reason_check',
      sql`${table.revocationReason} IN ('logout','reuse_detected','forced','family_revoked','replaced')`,
    ),
    index('idx_rt_user_id').on(table.userId),
    index('idx_rt_family_id').on(table.familyId),
    index('idx_rt_expires_at')
      .on(table.expiresAt)
  ],
);

/**
 * iam.password_reset_tokens table
 * Server-side DB, hashed + salted value for one-time password reset.
 */
export const passwordResetTokens = iamSchema.table(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    salt: text('salt').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_password_reset_tokens_hash').on(table.tokenHash),
    index('idx_prt_user_id').on(table.userId),
  ],
);

/**
 * iam.roles table
 * System and operational roles.
 */
export const roles = iamSchema.table(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    name: text('name').notNull(),
    code: text('code').notNull(),
    description: text('description'),
    typeCode: text('type_code').notNull(),
    isSystemRole: boolean('is_system_role').notNull().default(false),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_roles_city_code').on(table.cityId, table.code),
    check(
      'roles_type_code_check',
      sql`${table.typeCode} IN ('platform_admin','document_processor','sys_admin','auditor','citizen')`,
    ),
  ],
);

/**
 * iam.permissions table
 */
export const permissions = iamSchema.table(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_permissions_city_resource_action').on(table.cityId, table.resource, table.action),
  ],
);

/**
 * iam.role_permissions table
 */
export const rolePermissions = iamSchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id),
    decision: text('decision').notNull(),
    conditionReference: text('condition_reference'),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    check(
      'role_permissions_decision_check',
      sql`${table.decision} IN ('allow','deny','conditional')`,
    ),
    check(
      'ck_role_permissions_condition_required',
      sql`${table.decision} <> 'conditional' OR ${table.conditionReference} IS NOT NULL`,
    ),
  ],
);

/**
 * iam.role_assignments table
 */
export const roleAssignments = iamSchema.table(
  'role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    officeScopeId: uuid('office_scope_id'), // logical FK -> organization.offices.id (cross-schema)
    revokedBy: uuid('revoked_by').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    check(
      'ck_role_assignments_revocation_consistency',
      sql`(${table.revokedAt} IS NULL) = (${table.isActive} = true)`,
    ),
    uniqueIndex('uq_role_assignments_active')
      .on(
        table.userId,
        table.roleId,
        sql`coalesce(${table.officeScopeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`is_active = true AND deleted_at IS NULL`),
    index('idx_role_assignments_user')
      .on(table.userId)
      .where(sql`is_active = true`),
    index('idx_role_assignments_role').on(table.roleId),
  ],
);

/**
 * iam.mfa_records table
 */
export const mfaRecords = iamSchema.table(
  'mfa_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    method: text('method').notNull().default('totp'),
    secretEncrypted: text('secret_encrypted').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    enabledAt: timestamp('enabled_at', { withTimezone: true }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_mfa_records_user_method').on(table.userId, table.method),
    check('mfa_records_method_check', sql`${table.method} IN ('totp')`),
  ],
);
