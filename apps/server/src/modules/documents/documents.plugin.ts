import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import { FinalNumberAlreadyAssignedError } from '../../errors/domain/documents.js';
import type { FastifyInstance } from 'fastify';
import type { WorkflowPublicAPI } from '../workflow/index.js';
import { createDocumentsService } from './documents.service.js';
import { createDocumentsAppRouter } from './documents.app.router.js';
import { DocumentsRepository } from './documents.repository.js';
import { DocumentPolicyGuard } from './documents.policy.js';
import { NumberingService } from './numbering.service.js';
import { DesignationHandler } from './designation.handler.js';
import { OcrService, StubOcrProvider } from './ocr.service.js';
import { StubPreviewProvider } from './preview.provider.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import {
  createEventConsumerDb,
  type EventConsumerDb,
} from '../../infrastructure/event-consumer-db.js';
import type { DocumentsPublicAPI } from './documents.types.js';

/**
 * [Inference — TASK-DOCS-011] `documentsRepository` and `documentsPolicyGuard`
 * were not previously decorated on fastify (only `documentsService` and
 * `documentsTrpcRouter` were) — documents.router.ts (general CRUD) needs
 * direct repository access for reads that aren't exposed on
 * DocumentsPublicAPI, and the policy guard, per the ABAC enforcement
 * pattern described in TASK-DOCS-011's brief. Declared here (rather than in
 * documents.types.ts, which is imported *by* documents.repository.ts and
 * documents.policy.ts) to avoid a circular import; TypeScript merges
 * `declare module` augmentations across files regardless of which file
 * declares them.
 *
 * [Confirmed — TASK-DOCS-018] `designationHandler` added below, same
 * reasoning: needed by documents.router.ts's submit/cancel procedures for
 * the DESIGNATION document type's delegation-grant lifecycle wiring. See
 * docs/development-findings-log.md for the full finding this responds to.
 */
declare module 'fastify' {
  interface FastifyInstance {
    documentsRepository: DocumentsRepository;
    documentsPolicyGuard: DocumentPolicyGuard;
    numberingService: NumberingService;
    designationHandler: DesignationHandler;
    ocrService: OcrService;
    workflowService: WorkflowPublicAPI;
    /**
     * Dedicated connection + RLS-primed DocumentsService for fire-and-forget
     * event consumers (LOG-0207/LOG-0210). Consumer handlers must never
     * capture `fastify.db`: they run inside the emitter's ALS/RLS transaction
     * and nested transactions on the same connection are lost. See
     * apps/server/src/infrastructure/event-consumer-db.ts.
     */
    documentsEventDb: EventConsumerDb;
    documentsEventService: DocumentsPublicAPI;
  }
}

async function documentsPlugin(fastify: FastifyInstance): Promise<void> {
  const db = fastify.db;
  if (!db) {
    throw new Error('Database client (fastify.db) is not initialized');
  }

  const repository = new DocumentsRepository(db);
  const numberingService = new NumberingService({ db, logger: fastify.log as any });
  const s3Client = new S3Client({
    region: env.S3_REGION || 'ap-southeast-1',
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY || '',
      secretAccessKey: env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
  });

  const service = createDocumentsService({
    db,
    documentsRepository: repository,
    numberingService,
    s3Client,
    env,
    eventBus: fastify.eventBus,
    auditService: (fastify as any).auditService,
  });

  const trpcRouter = createDocumentsAppRouter();
  const policyGuard = new DocumentPolicyGuard();

  /**
   * [Confirmed — TASK-DOCS-018] `designationHandler` composes the
   * delegation-grant INSERT and the DESIGNATION document's metadata
   * write-back into one transaction, via this `runInTransaction` closure.
   * Requires `documentsPlugin` to register AFTER `organizationPlugin`, so
   * `fastify.delegationService` exists here — enforced via the
   * `dependencies: [..., 'organization']` array on this plugin's fp(...)
   * registration below, not by manual ordering in app.ts.
   *
   * [Unverified] This has not been executed against a real database. The
   * `db.transaction(...)` call below is written against the same pattern
   * already used in documents.service.ts's transitionState (both before and
   * after this change's edit to that method) and delegation.service.ts's
   * createDelegationGrant/revokeEarlyDelegationGrant, but that pattern
   * match is a structural/textual observation, not a tested guarantee that
   * this specific composition behaves correctly at runtime.
   */
  const designationHandler = new DesignationHandler({
    documentsRepository: repository,
    delegationService: fastify.delegationService,
    runInTransaction: (fn) => db.transaction(fn),
  });

  const ocrS3Client = {
    putObject: (params: any) => s3Client.send(new PutObjectCommand(params)),
  };

  const ocrService = new OcrService(
    (fastify as any).boss,
    new StubOcrProvider(),
    new StubPreviewProvider(),
    ocrS3Client,
    env.S3_BUCKET || 'batac-dms-assets',
    db,
  );

  fastify.decorate('documentsRepository', repository);
  fastify.decorate('documentsService', service);
  fastify.decorate('documentsPolicyGuard', policyGuard);
  fastify.decorate('documentsTrpcRouter', trpcRouter);
  fastify.decorate('numberingService', numberingService);
  fastify.decorate('designationHandler', designationHandler);
  fastify.decorate('ocrService', ocrService);

  // Dedicated connection for fire-and-forget event consumers (LOG-0207/LOG-0210).
  // The consumer service must use its own connection: the EventBus runs handlers
  // inside the emitter's RLS-scoped transaction, so a consumer writing via
  // `fastify.db` hits a nested-transaction loss (the workflow consumer lost every
  // instance because of this). The event connection is primed with a constant
  // system RLS context at creation (see createEventConsumerDb).
  const eventConsumerDb = await createEventConsumerDb();
  const eventRepository = new DocumentsRepository(eventConsumerDb.db);
  const eventNumberingService = new NumberingService({
    db: eventConsumerDb.db,
    logger: fastify.log as any,
  });
  const eventService = createDocumentsService({
    db: eventConsumerDb.db,
    documentsRepository: eventRepository,
    numberingService: eventNumberingService,
    s3Client,
    env,
    eventBus: fastify.eventBus,
    auditService: (fastify as any).auditService,
  });
  fastify.decorate('documentsEventDb', eventConsumerDb);
  fastify.decorate('documentsEventService', eventService);
  fastify.addHook('onClose', async () => {
    await eventConsumerDb.close();
  });

  if ((fastify as any).boss) {
    const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';
    const boss = (fastify as any).boss; // pg-boss instance

    await boss.createQueue('panlalawigan.checkDeemedApproved');
    await boss.schedule(
      'panlalawigan.checkDeemedApproved',
      '0 6 * * *',
      {},
      { timezone: 'Asia/Manila' },
    );
    await boss.work('panlalawigan.checkDeemedApproved', async () => {
      const overdueReviews = await repository.findOverduePanlalawiganReviews();
      for (const review of overdueReviews) {
        await repository.updatePanlalawiganReview(review.id, {
          outcome: 'deemed_approved',
          responseDate: new Date(),
        });

        await service.transitionState(
          review.documentId,
          'completed',
          SYSTEM_ACTOR_ID,
          'Deemed approved by operation of law -- 30-day review period elapsed without Panlalawigan response',
        );

        if (fastify.eventBus) {
          const now = new Date();
          fastify.eventBus.emit('document.panlalawigan.deemed_approved', {
            eventId: crypto.randomUUID(),
            eventType: 'document.panlalawigan.deemed_approved',
            occurredAt: now.toISOString(),
            cityId: review.cityId,
            schemaVersion: 1,
            payload: {
              documentId: review.documentId,
              transmittedAt: review.transmittedAt!,
              cityId: review.cityId,
            },
          });
        }
      }
    });
  }

  // TASK-WF-016: automatic final-number assignment on SP Resolution
  // second-reading approval. See docs/development-findings-log.md and
  // TASK-WF-016's own prompt for the full decision record (fire-and-forget
  // failure mode; do not add 'workflow' to this plugin's dependencies
  // array — fastify.workflowService is referenced lazily below precisely
  // to avoid needing that, since workflow already depends on documents).
  const SP_RESOLUTION_FINAL_NUMBERING_STEP_KEYS = new Set<string>([
    'second_reading_vote',
    'second_reading_amended_vote',
  ]);

  fastify.eventBus.on(
    'workflow.step.completed',
    (event) => {
      const run = async () => {
        if (event.payload.outcome !== 'APPROVED') return;

        const stepKey = await fastify.workflowService.getStepKeyById(event.payload.stepId);
        if (!stepKey || !SP_RESOLUTION_FINAL_NUMBERING_STEP_KEYS.has(stepKey)) return;

        try {
          await eventService.assignFinalNumber(event.payload.documentId, event.payload.actorId);
        } catch (err) {
          if (err instanceof FinalNumberAlreadyAssignedError) {
            // Idempotent no-op, not a failure: this document already has a
            // final number. Swallow silently -- do not log as an error.
            return;
          }
          throw err;
        }
      };
      run().catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId, documentId: event.payload.documentId },
          'documents: workflow.step.completed handler failed (final numbering)',
        );
      });
    },
    'documents',
  );

  fastify.log.info('documents.module.ready');
}

export default fp(documentsPlugin, {
  name: 'documents',
  dependencies: ['database', 'event-bus', 'audit', 'organization'],
});
