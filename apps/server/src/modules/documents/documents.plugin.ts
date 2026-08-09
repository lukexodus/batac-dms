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
import { ScribeOcrProvider } from './scribe-ocr.provider.js';
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
    new ScribeOcrProvider(s3Client, env.S3_BUCKET || 'batac-dms-assets'),
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

  if ((fastify as any).boss) {
    const boss = (fastify as any).boss;
    await boss.createQueue('ocr.process');
    await boss.work('ocr.process', { includeMetadata: true }, async (jobs: any[]) => {
      const results = await Promise.allSettled(
        jobs.map((job) => ocrService.processJob(job.data)),
      );
      const failures: unknown[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result && result.status === 'rejected') {
          const job = jobs[i];
          fastify.log.error(
            { err: result.reason, jobId: job?.id, versionId: job?.data?.versionId },
            'documents: ocr.process job failed',
          );
          failures.push(result.reason);

          if (job && job.data?.versionId && (job.retryCount ?? 0) >= (job.retryLimit ?? 0)) {
            try {
              await ocrService.markOcrFailed(job.data.versionId);
            } catch (err) {
              fastify.log.error(
                { err, versionId: job.data?.versionId },
                'documents: failed to set ocrStatus to failed',
              );
            }
          }
        }
      }
      if (failures.length > 0) {
        // pg-boss's batch handler contract: throwing marks the batch as
        // failed for retry purposes. We still throw here (after every job
        // has already been individually attempted and logged above) so
        // that pg-boss's existing retryLimit/retryDelay policy from
        // enqueueOcrJob still applies to whichever jobs actually failed --
        // but by this point every job in the batch, failed or not, has
        // already had processJob run to completion (or failure)
        // independently via Promise.allSettled, so a failure in one job
        // no longer prevents any other job in the same batch from being
        // attempted. This does mean an already-succeeded job in the same
        // batch could be retried again if pg-boss's retry semantics apply
        // at the batch level rather than the per-job level -- confirm
        // this against the installed pg-boss version's actual retry
        // behavior for batched work(), and if per-job retry isolation is
        // not achievable this way, report it as a finding rather than
        // silently accepting duplicate-processing risk.
        throw new AggregateError(failures, `${failures.length} of ${jobs.length} ocr.process jobs failed`);
      }
    });
  }

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

  // ADR-014: document supersession on repass.
  // When the workflow engine emits workflow.instance.repassed the old document must be
  // marked as superseded and a new document (with a fresh workflow instance) must be
  // created. The new instance is kicked off by re-emitting document.created, which the
  // workflow module's existing subscriber handles verbatim — no new workflow-side code.
  //
  // Uses eventService (event-connection-backed) per LOG-0207/LOG-0210. Does NOT
  // reference fastify.workflowService and does NOT add 'workflow' to this plugin's
  // dependencies array — workflow already depends on documents; the reverse would be
  // circular. See LOG-0222 for the full decision record.
  fastify.eventBus.on(
    'workflow.instance.repassed',
    (event) => {
      const { instanceId, documentId } = event.payload;
      const run = async () => {
        const result = await eventService.createSupersedingDocument({
          oldDocumentId: documentId,
          closureReason:
            'Document repassed by Sangguniang Panlalawigan; superseded by revised version.',
        });

        fastify.eventBus.emit('document.created', {
          eventId: crypto.randomUUID(),
          eventType: 'document.created',
          occurredAt: new Date().toISOString(),
          cityId: result.cityId,
          schemaVersion: 1,
          payload: {
            documentId: result.newDocumentId,
            documentTypeId: result.documentTypeId,
            ownedByOfficeId: result.ownedByOfficeId,
            actorId: result.actorId,
            cityId: result.cityId,
          },
        });
      };
      run().catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId, instanceId, documentId },
          'documents: workflow.instance.repassed handler failed (document supersession)',
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
