import type { AuditPublicAPI } from './index.js';
import type { AuditTrpcRouter } from './audit.router.js';
import type { EventBus } from '@batac/shared/event-bus';

export {};

declare module 'fastify' {
  interface FastifyInstance {
    auditService: AuditPublicAPI;
    eventBus: EventBus;
    auditTrpcRouter: AuditTrpcRouter;
  }
}
