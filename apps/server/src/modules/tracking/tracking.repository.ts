import type { InferSelectModel } from 'drizzle-orm';
import type { AppDb } from '../../db.js';
import { qrCodes, trackingRecords, routingEntries } from './tracking.db.js';
import type { TrackingRecordSummary, RoutingEntry } from './index.js';

export type QrCodeRow = InferSelectModel<typeof qrCodes>;
export type TrackingRecordRow = InferSelectModel<typeof trackingRecords>;
export type RoutingEntryRow = InferSelectModel<typeof routingEntries>;

export class TrackingRepository {
  constructor(private readonly db: AppDb) {}

  async createQrCode(
    input: {
      documentId: string;
      trackingId: string;
      trackingNumber: string;
      generatedBy: string | null;
      cityId?: string;
    },
    db: AppDb = this.db
  ): Promise<QrCodeRow> {
    throw new Error('not implemented');
  }

  async updateQrImageKey(
    qrCodeId: string,
    qrImageFileKey: string,
    db: AppDb = this.db
  ): Promise<void> {
    throw new Error('not implemented');
  }

  async createTrackingRecord(
    input: {
      documentId: string;
      qrCodeId: string;
      currentCustodianOfficeId: string | null;
      currentStatus?: string;
      cityId?: string;
    },
    db: AppDb = this.db
  ): Promise<TrackingRecordRow> {
    throw new Error('not implemented');
  }

  async updateTrackingRecordCustodian(
    trackingRecordId: string,
    currentCustodianOfficeId: string | null,
    lastMovedAt: Date,
    db: AppDb = this.db
  ): Promise<void> {
    throw new Error('not implemented');
  }

  async appendRoutingEntry(
    input: {
      trackingRecordId: string;
      fromOfficeId: string | null;
      toOfficeId: string | null;
      actorId: string | null;
      actionDescription: string;
      cityId?: string;
    },
    db: AppDb = this.db
  ): Promise<RoutingEntryRow> {
    throw new Error('not implemented');
  }

  async findTrackingRecordByDocumentId(
    documentId: string,
    db: AppDb = this.db
  ): Promise<TrackingRecordSummary | null> {
    throw new Error('not implemented');
  }

  async findQrCodeByTrackingId(
    trackingId: string,
    db: AppDb = this.db
  ): Promise<QrCodeRow | null> {
    throw new Error('not implemented');
  }

  async getNextTrackingNumber(
    year: number,
    db: AppDb = this.db
  ): Promise<string> {
    throw new Error('not implemented');
  }

  async getRoutingHistory(
    documentId: string,
    db: AppDb = this.db
  ): Promise<RoutingEntry[]> {
    throw new Error('not implemented');
  }
}
