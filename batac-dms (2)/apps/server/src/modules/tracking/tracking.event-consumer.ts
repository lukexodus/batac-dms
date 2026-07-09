import type { DomainEvent, EventPayloadMap } from '@batac/shared';
import type { TrackingRepository } from './tracking.repository.js';
import type { QrCodeService } from './tracking.qr-service.js';
import type { AppDb } from '../../db.js';
import type { FastifyBaseLogger } from 'fastify';
import type { DocumentCreatedPayload, WorkflowStepCompletedPayload } from '@batac/shared/events/event-payload-map';

export class TrackingEventConsumer {
  constructor(
    private readonly repository: TrackingRepository,
    private readonly qrService: QrCodeService,
    private readonly logger: FastifyBaseLogger,
    private readonly db?: AppDb
  ) {}

  async handleDocumentCreated(
    event: DomainEvent<EventPayloadMap['document.created']>
  ): Promise<void> {
    const payload = event.payload as DocumentCreatedPayload;

    // 1. Idempotency guard
    const existing = await this.repository.findTrackingRecordByDocumentId(payload.documentId);
    if (existing) {
      this.logger.info({ documentId: payload.documentId, eventId: event.eventId },
        'tracking: document.created duplicate — tracking record already exists, skipping');
      return;
    }

    // 2. Generate QR code and create qr_codes row
    const qrRow = await this.qrService.generateAndStore(payload.documentId, payload.actorId, this.db);

    // 3. Create tracking_records row
    const trackingRecord = await this.repository.createTrackingRecord({
      documentId: payload.documentId,
      qrCodeId: qrRow.id,
      currentCustodianOfficeId: payload.ownedByOfficeId,
      currentStatus: 'Received by SP Secretariat',
    }, this.db);

    // 4. Append initial routing entry
    await this.repository.appendRoutingEntry({
      trackingRecordId: trackingRecord.id,
      fromOfficeId: null,          // no prior office at first receipt
      toOfficeId: payload.ownedByOfficeId,
      actorId: payload.actorId,
      actionDescription: 'Document logged and QR tracking number assigned',
    }, this.db);
  }

  async handleWorkflowStepCompleted(
    event: DomainEvent<EventPayloadMap['workflow.step_completed']>
  ): Promise<void> {
    const payload = event.payload as WorkflowStepCompletedPayload;

    const trackingRecord = await this.repository.findTrackingRecordByDocumentId(payload.documentId, this.db);
    if (!trackingRecord) {
      this.logger.warn({ documentId: payload.documentId, eventId: event.eventId },
        'tracking: workflow.step_completed — no tracking record found for document, skipping');
      return;  // not an error — may be a document type without tracking
    }

    await this.repository.appendRoutingEntry({
      trackingRecordId: trackingRecord.id,  // resolve the actual tracking_records.id
      fromOfficeId: payload.fromOfficeId,
      toOfficeId: payload.toOfficeId,
      actorId: payload.actorId,
      actionDescription: payload.actionDescription,
    }, this.db);

    if (payload.toOfficeId) {
      await this.repository.updateTrackingRecordCustodian(
        trackingRecord.id,  // tracking_records.id
        payload.toOfficeId,
        new Date(),
        this.db
      );
    }
  }
}
