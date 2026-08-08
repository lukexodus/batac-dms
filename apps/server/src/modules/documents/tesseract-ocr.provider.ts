import { createWorker } from 'tesseract.js';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { OcrProvider } from './ocr.service.js';

export class TesseractOcrProvider implements OcrProvider {
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucket: string,
  ) {}

  async extractTextFromS3Key(
    s3Key: string,
    mimeType: string,
  ): Promise<{ text: string; confidenceScore: number }> {
    // 1. Fetch file from S3
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error(`Could not read object body from S3 key: ${s3Key}`);
    }

    // Convert S3 Readable stream to Buffer
    const buffer = Buffer.from(await response.Body.transformToByteArray());

    // 2. Initialize Tesseract worker
    const languagePacks = process.env['OCR_LANGUAGE_PACKS'] || 'eng+fil';
    const worker = await createWorker(languagePacks);

    try {
      // 3. Perform OCR
      const ret = await worker.recognize(buffer);
      
      // tesseract.js returns confidence on a 0-100 scale. We normalize to 0.0-1.0
      const confidenceScore = ret.data.confidence / 100;
      
      return {
        text: ret.data.text,
        confidenceScore,
      };
    } finally {
      await worker.terminate();
    }
  }
}
