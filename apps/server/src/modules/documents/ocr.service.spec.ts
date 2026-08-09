import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OcrService, OcrProvider, S3Client } from './ocr.service.js';
import { PreviewProvider } from './preview.provider.js';
import type PgBoss from 'pg-boss';
import type { AppDb } from '../../db.js';
import { versions } from '@batac/database/schema/documents.schema.js';

describe('OcrService', () => {
  let pgBossMock: any;
  let ocrProviderMock: any;
  let previewProviderMock: any;
  let s3ClientMock: any;
  let dbMock: any;
  let ocrService: OcrService;

  beforeEach(() => {
    pgBossMock = {
      send: vi.fn(),
    };

    ocrProviderMock = {
      extractTextFromS3Key: vi.fn(),
    };

    previewProviderMock = {
      renderFirstPage: vi.fn().mockResolvedValue(Buffer.from('test-webp')),
    };

    s3ClientMock = {
      putObject: vi.fn().mockResolvedValue({}),
    };

    const mockQueryBuilder = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ s3Key: 'test-s3-key', documentId: 'doc-1' }]),
    };

    dbMock = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    process.env['OCR_QUALITY_GOOD_THRESHOLD'] = '0.85';
    process.env['OCR_QUALITY_FAIR_THRESHOLD'] = '0.50';

    ocrService = new OcrService(
      pgBossMock as unknown as PgBoss,
      ocrProviderMock as OcrProvider,
      previewProviderMock as PreviewProvider,
      s3ClientMock as S3Client,
      'test-bucket',
      dbMock as unknown as AppDb,
    );
  });

  describe('enqueueOcrJob', () => {
    it('should enqueue an ocr.process job with correct options', async () => {
      await ocrService.enqueueOcrJob('v1', 'test/doc.pdf', 'doc1');
      expect(pgBossMock.send).toHaveBeenCalledWith(
        'ocr.process',
        { versionId: 'v1', s3Key: 'test/doc.pdf', documentId: 'doc1' },
        { retryLimit: 3, retryDelay: 30, expireInHours: 12 },
      );
    });
  });

  describe('processOcrCallback', () => {
    it('should set category good and not require manual verification for score >= 0.85', async () => {
      await ocrService.processOcrCallback('ver-1', 'text', 0.9, 'doc-1', 'application/pdf');

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalledWith({
        ocrProcessed: true,
        ocrText: 'text',
        scanQualityScore: '0.9',
        scanQualityCategory: 'good',
        requiresManualVerification: false,
        ocrStatus: 'done',
      });

      expect(previewProviderMock.renderFirstPage).toHaveBeenCalledWith(
        'test-s3-key',
        'application/pdf',
      );
      expect(s3ClientMock.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'documents/previews/doc-1/page-1.webp',
        Body: Buffer.from('test-webp'),
        ContentType: 'image/webp',
      });
    });

    it('should set category fair and not require manual verification for 0.5 <= score < 0.85', async () => {
      await ocrService.processOcrCallback('ver-1', 'text', 0.7, 'doc-1', 'application/pdf');

      expect(dbMock.set).toHaveBeenCalledWith({
        ocrProcessed: true,
        ocrText: 'text',
        scanQualityScore: '0.7',
        scanQualityCategory: 'fair',
        requiresManualVerification: false,
        ocrStatus: 'done',
      });
    });

    it('should set category poor and require manual verification for score < 0.50', async () => {
      await ocrService.processOcrCallback('ver-1', 'text', 0.3, 'doc-1', 'application/pdf');

      expect(dbMock.set).toHaveBeenCalledWith({
        ocrProcessed: true,
        ocrText: 'text',
        scanQualityScore: '0.3',
        scanQualityCategory: 'poor',
        requiresManualVerification: true,
        ocrStatus: 'done',
      });
    });

    it('should call generateFirstPagePreview unconditionally', async () => {
      await ocrService.processOcrCallback('ver-1', 'text', 0.9, 'doc-1', 'application/pdf');

      expect(previewProviderMock.renderFirstPage).toHaveBeenCalled();
      expect(s3ClientMock.putObject).toHaveBeenCalled();
    });
  });
});
