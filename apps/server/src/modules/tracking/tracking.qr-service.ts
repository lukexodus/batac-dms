/**
 * tracking.qr-service.ts — QR code generation and cover sheet PDF creation.
 *
 * generateAndStore: generates a QR image, uploads to S3, inserts into DB.
 * generateCoverSheetPdf: builds a PDF with one or more cover sheets.
 *
 * Cover sheet layout (confirmed — E1 §Module 5 tracking.printQrCoverSheet,
 * Q-B02 in consolidated reference):
 *   - Three fields only: QR Code image, Tracking Number, Series Number.
 *   - Sized to take only the space needed (horizontal rectangle, not A4).
 *   - 'multi_per_page': multiple cover sheets per physical A4 page.
 *   - 'single': one cover sheet per page.
 *
 * [Inference] Series Number is derived from the document's preliminaryNumber
 * falling back to finalNumber (the nearest equivalent to a "series number" at
 * the time of QR generation). See LOG-0038 in the findings log.
 *
 * [Inference] pdf-lib (pure Node.js) is used rather than @react-pdf/renderer
 * (which requires a React environment). The tech-stack lists both; pdf-lib is
 * the server-side choice for this PDF.
 */

import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppDb } from '../../db.js';
import type { TrackingRepository, QrCodeRow } from './tracking.repository.js';
import type { ServerEnv } from '../../config/env.server.js';

// ─── Cover sheet dimensions (in PDF units / points) ──────────────────────────

/** Width of a single cover sheet (A5 landscape-ish, in pt). */
const COVER_WIDTH_PT = 297;
/** Height of a single cover sheet card. */
const COVER_HEIGHT_PT = 105;
/** Number of cover sheets per page in multi_per_page layout. */
const COVERS_PER_PAGE = 3;
/** Margin between sheets and from page edge (pt). */
const MARGIN_PT = 12;
/** Physical page size: A4 portrait (595 × 842 pt). */
const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;

export class QrCodeService {
  constructor(
    private readonly repository: TrackingRepository,
    private readonly s3Client: S3Client,
    private readonly env: ServerEnv,
    private readonly db?: AppDb,
  ) {}

  async generateAndStore(documentId: string, actorId: string, db?: AppDb): Promise<QrCodeRow> {
    const currentYear = new Date().getFullYear();
    const trackingId = randomUUID();

    // Get the next tracking number (e.g. DTS-2026-0001)
    const trackingNumber = await this.repository.getNextTrackingNumber(currentYear, db);

    // Generate QR image buffer
    const qrBuffer = await QRCode.toBuffer(trackingId, {
      type: 'png',
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    const qrImageFileKey = `qr-codes/${trackingId}.png`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: qrImageFileKey,
      Body: qrBuffer,
      ContentType: 'image/png',
    });

    try {
      await this.s3Client.send(command);
    } catch (err) {
      console.warn('Failed to upload QR code to S3, proceeding without it', err);
    }

    // Save to DB
    const qrCodeRow = await this.repository.createQrCode(
      {
        documentId,
        trackingId,
        trackingNumber,
        generatedBy: actorId,
      },
      db,
    );

    try {
      // qr_image_file_key is a UUID column (see tracking/index.ts: "UUID key,
      // not a full URL") — store the trackingId; consumers derive the S3
      // object key as `qr-codes/{uuid}.png`.
      await this.repository.updateQrImageKey(qrCodeRow.id, trackingId, db);
      // Refresh to get the updated row
      qrCodeRow.qrImageFileKey = trackingId;
    } catch (err) {
      console.warn('Failed to update QR image key', err);
    }

    return qrCodeRow;
  }

  /**
   * Generate a QR cover sheet PDF for one or more documents.
   *
   * Each cover sheet contains exactly three fields (Q-B02, E1 §Module 5):
   *   1. QR Code image (fetched from S3 by qrImageFileKey)
   *   2. Tracking Number  (e.g. DTS-2026-0001)
   *   3. Series Number    (preliminaryNumber ?? finalNumber ?? '')
   *
   * Layout modes:
   *   - 'single'        → one cover sheet per PDF page.
   *   - 'multi_per_page' → up to COVERS_PER_PAGE cover sheets per A4 page,
   *                         stacked vertically (saves paper — Q-B02).
   *
   * @param documentIds  UUIDs of documents whose cover sheets to include.
   * @param layout       Page layout mode.
   * @param documentsRepo  Optional DocumentsRepository to fetch series number.
   */
  async generateCoverSheetPdf(
    documentIds: string[],
    layout: 'single' | 'multi_per_page' = 'multi_per_page',
    documentsRepo?: {
      findById(
        id: string,
      ): Promise<{ preliminaryNumber?: string | null; finalNumber?: string | null } | null>;
    },
  ): Promise<Buffer> {
    // Dynamically import pdf-lib so the module doesn't hard-fail if pdf-lib
    // is not yet installed (dev startup without the dep present).
    let PDFDocument: any;
    let rgb: any;
    try {
      const pdfLib = await import('pdf-lib');
      PDFDocument = pdfLib.PDFDocument;
      rgb = pdfLib.rgb;
    } catch {
      throw new Error('pdf-lib is not installed. Run: pnpm add pdf-lib --filter server');
    }

    // Collect cover sheet data for each document
    const sheets: Array<{
      qrPngBuffer: Buffer | null;
      trackingNumber: string;
      seriesNumber: string;
    }> = [];

    for (const documentId of documentIds) {
      const qrCode = await this.repository.findQrCodeByDocumentId(documentId);

      if (!qrCode) {
        throw new Error(`Tracking record and QR code not found for document ${documentId}. Ensure the document has been submitted.`);
      }

      let qrPngBuffer: Buffer | null = null;
      let trackingNumber = '';

      if (qrCode) {
        trackingNumber = qrCode.trackingNumber;

        // Fetch QR image from S3 (qr_image_file_key holds the trackingId UUID;
        // the object key is derived as `qr-codes/{uuid}.png`)
        if (qrCode.qrImageFileKey) {
          try {
            const { Body } = await this.s3Client.send(
              new GetObjectCommand({
                Bucket: this.env.S3_BUCKET,
                Key: `qr-codes/${qrCode.qrImageFileKey}.png`,
              }),
            );
            if (Body) {
              const chunks: Uint8Array[] = [];
              for await (const chunk of Body as AsyncIterable<Uint8Array>) {
                chunks.push(chunk);
              }
              qrPngBuffer = Buffer.concat(chunks);
            }
          } catch {
            // If S3 fetch fails, render a fallback QR from the trackingId
            qrPngBuffer = await QRCode.toBuffer(qrCode.trackingId, {
              type: 'png',
              margin: 2,
              errorCorrectionLevel: 'H',
            });
          }
        }

        // Fallback QR generation if no stored key
        if (!qrPngBuffer) {
          qrPngBuffer = await QRCode.toBuffer(qrCode.trackingId, {
            type: 'png',
            margin: 2,
            errorCorrectionLevel: 'H',
          });
        }
      }

      // Series number: preliminaryNumber ?? finalNumber ?? ''
      // [Inference] See LOG-0038. A human should confirm this interpretation.
      let seriesNumber = '';
      if (documentsRepo) {
        const doc = await documentsRepo.findById(documentId);
        seriesNumber = doc?.preliminaryNumber ?? doc?.finalNumber ?? '';
      }

      sheets.push({ qrPngBuffer, trackingNumber, seriesNumber });
    }

    // Build the PDF using pdf-lib
    const pdfDoc = await PDFDocument.create();

    if (layout === 'single') {
      for (const sheet of sheets) {
        const page = pdfDoc.addPage([COVER_WIDTH_PT, COVER_HEIGHT_PT]);
        await drawCoverSheet(pdfDoc, page, sheet, rgb, 0, 0, COVER_WIDTH_PT, COVER_HEIGHT_PT);
      }
    } else {
      // multi_per_page: stack up to COVERS_PER_PAGE per A4 page
      for (let i = 0; i < sheets.length; i += COVERS_PER_PAGE) {
        const page = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
        const batch = sheets.slice(i, i + COVERS_PER_PAGE);

        for (let j = 0; j < batch.length; j++) {
          const y = PAGE_HEIGHT_PT - MARGIN_PT - (j + 1) * COVER_HEIGHT_PT - j * MARGIN_PT;
          await drawCoverSheet(
            pdfDoc,
            page,
            batch[j]!,
            rgb,
            MARGIN_PT,
            y,
            COVER_WIDTH_PT,
            COVER_HEIGHT_PT,
          );
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

/**
 * Draw a single cover sheet card onto a pdf-lib page at (x, y).
 * Contains: QR image (left), Tracking Number (center), Series Number (below).
 */
async function drawCoverSheet(
  pdfDoc: any,
  page: any,
  sheet: { qrPngBuffer: Buffer | null; trackingNumber: string; seriesNumber: string },
  rgb: any,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  const padding = 8;
  const qrSize = height - padding * 2;
  const textX = x + qrSize + padding * 2;
  const textAreaWidth = width - qrSize - padding * 3;

  // Draw border
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 0.5,
  });

  // Draw QR image (if available)
  if (sheet.qrPngBuffer) {
    try {
      const qrImage = await pdfDoc.embedPng(sheet.qrPngBuffer);
      page.drawImage(qrImage, {
        x: x + padding,
        y: y + padding,
        width: qrSize,
        height: qrSize,
      });
    } catch {
      // Image embed failed — draw a placeholder box
      page.drawRectangle({
        x: x + padding,
        y: y + padding,
        width: qrSize,
        height: qrSize,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });
    }
  }

  // Text baseline from top of card
  const labelFontSize = 7;
  const valueFontSize = 11;

  // "Tracking No." label
  page.drawText('Tracking No.', {
    x: textX,
    y: y + height - padding - labelFontSize - 2,
    size: labelFontSize,
    color: rgb(0.4, 0.4, 0.4),
    maxWidth: textAreaWidth,
  });

  // Tracking number value
  page.drawText(sheet.trackingNumber || '—', {
    x: textX,
    y: y + height - padding - labelFontSize - valueFontSize - 4,
    size: valueFontSize,
    color: rgb(0, 0, 0),
    maxWidth: textAreaWidth,
  });

  // "Series No." label
  const seriesLabelY = y + height - padding - labelFontSize - valueFontSize - 14;
  page.drawText('Series No.', {
    x: textX,
    y: seriesLabelY,
    size: labelFontSize,
    color: rgb(0.4, 0.4, 0.4),
    maxWidth: textAreaWidth,
  });

  // Series number value
  page.drawText(sheet.seriesNumber || '—', {
    x: textX,
    y: seriesLabelY - valueFontSize - 2,
    size: valueFontSize,
    color: rgb(0, 0, 0),
    maxWidth: textAreaWidth,
  });
}
