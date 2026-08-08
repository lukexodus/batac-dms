import { eq } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { versions } from '@batac/database/schema/documents.schema.js';
import type { AppDb } from '../../db.js';
import type { PreviewProvider } from './preview.provider.js';

export interface OcrProvider {
  extractTextFromS3Key(
    s3Key: string,
    mimeType: string,
  ): Promise<{
    text: string;
    confidenceScore: number;
  }>;
}

export class StubOcrProvider implements OcrProvider {
  async extractTextFromS3Key(): Promise<never> {
    throw new Error('OCR provider not configured -- set OCR_PROVIDER in environment');
  }
}

// Minimal interface for S3Client to satisfy dependency injection
export interface S3Client {
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer;
    ContentType: string;
  }): Promise<any>;
}

export class OcrService {
  private readonly GOOD_THRESHOLD: number;
  private readonly FAIR_THRESHOLD: number;

  constructor(
    private readonly pgBoss: PgBoss,
    private readonly ocrProvider: OcrProvider,
    private readonly previewProvider: PreviewProvider,
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly db: AppDb,
  ) {
    this.GOOD_THRESHOLD = parseFloat(process.env['OCR_QUALITY_GOOD_THRESHOLD'] ?? '0.85');
    this.FAIR_THRESHOLD = parseFloat(process.env['OCR_QUALITY_FAIR_THRESHOLD'] ?? '0.50');
  }

  private categorize(score: number): 'good' | 'fair' | 'poor' {
    if (score >= this.GOOD_THRESHOLD) return 'good';
    if (score >= this.FAIR_THRESHOLD) return 'fair';
    return 'poor';
  }

  async processJob(payload: { versionId: string; s3Key: string; documentId: string }): Promise<void> {
    const { versionId, s3Key, documentId } = payload;

    const versionRows = await this.db
      .select({ mimeType: versions.mimeType })
      .from(versions)
      .where(eq(versions.id, versionId))
      .limit(1);

    const mimeType = versionRows[0]?.mimeType;
    if (!mimeType) {
      throw new Error(`processJob: version ${versionId} not found or has no mimeType`);
    }

    const { text, confidenceScore } = await this.ocrProvider.extractTextFromS3Key(s3Key, mimeType);
    await this.processOcrCallback(versionId, text, confidenceScore, documentId, mimeType, s3Key);
  }

  async enqueueOcrJob(versionId: string, s3Key: string, documentId: string): Promise<void> {
    await this.pgBoss.send(
      'ocr.process',
      { versionId, s3Key, documentId },
      {
        retryLimit: 3,
        retryDelay: 30,
        expireInHours: 12,
      },
    );
  }

  async enqueueManualReOcrJob(versionId: string): Promise<void> {
    const result = await this.db
      .select({ s3Key: versions.fileKey, documentId: versions.documentId })
      .from(versions)
      .where(eq(versions.id, versionId))
      .limit(1);

    if (!result || result.length === 0) {
      throw new Error(`Version ${versionId} not found`);
    }

    const firstResult = result[0];
    if (!firstResult) {
      throw new Error(`Version ${versionId} not found`);
    }

    const { s3Key, documentId } = firstResult;
    await this.enqueueOcrJob(versionId, s3Key, documentId);
  }

  async generateFirstPagePreview(
    documentId: string,
    s3Key: string,
    mimeType: string,
  ): Promise<void> {
    const webpBuffer = await this.previewProvider.renderFirstPage(s3Key, mimeType);
    const previewKey = `documents/previews/${documentId}/page-1.webp`;
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: previewKey,
      Body: webpBuffer,
      ContentType: 'image/webp',
    });
  }

  async processOcrCallback(
    versionId: string,
    ocrText: string,
    scanQualityScore: number,
    documentId: string,
    mimeType: string,
    s3Key?: string,
  ): Promise<void> {
    const category = this.categorize(scanQualityScore);
    const requiresManualVerification = category === 'poor';

    await this.db
      .update(versions)
      .set({
        ocrProcessed: true,
        ocrText,
        scanQualityScore: scanQualityScore.toString(),
        scanQualityCategory: category,
        requiresManualVerification,
      })
      .where(eq(versions.id, versionId));

    let fileKey = s3Key;
    if (!fileKey) {
      const versionRecord = await this.db
        .select({ s3Key: versions.fileKey })
        .from(versions)
        .where(eq(versions.id, versionId))
        .limit(1);
      if (versionRecord && versionRecord.length > 0) {
        const firstVersion = versionRecord[0];
        if (firstVersion) {
          fileKey = firstVersion.s3Key;
        }
      }
    }

    if (fileKey) {
      await this.generateFirstPagePreview(documentId, fileKey, mimeType);
    }
  }
}
