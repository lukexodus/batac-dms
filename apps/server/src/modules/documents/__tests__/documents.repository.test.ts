import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsRepository } from '../documents.repository.js';
import type { DbClient } from '../documents.types.js';
import {
  documents,
  numbers,
  classificationAllowlists,
} from '@batac/database/schema/documents.schema.js';

describe('DocumentsRepository', () => {
  let mockDb: any;
  let repo: DocumentsRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    repo = new DocumentsRepository(mockDb as unknown as DbClient);
  });

  describe('insertDocument -> findDocumentById round-trip', () => {
    it('successfully inserts a document and then retrieves it by ID', async () => {
      const mockInsertInput = {
        title: 'Draft Resolution',
        documentTypeId: '550e8400-e29b-41d4-a716-446655440000',
        classificationLevel: 'internal',
        qrTrackingNumber: '550e8400-e29b-41d4-a716-446655440001',
        originatingOfficeId: '550e8400-e29b-41d4-a716-446655440002',
        ownedByOfficeId: '550e8400-e29b-41d4-a716-446655440002',
        createdBy: '550e8400-e29b-41d4-a716-446655440003',
        retentionScheduleId: '550e8400-e29b-41d4-a716-446655440004',
      };

      const mockResultRow = {
        id: '550e8400-e29b-41d4-a716-446655449999',
        ...mockInsertInput,
        lifecycleState: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Mock DB for insertDocument
      mockDb.returning.mockResolvedValueOnce([mockResultRow]);
      const inserted = await repo.insertDocument(mockInsertInput as any);

      expect(inserted).toEqual(mockResultRow);
      expect(mockDb.insert).toHaveBeenCalledWith(documents);
      expect(mockDb.values).toHaveBeenCalledWith(mockInsertInput);

      // Mock DB for findDocumentById
      mockDb.where.mockResolvedValueOnce([mockResultRow]);
      const retrieved = await repo.findDocumentById(mockResultRow.id);

      expect(retrieved).toEqual(mockResultRow);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(documents);
    });

    it('returns null when looking up a non-existent or deleted document', async () => {
      mockDb.where.mockResolvedValueOnce([]);
      const result = await repo.findDocumentById('550e8400-e29b-41d4-a716-446655449999');
      expect(result).toBeNull();
    });
  });

  describe('insertNumber -> findCurrentNumber', () => {
    it('successfully appends a numbering ledger entry and finds current number', async () => {
      const mockNumberInput = {
        documentId: '550e8400-e29b-41d4-a716-446655449999',
        numberSeriesId: '550e8400-e29b-41d4-a716-446655448888',
        numberType: 'preliminary',
        numberValue: 'Draft 7SP 2026-01',
        sequenceYear: 2026,
        sequenceNumber: 1,
        assignedBy: '550e8400-e29b-41d4-a716-446655440003',
      };

      const mockNumberRow = {
        id: '550e8400-e29b-41d4-a716-446655447777',
        ...mockNumberInput,
        isCurrent: true,
        assignedAt: new Date(),
        supersededAt: null,
        createdAt: new Date(),
        deletedAt: null,
      };

      // Mock DB for insertNumber
      mockDb.returning.mockResolvedValueOnce([mockNumberRow]);
      const inserted = await repo.insertNumber(mockNumberInput as any);

      expect(inserted).toEqual(mockNumberRow);
      expect(mockDb.insert).toHaveBeenCalledWith(numbers);
      expect(mockDb.values).toHaveBeenCalledWith(mockNumberInput);

      // Mock DB for findCurrentNumber
      mockDb.limit.mockResolvedValueOnce([mockNumberRow]);
      const current = await repo.findCurrentNumber(
        mockNumberInput.documentId,
        mockNumberInput.numberType,
      );

      expect(current).toEqual(mockNumberRow);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(numbers);
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('returns null if no current number is found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const result = await repo.findCurrentNumber('550e8400-e29b-41d4-a716-446655449999', 'final');
      expect(result).toBeNull();
    });
  });

  describe('hasClassificationAllowlistEntry', () => {
    it('returns true if a matching allowlist entry exists', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'allowlist-1' }]);
      const result = await repo.hasClassificationAllowlistEntry('type-1', 'role-1', 'city-1');
      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(classificationAllowlists);
    });

    it('returns false for unlisted type/role/city pairs', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const result = await repo.hasClassificationAllowlistEntry('type-2', 'role-2', 'city-2');
      expect(result).toBe(false);
    });
  });
});
