import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import cron from 'node-cron';
import { createWorkflowRouter } from './workflow.router.js';
import { createSessionRouter } from './session.router.js';
import { createWorkflowPublicAPI } from './workflow.public-api.js';
import type { WorkflowPublicAPI } from './index.js';
import { processCertificationUrgencyEvent } from './engine/certified-urgent-bypass.handler.js';
import { createInstance } from './engine/create-instance.js';
import { WorkflowRepository } from './workflow.repository.js';
import { evaluateThursdayCutoffs } from './jobs/evaluate-thursday-cutoffs.js';
import { evaluateMayorLapseTimers } from './jobs/evaluate-mayor-lapse-timers.js';
import { evaluatePanlalawiganTimers } from './jobs/evaluate-panlalawigan-timers.js';
import { evaluateSlaBreaches, registerSlaMonitorJob } from './jobs/evaluate-sla-breaches.js';

declare module 'fastify' {
  interface FastifyInstance {
    workflowService: WorkflowPublicAPI;
    workflowTrpcRouter: ReturnType<typeof createWorkflowRouter>;
    sessionTrpcRouter: ReturnType<typeof createSessionRouter>;
  }
}

const workflowPlugin: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;
  if (!db) {
    throw new Error('Database client (fastify.db) is not initialized');
  }

  const workflowRepository = new WorkflowRepository(db);
  const workflowService = createWorkflowPublicAPI({
    db,
    documentsService: fastify.documentsService,
    eventBus: fastify.eventBus,
    orgService: fastify.organizationService,
    delegationService: fastify.delegationService,
    iamService: fastify.iamService,
  });
  fastify.decorate('workflowService', workflowService);

  const workflowTrpcRouter = createWorkflowRouter();
  fastify.decorate('workflowTrpcRouter', workflowTrpcRouter);

  const sessionTrpcRouter = createSessionRouter();
  fastify.decorate('sessionTrpcRouter', sessionTrpcRouter);

  // Event Bus Subscriptions
  const stepDeps = {
    db,
    workflowRepository,
    documentsService: fastify.documentsService,
    eventBus: fastify.eventBus,
    orgService: fastify.organizationService,
    delegationService: fastify.delegationService,
    iamService: fastify.iamService,
  };

  fastify.eventBus.on(
    'document.certification_urgency.logged',
    (event) => {
      processCertificationUrgencyEvent(event.payload, stepDeps).catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'workflow: document.certification_urgency.logged handler failed',
        );
      });
    },
    'workflow',
  );

  fastify.eventBus.on(
    'document.created',
    (event) => {
      // Note: The `engine.createInstance` function takes a DocumentCreatedPayload.
      // However, it also requires fetching the active definition for the document type.
      const run = async () => {
        const activeDef = await workflowRepository.getActiveDefinitionForDocumentType(
          event.payload.documentTypeId,
        );
        if (!activeDef) {
          // NO_ACTIVE_VERSION: expected inert failure in Phase 1 for DOCUMENT_REQUEST_FORM
          fastify.log.info(
            { documentId: event.payload.documentId },
            'No active workflow definition found; skipping instance creation.',
          );
          return;
        }
        await createInstance(
          event.payload.documentId,
          activeDef.definition.id,
          event.payload.actorId,
          {
            db,
            workflowRepository,
            documentsService: fastify.documentsService,
            orgService: fastify.organizationService,
            delegationService: fastify.delegationService,
            iamService: fastify.iamService,
            eventBus: fastify.eventBus,
          },
        );
      };
      run().catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'workflow: document.created handler failed',
        );
      });
    },
    'workflow',
  );

  // Scheduler Jobs
  registerSlaMonitorJob({ workflowRepository, eventBus: fastify.eventBus });

  if (fastify.boss) {
    await fastify.boss.createQueue('evaluateMayorLapseTimers');
    await fastify.boss.schedule('evaluateMayorLapseTimers', '0 * * * *', {}, { tz: 'Asia/Manila' });
    fastify.boss.work('evaluateMayorLapseTimers', async () => {
      try {
        await evaluateMayorLapseTimers(stepDeps);
      } catch (err) {
        fastify.log.error({ err }, '[Mayor Lapse Monitor] Failed to evaluate timers');
      }
    });

    await fastify.boss.createQueue('evaluatePanlalawiganTimers');
    await fastify.boss.schedule(
      'evaluatePanlalawiganTimers',
      '0 6 * * *',
      {},
      { tz: 'Asia/Manila' },
    );
    fastify.boss.work('evaluatePanlalawiganTimers', async () => {
      try {
        await evaluatePanlalawiganTimers(stepDeps);
      } catch (err) {
        fastify.log.error({ err }, '[Panlalawigan Timer] Failed to evaluate timers');
      }
    });

    await fastify.boss.createQueue('evaluateThursdayCutoffs');
    await fastify.boss.schedule('evaluateThursdayCutoffs', '0 0 * * 4', {});
    fastify.boss.work('evaluateThursdayCutoffs', async () => {
      try {
        await evaluateThursdayCutoffs({ workflowRepository, eventBus: fastify.eventBus });
      } catch (err) {
        fastify.log.error({ err }, '[Thursday Cutoff] Failed to evaluate cutoffs');
      }
    });
  }

  // Run SLA monitor synchronously once on boot
  try {
    await evaluateSlaBreaches({ workflowRepository, eventBus: fastify.eventBus });
  } catch (err) {
    fastify.log.error({ err }, '[SLA Monitor] Initial synchronous run failed');
  }

  fastify.log.info('workflow plugin registered');
};

export default fp(workflowPlugin, {
  name: 'workflow',
  dependencies: ['database', 'event-bus', 'audit', 'organization', 'documents', 'iam'],
});
