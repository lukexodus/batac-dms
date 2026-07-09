import { eq, and, isNull, asc, sql } from 'drizzle-orm';
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
    const [row] = await db
      .insert(qrCodes)
      .values({
        documentId: input.documentId,
        trackingId: input.trackingId,
        trackingNumber: input.trackingNumber,
        generatedBy: input.generatedBy,
        ...(input.cityId ? { cityId: input.cityId } : {}),
      })
      .returning();
    return row as QrCodeRow;
  }

  async updateQrImageKey(
    qrCodeId: string,
    qrImageFileKey: string,
    db: AppDb = this.db
  ): Promise<void> {
    await db
      .update(qrCodes)
      .set({ qrImageFileKey })
      .where(eq(qrCodes.id, qrCodeId));
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
    const [row] = await db
      .insert(trackingRecords)
      .values({
        documentId: input.documentId,
        qrCodeId: input.qrCodeId,
        currentCustodianOfficeId: input.currentCustodianOfficeId,
        currentStatus: input.currentStatus,
        ...(input.cityId ? { cityId: input.cityId } : {}),
      })
      .returning();
    return row as TrackingRecordRow;
  }

  async updateTrackingRecordCustodian(
    trackingRecordId: string,
    currentCustodianOfficeId: string | null,
    lastMovedAt: Date,
    db: AppDb = this.db
  ): Promise<void> {
    await db
      .update(trackingRecords)
      .set({
        currentCustodianOfficeId,
        lastMovedAt,
      })
      .where(eq(trackingRecords.id, trackingRecordId));
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
    const [row] = await db
      .insert(routingEntries)
      .values({
        trackingRecordId: input.trackingRecordId,
        fromOfficeId: input.fromOfficeId,
        toOfficeId: input.toOfficeId,
        actorId: input.actorId,
        actionDescription: input.actionDescription,
        ...(input.cityId ? { cityId: input.cityId } : {}),
      })
      .returning();
    return row as RoutingEntryRow;
  }

  async findTrackingRecordByDocumentId(
    documentId: string,
    db: AppDb = this.db
  ): Promise<TrackingRecordSummary | null> {
    const result = await db
      .select({
        id: trackingRecords.id,
        trackingId: qrCodes.trackingId,
        documentId: trackingRecords.documentId,
        trackingNumber: qrCodes.trackingNumber,
        qrCodeS3Key: qrCodes.qrImageFileKey,
        assignedAt: qrCodes.assignedAt,
        physicalLocation: trackingRecords.physicalLocation,
      })
      .from(trackingRecords)
      .innerJoin(qrCodes, eq(trackingRecords.qrCodeId, qrCodes.id))
      .where(
        and(
          eq(trackingRecords.documentId, documentId),
          isNull(trackingRecords.deletedAt)
        )
      )
      .limit(1);

    const row = result[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      trackingId: row.trackingId,
      documentId: row.documentId,
      trackingNumber: row.trackingNumber,
      qrCodeS3Key: row.qrCodeS3Key ?? '',
      assignedAt: row.assignedAt,
      physicalLocation: row.physicalLocation,
    };
  }

  async findQrCodeByTrackingId(
    trackingId: string,
    db: AppDb = this.db
  ): Promise<QrCodeRow | null> {
    const result = await db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.trackingId, trackingId), isNull(qrCodes.deletedAt)))
      .limit(1);

    return (result[0] as QrCodeRow) || null;
  }

  async findQrCodeByDocumentId(
    documentId: string,
    db: AppDb = this.db
  ): Promise<QrCodeRow | null> {
    const result = await db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.documentId, documentId), isNull(qrCodes.deletedAt)))
      .limit(1);

    return (result[0] as QrCodeRow) || null;
  }

  async getNextTrackingNumber(
    year: number,
    db: AppDb = this.db
  ): Promise<string> {
    const result = await db.execute<{ sequence_value: number; was_created: boolean }>(
      sql`SELECT * FROM tracking.fn_get_next_tracking_number(${year})`
    );
    const { sequence_value, was_created } = (result as any).rows[0];
    if (was_created) {
      // Structured log warning only (not an audit/domain event) -- same pattern
      // as documents.fn_get_next_sequence_value's was_created signal.
      console.warn({ year }, 'tracking: dts_${year}_seq auto-created on demand');
    }
    const padded = String(sequence_value).padStart(4, '0');
    return `DTS-${year}-${padded}`;
  }

  async findTrackingRecordRowByDocumentId(
    documentId: string,
    db: AppDb = this.db
  ): Promise<TrackingRecordRow | null> {
    const result = await db
      .select()
      .from(trackingRecords)
      .where(
        and(
          eq(trackingRecords.documentId, documentId),
          isNull(trackingRecords.deletedAt)
        )
      )
      .limit(1);

    return (result[0] as TrackingRecordRow) || null;
  }

  async getRoutingHistory(
    documentId: string,
    db: AppDb = this.db
  ): Promise<RoutingEntry[]> {
    const rows = await db
      .select({
        entryId: routingEntries.id,
        trackingId: qrCodes.trackingId,
        fromOfficeId: routingEntries.fromOfficeId,
        toOfficeId: routingEntries.toOfficeId,
        actorId: routingEntries.actorId,
        actionDescription: routingEntries.actionDescription,
        timestamp: routingEntries.occurredAt,
      })
      .from(routingEntries)
      .innerJoin(trackingRecords, eq(routingEntries.trackingRecordId, trackingRecords.id))
      .innerJoin(qrCodes, eq(trackingRecords.qrCodeId, qrCodes.id))
      .where(
        and(eq(trackingRecords.documentId, documentId), isNull(routingEntries.deletedAt))
      )
      .orderBy(asc(routingEntries.occurredAt));

    return rows.map((r) => ({
      entryId: r.entryId,
      trackingId: r.trackingId,
      fromOfficeId: r.fromOfficeId,
      toOfficeId: r.toOfficeId,
      actorId: r.actorId ?? 'SYSTEM',
      actionDescription: r.actionDescription,
      timestamp: r.timestamp,
    }));
  }
}
