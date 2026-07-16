import { eq, and, or, isNull, desc, inArray, ilike } from 'drizzle-orm';
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
import type { IamRepository, DbClient, DbTransaction } from './iam.types.js';

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
      const [cred] = await db
        .select()
        .from(credentials)
        .where(and(eq(credentials.userId, userId), isNull(credentials.deletedAt)));
      return cred || null;
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
      const [session] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, id), isNull(sessions.deletedAt)));
      return session || null;
    },
    terminateSession: async (id, reason, terminatedBy) => {
      await db
        .update(sessions)
        .set({ active: false, terminatedAt: new Date(), terminationReason: reason, terminatedBy })
        .where(eq(sessions.id, id));
    },
    updateLastActivity: async (id) => {
      await db.update(sessions).set({ lastActivityAt: new Date() }).where(eq(sessions.id, id));
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
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), revocationReason: reason })
        .where(
          and(
            eq(refreshTokens.sessionId, sessionId),
            isNull(refreshTokens.usedAt),
            isNull(refreshTokens.revokedAt),
            isNull(refreshTokens.deletedAt),
          ),
        );
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
