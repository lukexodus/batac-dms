/**
 * NumberingService unit tests — TASK-DOCS-005
 *
 * Tests are fully isolated: all DB interactions are mocked via Vitest.
 * No live database or pgBoss connection is required.
 *
 * Repository query patterns used by NumberingService:
 *   findCurrentNumber      → .select().from(numbers).where(…).limit(1)       resolves at .limit()
 *   findDocumentById       → .select().from(documents).where(…)               resolves at .where()
 *   findNumberSeriesByKey  → .select().from(numberSeries).where(…)            resolves at .where()
 *   insertNumber           → .insert(numbers).values(…).returning()           resolves at .returning()
 *   supersedePreliminary   → .update(numbers).set(…).where(…)                 resolves at .where()
 *   updateDocumentNumbering→ .update(documents).set(…).where(…)               resolves at .where()
 *   logCancellationGap     → .update(numbers).set(…).where(…)                 resolves at .where()
 *
 * Acceptance criteria covered:
 *  ✔ assignPreliminaryNumber inserts numbers row with number_type='preliminary', is_current=true
 *  ✔ assignPreliminaryNumber updates documents.preliminary_number
 *  ✔ assignPreliminaryNumber throws 'preliminary number already assigned' on second call
 *  ✔ assignFinalNumber throws 'final number already assigned' when final_number IS NOT NULL
 *  ✔ assignFinalNumber supersedes preliminary, inserts final, sets final_number, clears preliminary_number
 *  ✔ logCancellationGap writes cancellation_reason to numbers row
 *  ✔ was_created=true triggers logger.warn
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NumberingService } from '../numbering.service.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SERIES = {
  id: 'series-uuid-1',
  cityId: 'city-uuid-1',
  seriesKey: 'sp_resolution',
  sequencePadding: 2,
  spOrdinal: '7',
  prefix: null,
  delimiter: ' ',
  preliminaryFormat: 'Draft 7SP {YEAR}-{NN}',
  finalFormat: '7SP {YEAR}-{NN}',
  sequenceNamePrefix: 'ns_sp_resolution',
};

const DOCUMENT_NO_FINAL = {
  id: 'doc-uuid-1',
  finalNumber: null,
  preliminaryNumber: null,
};

const DOCUMENT_WITH_FINAL = {
  id: 'doc-uuid-1',
  finalNumber: '7SP 2026-01',
  preliminaryNumber: 'Draft 7SP 2026-01',
};

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a query builder mock (thenable) that resolves to `rows`.
 * Drizzle query builders return themselves for all chaining methods,
 * and execute the query when `.then()` is called.
 */
function makeBuilder(rows: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: function (resolve: any) {
      resolve(rows);
    },
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NumberingService', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  });

  // ── assignPreliminaryNumber ───────────────────────────────────────────────

  describe('assignPreliminaryNumber', () => {
    it('inserts a numbers row with number_type=preliminary and updates documents.preliminary_number', async () => {
      const year = new Date().getFullYear();
      const insertedRow = {
        id: 'num-1',
        numberValue: `Draft 7SP ${year}-01`,
        sequenceNumber: 1,
        sequenceYear: year,
        assignedAt: new Date(),
      };

      let selectCount = 0;
      const trx: any = {
        execute: vi.fn().mockResolvedValue({ rows: [{ sequence_value: BigInt(1), was_created: false }] }),
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // findCurrentNumber('preliminary') — returns empty (no existing prelim)
            return makeBuilder([]);
          }
          // findNumberSeriesByKey — returns SERIES
          return makeBuilder([SERIES]);
        }),
        insert: vi.fn(() => makeBuilder([insertedRow])),
        update: vi.fn(() => makeBuilder([])),
      };
      const db: any = { transaction: vi.fn(async (cb: any) => cb(trx)) };
      const svc = new NumberingService({ db, logger: mockLogger });

      const result = await svc.assignPreliminaryNumber('doc-1', 'sp_resolution', 'city-1', 'actor-1');

      // Ledger row inserted
      expect(trx.insert).toHaveBeenCalledTimes(1);
      const vals = trx.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(vals.numberType).toBe('preliminary');
      expect(vals.isCurrent).toBe(true);
      expect(vals.numberValue).toMatch(/^Draft 7SP \d{4}-01$/);

      // documents.documents updated with preliminary_number
      expect(trx.update).toHaveBeenCalledTimes(1);
      const setArg = trx.update.mock.results[0].value.set.mock.calls[0][0];
      expect(setArg.preliminaryNumber).toMatch(/^Draft 7SP \d{4}-01$/);

      // Return value
      expect(result.numberValue).toBe(insertedRow.numberValue);
      expect(result.sequenceNumber).toBe(1);
    });

    it('throws "preliminary number already assigned" when called a second time', async () => {
      const existingRow = { id: 'num-existing', numberType: 'preliminary', isCurrent: true };

      let selectCount = 0;
      const trx: any = {
        execute: vi.fn(),
        select: vi.fn(() => {
          selectCount++;
          // findCurrentNumber → returns an existing row (already assigned)
          return makeBuilder([existingRow]);
        }),
        insert: vi.fn(),
        update: vi.fn(() => makeBuilder([])),
      };
      const db: any = { transaction: vi.fn(async (cb: any) => cb(trx)) };
      const svc = new NumberingService({ db, logger: mockLogger });

      await expect(
        svc.assignPreliminaryNumber('doc-1', 'sp_resolution', 'city-1', 'actor-1'),
      ).rejects.toThrow('preliminary number already assigned');

      // No insert should have occurred
      expect(trx.insert).not.toHaveBeenCalled();
    });

    it('logs a warn when fn_get_next_sequence_value returns was_created=true', async () => {
      const year = new Date().getFullYear();
      const insertedRow = {
        id: 'num-1', numberValue: `Draft 7SP ${year}-01`,
        sequenceNumber: 1, sequenceYear: year, assignedAt: new Date(),
      };

      let selectCount = 0;
      const trx: any = {
        execute: vi.fn().mockResolvedValue({ rows: [{ sequence_value: BigInt(1), was_created: true }] }),
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeBuilder([]); // no existing prelim
          return makeBuilder([SERIES]);
        }),
        insert: vi.fn(() => makeBuilder([insertedRow])),
        update: vi.fn(() => makeBuilder([])),
      };
      const db: any = { transaction: vi.fn(async (cb: any) => cb(trx)) };
      const svc = new NumberingService({ db, logger: mockLogger });

      await svc.assignPreliminaryNumber('doc-1', 'sp_resolution', 'city-1', 'actor-1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ seriesKey: 'sp_resolution' }),
        expect.stringContaining('On-demand year sequence created'),
      );
    });
  });

  // ── assignFinalNumber ─────────────────────────────────────────────────────

  describe('assignFinalNumber', () => {
    it('throws "final number already assigned" if documents.final_number is not null', async () => {
      let selectCount = 0;
      const trx: any = {
        execute: vi.fn(),
        select: vi.fn(() => {
          selectCount++;
          // findDocumentById — returns doc with finalNumber set
          return makeBuilder([DOCUMENT_WITH_FINAL]);
        }),
        insert: vi.fn(),
        update: vi.fn(() => makeBuilder([])),
      };
      const db: any = { transaction: vi.fn(async (cb: any) => cb(trx)) };
      const svc = new NumberingService({ db, logger: mockLogger });

      await expect(
        svc.assignFinalNumber('doc-1', 'sp_resolution', 'city-1', 'actor-1'),
      ).rejects.toThrow('final number already assigned');

      expect(trx.insert).not.toHaveBeenCalled();
    });

    it('inserts final row, supersedes preliminary, sets final_number, clears preliminary_number', async () => {
      const year = new Date().getFullYear();
      const docRow = { id: 'doc-1', finalNumber: null, preliminaryNumber: 'Draft 7SP 2026-01' };
      const finalNumberRow = {
        id: 'num-final-1',
        numberValue: `7SP ${year}-01`,
        sequenceNumber: 1,
        sequenceYear: year,
        assignedAt: new Date(),
      };

      let selectCount = 0;
      const trx: any = {
        execute: vi.fn().mockResolvedValue({ rows: [{ sequence_value: BigInt(1), was_created: false }] }),
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeBuilder([docRow]); // findDocumentById
          return makeBuilder([SERIES]); // findNumberSeriesByKey
        }),
        insert: vi.fn(() => makeBuilder([finalNumberRow])),
        update: vi.fn(() => makeBuilder([])),
      };
      const db: any = { transaction: vi.fn(async (cb: any) => cb(trx)) };
      const svc = new NumberingService({ db, logger: mockLogger });

      const result = await svc.assignFinalNumber('doc-1', 'sp_resolution', 'city-1', 'actor-1');

      // Two UPDATE calls: supersedePreliminaryNumber + updateDocumentNumbering
      expect(trx.update).toHaveBeenCalledTimes(2);

      // updateDocumentNumbering (second update) must set finalNumber and clear preliminaryNumber
      const secondUpdateSet = trx.update.mock.results[1].value.set.mock.calls[0][0];
      expect(secondUpdateSet.finalNumber).toMatch(/^7SP \d{4}-01$/);
      expect(secondUpdateSet.preliminaryNumber).toBeNull();

      // Ledger INSERT must be for 'final' type
      const insertVals = trx.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertVals.numberType).toBe('final');

      expect(result.numberValue).toBe(finalNumberRow.numberValue);
    });
  });

  // ── logCancellationGap ────────────────────────────────────────────────────

  describe('logCancellationGap', () => {
    it('writes cancellation_reason to the numbers row', async () => {
      const updateChain = makeBuilder([]);
      const db: any = { update: vi.fn(() => updateChain) };
      const svc = new NumberingService({ db, logger: mockLogger });

      await svc.logCancellationGap('number-uuid-1', 'Document cancelled by SP Secretary', 'actor-1');

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(updateChain.set).toHaveBeenCalledWith({ cancellationReason: 'Document cancelled by SP Secretary' });
    });
  });

  // ── format rendering ──────────────────────────────────────────────────────

  describe('number format rendering', () => {
    it('formats SP_RESOLUTION preliminary number using template "Draft 7SP {YEAR}-{NN}" with padding', async () => {
      const year = new Date().getFullYear();

      let selectCount = 0;
      const trx: any = {
        execute: vi.fn().mockResolvedValue({ rows: [{ sequence_value: BigInt(5), was_created: false }] }),
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeBuilder([]); // no prelim
          return makeBuilder([SERIES]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn().mockImplementation((vals: any) => {
            return makeBuilder([{ ...vals, id: 'n1', assignedAt: new Date() }]);
          }),
        })),
        update: vi.fn(() => makeBuilder([])),
      };
      const db: any = { transaction: vi.fn(async (cb: any) => cb(trx)) };
      const svc = new NumberingService({ db, logger: mockLogger });

      await svc.assignPreliminaryNumber('doc-1', 'sp_resolution', 'city-1', 'actor-1');

      const insertedVals = trx.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertedVals.numberValue).toBe(`Draft 7SP ${year}-05`);
      expect(insertedVals.sequenceNumber).toBe(5);
    });
  });
});

