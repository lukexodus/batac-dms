import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../../trpc/trpc.js';
import * as s from './iam.schemas.js';
import { RoleCombinationForbiddenError } from './iam.errors.js';
import { env } from '../../config/env.js';
function getService(ctx) {
    return ctx.req.server.iamService;
}
function getRepo(ctx) {
    return ctx.req.server.iamRepository;
}
export const iamRouter = router({
    getCurrentUser: protectedProcedure.input(s.GetProfileInput).query(async ({ ctx, input }) => {
        const targetId = input.userId ?? ctx.auth.userId;
        if (targetId !== ctx.auth.userId) {
            if (!ctx.auth.isItAdmin && !ctx.auth.isPlatformAdmin) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Admin access required to view other profiles',
                });
            }
        }
        const service = getService(ctx);
        const user = await service.getUserById(targetId);
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND' });
        }
        return user;
    }),
    updateOwnProfile: protectedProcedure
        .input(s.UpdateProfileInput)
        .mutation(async ({ ctx, input }) => {
        const service = getService(ctx);
        return service.updateOwnProfile({
            userId: ctx.auth.userId,
            ...(input.displayName !== undefined && { displayName: input.displayName }),
            ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
        });
    }),
    changeOwnPassword: protectedProcedure
        .input(s.ChangePasswordInput)
        .mutation(async ({ ctx, input }) => {
        const service = getService(ctx);
        try {
            await service.changeOwnPassword({
                userId: ctx.auth.userId,
                currentPassword: input.currentPassword,
                newPassword: input.newPassword,
            });
            return { success: true };
        }
        catch (err) {
            if (err.message === 'UNAUTHORIZED') {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }
            throw err;
        }
    }),
    listActiveSessions: protectedProcedure.query(async ({ ctx }) => {
        const service = getService(ctx);
        return service.listSessionsByUserId(ctx.auth.userId);
    }),
    listAllActiveSessions: protectedProcedure
        .input(s.paginationInput)
        .query(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'System Admin access required' });
        }
        const service = getService(ctx);
        const items = await service.listAllActiveSessions(ctx.auth.cityId, {
            limit: input.pageSize,
            offset: 0,
        });
        return { items, nextCursor: null };
    }),
    forceTerminateSession: protectedProcedure
        .input(s.ForceTerminateSessionInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'System Admin access required' });
        }
        const service = getService(ctx);
        await service.forceTerminateSession({
            targetSessionId: input.sessionId,
            reason: input.reason,
            actorId: ctx.auth.userId,
            cityId: ctx.auth.cityId,
        });
        return { success: true };
    }),
    listAllUsers: protectedProcedure.query(async ({ ctx }) => {
        // accessible by any authenticated user for selection in document metadata
        const service = getService(ctx);
        return service.listAllUsers(ctx.auth.cityId);
    }),
    listUserDirectory: protectedProcedure
        .input(s.ListUserDirectoryInput)
        .query(async ({ ctx, input }) => {
        const service = getService(ctx);
        const items = await service.listUserDirectory(ctx.auth.cityId, {
            limit: input.pageSize,
            offset: 0,
            ...(input.officeId !== undefined && { officeId: input.officeId }),
            ...(input.search !== undefined && { search: input.search }),
        });
        return { items, nextCursor: null };
    }),
    createUserAccount: protectedProcedure
        .input(s.CreateUserAccountInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'System Admin access required' });
        }
        const service = getService(ctx);
        return service.createUserAccount({
            username: input.username,
            email: input.email,
            employeeId: input.employeeId,
            cityId: ctx.auth.cityId,
            actorId: ctx.auth.userId,
        });
    }),
    generatePasswordResetLink: protectedProcedure
        .input(s.GeneratePasswordResetLinkInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'System Admin access required to generate password reset links',
            });
        }
        const service = getService(ctx);
        return service.generatePasswordResetToken({
            userId: input.userId,
            actorId: ctx.auth.userId,
            cityId: ctx.auth.cityId,
        });
    }),
    redeemPasswordResetToken: publicProcedure
        .input(s.RedeemPasswordResetTokenInput)
        .mutation(async ({ ctx, input }) => {
        const service = getService(ctx);
        return service.redeemPasswordResetToken({
            tokenId: input.tokenId,
            rawToken: input.rawToken,
            newPassword: input.newPassword,
        });
    }),
    editUserAccount: protectedProcedure
        .input(s.EditUserAccountInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin && !ctx.auth.isPlatformAdmin && ctx.auth.userId !== input.userId) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Admin access required to edit other users',
            });
        }
        const service = getService(ctx);
        return service.updateUserAccount({
            userId: input.userId,
            ...(input.email !== undefined && { email: input.email }),
            ...(input.status !== undefined && { status: input.status }),
            ...(input.officeId !== undefined && { officeId: input.officeId }),
        });
    }),
    deactivateUserAccount: protectedProcedure
        .input(s.DeactivateUserAccountInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin && !ctx.auth.isPlatformAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        const service = getService(ctx);
        await service.deactivateUserAccount(input.userId, ctx.auth.userId);
        return { success: true, newStatus: 'deactivated' };
    }),
    reactivateUserAccount: protectedProcedure
        .input(s.DeactivateUserAccountInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isItAdmin && !ctx.auth.isPlatformAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        const service = getService(ctx);
        await service.reactivateUserAccount(input.userId, ctx.auth.userId);
        return { success: true, newStatus: 'active' };
    }),
    assignRole: protectedProcedure.input(s.AssignRoleInput).mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isPlatformAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform Admin access required' });
        }
        const service = getService(ctx);
        try {
            const assignment = await service.assignRole({
                actorId: ctx.auth.userId,
                targetUserId: input.userId,
                roleId: input.roleCode,
                officeScopeId: input.officeScopeId ?? null,
            });
            return { roleAssignmentId: assignment.id };
        }
        catch (err) {
            if (err instanceof RoleCombinationForbiddenError) {
                throw new TRPCError({ code: 'FORBIDDEN', message: err.message, cause: err });
            }
            throw err;
        }
    }),
    revokeRole: protectedProcedure.input(s.RevokeRoleInput).mutation(async ({ ctx, input }) => {
        if (!ctx.auth.isPlatformAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform Admin access required' });
        }
        const service = getService(ctx);
        await service.revokeRole({
            actorId: ctx.auth.userId,
            targetUserId: '',
            roleAssignmentId: input.roleAssignmentId,
            reason: 'Revoked by Platform Admin',
        });
        return { success: true };
    }),
    listRoleAssignmentsByUser: protectedProcedure
        .input(z.object({ userId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
        if (!ctx.auth.isPlatformAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform Admin access required' });
        }
        const repo = getRepo(ctx);
        const assignments = await repo.findActiveRoleAssignmentsByUserId(input.userId);
        return assignments.map((a) => ({
            id: a.id,
            roleCode: a.role.code,
            roleName: a.role.name,
            officeScopeId: a.officeScopeId,
            assignedAt: a.assignedAt,
        }));
    }),
    registerCitizenAccountClerkAssisted: protectedProcedure
        .input(s.RegisterCitizenClerkAssistedInput)
        .mutation(async ({ ctx, input }) => {
        if (!ctx.auth.roles.includes('sp_secretary')) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'SP Secretary access required' });
        }
        const service = getService(ctx);
        const { idReference, ...restInput } = input;
        return service.registerCitizenAccountClerkAssisted({
            ...restInput,
            actorId: ctx.auth.userId,
            ...(idReference !== undefined && { idReference }),
        });
    }),
    getEnvironmentConfigMatrix: protectedProcedure
        .query(async ({ ctx }) => {
        if (!ctx.auth.isItAdmin) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'System Admin access required',
            });
        }
        const { serverEnvSchema } = await import('../../config/env.server.js');
        const config = env;
        const keys = Object.keys(serverEnvSchema.shape);
        const MASK_THESE_KEYS_ENTIRELY = new Set([
            "AUTH_JWT_ACCESS_SECRET",
            "AUTH_JWT_REFRESH_SECRET",
            "AUDIT_HMAC_SECRET",
            "S3_ACCESS_KEY",
            "S3_SECRET_KEY",
            "S3_BACKUP_ACCESS_KEY",
            "S3_BACKUP_SECRET_KEY",
            "SMTP_PASSWORD",
            "OCR_SERVICE_API_KEY",
            "SEARCH_MEILISEARCH_MASTER_KEY",
            "SMS_API_KEY",
            "BACKUP_ENCRYPTION_KEY",
            "OTEL_EXPORTER_OTLP_HEADERS",
            "DATABASE_URL_APP",
            "DATABASE_URL_AUDIT",
            "DATABASE_URL_MIGRATE",
            "S3_BACKUP_ENDPOINT"
        ]);
        const result = [];
        for (const key of keys) {
            const isSet = process.env[key] !== undefined;
            let val = config[key];
            let stringVal = null;
            if (val !== undefined && val !== null) {
                if (Array.isArray(val)) {
                    stringVal = JSON.stringify(val);
                }
                else {
                    stringVal = String(val);
                }
            }
            let isMasked = false;
            if (stringVal !== null && MASK_THESE_KEYS_ENTIRELY.has(key)) {
                isMasked = true;
                if (stringVal.length < 8) {
                    stringVal = '••••••••';
                }
                else {
                    stringVal = stringVal.substring(0, 4) + '••••••••' + stringVal.substring(stringVal.length - 2);
                }
            }
            result.push({
                key,
                isSet,
                value: stringVal,
                isMasked
            });
        }
        return result;
    }),
});
