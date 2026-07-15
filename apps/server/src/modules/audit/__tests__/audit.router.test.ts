/**
 * TASK-PRE-03 — Tests for audit.router.ts (all 6 procedures)
 *
 * Covers:
 *   1. audit.queryEvents                — legacy, sys_admin|auditor only
 *   2. audit.listOwnActions             — 10 operational roles, actorId forced
 *   3. audit.listOwnOfficeDocumentActions — 7 roles, office-scoped
 *   4. audit.listFullLog                — auditor only, sys_admin denied
 *   5. audit.validateChainIntegrity     — sys_admin|auditor, full chain walk
 *   6. audit.exportEvents               — auditor only, mutation
 *
 * Strategy: tRPC caller via createCallerFactory, mock AuditPublicAPI.
 * validateChainIntegrity and exportEvents access _internal.repo directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createAuditTrpcRouter } from '../audit.router.js';
import type { AuditPublicAPI, AuditQueryResult } from '../index.js';
import type { Context } from '../../iam/iam.types.js';
import { computeChainHash, signHmac, canonicalizePayload, GENESIS_HASH } from '../audit.crypto.js';

// ─── Shared mock data ─────────────────────────────────────────────────────────

const TEST_HMAC_SECRET = 'test-secret-key-for-audit-router';
const CITY_ID = '00000000-0000-0000-0000-000000000003';
const USER_ID = '00000000-0000-0000-0000-000000000001';

const MOCK_EVENT = {
  auditEventId: '00000000-0000-0000-0000-000000000010',
  eventType: 'document.created',
  actorId: USER_ID,
  targetId: '00000000-0000-0000-0000-000000000020',
  targetType: 'document',
  payload: { docNumber: '2025-0001' },
  cityId: CITY_ID,
  occurredAt: new Date('2025-06-15T10:00:00Z'),
  chainHash: 'a'.repeat(64),
  hmac: 'b'.repeat(64),
};

const MOCK_RESULT: AuditQueryResult = {
  events: [MOCK_EVENT],
  chainValidationStatus: 'intact',
  nextCursor: undefined,
};

const MOCK_RESULT_WITH_CURSOR: AuditQueryResult = {
  events: [MOCK_EVENT],
  chainValidationStatus: 'intact',
  nextCursor: 'MjA=',
};

function makeAuditService(overrides?: Partial<AuditPublicAPI>): AuditPublicAPI {
  return {
    writeEvent: vi.fn().mockResolvedValue(undefined),
    queryEvents: vi.fn().mockResolvedValue(MOCK_RESULT),
    _internal: { repo: {} as any, writeService: {} as any },
    ...overrides,
  };
}

// ─── tRPC caller builder ──────────────────────────────────────────────────────

function buildCaller(ctx: Context, auditService: AuditPublicAPI) {
  const auditRouter = createAuditTrpcRouter(auditService);
  const t = initTRPC.context<Context>().create();
  const callerFactory = t.createCallerFactory(t.router({ audit: auditRouter }));
  return callerFactory(ctx);
}

// ─── Context fixtures ─────────────────────────────────────────────────────────

function makeCtx(roles: string[], overrides?: Partial<Context['auth']>): Context {
  return {
    auth: {
      userId: USER_ID,
      sessionId: 'sess-001',
      officeId: 'office-A',
      cityId: CITY_ID,
      roles,
      permissions: [],
      committeeIds: [],
      delegationGrantId: null,
      effectiveOfficeIds: [
        '00000000-0000-0000-0000-0000000000aa',
        '00000000-0000-0000-0000-0000000000bb',
      ],
      effectiveRoles: roles,
      isItAdmin: roles.includes('sys_admin'),
      isPlatformAdmin: false,
      ...overrides,
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

// ─── 1. audit.queryEvents (legacy) ────────────────────────────────────────────

describe('audit.queryEvents', () => {
  it('returns AuditQueryResult for sys_admin', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    const result = await caller.audit.queryEvents({});

    expect(result.chainValidationStatus).toBe('intact');
    expect(result.events).toHaveLength(1);
    expect(service.queryEvents).toHaveBeenCalledOnce();
  });

  it('returns AuditQueryResult for auditor', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.queryEvents({});

    expect(result.chainValidationStatus).toBe('intact');
    expect(service.queryEvents).toHaveBeenCalledOnce();
  });

  it('throws FORBIDDEN for records_officer', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['records_officer']), service);

    await expect(caller.audit.queryEvents({})).rejects.toThrowError(TRPCError);
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED when unauthenticated', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeUnauthCtx(), service);

    await expect(caller.audit.queryEvents({})).rejects.toThrowError(TRPCError);
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('forwards filter fields to auditService.queryEvents', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    const input = {
      actorId: '00000000-0000-0000-0000-000000000099',
      targetId: '00000000-0000-0000-0000-000000000088',
      eventTypes: ['user.login', 'document.created'],
      from: '2025-01-01T00:00:00Z',
      to: '2025-12-31T23:59:59Z',
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

// ─── 2. audit.listOwnActions ───────────────────────────────────────────────────

describe('audit.listOwnActions', () => {
  const ALLOWED_ROLES = [
    'records_officer',
    'dept_encoder',
    'dept_approver',
    'sp_secretary',
    'sp_member',
    'sp_presiding_officer',
    'mayor',
    'brgy_encoder',
    'brgy_captain',
    'auditor',
  ];

  for (const role of ALLOWED_ROLES) {
    it(`allows ${role}`, async () => {
      const service = makeAuditService();
      const caller = buildCaller(makeCtx([role]), service);

      const result = await caller.audit.listOwnActions({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.auditEventId).toBe(MOCK_EVENT.auditEventId);
      expect(result.nextCursor).toBeNull();
      expect(service.queryEvents).toHaveBeenCalledOnce();
    });
  }

  it('throws FORBIDDEN for sys_admin', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    await expect(caller.audit.listOwnActions({})).rejects.toThrowError(TRPCError);
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN for plat_admin', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['plat_admin']), service);

    await expect(caller.audit.listOwnActions({})).rejects.toThrowError(TRPCError);
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('forces actorId to ctx.auth.userId (client value ignored)', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['records_officer']), service);

    // The input does NOT have actorId — it's forced server-side.
    // But even if we could supply it, the procedure ignores it.
    await caller.audit.listOwnActions({ pageSize: 25 });

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: USER_ID,
      }),
    );
  });

  it('forces cityId for tenant isolation', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['mayor']), service);

    await caller.audit.listOwnActions({});

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: CITY_ID,
      }),
    );
  });

  it('omits chainHash/hmac from output shape', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.listOwnActions({});

    const item = result.items[0]!;
    expect(item).not.toHaveProperty('chainHash');
    expect(item).not.toHaveProperty('hmac');
    expect(item).toHaveProperty('auditEventId');
    expect(item).toHaveProperty('eventType');
  });

  it('passes date range and pagination to queryEvents', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['dept_approver']), service);

    await caller.audit.listOwnActions({
      from: '2025-01-01T00:00:00Z',
      to: '2025-06-30T23:59:59Z',
      pageSize: 100,
      cursor: 'abc',
    });

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(Date),
        to: expect.any(Date),
        pageSize: 100,
        cursor: 'abc',
      }),
    );
  });

  it('returns nextCursor when present', async () => {
    const service = makeAuditService({
      queryEvents: vi.fn().mockResolvedValue(MOCK_RESULT_WITH_CURSOR),
    });
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.listOwnActions({});

    expect(result.nextCursor).toBe('MjA=');
  });
});

// ─── 3. audit.listOwnOfficeDocumentActions ─────────────────────────────────────

describe('audit.listOwnOfficeDocumentActions', () => {
  const ALLOWED_ROLES = [
    'records_officer',
    'dept_approver',
    'sp_secretary',
    'sp_presiding_officer',
    'mayor',
    'brgy_captain',
    'auditor',
  ];

  const DENIED_ROLES = ['dept_encoder', 'sp_member', 'brgy_encoder'];

  for (const role of ALLOWED_ROLES) {
    it(`allows ${role}`, async () => {
      const service = makeAuditService();
      const caller = buildCaller(makeCtx([role]), service);

      const result = await caller.audit.listOwnOfficeDocumentActions({});

      expect(result.items).toHaveLength(1);
      expect(service.queryEvents).toHaveBeenCalledOnce();
    });
  }

  for (const role of DENIED_ROLES) {
    it(`denies ${role}`, async () => {
      const service = makeAuditService();
      const caller = buildCaller(makeCtx([role]), service);

      await expect(caller.audit.listOwnOfficeDocumentActions({})).rejects.toThrowError(TRPCError);
      expect(service.queryEvents).not.toHaveBeenCalled();
    });
  }

  it('queries all effectiveOfficeIds when no officeId supplied', async () => {
    const service = makeAuditService();
    const caller = buildCaller(
      makeCtx(['records_officer'], {
        effectiveOfficeIds: [
          '00000000-0000-0000-0000-0000000000aa',
          '00000000-0000-0000-0000-0000000000bb',
        ],
      }),
      service,
    );

    await caller.audit.listOwnOfficeDocumentActions({});

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceOfficeIds: [
          '00000000-0000-0000-0000-0000000000aa',
          '00000000-0000-0000-0000-0000000000bb',
        ],
        cityId: CITY_ID,
      }),
    );
  });

  it('validates officeId against effectiveOfficeIds', async () => {
    const service = makeAuditService();
    const caller = buildCaller(
      makeCtx(['records_officer'], {
        effectiveOfficeIds: ['00000000-0000-0000-0000-0000000000aa'],
      }),
      service,
    );

    await expect(
      caller.audit.listOwnOfficeDocumentActions({
        officeId: '00000000-0000-0000-0000-0000000000ff',
      }),
    ).rejects.toThrowError(TRPCError);

    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('allows a valid officeId within effectiveOfficeIds', async () => {
    const service = makeAuditService();
    const caller = buildCaller(
      makeCtx(['mayor'], {
        effectiveOfficeIds: [
          '00000000-0000-0000-0000-0000000000aa',
          '00000000-0000-0000-0000-0000000000bb',
        ],
      }),
      service,
    );

    await caller.audit.listOwnOfficeDocumentActions({
      officeId: '00000000-0000-0000-0000-0000000000bb',
    });

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceOfficeIds: ['00000000-0000-0000-0000-0000000000bb'],
      }),
    );
  });

  it('returns empty when effectiveOfficeIds is empty', async () => {
    const service = makeAuditService();
    const caller = buildCaller(
      makeCtx(['records_officer'], {
        effectiveOfficeIds: [],
      }),
      service,
    );

    const result = await caller.audit.listOwnOfficeDocumentActions({});

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('omits chainHash/hmac from output', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.listOwnOfficeDocumentActions({});

    const item = result.items[0]!;
    expect(item).not.toHaveProperty('chainHash');
    expect(item).not.toHaveProperty('hmac');
  });
});

// ─── 4. audit.listFullLog ──────────────────────────────────────────────────────

describe('audit.listFullLog', () => {
  it('allows auditor', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.listFullLog({});

    expect(result.items).toHaveLength(1);
    expect(result.chainValidationStatus).toBe('intact');
    expect(service.queryEvents).toHaveBeenCalledOnce();
  });

  it('throws FORBIDDEN for sys_admin (I2 §15 denial)', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    await expect(caller.audit.listFullLog({})).rejects.toThrowError(TRPCError);
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN for records_officer', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['records_officer']), service);

    await expect(caller.audit.listFullLog({})).rejects.toThrowError(TRPCError);
    expect(service.queryEvents).not.toHaveBeenCalled();
  });

  it('does NOT force actorId — queries all actors', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    await caller.audit.listFullLog({});

    // listFullLog passes through actorId from input, doesn't force it
    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: CITY_ID,
      }),
    );
    // Verify actorId was NOT passed (omitUndefined strips it)
    expect(service.queryEvents.mock.calls[0]![0]).not.toHaveProperty('actorId');
  });

  it('passes actorId filter when supplied', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    const targetActor = '00000000-0000-0000-0000-000000000055';
    await caller.audit.listFullLog({ actorId: targetActor });

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: targetActor,
      }),
    );
  });

  it('includes chainValidationStatus in output', async () => {
    const service = makeAuditService({
      queryEvents: vi.fn().mockResolvedValue({
        ...MOCK_RESULT,
        chainValidationStatus: 'broken',
      }),
    });
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.listFullLog({});

    expect(result.chainValidationStatus).toBe('broken');
  });

  it('passes eventTypes filter', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['auditor']), service);

    await caller.audit.listFullLog({ eventTypes: ['user.login', 'document.created'] });

    expect(service.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypes: ['user.login', 'document.created'],
      }),
    );
  });
});

// ─── 5. audit.validateChainIntegrity ───────────────────────────────────────────

describe('audit.validateChainIntegrity', () => {
  // Build the canonical payload exactly as the router does (I1 §8):
  //   { eventType, actorId, targetId, targetType, resourceOfficeId, payload, cityId, occurredAt }
  function makeCanonical(row: {
    eventType: string;
    actorId: string | null;
    targetId: string | null;
    targetType: string | null;
    resourceOfficeId: string | null;
    payload: Record<string, unknown>;
    cityId: string;
    occurredAt: Date;
  }): string {
    return canonicalizePayload({
      eventType: row.eventType,
      actorId: row.actorId,
      targetId: row.targetId,
      targetType: row.targetType,
      resourceOfficeId: row.resourceOfficeId,
      payload: row.payload,
      cityId: row.cityId,
      occurredAt: row.occurredAt.toISOString(),
    });
  }

  // Build a valid 2-event chain for testing
  function buildChainRows() {
    const event1 = {
      id: '10000000-0000-0000-0000-000000000001',
      sequenceNumber: 1n,
      cityId: CITY_ID,
      eventType: 'user.login',
      actorId: USER_ID,
      targetId: null,
      targetType: null,
      resourceOfficeId: null,
      payload: { ip: '127.0.0.1' },
      occurredAt: new Date('2025-06-01T00:00:00Z'),
      chainHash: '',
      hmac: '',
      hmacKeyVersion: 1,
    };

    const canonical1 = makeCanonical(event1);
    event1.hmac = signHmac(canonical1, TEST_HMAC_SECRET);
    event1.chainHash = computeChainHash(GENESIS_HASH, canonical1);

    const event2 = {
      id: '10000000-0000-0000-0000-000000000002',
      sequenceNumber: 2n,
      cityId: CITY_ID,
      eventType: 'document.created',
      actorId: USER_ID,
      targetId: '10000000-0000-0000-0000-000000000099',
      targetType: 'document',
      resourceOfficeId: '00000000-0000-0000-0000-00000000000a',
      payload: { docNumber: '2025-0001' },
      occurredAt: new Date('2025-06-15T10:00:00Z'),
      chainHash: '',
      hmac: '',
      hmacKeyVersion: 1,
    };

    const canonical2 = makeCanonical(event2);
    event2.hmac = signHmac(canonical2, TEST_HMAC_SECRET);
    event2.chainHash = computeChainHash(event1.chainHash, canonical2);

    return [event1, event2];
  }

  function makeRepoMock(rows: any[], opts?: { fromEventNotFound?: boolean }) {
    return {
      db: {
        select: vi.fn().mockImplementation((selection?: any) => {
          const builder: any = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockImplementation((n: number) => {
              // fromEventId lookup (single row)
              if (opts?.fromEventNotFound && builder._lastWhereType === 'byId') {
                return Promise.resolve([]);
              }
              return Promise.resolve(rows);
            }),
          };

          // Track which .where() pattern is being used
          const origWhere = builder.where;
          builder.where = vi.fn().mockImplementation((...args: any[]) => {
            builder._lastWhereType = 'filter';
            origWhere(...args);
            return builder;
          });

          // The first .select() call in the procedure is for fromEventId lookup
          // Returns a [{ seq: bigint }] shape
          if (selection && selection.seq) {
            // This is the fromEventId resolution query
            return {
              from: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              limit: vi
                .fn()
                .mockResolvedValue(
                  opts?.fromEventNotFound ? [] : [{ seq: rows[0]?.sequenceNumber ?? 1n }],
                ),
            };
          }

          return builder;
        }),
      },
    };
  }

  function makeCtxWithServer(roles: string[], repoMock: any): Context {
    return {
      auth: {
        userId: USER_ID,
        sessionId: 'sess-001',
        officeId: '00000000-0000-0000-0000-0000000000aa',
        cityId: CITY_ID,
        roles,
        permissions: [],
        committeeIds: [],
        delegationGrantId: null,
        effectiveOfficeIds: ['00000000-0000-0000-0000-0000000000aa'],
        effectiveRoles: roles,
        isItAdmin: roles.includes('sys_admin'),
        isPlatformAdmin: false,
      },
      db: {} as any,
      req: {
        server: {
          auditEnv: { AUDIT_HMAC_SECRET: TEST_HMAC_SECRET },
        },
      } as any,
    };
  }

  it('allows sys_admin', async () => {
    const rows = buildChainRows();
    const repoMock = { db: createDrizzleMock(rows) };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtxWithServer(['sys_admin'], repoMock), service);

    const result = await caller.audit.validateChainIntegrity({});

    expect(result.status).toBe('intact');
    expect(result.brokenAtEventId).toBeNull();
  });

  it('allows auditor', async () => {
    const rows = buildChainRows();
    const repoMock = { db: createDrizzleMock(rows) };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtxWithServer(['auditor'], repoMock), service);

    const result = await caller.audit.validateChainIntegrity({});

    expect(result.status).toBe('intact');
  });

  it('throws FORBIDDEN for records_officer', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['records_officer']), service);

    await expect(caller.audit.validateChainIntegrity({})).rejects.toThrowError(TRPCError);
  });

  it('returns intact for empty chain', async () => {
    const repoMock = { db: createDrizzleMock([]) };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtxWithServer(['sys_admin'], repoMock), service);

    const result = await caller.audit.validateChainIntegrity({});

    expect(result.status).toBe('intact');
    expect(result.brokenAtEventId).toBeNull();
  });

  it('detects broken chain (tampered HMAC)', async () => {
    const rows = buildChainRows();
    // Tamper with the HMAC on event 2
    rows[1]!.hmac = 'f'.repeat(64);

    const repoMock = { db: createDrizzleMock(rows) };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtxWithServer(['auditor'], repoMock), service);

    const result = await caller.audit.validateChainIntegrity({});

    expect(result.status).toBe('broken');
    expect(result.brokenAtEventId).toBe(rows[1]!.id);
  });

  it('detects broken chain (tampered chainHash)', async () => {
    const rows = buildChainRows();
    // Tamper with chain hash on event 1 (break the chain)
    rows[0]!.chainHash = '0'.repeat(64);

    const repoMock = { db: createDrizzleMock(rows) };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtxWithServer(['auditor'], repoMock), service);

    const result = await caller.audit.validateChainIntegrity({});

    expect(result.status).toBe('broken');
    expect(result.brokenAtEventId).toBe(rows[0]!.id);
  });
});

// ─── 6. audit.exportEvents ─────────────────────────────────────────────────────

describe('audit.exportEvents', () => {
  it('allows auditor', async () => {
    const ndjson = JSON.stringify({ id: '1', eventType: 'user.login' });
    const repoMock = {
      compileMonthlySnapshot: vi.fn().mockResolvedValue(Buffer.from(ndjson, 'utf-8')),
    };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.exportEvents({});

    expect(result.contentType).toBe('application/x-ndjson');
    expect(result.eventCount).toBe(1);
    expect(result.exportData).toBe(Buffer.from(ndjson, 'utf-8').toString('base64'));
    expect(repoMock.compileMonthlySnapshot).toHaveBeenCalledOnce();
  });

  it('throws FORBIDDEN for sys_admin', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['sys_admin']), service);

    await expect(caller.audit.exportEvents({})).rejects.toThrowError(TRPCError);
  });

  it('throws FORBIDDEN for records_officer', async () => {
    const service = makeAuditService();
    const caller = buildCaller(makeCtx(['records_officer']), service);

    await expect(caller.audit.exportEvents({})).rejects.toThrowError(TRPCError);
  });

  it('returns empty export with 0 events for empty chain', async () => {
    const repoMock = {
      compileMonthlySnapshot: vi.fn().mockResolvedValue(Buffer.alloc(0)),
    };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.exportEvents({});

    expect(result.eventCount).toBe(0);
    expect(result.exportData).toBe('');
  });

  it('counts multiple NDJSON lines correctly', async () => {
    const lines = [
      JSON.stringify({ id: '1' }),
      JSON.stringify({ id: '2' }),
      JSON.stringify({ id: '3' }),
    ].join('\n');
    const repoMock = {
      compileMonthlySnapshot: vi.fn().mockResolvedValue(Buffer.from(lines, 'utf-8')),
    };
    const service = makeAuditService({
      _internal: { repo: repoMock as any, writeService: {} as any },
    });
    const caller = buildCaller(makeCtx(['auditor']), service);

    const result = await caller.audit.exportEvents({});

    expect(result.eventCount).toBe(3);
  });
});

// ─── Drizzle mock builder for validateChainIntegrity ──────────────────────────

/**
 * Builds a mock Drizzle query builder that handles the 3 distinct select
 * patterns used by validateChainIntegrity:
 *   1. resolve fromEventId → .select({ seq }).from().where().limit(1)
 *   2. fetch prev hash   → .select({ chainHash }).from().where().orderBy().limit(1)
 *   3. fetch all rows    → .select().from().where().orderBy()
 */
function createDrizzleMock(rows: any[]) {
  let callIndex = 0;

  return {
    select: vi.fn().mockImplementation((selection?: any) => {
      const currentCall = callIndex++;
      const builder: any = {};

      builder.from = vi.fn().mockReturnValue(builder);

      if (selection && selection.seq) {
        // Pattern 1: fromEventId lookup → returns [{ seq }]
        builder.where = vi.fn().mockReturnValue(builder);
        builder.limit = vi
          .fn()
          .mockResolvedValue(rows.length > 0 ? [{ seq: rows[0].sequenceNumber }] : []);
        return builder;
      }

      if (selection && selection.chainHash) {
        // Pattern 2: prevHash lookup → returns last chainHash before first row
        builder.where = vi.fn().mockReturnValue(builder);
        builder.orderBy = vi.fn().mockReturnValue(builder);
        // Return the chainHash of the row before the first row (or empty for genesis)
        const firstSeq = rows[0]?.sequenceNumber ?? 1n;
        const prevRows = rows.filter((r) => r.sequenceNumber < firstSeq);
        builder.limit = vi
          .fn()
          .mockResolvedValue(
            prevRows.length > 0 ? [{ chainHash: prevRows[prevRows.length - 1].chainHash }] : [],
          );
        return builder;
      }

      // Pattern 3: fetch all rows
      builder.where = vi.fn().mockReturnValue(builder);
      builder.orderBy = vi.fn().mockResolvedValue(rows);

      return builder;
    }),
  };
}
