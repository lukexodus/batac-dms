import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingEventConsumer } from '../tracking.event-consumer.js';
import type { TrackingRepository } from '../tracking.repository.js';
import type { QrCodeService } from '../tracking.qr-service.js';
import type { FastifyBaseLogger } from 'fastify';
import type { DomainEvent, EventPayloadMap } from '@batac/shared';
import type { DocumentCreatedPayload, WorkflowStepCompletedPayload } from '@batac/shared/events/event-payload-map';

describe('TrackingEventConsumer', () => {
  let repository: import('vitest').Mocked<TrackingRepository>;
  let qrService: import('vitest').Mocked<QrCodeService>;
  let logger: import('vitest').Mocked<FastifyBaseLogger>;
  let consumer: TrackingEventConsumer;

  beforeEach(() => {
    repository = {
      findTrackingRecordByDocumentId: vi.fn(),
      createTrackingRecord: vi.fn(),
      appendRoutingEntry: vi.fn(),
      updateTrackingRecordCustodian: vi.fn(),
    } as any;

    qrService = {
      generateAndStore: vi.fn(),
    } as any;

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    consumer = new TrackingEventConsumer(repository, qrService, logger);
  });

  describe('handleDocumentCreated', () => {
    const documentId = 'doc-123';
    const actorId = 'actor-456';
    const officeId = 'office-789';

    const event: DomainEvent<EventPayloadMap['document.created']> = {
      eventId: 'evt-1',
      eventType: 'document.created',
      occurredAt: new Date().toISOString(),
      cityId: 'city-1',
      schemaVersion: 1,
      payload: {
        documentId,
        actorId,
        ownedByOfficeId: officeId,
        documentTypeId: 'type-1',
        cityId: 'city-1',
      } as DocumentCreatedPayload,
    };

    it('creates tracking record on first call', async () => {
      repository.findTrackingRecordByDocumentId.mockResolvedValue(null);
      qrService.generateAndStore.mockResolvedValue({ id: 'qr-1' } as any);
      repository.createTrackingRecord.mockResolvedValue({ id: 'tr-1' } as any);

      await consumer.handleDocumentCreated(event);

      expect(qrService.generateAndStore).toHaveBeenCalledWith(documentId, actorId, undefined);
      expect(repository.createTrackingRecord).toHaveBeenCalledWith({
        documentId,
        qrCodeId: 'qr-1',
        currentCustodianOfficeId: officeId,
        currentStatus: 'Received by SP Secretariat',
      }, undefined);
      expect(repository.appendRoutingEntry).toHaveBeenCalledWith({
        trackingRecordId: 'tr-1',
        fromOfficeId: null,
        toOfficeId: officeId,
        actorId,
        actionDescription: 'Document logged and QR tracking number assigned',
      }, undefined);
    });

    it('is idempotent on second call with same documentId', async () => {
      repository.findTrackingRecordByDocumentId.mockResolvedValue({ id: 'tr-1' } as any);

      await consumer.handleDocumentCreated(event);

      expect(qrService.generateAndStore).not.toHaveBeenCalled();
      expect(repository.createTrackingRecord).not.toHaveBeenCalled();
      expect(repository.appendRoutingEntry).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ documentId }),
        expect.stringContaining('duplicate')
      );
    });

    it('propagates errors without swallowing', async () => {
      repository.findTrackingRecordByDocumentId.mockRejectedValue(new Error('DB connection lost'));

      await expect(consumer.handleDocumentCreated(event)).rejects.toThrow('DB connection lost');
    });
  });

  describe('handleWorkflowStepCompleted', () => {
    const documentId = 'doc-123';

    const event: DomainEvent<EventPayloadMap['workflow.step_completed']> = {
      eventId: 'evt-2',
      eventType: 'workflow.step_completed',
      occurredAt: new Date().toISOString(),
      cityId: 'city-1',
      schemaVersion: 1,
      payload: {
        documentId,
        instanceId: 'inst-1',
        stepId: 'step-1',
        stepType: 'review',
        fromOfficeId: 'office-1',
        toOfficeId: 'office-2',
        actorId: 'actor-1',
        actionDescription: 'Reviewed and forwarded',
        cityId: 'city-1',
      } as WorkflowStepCompletedPayload,
    };

    it('appends routing entry and updates custodian', async () => {
      repository.findTrackingRecordByDocumentId.mockResolvedValue({ id: 'tr-1' } as any);

      await consumer.handleWorkflowStepCompleted(event);

      expect(repository.appendRoutingEntry).toHaveBeenCalledWith({
        trackingRecordId: 'tr-1',
        fromOfficeId: 'office-1',
        toOfficeId: 'office-2',
        actorId: 'actor-1',
        actionDescription: 'Reviewed and forwarded',
      }, undefined);

      expect(repository.updateTrackingRecordCustodian).toHaveBeenCalledWith(
        'tr-1',
        'office-2',
        expect.any(Date),
        undefined
      );
    });

    it('does not update custodian if toOfficeId is null', async () => {
      repository.findTrackingRecordByDocumentId.mockResolvedValue({ id: 'tr-1' } as any);
      
      const noOfficeEvent = { ...event, payload: { ...event.payload, toOfficeId: null } as WorkflowStepCompletedPayload };
      await consumer.handleWorkflowStepCompleted(noOfficeEvent);

      expect(repository.appendRoutingEntry).toHaveBeenCalled();
      expect(repository.updateTrackingRecordCustodian).not.toHaveBeenCalled();
    });

    it('logs warning and returns if no tracking record exists', async () => {
      repository.findTrackingRecordByDocumentId.mockResolvedValue(null);

      await consumer.handleWorkflowStepCompleted(event);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ documentId }),
        expect.stringContaining('no tracking record found')
      );
      expect(repository.appendRoutingEntry).not.toHaveBeenCalled();
    });

    it('propagates errors without swallowing', async () => {
      repository.findTrackingRecordByDocumentId.mockRejectedValue(new Error('DB connection lost'));

      await expect(consumer.handleWorkflowStepCompleted(event)).rejects.toThrow('DB connection lost');
    });
  });
});
