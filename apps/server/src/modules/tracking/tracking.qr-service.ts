import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppDb } from '../../db.js';
import type { TrackingRepository, QrCodeRow } from './tracking.repository.js';
import type { ServerEnv } from '../../config/env.server.js';

export class QrCodeService {
  constructor(
    private readonly repository: TrackingRepository,
    private readonly s3Client: S3Client,
    private readonly env: ServerEnv,
    private readonly db?: AppDb
  ) {}

  async generateAndStore(
    documentId: string,
    actorId: string,
    db?: AppDb
  ): Promise<QrCodeRow> {
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
    
    await this.s3Client.send(command);

    // Save to DB
    const qrCodeRow = await this.repository.createQrCode(
      {
        documentId,
        trackingId,
        trackingNumber,
        generatedBy: actorId,
      },
      db
    );

    await this.repository.updateQrImageKey(qrCodeRow.id, qrImageFileKey, db);
    // Refresh to get the updated row
    qrCodeRow.qrImageFileKey = qrImageFileKey;

    return qrCodeRow;
  }

  async generateCoverSheetPdf(
    documentId: string
  ): Promise<Buffer> {
    throw new Error('not implemented');
  }
}
