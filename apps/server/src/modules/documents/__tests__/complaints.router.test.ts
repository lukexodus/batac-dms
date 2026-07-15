/**
 * complaints.router.test.ts
 *
 * Router-level tests for the complaints procedures added in TASK-PRE-01.
 * Uses the same t.createCallerFactory pattern as document-requests.router.test.ts.
 *
 * Coverage targets (acceptance criteria from TASK-PRE-01):
 *  AC-C1  complaints.get — sp_secretary, sp_presiding_officer, auditor succeed unconditionally
 *  AC-C2  complaints.get — sp_member succeeds when assignedOfficeId ∈ subject.committeeIds
 *  AC-C3  complaints.get — sp_member with no matching committee throws FORBIDDEN
 *  AC-C4  complaints.get — any other role throws FORBIDDEN
 *  AC-C5  complaints.get — nonexistent or wrong-cityId record throws NOT_FOUND
 *  AC-C6  complaints.get — returns list-item fields plus four detail-only fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC } from '@trpc/server';
import { createComplaintsRouter } from '../complaints.router.js';
import type { Context, AuthContext } from '../../iam/iam.types.js';
import type { DocumentRow } from '../documents.repository.js';

vi.mock('../../../config/env.js', () => ({
  env: {},
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_CITY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OFFICE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const COMMITTEE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const OTHER_COMMITTEE_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const DOC_ID = '11111111-1111-1111-1111-111111111111';
const DOC_TYPE_ID = '22222222-2222-2222-2222-222222222222';

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: USER_ID,
    sessionId: 'session-1',
    officeId: OFFICE_ID,
    cityId: CITY_ID,
    roles: ['sp_secretary'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: [OFFICE_ID],
    effectiveRoles: ['sp_secretary'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeComplaintRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: DOC_ID,
    cityId: CITY_ID,
    documentTypeId: DOC_TYPE_ID,
    title: 'Citizen Complaint -- Juan dela Cruz -- 2026-06-01',
    lifecycleState: 'submitted',
    classificationLevel: 'internal',
    qrTrackingNumber: 'pending',
    preliminaryNumber: null,
    finalNumber: null,
    controlNumber: null,
    originatingOfficeId: OFFICE_ID,
    ownedByOfficeId: OFFICE_ID,
    createdBy: USER_ID,
    workflowInstanceId: null,
    versionNumber: 1,
    metadata: {
      subjectCategory: 'Traffic Violation',
      outcomeState: 'pending_hearing',
      assignedOfficeId: COMMITTEE_ID,
      committeeReport: null,
      respondent: {
        name: 'Pedro Reyes',
        contactNumber: null,
        email: null,
        tricycleNumber: null,
        notificationChannel: null,
      },
      incidentDetails: { date: null, time: null, place: null, narrative: 'Narrative text here' },
      routingDecision: null,
      accessMode: 'in_person_clerk',
    },
    supersededBy: null,
    supersededAt: null,
    closureReason: null,
    retentionScheduleId: '33333333-3333-3333-3333-333333333333',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  } as unknown as DocumentRow;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeMockRepository(rowOverride?: DocumentRow | null) {
  const row = rowOverride !== undefined ? rowOverride : makeComplaintRow();
  return {
    findDocumentById: vi.fn().mockResolvedValue(row),
    insertDocument: vi.fn(),
    updateDocumentMetadata: vi.fn().mockResolvedValue(row),
    listDocuments: vi.fn().mockResolvedValue([]),
  };
}

function makeCtx(
  subject: AuthContext,
  repository?: ReturnType<typeof makeMockRepository>,
): Context {
  const repo = repository ?? makeMockRepository();
  return {
    auth: subject,
    db: {} as any,
    req: {
      server: {
        db: {} as any,
        documentsRepository: repo,
        documentsService: { transitionState: vi.fn() },
        eventBus: null,
        auditService: null,
      },
    } as any,
  };
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(t.router({ complaints: createComplaintsRouter() }));

function callerFor(ctx: Context) {
  return callerFactory(ctx).complaints;
}

// ---------------------------------------------------------------------------
// Tests — complaints.get
// ---------------------------------------------------------------------------

describe('complaints.get', () => {
  beforeEach(() => vi.clearAllMocks());

  // AC-C1 — unconditional roles
  it('AC-C1: sp_secretary can get a complaint', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const caller = callerFor(makeCtx(subject));
    const result = await caller.getComplaint({ complaintId: DOC_ID });
    expect(result.complaintId).toBe(DOC_ID);
  });

  it('AC-C1: sp_presiding_officer can get a complaint', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const caller = callerFor(makeCtx(subject));
    const result = await caller.getComplaint({ complaintId: DOC_ID });
    expect(result.complaintId).toBe(DOC_ID);
  });

  it('AC-C1: auditor can get a complaint', async () => {
    const subject = makeSubject({ roles: ['auditor'] });
    const caller = callerFor(makeCtx(subject));
    const result = await caller.getComplaint({ complaintId: DOC_ID });
    expect(result.complaintId).toBe(DOC_ID);
  });

  // AC-C2 — sp_member with matching committee
  it('AC-C2: sp_member with assignedOfficeId in committeeIds succeeds', async () => {
    const subject = makeSubject({ roles: ['sp_member'], committeeIds: [COMMITTEE_ID] });
    const caller = callerFor(makeCtx(subject));
    const result = await caller.getComplaint({ complaintId: DOC_ID });
    expect(result.complaintId).toBe(DOC_ID);
  });

  // AC-C3 — sp_member with wrong committee
  it('AC-C3: sp_member not assigned to this committee throws FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['sp_member'], committeeIds: [OTHER_COMMITTEE_ID] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.getComplaint({ complaintId: DOC_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('AC-C3: sp_member with empty committeeIds throws FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['sp_member'], committeeIds: [] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.getComplaint({ complaintId: DOC_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  // AC-C4 — other roles
  it('AC-C4: records_officer throws FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['records_officer'] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.getComplaint({ complaintId: DOC_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('AC-C4: dept_encoder throws FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['dept_encoder'] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.getComplaint({ complaintId: DOC_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  // AC-C5 — NOT_FOUND
  it('AC-C5: throws NOT_FOUND when document does not exist', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repo = makeMockRepository(null);
    const caller = callerFor(makeCtx(subject, repo));
    await expect(caller.getComplaint({ complaintId: DOC_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('AC-C5: throws NOT_FOUND when cityId does not match', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const row = makeComplaintRow({ cityId: OTHER_CITY_ID });
    const repo = makeMockRepository(row);
    const caller = callerFor(makeCtx(subject, repo));
    await expect(caller.getComplaint({ complaintId: DOC_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // AC-C6 — return shape
  it('AC-C6: returns list-item fields plus four detail-only fields', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const caller = callerFor(makeCtx(subject));
    const result = await caller.getComplaint({ complaintId: DOC_ID });

    // List-item fields (same as listAllComplaints items)
    expect(result).toHaveProperty('complaintId');
    expect(result).toHaveProperty('subjectMatter');
    expect(result).toHaveProperty('outcomeState');
    expect(result).toHaveProperty('assignedOfficeId');
    expect(result).toHaveProperty('createdAt');

    // Detail-only fields
    expect(result).toHaveProperty('committeeReport');
    expect(result).toHaveProperty('respondent');
    expect(result).toHaveProperty('incidentDetails');
    expect(result).toHaveProperty('routingDecision');

    // Spot-check values from the fixture
    expect(result.subjectMatter).toBe('Traffic Violation');
    expect(result.outcomeState).toBe('pending_hearing');
    expect(result.assignedOfficeId).toBe(COMMITTEE_ID);
    expect(result.committeeReport).toBeNull();
    expect(result.respondent).toBeDefined();
    expect(result.respondent?.name).toBe('Pedro Reyes');
    expect(result.incidentDetails?.narrative).toBe('Narrative text here');
  });
});
