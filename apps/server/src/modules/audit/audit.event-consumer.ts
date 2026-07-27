import type { EventBus } from '@batac/shared/event-bus';
import type { DomainEvent } from '@batac/shared/events/domain-event';
import type { EventPayloadMap } from '@batac/shared/events/event-payload-map';
import type { FastifyBaseLogger } from 'fastify';

import type { AuditPublicAPI, AuditEventInput } from './index.js';

export function registerAuditEventConsumer(
  bus: EventBus,
  writeService: AuditPublicAPI,
  logger: FastifyBaseLogger,
): void {
  function makeHandler<K extends keyof EventPayloadMap>(
    eventType: K,
    toInput: (envelope: DomainEvent<EventPayloadMap[K]>) => AuditEventInput,
  ) {
    bus.on(
      eventType,
      async (envelope) => {
        try {
          await writeService.writeEvent(toInput(envelope));
        } catch (err) {
          logger.error(
            { err, envelope, eventType },
            '[audit] Failed to write audit event — routing to dead-letter',
          );
          throw err; // re-throw so EventBus dead-letter routing fires
        }
      },
      'audit',
    );
  }

  // Helper to extract a string property from a payload stub safely
  const getString = (payload: any, key: string, fallbackKey?: string): string | null => {
    let val = payload?.[key];
    if (val === undefined && fallbackKey) {
      val = payload?.[fallbackKey];
    }
    return typeof val === 'string' ? val : null;
  };

  // ── IAM module ─────────────────────────────────────────────────────────────

  makeHandler('user.login', (e) => ({
    eventType: 'user.login',
    actorId: getString(e.payload, 'userId', 'actorId'),
    targetId: getString(e.payload, 'userId'),
    targetType: 'user',
    resourceOfficeId: null,
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('user.logout', (e) => ({
    eventType: 'user.logout',
    actorId: getString(e.payload, 'userId', 'actorId'),
    targetId: getString(e.payload, 'userId'),
    targetType: 'user',
    resourceOfficeId: null,
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('session.terminated', (e) => ({
    eventType: 'session.terminated',
    actorId: getString(e.payload, 'adminUserId', 'userId'), // admin might terminate session
    targetId: getString(e.payload, 'sessionId', 'userId'),
    targetType: 'session',
    resourceOfficeId: null,
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('role.assigned', (e) => ({
    eventType: 'role.assigned',
    actorId: getString(e.payload, 'assignerId', 'actorId'),
    targetId: getString(e.payload, 'userId', 'targetUserId'),
    targetType: 'user_role',
    resourceOfficeId: getString(e.payload, 'officeId'), // office UUID the role is scoped to, if any
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('role.revoked', (e) => ({
    eventType: 'role.revoked',
    actorId: getString(e.payload, 'revokerId', 'actorId'),
    targetId: getString(e.payload, 'userId', 'targetUserId'),
    targetType: 'user_role',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  // ── Organization module ────────────────────────────────────────────────────

  makeHandler('delegation.granted', (e) => ({
    eventType: 'delegation.granted',
    actorId: getString(e.payload, 'grantorId', 'actorId'),
    targetId: getString(e.payload, 'delegationId'),
    targetType: 'delegation',
    resourceOfficeId: null, // delegation.* events: null (cross-office grants have no single owner)
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('delegation.expired', (e) => ({
    eventType: 'delegation.expired',
    actorId: null, // system-generated
    targetId: getString(e.payload, 'delegationId'),
    targetType: 'delegation',
    resourceOfficeId: null,
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('delegation.revoked', (e) => ({
    eventType: 'delegation.revoked',
    actorId: getString(e.payload as any, 'revokedBy', 'actorId'),
    targetId: getString(e.payload as any, 'delegationId'),
    targetType: 'delegation',
    resourceOfficeId: null,
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  // ── Documents module ───────────────────────────────────────────────────────

  makeHandler('document.created', (e) => ({
    eventType: 'document.created',
    actorId: getString(e.payload, 'creatorId', 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('document.state_changed', (e) => ({
    eventType: 'document.state_changed',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('document.number_assigned', (e) => ({
    eventType: 'document.number_assigned',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  // ── Workflow module ────────────────────────────────────────────────────────

  makeHandler('workflow.step_assigned', (e) => ({
    eventType: 'workflow.step_assigned',
    actorId: getString(e.payload, 'assignerId', 'actorId'), // might be null if auto-assigned
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.step.completed', (e) => ({
    eventType: 'workflow.step.completed',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'fromOfficeId'),
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.lapsed', (e) => ({
    eventType: 'workflow.lapsed',
    actorId: null, // system-generated
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.escalated', (e) => ({
    eventType: 'workflow.escalated',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.certified_urgent_applied', (e) => ({
    eventType: 'workflow.certified_urgent_applied',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.manually_advanced', (e) => ({
    eventType: 'workflow.manually_advanced',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.completed', (e) => ({
    eventType: 'workflow.completed',
    actorId: getString(e.payload, 'actorId'), // may be null depending on what completed it
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: getString(e.payload, 'officeId'),
    payload: e.payload as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.step.bypassed', (e) => ({
    eventType: 'workflow.step.bypassed',
    actorId: getString(e.payload, 'actorId'),
    targetId: getString(e.payload, 'stepInstanceId'),
    targetType: 'workflow_step',
    resourceOfficeId: null,
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.instance.cancelled', (e) => ({
    eventType: 'workflow.instance.cancelled',
    actorId: getString(e.payload, 'cancelledBy'),
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: null,
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.approval.lapsed', (e) => ({
    eventType: 'workflow.approval.lapsed',
    actorId: null, // system-generated
    targetId: getString(e.payload, 'instanceId'),
    targetType: 'workflow_instance',
    resourceOfficeId: null,
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));

  makeHandler('workflow.panlalawigan.deemed_approved', (e) => ({
    eventType: 'workflow.panlalawigan.deemed_approved',
    actorId: null, // system-generated
    targetId: getString(e.payload, 'documentId'),
    targetType: 'document',
    resourceOfficeId: null,
    payload: e.payload as unknown as Record<string, unknown>,
    cityId: e.cityId,
  }));
}
