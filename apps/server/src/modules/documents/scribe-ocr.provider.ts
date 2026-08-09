import scribe from 'scribe.js-ocr';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { OcrProvider } from './ocr.service.js';

export class ScribeOcrProvider implements OcrProvider {
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucket: string,
  ) {}

  async extractTextFromS3Key(
    s3Key: string,
    mimeType: string,
  ): Promise<{ text: string; confidenceScore: number }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error(`Could not read object body from S3 key: ${s3Key}`);
    }

    const buffer = Buffer.from(await response.Body.transformToByteArray());
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    const languagePacks = process.env['OCR_LANGUAGE_PACKS'] || 'eng+fil';
    const langs = languagePacks.split('+');

    let files: { pdfFiles?: ArrayBuffer[]; imageFiles?: ArrayBuffer[] };
    if (mimeType === 'application/pdf') {
      files = { pdfFiles: [arrayBuffer] };
    } else if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
      files = { imageFiles: [arrayBuffer] };
    } else {
      // OcrService.processJob (ocr.service.ts) already filters out
      // non-OCR-able MIME types via OCR_ABLE_MIME_TYPES before this method
      // is ever called in the normal job-processing path. This branch is a
      // defensive fallback for any other caller, direct test invocation,
      // or future MIME type added to AllowedMimeTypeSchema without a
      // matching update to OCR_ABLE_MIME_TYPES -- it intentionally still
      // throws rather than silently no-op'ing, so a real gap doesn't fail
      // silently.
      throw new Error(`Unsupported MIME type for OCR: ${mimeType}`);
    }

    const doc = await scribe.openDocument(files);
    try {
      await doc.recognize({ langs, ocrPages: 'autoShallow' });

      const pages = doc.ocr.active;
      const textParts: string[] = [];
      const allConfidences: number[] = [];

      for (const page of pages) {
        for (const line of page.lines) {
          for (const word of line.words) {
            textParts.push(word.text);
            allConfidences.push(word.conf);
          }
        }
      }

      const text = textParts.join(' ');
      const confidenceScore =
        allConfidences.length > 0
          ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length / 100
          : 0;

      return { text, confidenceScore };
    } finally {
      await doc.close();
    }
  }
}
