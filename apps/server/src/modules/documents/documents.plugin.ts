import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createDocumentsService } from './documents.service.js';
import { createDocumentsRouter } from './documents.router.js';
import { DocumentsRepository } from './documents.repository.js';
import { DocumentPolicyGuard } from './documents.policy.js';
import { NumberingService } from './numbering.service.js';
import { DesignationHandler } from './designation.handler.js';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

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
    auditService: fastify.auditService,
  });

  const trpcRouter = createDocumentsRouter();
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

  fastify.decorate('documentsRepository', repository);
  fastify.decorate('documentsService', service);
  fastify.decorate('documentsPolicyGuard', policyGuard);
  fastify.decorate('documentsTrpcRouter', trpcRouter);
  fastify.decorate('numberingService', numberingService);
  fastify.decorate('designationHandler', designationHandler);

  if (fastify.boss) {
    const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';
    const boss = fastify.boss as any; // pg-boss instance
    
    await boss.schedule('panlalawigan.checkDeemedApproved', '0 6 * * *', {}, { timezone: 'Asia/Manila' });
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
          'Deemed approved by operation of law -- 30-day review period elapsed without Panlalawigan response'
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
              cityId: review.cityId 
            }
          });
        }
      }
    });
  }

  fastify.log.info('documents plugin registered');
}

export default fp(documentsPlugin, {
  name: 'documents',
  dependencies: ['database', 'event-bus', 'audit', 'organization'],
});
