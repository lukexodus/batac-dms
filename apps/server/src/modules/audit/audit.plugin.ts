import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createAuditDb } from './audit.db.js';
import { createAuditModule } from './index.js';
import type { AuditPublicAPI } from './index.js';
import { registerAuditEventConsumer } from './audit.event-consumer.js';
import type { EventBus } from '@batac/shared/event-bus';

// ─── TypeScript Fastify augmentation ─────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    auditService: AuditPublicAPI;
    eventBus: EventBus;
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

async function auditPlugin(fastify: FastifyInstance): Promise<void> {
  const databaseUrlAudit = process.env['DATABASE_URL_AUDIT'];
  if (!databaseUrlAudit) {
    throw new Error('DATABASE_URL_AUDIT env var is required for the audit plugin');
  }

  const hmacSecret = process.env['AUDIT_HMAC_SECRET'];
  if (!hmacSecret) {
    throw new Error('AUDIT_HMAC_SECRET env var is required for the audit plugin');
  }

  // Default to true; only disabled when explicitly set to 'false'.
  const verifyOnRead = process.env['AUDIT_CHAIN_VERIFY_ON_READ'] !== 'false';

  const auditDb = createAuditDb(databaseUrlAudit);
  const auditModule = createAuditModule({
    auditDb,
    env: {
      AUDIT_HMAC_SECRET: hmacSecret,
      AUDIT_CHAIN_VERIFY_ON_READ: verifyOnRead,
    },
  });

  fastify.decorate('auditService', auditModule);

  // Register the domain event consumer for all audit events
  registerAuditEventConsumer(fastify.eventBus, auditModule, fastify.log);
}

export default fp(auditPlugin, {
  name: 'audit',
  dependencies: ['database', 'event-bus'],
});

export { createAuditDb };
