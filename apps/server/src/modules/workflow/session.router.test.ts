import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createSessionRouter } from './session.router.js';
import type { Context, AuthContext } from '../iam/iam.types.js';

const CITY_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const COUNCILOR_2_UUID = '22222222-2222-2222-2222-222222222222';
const VM_EMP_UUID = '33333333-3333-3333-3333-333333333333';

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: USER_ID,
    sessionId: 'session-1',
    officeId: 'office-1',
    cityId: CITY_ID,
    roles: ['sp_secretary'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: ['office-1'],
    effectiveRoles: ['sp_secretary'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeMockDb() {
  const responses: any[] = [];
  const db: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (cb) => {
      return await cb(db);
    }),
    then: vi.fn().mockImplementation((onFulfilled) => {
      const val = responses.shift();
      return Promise.resolve(val).then(onFulfilled);
    }),
    mockResponse: (val: any) => {
      responses.push(val);
    },
  };
  return db;
}

function makeCtx(subject: AuthContext, db: ReturnType<typeof makeMockDb>): Context {
  return {
    auth: subject,
    db: db as any,
    req: {
      server: {},
    } as any,
    requestId: 'test-request-id',
  };
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(t.router({ session: createSessionRouter() }));

function callerFor(ctx: Context) {
  return callerFactory(ctx).session;
}

describe('Session Router tRPC Procedures', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  describe('recordAttendance', () => {
    it('throws FORBIDDEN for non-sp_secretary roles', async () => {
      const subject = makeSubject({ roles: ['sp_member'], effectiveRoles: ['sp_member'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      await expect(
        caller.recordAttendance({
          sessionDate: new Date('2026-07-14'),
          absences: [],
        }),
      ).rejects.toThrowError(/You do not have permission/);
    });

    it('successfully records attendance with quorum met', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      // mock sequence of DB queries/updates inside transaction:
      const roster = Array.from({ length: 10 }).map((_, i) => ({
        id: i === 0 ? COUNCILOR_2_UUID : `councilor-${i}`,
      }));
      mockDb.mockResponse(roster); // 1. SP members check (returns 10 members)
      mockDb.mockResponse([]); // 2. VM position check -> empty (fallback used)
      mockDb.mockResponse([]); // 3. logged in employee
      mockDb.mockResponse([{ id: 'fallback-emp-1' }]); // 4. first employee fallback
      mockDb.mockResponse([]); // 5. existing session check -> empty (insert new)
      mockDb.mockResponse([{ maxNum: 10 }]); // 6. max session number check
      mockDb.mockResponse([{ id: 'new-session-id' }]); // 7. insert session return
      roster.forEach(() => mockDb.mockResponse([])); // 8... upsert for each councilor

      const result = await caller.recordAttendance({
        sessionDate: new Date('2026-07-14'),
        absences: [
          {
            councilorEmployeeId: COUNCILOR_2_UUID,
            reason: 'sick_leave',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.presentCount).toBe(9); // 10 total - 1 absent
      expect(result.absentCount).toBe(1);
      expect(result.quorumMet).toBe(true); // 9 >= ceil(10/2) + 1 = 6
    });

    it('records attendance when VM is absent and delegation is active', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      const roster = Array.from({ length: 10 }).map((_, i) => ({
        id: i === 0 ? VM_EMP_UUID : `councilor-${i}`,
      }));
      mockDb.mockResponse(roster); // 1. SP members check
      mockDb.mockResponse([{ employeeId: VM_EMP_UUID, positionId: 'vm-pos-id' }]); // 2. VM position
      mockDb.mockResponse([{ delegatedToEmployeeId: 'substitute-emp-id' }]); // 3. active designation
      mockDb.mockResponse([]); // 4. existing session check -> empty
      mockDb.mockResponse([{ maxNum: 5 }]); // 5. max session number
      mockDb.mockResponse([{ id: 'session-id' }]); // 6. insert session
      roster.forEach(() => mockDb.mockResponse([])); // 7... upsert attendance

      const result = await caller.recordAttendance({
        sessionDate: new Date('2026-07-14'),
        absences: [
          {
            councilorEmployeeId: VM_EMP_UUID,
            reason: 'official_business',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.presentCount).toBe(9); // 10 - 1
      expect(result.quorumMet).toBe(true);
    });

    it('records attendance when VM is absent and valid override is provided (override wins)', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      const roster = Array.from({ length: 10 }).map((_, i) => ({
        id: i === 0 ? VM_EMP_UUID : `councilor-${i}`,
      }));
      mockDb.mockResponse(roster); // 1. SP members check
      mockDb.mockResponse([{ employeeId: VM_EMP_UUID, positionId: 'vm-pos-id' }]); // 2. VM position
      mockDb.mockResponse([{ id: 'valid-override-id' }]); // 3. override validation (employee exists)
      mockDb.mockResponse([{ id: 'grant-id' }]); // 4. override eligibility (active delegation)
      mockDb.mockResponse([]); // 5. existing session check -> empty
      mockDb.mockResponse([{ maxNum: 5 }]); // 6. max session number
      mockDb.mockResponse([{ id: 'session-id' }]); // 7. insert session
      roster.forEach(() => mockDb.mockResponse([])); // 8... upsert attendance

      const result = await caller.recordAttendance({
        sessionDate: new Date('2026-07-14'),
        absences: [
          {
            councilorEmployeeId: VM_EMP_UUID,
            reason: 'sick_leave',
          },
        ],
        presidedByEmployeeIdOverride: '11111111-1111-1111-1111-111111111111',
      });

      expect(result.success).toBe(true);
      expect(result.presentCount).toBe(9); // 10 - 1
      expect(result.quorumMet).toBe(true);
    });

    it('ignores override if VM is present', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      const roster = Array.from({ length: 10 }).map((_, i) => ({
        id: i === 0 ? COUNCILOR_2_UUID : `councilor-${i}`,
      }));
      mockDb.mockResponse(roster); // 1. SP members check
      mockDb.mockResponse([{ employeeId: VM_EMP_UUID, positionId: 'vm-pos-id' }]); // 2. VM position check
      mockDb.mockResponse([]); // 3. existing session check -> empty
      mockDb.mockResponse([{ maxNum: 5 }]); // 4. max session number
      mockDb.mockResponse([{ id: 'session-id' }]); // 5. insert session
      roster.forEach(() => mockDb.mockResponse([])); // 6... upsert attendance

      const result = await caller.recordAttendance({
        sessionDate: new Date('2026-07-14'),
        absences: [
          {
            councilorEmployeeId: COUNCILOR_2_UUID,
            reason: 'vacation_leave',
          },
        ],
        presidedByEmployeeIdOverride: '11111111-1111-1111-1111-111111111111',
      });

      expect(result.success).toBe(true);
      expect(result.presentCount).toBe(9); // 10 - 1
      expect(result.quorumMet).toBe(true);
    });

    it('throws BAD_REQUEST if override is provided, VM is absent, but override employee is not found', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      const roster = Array.from({ length: 10 }).map((_, i) => ({
        id: i === 0 ? VM_EMP_UUID : `councilor-${i}`,
      }));
      mockDb.mockResponse(roster); // 1. SP members check
      mockDb.mockResponse([{ employeeId: VM_EMP_UUID, positionId: 'vm-pos-id' }]); // 2. VM position
      mockDb.mockResponse([]); // 3. override validation (employee does NOT exist)

      await expect(
        caller.recordAttendance({
          sessionDate: new Date('2026-07-14'),
          absences: [
            {
              councilorEmployeeId: VM_EMP_UUID,
              reason: 'official_business',
            },
          ],
          presidedByEmployeeIdOverride: '11111111-1111-1111-1111-111111111111',
        }),
      ).rejects.toThrowError(/substitute presiding officer could not be found/);
    });

    it('throws BAD_REQUEST if override is provided, VM is absent, but override employee is not eligible', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      const roster = Array.from({ length: 10 }).map((_, i) => ({
        id: i === 0 ? VM_EMP_UUID : `councilor-${i}`,
      }));
      mockDb.mockResponse(roster); // 1. SP members check
      mockDb.mockResponse([{ employeeId: VM_EMP_UUID, positionId: 'vm-pos-id' }]); // 2. VM position
      mockDb.mockResponse([{ id: 'valid-override-id' }]); // 3. override validation (employee exists)
      mockDb.mockResponse([]); // 4. override eligibility (NO active delegation)

      await expect(
        caller.recordAttendance({
          sessionDate: new Date('2026-07-14'),
          absences: [
            {
              councilorEmployeeId: VM_EMP_UUID,
              reason: 'official_business',
            },
          ],
          presidedByEmployeeIdOverride: '11111111-1111-1111-1111-111111111111',
        }),
      ).rejects.toThrowError(/substitute presiding officer is not eligible/);
    });

    it('throws INTERNAL_SERVER_ERROR if no active SP members can be resolved', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([]); // 1. SP members check (primary) -> empty
      mockDb.mockResponse([]); // 2. SP members check (fallback) -> empty

      await expect(
        caller.recordAttendance({
          sessionDate: new Date('2026-07-14'),
          absences: [],
        }),
      ).rejects.toThrowError(/No active SP membership roster could be resolved/);
    });
  });

  describe('getAttendanceRecord', () => {
    it('throws FORBIDDEN for citizen role', async () => {
      const subject = makeSubject({ roles: ['citizen'], effectiveRoles: ['citizen'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      await expect(
        caller.getAttendanceRecord({ sessionDate: new Date('2026-07-14') }),
      ).rejects.toThrowError(/You do not have permission/);
    });

    it('returns default empty shape if session not found', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ employeeId: 'vm-emp-id' }]); // vm position lookup
      mockDb.mockResponse([]); // session check -> empty

      const result = await caller.getAttendanceRecord({ sessionDate: new Date('2026-07-14') });
      expect(result.presentCouncilors).toEqual([]);
      expect(result.absences).toEqual([]);
      expect(result.quorumMet).toBe(false);
      expect(result.presidedByEmployeeId).toBeNull();
      expect(result.presidedByDisplayName).toBeNull();
    });

    it('returns attendance record with present and absent councilors', async () => {
      const subject = makeSubject({ roles: ['auditor'], effectiveRoles: ['auditor'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ employeeId: 'vm-emp-id' }]); // vm position lookup
      mockDb.mockResponse([
        { id: 'session-id', quorumAchieved: true, presidedByEmployeeId: 'presiding-id' },
      ]); // session check
      mockDb.mockResponse([
        {
          employeeId: 'emp-1',
          isPresent: true,
          absenceReason: null,
          firstName: 'Juan',
          lastName: 'Dela Cruz',
        },
        {
          employeeId: 'emp-2',
          isPresent: false,
          absenceReason: 'ob',
          firstName: 'Maria',
          lastName: 'Clara',
        },
      ]); // attendances fetch
      mockDb.mockResponse([{ firstName: 'Sub', lastName: 'Stitute' }]); // presiding emp lookup

      const result = await caller.getAttendanceRecord({ sessionDate: new Date('2026-07-14') });
      expect(result.presentCouncilors).toEqual([{ id: 'emp-1', displayName: 'Juan Dela Cruz' }]);
      expect(result.absences).toEqual([
        {
          councilorEmployeeId: 'emp-2',
          councilorDisplayName: 'Maria Clara',
          reason: 'Official Business',
        },
      ]);
      expect(result.quorumMet).toBe(true);
      expect(result.presidedByEmployeeId).toBe('presiding-id');
      expect(result.presidedByDisplayName).toBe('Sub Stitute');
    });
  });

  describe('getAttendanceStatistics', () => {
    it('returns computed stats series within date range, using roster size as of each session date', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([
        { sessionDate: '2026-07-07', presentCount: 10 },
        { sessionDate: '2026-07-14', presentCount: 8 },
        { sessionDate: '2026-07-21', presentCount: null },
      ]);
      // Roster as of 2026-07-07: 12 members.
      mockDb.mockResponse(Array.from({ length: 12 }).map((_, i) => ({ id: `emp-${i}` })));
      // Roster as of 2026-07-14: 10 members (2 fewer than the prior session's date —
      // this is the value that proves the roster-lookup query is actually being
      // exercised per-row rather than a fixed constant leaking through).
      mockDb.mockResponse(Array.from({ length: 10 }).map((_, i) => ({ id: `emp-${i}` })));

      const result = await caller.getAttendanceStatistics({
        from: new Date('2026-07-01'),
        to: new Date('2026-07-20'),
      });

      expect(result.series.length).toBe(3);
      expect(result.series[0]?.presentCount).toBe(10);
      expect(result.series[0]?.absentCount).toBe(2);
      expect(result.series[1]?.presentCount).toBe(8);
      expect(result.series[1]?.absentCount).toBe(2);
      expect(result.series[2]?.presentCount).toBeNull();
      expect(result.series[2]?.absentCount).toBeNull();
      expect(result.printableSummaryUrl).toBeNull();
    });

    it('falls back to a fixed roster size of 12 if the mocked roster size is not distinguished across dates (regression guard)', async () => {
      // This second test intentionally mirrors the OLD, defeated test's mock
      // shape (12 employees for every date) as a permanent regression guard:
      // it exists so that if the roster-lookup query is ever accidentally
      // removed or short-circuited back to a hardcoded 12, at least one test
      // in this file still exercises that a *query* happens per-row (even
      // though this specific test cannot, by itself, prove the query is
      // date-aware — the first test above is what proves that). Do not
      // delete this test in a future cleanup on the assumption it's
      // redundant with the first one; it exercises a genuinely different
      // failure mode (query never called at all vs. query called but not
      // date-scoped).
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ sessionDate: '2026-07-07', presentCount: 10 }]);
      mockDb.mockResponse(Array.from({ length: 12 }).map((_, i) => ({ id: `emp-${i}` })));

      const result = await caller.getAttendanceStatistics({
        from: new Date('2026-07-01'),
        to: new Date('2026-07-20'),
      });

      expect(result.series.length).toBe(1);
      expect(result.series[0]?.presentCount).toBe(10);
      expect(result.series[0]?.absentCount).toBe(2);
    });
  });

  describe('scheduleDocumentForFirstReading', () => {
    it('schedules on next Tuesday and rolls forward to following Tuesday if past Thursday cutoff', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-08T10:00:00Z')); // Wednesday

      mockDb.mockResponse([]); // VM position check
      mockDb.mockResponse([{ id: 'fallback-emp-1' }]); // first employee fallback
      mockDb.mockResponse([{ id: 'session-id' }]); // session check -> exists
      mockDb.mockResponse([{ id: 'oob-id' }]); // order of business check -> exists
      mockDb.mockResponse([]); // check if scheduled -> empty (insert item)
      mockDb.mockResponse([{ maxOrder: 2 }]); // get maxOrder
      mockDb.mockResponse([]); // insert item

      const result = await caller.scheduleDocumentForFirstReading({
        documentId: VALID_UUID,
        sessionDate: new Date('2026-07-14'), // Tuesday next week
      });

      expect(result.success).toBe(true);
      vi.useRealTimers();
    });

    it('inserts a new session row with null attendance when no session exists for the date', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-08T10:00:00Z'));

      mockDb.mockResponse([]); // 1. vmPos select (VM/presiding-officer position lookup)
      mockDb.mockResponse([]); // 2. loggedInEmployee select (fallback: current user as employee)
      mockDb.mockResponse([{ employeeId: 'emp-1' }]); // 3. firstEmp select (fallback: any employee)
      mockDb.mockResponse([]); // 4. session select (empty, forces session-creation branch)
      mockDb.mockResponse([{ maxNumber: 1 }]); // 5. numRow select (max existing session number)
      mockDb.mockResponse([{ id: 'new-session-id' }]); // 6. insert(spSessions).returning()
      mockDb.mockResponse([{ id: 'oob-id' }]); // 7. oob select (Order of Business lookup)
      mockDb.mockResponse([]); // 8. existingItem select (check if scheduled)
      mockDb.mockResponse([{ maxOrder: 1 }]); // 9. orderRow select (max existing item order)
      mockDb.mockResponse([]); // 10. insert(orderOfBusinessItems)

      const result = await caller.scheduleDocumentForFirstReading({
        documentId: VALID_UUID,
        sessionDate: new Date('2026-07-14'),
      });

      expect(result.success).toBe(true);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          presentCount: null,
          quorumAchieved: null,
        }),
      );

      vi.useRealTimers();
    });
  });

  describe('getOrderOfBusiness', () => {
    it('returns empty items list if session does not exist', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([]); // session check -> empty

      const result = await caller.getOrderOfBusiness({
        sessionDate: new Date('2026-07-14'),
      });

      expect(result.items).toEqual([]);
    });

    it('returns items list with committee details and red flags', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: 'session-id' }]); // session exists
      mockDb.mockResponse([{ id: 'oob-id', cutoffDate: '2026-07-09' }]); // OOB exists
      mockDb.mockResponse([
        {
          documentId: VALID_UUID,
          title: 'Document Title 1',
          preliminaryNumber: 'PRE-1',
          isRedFlagged: false,
          stepType: 'multi_referral',
          stepMetadata: {
            assigned_committees: [{ committee_id: 'comm-1' }],
            submissions: [], // missing submission
          },
        },
      ]); // items inside OOB
      mockDb.mockResponse([{ id: 'comm-1', name: 'Committee on Laws', code: 'CL' }]); // committees table

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-10T12:00:00Z')); // Friday (past July 9 cutoff)

      const result = await caller.getOrderOfBusiness({
        sessionDate: new Date('2026-07-14'),
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.title).toBe('Document Title 1');
      expect(result.items[0]?.committeeReportStatus).toBe('red_flagged');
      expect(result.items[0]?.assignedCommittees).toEqual(['Committee on Laws']);

      vi.useRealTimers();
    });
  });

  describe('enterCommitteeHearingDate', () => {
    it('successfully updates metadata of step instance with hearing date', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, metadata: {} }]); // step instance lookup
      mockDb.mockResponse([]); // update step instance

      const result = await caller.enterCommitteeHearingDate({
        stepInstanceId: VALID_UUID,
        hearingDate: new Date('2026-07-15'),
      });

      expect(result.success).toBe(true);
    });
  });
});
