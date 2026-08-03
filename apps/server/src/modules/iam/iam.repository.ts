import { eq, and, or, isNull, desc, inArray, ilike, sql } from 'drizzle-orm';
import {
  users,
  credentials,
  sessions,
  refreshTokens,
  passwordResetTokens,
  roles,
  permissions,
  rolePermissions,
  roleAssignments,
  mfaRecords,
} from '@batac/database/schema/iam.schema.js';
import type { IamRepository, DbClient, DbTransaction, CredentialRow } from './iam.types.js';

export function createIamRepository(db: DbClient | DbTransaction): IamRepository {
  return {
    findUserById: async (id) => {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)));
      return user || null;
    },
    findUserByUsername: async (cityId, username) => {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(eq(users.cityId, cityId), eq(users.username, username), isNull(users.deletedAt)),
        );
      return user || null;
    },
    findUserByEmail: async (cityId, email) => {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.cityId, cityId), eq(users.email, email), isNull(users.deletedAt)));
      return user || null;
    },
    createUser: async (input) => {
      const [user] = await db.insert(users).values(input).returning();
      return user!;
    },
    updateUser: async (id, input) => {
      const [user] = await db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user!;
    },
    softDeleteUser: async (id, deletedBy) => {
      await db.update(users).set({ deletedAt: new Date(), deletedBy }).where(eq(users.id, id));
    },
    listUsers: async (cityId, opts) => {
      let query = db
        .select()
        .from(users)
        .where(and(eq(users.cityId, cityId), isNull(users.deletedAt)))
        .$dynamic();
      if (opts.search) {
        query = query.where(
          or(ilike(users.username, `%${opts.search}%`), ilike(users.email, `%${opts.search}%`)),
        );
      }
      return query.limit(opts.limit).offset(opts.offset);
    },
    updateLoginFailure: async (id, count, lockedUntil) => {
      await db
        .update(users)
        .set({ loginFailureCount: count, loginLockedUntil: lockedUntil, updatedAt: new Date() })
        .where(eq(users.id, id));
    },
    resetLoginFailure: async (id) => {
      await db
        .update(users)
        .set({ loginFailureCount: 0, loginLockedUntil: null, updatedAt: new Date() })
        .where(eq(users.id, id));
    },

    findCredentialByUserId: async (userId) => {
      // Uses iam.fn_get_credential_by_user_id (SECURITY DEFINER) instead
      // of a direct SELECT, because batac_app has no SELECT grant on
      // iam.credentials by design (0002_iam_create_iam_schema.sql line
      // 247). NOTE: db.execute() on a raw sql`...` query does NOT apply
      // Drizzle's camelCase schema mapping — that mapping only applies
      // to Drizzle's own query-builder methods (db.select().from(...)).
      // The SQL function's RETURNS TABLE clause
      // (packages/database/migrations/0013_iam_get_credential.sql)
      // returns snake_case column names as-is, so this method maps them
      // to CredentialRow's camelCase keys explicitly, rather than
      // relying on the db.execute<CredentialRow>(...) generic — which
      // is a compile-time type assertion only and has no runtime
      // effect. See docs/development-findings-log.md, [LOG entry for
      // this bug] for the full incident this fixes.
      const result = await db.execute<{
        id: string;
        city_id: string;
        user_id: string;
        password_hash: string;
        last_changed_at: Date;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
        deleted_by: string | null;
      }>(sql`SELECT * FROM iam.fn_get_credential_by_user_id(${userId}::uuid)`);
      const row = (result as any)[0];
      if (!row) return null;
      const cred: CredentialRow = {
        id: row.id,
        cityId: row.city_id,
        userId: row.user_id,
        passwordHash: row.password_hash,
        lastChangedAt: row.last_changed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by,
      };
      return cred;
    },
    createCredential: async (userId, passwordHash) => {
      await db.insert(credentials).values({ userId, passwordHash });
    },
    updateCredentialHash: async (userId, passwordHash) => {
      await db
        .update(credentials)
        .set({ passwordHash, lastChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(credentials.userId, userId));
    },

    createSession: async (input) => {
      const [session] = await db.insert(sessions).values(input).returning();
      return session!;
    },
    findActiveSessionByUserId: async (userId) => {
      const [session] = await db
        .select()
        .from(sessions)
        .where(
          and(eq(sessions.userId, userId), eq(sessions.active, true), isNull(sessions.deletedAt)),
        );
      return session || null;
    },
    findSessionByTokenHash: async (tokenHash) => {
      const [session] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.sessionTokenHash, tokenHash), isNull(sessions.deletedAt)));
      return session || null;
    },
    findSessionById: async (id) => {
      // Uses iam.fn_get_session_by_id (SECURITY DEFINER) instead of a direct
      // SELECT, because Hook 1 reads this before Hook 3 sets the RLS GUC context.
      const result = await db.execute<{
        id: string;
        city_id: string;
        user_id: string;
        session_token_hash: string;
        ip_address: string | null;
        user_agent: string | null;
        last_activity_at: string | Date;
        locked_at: string | Date | null;
        active: boolean;
        created_at: string | Date;
        terminated_at: string | Date | null;
        terminated_by: string | null;
        termination_reason: string | null;
        deleted_at: string | Date | null;
        deleted_by: string | null;
      }>(sql`SELECT * FROM iam.fn_get_session_by_id(${id})`);

      const session = result[0];
      if (!session) return null;

      return {
        id: session.id,
        cityId: session.city_id,
        userId: session.user_id,
        sessionTokenHash: session.session_token_hash,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        lastActivityAt: new Date(session.last_activity_at),
        locked_at: session.locked_at ? new Date(session.locked_at) : null,
        active: session.active,
        createdAt: new Date(session.created_at),
        terminatedAt: session.terminated_at ? new Date(session.terminated_at) : null,
        terminatedBy: session.terminated_by,
        terminationReason: session.termination_reason,
        deletedAt: session.deleted_at ? new Date(session.deleted_at) : null,
        deletedBy: session.deleted_by,
      };
    },
    terminateSession: async (id, reason, terminatedBy) => {
      // Uses SECURITY DEFINER function to bypass RLS when called from Hook 1
      await db.execute(sql`SELECT iam.fn_terminate_session(${id}, ${reason}, ${terminatedBy})`);
    },
    updateLastActivity: async (id) => {
      // Uses SECURITY DEFINER function to bypass RLS when called from Hook 4
      await db.execute(sql`SELECT iam.fn_update_last_activity(${id})`);
    },
    setSessionLocked: async (id, lockedAt) => {
      await db.update(sessions).set({ locked_at: lockedAt }).where(eq(sessions.id, id));
    },
    listSessionsByUserId: async (userId) => {
      return db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), isNull(sessions.deletedAt)));
    },
    listAllActiveSessions: async (cityId, opts) => {
      return db
        .select()
        .from(sessions)
        .where(
          and(eq(sessions.cityId, cityId), eq(sessions.active, true), isNull(sessions.deletedAt)),
        )
        .limit(opts.limit)
        .offset(opts.offset);
    },

    createRefreshToken: async (input) => {
      const [token] = await db.insert(refreshTokens).values(input).returning();
      return token!;
    },
    findRefreshTokenById: async (id) => {
      const [token] = await db
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.deletedAt)));
      return token || null;
    },
    markRefreshTokenUsed: async (id, replacedById) => {
      const updated = await db
        .update(refreshTokens)
        .set({ usedAt: new Date(), replacedBy: replacedById })
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.usedAt)))
        .returning();
      return updated.length > 0;
    },
    createPasswordResetToken: async (input) => {
      const [token] = await db.insert(passwordResetTokens).values(input).returning();
      return token!;
    },
    findPasswordResetTokenById: async (id) => {
      const [token] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.deletedAt)));
      return token || null;
    },
    markPasswordResetTokenUsed: async (id) => {
      const updated = await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)))
        .returning();
      return updated.length > 0;
    },
    revokeRefreshTokensBySessionId: async (sessionId, reason) => {
      // Uses SECURITY DEFINER function to bypass RLS when called from Hook 1
      await db.execute(sql`SELECT iam.fn_revoke_refresh_tokens_by_session_id(${sessionId}, ${reason})`);
    },
    revokeRefreshTokenFamily: async (familyId, reason) => {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), revocationReason: reason })
        .where(
          and(
            eq(refreshTokens.familyId, familyId),
            isNull(refreshTokens.usedAt),
            isNull(refreshTokens.revokedAt),
            isNull(refreshTokens.deletedAt),
          ),
        );
    },
    findLatestActiveRefreshTokenForSession: async (sessionId) => {
      const [token] = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.sessionId, sessionId),
            isNull(refreshTokens.revokedAt),
            isNull(refreshTokens.usedAt),
            isNull(refreshTokens.deletedAt),
          ),
        )
        .orderBy(desc(refreshTokens.createdAt))
        .limit(1);
      return token || null;
    },

    findRoleById: async (id) => {
      const [role] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, id), isNull(roles.deletedAt)));
      return role || null;
    },
    findRoleByCode: async (cityId, code) => {
      const [role] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.cityId, cityId), eq(roles.code, code), isNull(roles.deletedAt)));
      return role || null;
    },
    listActiveRoles: async (cityId) => {
      return db
        .select()
        .from(roles)
        .where(and(eq(roles.cityId, cityId), isNull(roles.deletedAt)));
    },

    findActiveRoleAssignmentsByUserId: async (userId) => {
      const rows = await db
        .select({
          assignment: roleAssignments,
          role: roles,
        })
        .from(roleAssignments)
        .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
        .where(
          and(
            eq(roleAssignments.userId, userId),
            eq(roleAssignments.isActive, true),
            isNull(roleAssignments.deletedAt),
          ),
        );
      return rows.map((r) => ({ ...r.assignment, role: r.role }));
    },
    findUsersByRoleCode: async (cityId, roleCode) => {
      const [role] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.cityId, cityId), eq(roles.code, roleCode), isNull(roles.deletedAt)));
      if (!role) return [];

      const rows = await db
        .select({ user: users })
        .from(roleAssignments)
        .innerJoin(users, eq(roleAssignments.userId, users.id))
        .where(
          and(
            eq(roleAssignments.roleId, role.id),
            eq(roleAssignments.isActive, true),
            isNull(roleAssignments.deletedAt),
          ),
        );
      return rows.map((r) => r.user);
    },
    createRoleAssignment: async (input) => {
      const [assignment] = await db.insert(roleAssignments).values(input).returning();
      return assignment!;
    },
    revokeRoleAssignment: async (id, revokedBy) => {
      await db
        .update(roleAssignments)
        .set({ isActive: false, revokedAt: new Date(), revokedBy })
        .where(eq(roleAssignments.id, id));
    },
    findAssignmentsByUserId: async (userId) => {
      return db
        .select()
        .from(roleAssignments)
        .where(and(eq(roleAssignments.userId, userId), isNull(roleAssignments.deletedAt)));
    },
    findConflictingTypeCodeForUser: async (userId, conflictTypeCode) => {
      const [role] = await db
        .select({ role: roles })
        .from(roleAssignments)
        .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
        .where(
          and(
            eq(roleAssignments.userId, userId),
            eq(roleAssignments.isActive, true),
            isNull(roleAssignments.deletedAt),
            eq(roles.typeCode, conflictTypeCode),
          ),
        )
        .limit(1);
      return role?.role || null;
    },

    findPermissionsByRoleIds: async (roleIds) => {
      if (roleIds.length === 0) return [];
      const rows = await db
        .selectDistinct({
          permission: permissions,
        })
        .from(permissions)
        .innerJoin(rolePermissions, eq(permissions.id, rolePermissions.permissionId))
        .where(and(inArray(rolePermissions.roleId, roleIds), isNull(permissions.deletedAt)));
      return rows.map((r) => r.permission);
    },

    findMfaRecordByUserId: async (userId) => {
      const [record] = await db
        .select()
        .from(mfaRecords)
        .where(and(eq(mfaRecords.userId, userId), isNull(mfaRecords.deletedAt)));
      return record || null;
    },
  };
}
