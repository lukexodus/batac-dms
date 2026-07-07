import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QrCodeService } from '../tracking.qr-service.js';
import type { TrackingRepository } from '../tracking.repository.js';
import { S3Client } from '@aws-sdk/client-s3';
import type { ServerEnv } from '../../../config/env.server.js';
import QRCode from 'qrcode';

// Mock QRCode
vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-qr-buffer')),
  }
}));

describe('QrCodeService', () => {
  let mockRepo: any;
  let mockS3Client: any;
  let mockEnv: ServerEnv;
  let service: QrCodeService;

  beforeEach(() => {
    mockRepo = {
      getNextTrackingNumber: vi.fn().mockResolvedValue('DTS-2026-0001'),
      createQrCode: vi.fn().mockResolvedValue({
        id: 'mock-qr-id',
        documentId: 'doc-1',
        trackingId: 'mock-uuid',
        trackingNumber: 'DTS-2026-0001',
        qrImageFileKey: null,
      }),
      updateQrImageKey: vi.fn().mockResolvedValue(undefined),
    };

    mockS3Client = {
      send: vi.fn().mockResolvedValue({}),
    };

    mockEnv = {
      S3_BUCKET: 'mock-bucket',
    } as any;

    service = new QrCodeService(
      mockRepo as unknown as TrackingRepository,
      mockS3Client as unknown as S3Client,
      mockEnv,
    );
  });

  describe('generateAndStore', () => {
    it('generates tracking number, QR, uploads to S3, and saves to DB', async () => {
      const documentId = 'doc-1';
      const actorId = 'actor-1';

      const result = await service.generateAndStore(documentId, actorId);

      // Verify DB sequence was requested
      expect(mockRepo.getNextTrackingNumber).toHaveBeenCalledWith(new Date().getFullYear(), undefined);

      // Verify QR Code generation
      expect(QRCode.toBuffer).toHaveBeenCalled();
      
      // Verify S3 upload
      expect(mockS3Client.send).toHaveBeenCalled();
      const commandArgs = mockS3Client.send.mock.calls[0][0];
      expect(commandArgs.input).toMatchObject({
        Bucket: 'mock-bucket',
        ContentType: 'image/png',
        Body: Buffer.from('mock-qr-buffer'),
      });
      // The Key should be qr-codes/{uuid}.png
      expect(commandArgs.input.Key).toMatch(/^qr-codes\/[a-f0-9\-]+\.png$/);

      // Verify DB creation
      expect(mockRepo.createQrCode).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'doc-1',
          trackingNumber: 'DTS-2026-0001',
          generatedBy: 'actor-1',
        }),
        undefined
      );

      // Verify DB update
      expect(mockRepo.updateQrImageKey).toHaveBeenCalledWith('mock-qr-id', commandArgs.input.Key, undefined);

      expect(result).toMatchObject({
        id: 'mock-qr-id',
        trackingNumber: 'DTS-2026-0001',
        qrImageFileKey: commandArgs.input.Key,
      });
    });
  });

  describe('generateCoverSheetPdf', () => {
    it('calls findQrCodeByDocumentId and QRCode.toBuffer for fallback QR when no S3 key', async () => {
      // Arrange: repo returns a QR code row with no image key stored
      mockRepo.findQrCodeByDocumentId = vi.fn().mockResolvedValue({
        id: 'qr-1',
        documentId: 'doc-1',
        trackingId: 'mock-tracking-uuid',
        trackingNumber: 'DTS-2026-0001',
        qrImageFileKey: null,
        assignedAt: new Date(),
        deletedAt: null,
      });

      // Mock pdf-lib dynamic import
      vi.doMock('pdf-lib', () => ({
        PDFDocument: {
          create: vi.fn().mockResolvedValue({
            addPage: vi.fn().mockReturnValue({
              drawRectangle: vi.fn(),
              drawImage: vi.fn(),
              drawText: vi.fn(),
            }),
            embedPng: vi.fn().mockResolvedValue({}),
            save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
          }),
        },
        rgb: vi.fn().mockReturnValue({}),
      }));

      const result = await service.generateCoverSheetPdf(['doc-1'], 'single');

      expect(mockRepo.findQrCodeByDocumentId).toHaveBeenCalledWith('doc-1');
      // Fallback QR generation via QRCode.toBuffer
      expect(QRCode.toBuffer).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Buffer);
    });

    it('returns a buffer when pdf-lib is available and multi_per_page layout is used', async () => {
      mockRepo.findQrCodeByDocumentId = vi.fn().mockResolvedValue({
        id: 'qr-2',
        documentId: 'doc-2',
        trackingId: 'uuid-2',
        trackingNumber: 'DTS-2026-0002',
        qrImageFileKey: null,
        assignedAt: new Date(),
        deletedAt: null,
      });

      vi.doMock('pdf-lib', () => ({
        PDFDocument: {
          create: vi.fn().mockResolvedValue({
            addPage: vi.fn().mockReturnValue({
              drawRectangle: vi.fn(),
              drawImage: vi.fn(),
              drawText: vi.fn(),
            }),
            embedPng: vi.fn().mockResolvedValue({}),
            save: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
          }),
        },
        rgb: vi.fn().mockReturnValue({}),
      }));

      const result = await service.generateCoverSheetPdf(['doc-2'], 'multi_per_page');
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
