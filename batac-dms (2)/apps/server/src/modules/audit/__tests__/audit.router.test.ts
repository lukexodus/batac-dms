/**
 * TASK-AUDIT-006 — Integration tests for audit.router.ts
 *
 * Tests cover:
 *   1. sys_admin role → returns AuditQueryResult with events and chainValidationStatus
 *   2. auditor role   → same result shape
 *   3. other_role     → throws TRPCError FORBIDDEN
 *   4. unauthenticated (no auth context) → throws TRPCError UNAUTHORIZED
 *
 * Strategy: call the router procedure's resolver directly via tRPC caller
 * (createCallerFactory), bypassing HTTP transport. The AuditPublicAPI is
 * supplied as a minimal mock so no real DB is required.
 */

import { describe, it, expect, vi } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createAuditTrpcRouter } from '../audit.router.js';
import type { AuditPublicAPI, AuditQueryResult } from '../index.js';
import type { Context } from '../../iam/iam.types.js';
import { protectedProcedure, router } from '../../../trpc.js';

// ─── Shared mock AuditPublicAPI ───────────────────────────────────────────────

const MOCK_RESULT: AuditQueryResult = {
  events: [
    {
      auditEventId: '00000000-0000-0000-0000-000000000001',
      eventType: 'test.event',
      actorId: '00000000-0000-0000-0000-000000000002',
      targetId: null,
      targetType: null,
      payload: { foo: 'bar' },
      cityId: '00000000-0000-0000-0000-000000000003',
      occurredAt: new Date('2025-01-01T00:00:00Z'),
      chainHash: 'a'.repeat(64),
      hmac: 'b'.repeat(64),
    },
  ],
  chainValidationStatus: 'intact',
  nextCursor: undefined,
};

function makeAuditService(overrides?: Partial<AuditPublicAPI>): AuditPublicAPI {
  return {
    writeEvent: vi.fn().mockResolvedValue(undefined),
    queryEvents: vi.fn().mockResolvedValue(MOCK_RESULT),
    _internal: { repo: {} as any, writeService: {} as any },
    ...overrides,
  };
}

// ─── Helper: build a tRPC caller with a given Context ────────────────────────

function buildCaller(ctx: Context, auditService: AuditPublicAPI) {
  const auditRouter = createAuditTrpcRouter(auditService);

  // We need to create a caller that uses our ctx directly.
  // createCallerFactory is the tRPC v11 API.
  const t = initTRPC.context<Context>().create();
  // Re-wrap so the caller factory can receive ctx:
  const callerFactory = t.createCallerFactory(
    t.router({
      audit: auditRouter,
    }),
  );
  return callerFactory(ctx);
}

// ─── Helpers for context fixtures ─────────────────────────────────────────────

function makeCtx(roles: string[]): Context {
  return {
    auth: {
      userId: 'user-001',
      sessionId: 'sess-001',
      officeId: null,
      cityId: 'city-001',
      roles,
      permissions: [],
      committeeIds: [],
      delegationGrantId: null,
      effectiveOfficeIds: [],
      effectiveRoles: roles,
      isItAdmin: false,
      isPlatformAdmin: false,
    },
    db: {} as any,
    req: {} as any,
  };
}

function makeUnauthCtx(): Context {
  return {
    auth: null,
    db: {} as any,
    req: {} as any,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('audit.queryEvents tRPC procedure', () => {
  // ── Test 1: sys_admin role ──────────────────────────────────────────────────

  it('returns AuditQueryResult with events and chainValidationStatus for sys_admin', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    const result = await caller.audit.queryEvents({});

    expect(result.chainValidationStatus).toBe('intact');
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.eventType).toBe('test.event');
    expect(service.queryEvents).toHaveBeenCalledOnce();
  });

  // ── Test 2: auditor role ────────────────────────────────────────────────────

  it('returns AuditQueryResult with events and chainValidationStatus for auditor', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.queryEvents({});

    expect(result.chainValidationStatus).toBe('intact');
    expect(result.events).toHaveLength(1);
    expect(service.queryEvents).toHaveBeenCalledOnce();
  });

  // ── Test 3: unauthorized role throws FORBIDDEN ──────────────────────────────

  it('throws FORBIDDEN TRPCError for a role that is not sys_admin or auditor', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['records_officer']), service);

    await expect(caller.audit.queryEvents({})).rejects.toThrowError(TRPCError);

    try {
      await caller.audit.queryEvents({});
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('FORBIDDEN');
    }

    // queryEvents on the service must NOT have been called
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  // ── Test 4: unauthenticated caller throws UNAUTHORIZED ──────────────────────

  it('throws UNAUTHORIZED TRPCError when no auth context is present', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeUnauthCtx(), service);

    await expect(caller.audit.queryEvents({})).rejects.toThrowError(TRPCError);

    try {
      await caller.audit.queryEvents({});
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('UNAUTHORIZED');
    }

    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  // ── Test 5: input forwarded correctly to queryEvents ───────────────────────

  it('forwards all filter fields to auditService.queryEvents', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    const input = {
      actorId: '00000000-0000-0000-0000-000000000099',
      targetId: '00000000-0000-0000-0000-000000000088',
      eventTypes: ['user.login', 'document.created'],
      from: new Date('2025-01-01T00:00:00Z'),
      to: new Date('2025-12-31T23:59:59Z'),
      pageSize: 10,
      cursor: 'dGVzdA==',
    };

    await caller.audit.queryEvents(input);

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: input.actorId,
        targetId: input.targetId,
        eventTypes: input.eventTypes,
        pageSize: input.pageSize,
        cursor: input.cursor,
      }),
    );
  });
});
