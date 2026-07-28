/**
 * EventPayloadMap — Phase 1 Master Event Bus Registry
 *
 * Typed entries covering all domain events confirmed in B2 §"Master Event
 * Bus Registry" and B3 §8 "Master Event Registry". Each payload is a stub
 * `Record<string, unknown>` until the owning module's task fills it in with
 * a concrete type.
 *
 * Compiler rules (ADR-API-001 §6):
 *   - `bus.emit()` and `bus.on()` accept only keys defined in this interface.
 *   - Using an unlisted event name is a TypeScript compile error, not a runtime error.
 *   - Any new domain event added to B2/B3 must also be added here in the same
 *     PR, or the build fails.
 *
 * Sources: B2 §"Master Event Bus Registry"; B3 §8; ADR-B2-1; B1 Appendix A.
 *
 * TASK-WF-EVT-001: expanded from 36 to 57 entries to cover all B3 §8
 * canonical workflow events and SLA events. Deprecated underscore-notation
 * workflow keys in favour of dot-notation canonical keys.
 */

// Stub until each owning module's task fills in the concrete payload type.
// Remove this line and replace the Stub alias with a concrete import when the
// owning module defines its payload type.
type Stub = Record<string, unknown>;

export interface DelegationRevokedEvent {
  delegationId: string;
  delegatingUserId: string;
  delegatedToUserId: string;
  revokedBy: string;
  revokedAt: Date;
}

export type DelegationExpiredEvent = {
  delegationId: string;
  delegatingUserId: string;
  delegatedToUserId: string;
  expiredAt: string;
};

export interface DocumentStateChangedEvent {
  documentId: string;
  fromState: string;
  toState: string;
  actorId: string;
  reason?: string;
  cityId: string;
  timestamp: Date;
}

export interface DocumentNumberAssignedEvent {
  documentId: string;
  numberType: 'final' | 'preliminary' | 'control';
  numberValue: string;
  series: string;
  assignedBy: string;
  cityId: string;
  timestamp: Date;
}

export interface DocumentCreatedPayload {
  documentId: string; // documents.documents.id
  documentTypeId: string; // documents.document_types.id
  ownedByOfficeId: string; // the SP Secretariat office — initial custodian
  actorId: string; // the SP Secretary who logged the document
  cityId: string;
}

export interface WorkflowStepCompletedPayload {
  documentId: string;
  instanceId: string;
  stepId: string;
  stepType: string;
  fromOfficeId: string | null;
  toOfficeId: string | null;
  actorId: string;
  actionDescription: string;
  cityId: string;
}

export interface WorkflowInstanceCreatedPayload {
  instanceId: string;
  documentId: string;
  documentType: string;
  definitionVersionId: string;
}

export interface WorkflowStepStartedPayload {
  instanceId: string;
  stepInstanceId: string;
  stepType: string;
  stepKey: string;
  documentId: string;
  // TASK-WF-EVT-004: Deliberate design choice per Luke (2026-07-28) to support
  // concurrent multi-assignees (e.g. committee, roles). B3 §7.11 to be updated.
  assignedTo: string[] | null;
  dueAt: Date | null;
}

export interface WorkflowInstanceStuckPayload {
  instanceId: string;
  stepInstanceId: string;
  evaluatedRules: Record<string, any>[];
  contextSnapshot: Record<string, any>;
}

export interface WorkflowContextUpdatedPayload {
  instanceId: string;
  updatedKeys: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  actorId: string;
}

export interface DocumentCertificationUrgencyLoggedPayload {
  certificationDocumentId: string;
  associatedInstanceIds: string[];
  loggedBy: string;
  loggedAt: string;
}

export interface EventPayloadMap {
  // ── IAM module ─────────────────────────────────────────────────────────────
  // [Unverified, consumer-derived] — no live producer exists for this event
  // as of this task. Type inferred from audit.event-consumer.ts's
  // makeHandler callback, not from a real emitted payload.
  'user.login': {
    userId?: string;
    actorId?: string;
  };
  // [Unverified, consumer-derived] — no live producer exists for this event
  // as of this task. Type inferred from audit.event-consumer.ts's
  // makeHandler callback, not from a real emitted payload.
  'user.logout': {
    userId?: string;
    actorId?: string;
  };
  // [Unverified, consumer-derived] — no live producer exists for this event
  // as of this task. Type inferred from audit.event-consumer.ts's
  // makeHandler callback, not from a real emitted payload.
  'session.terminated': {
    adminUserId?: string;
    userId?: string;
    sessionId?: string;
  };
  'role.assigned': {
    actorId: string;
    targetUserId: string;
    roleId: string;
    roleName: string;
  };
  'role.revoked': {
    actorId: string;
    targetUserId: string;
    roleId: string;
    roleName: string;
    reason: string;
  };
  'user.created': {
    actorId: string;
    newUserId: string;
  };
  'password.changed': {
    actorId: string;
    userId: string;
  };
  'session.locked': {
    user_id: string;
    session_id: string;
  };
  'session.unlocked': {
    user_id: string;
    session_id: string;
  };
  'password_reset_token.generated': { actorId: string; targetUserId: string };
  'password_reset.completed': { actorId: string; targetUserId: string };
  // Added by TASK-IAM-EVT-001: mechanism change from auditService.writeEvent → eventBus.emit
  'logout.success': {
    user_id: string;
    session_id: string;
  };
  'login.failed': {
    attempted_identifier_hash: string;
    ip_address: string | null;
    user_agent: string | null;
    failure_reason: 'no_credential' | 'wrong_password';
  };
  'session.replaced': {
    user_id: string;
    old_session_id: string;
    new_session_id: string;
    new_ip_address: string | null;
  };
  'login.success': {
    user_id: string;
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
  };
  'token.reuse_detected': {
    user_id: string;
    family_id: string;
    ip_address: string | null;
    action_taken: string;
  };
  'session.forced_logout': {
    actor_id: string;
    target_user_id: string;
    target_session_id: string;
    reason: string;
  };
  'abac.denial': {
    action: string;
    denial_reason: string;
    actorId: string;
    targetId: string | null;
  };


  // ── Organization module ────────────────────────────────────────────────────
  'delegation.granted': {
    delegationId: string;
    designationDocumentId: string | null;
    delegatingUserId: string;
    delegatedToUserId: string;
    grantorId: string;
    scope: {
      officeId: string;
      positionId: string;
    };
    validFrom: string;
    validUntil: string;
  };
  'delegation.expired': DelegationExpiredEvent;
  'delegation.revoked': DelegationRevokedEvent;

  // ── Documents module ───────────────────────────────────────────────────────
  'document.created': DocumentCreatedPayload;
  'document.state_changed': DocumentStateChangedEvent;
  'document.number_assigned': DocumentNumberAssignedEvent;
  'document.certification_urgency.logged': DocumentCertificationUrgencyLoggedPayload;
  'document.panlalawigan.deemed_approved': {
    documentId: string;
    transmittedAt: Date;
    cityId: string;
  };
  'audit.document.panlalawigan_transmitted': {
    documentId: string;
    actorId: string;
    cityId: string;
    timestamp: Date;
  };
  'audit.document.panlalawigan_outcome_logged': {
    documentId: string;
    outcome: string;
    actorId: string;
    cityId: string;
    timestamp: Date;
  };

  // ── Workflow module ────────────────────────────────────────────────────────

  // Instance lifecycle (B3 §7)
  'workflow.instance.created': WorkflowInstanceCreatedPayload;
  'workflow.instance.completed': {
    instanceId: string;
    documentId: string;
    outcomeCode: string;
    finalDocumentStatus: string | null;
  };
  'workflow.instance.cancelled': {
    instanceId: string;
    cancelledBy: string;
    cancellationReason: string | null;
  };
  'workflow.instance.stuck': WorkflowInstanceStuckPayload;
  'workflow.instance.repassed': { instanceId: string; documentId: string };
  // [Unverified, spec-derived] — no producer or consumer exists for this
  // event in the codebase as of this task. Type taken directly from B3
  // §7.6, whose own Source row reads "[Unverified] - confirmed in B4" —
  // this is a spec claim, not a code-confirmed one, at two removes.
  'workflow.instance.suspended': {
    instanceId: string;
    suspendedBy: string;
    reason: string;
  };
  // [Unverified, spec-derived] — same caveat as workflow.instance.suspended
  // above. Source: B3 §7.7, Source row "[Unverified] - confirmed in B4".
  'workflow.instance.resumed': {
    instanceId: string;
    resumedBy: string;
  };
  'workflow.instance.migration.started': Record<string, unknown>;
  'workflow.instance.migration.completed': Record<string, unknown>;
  'workflow.instance.migration.reversed': {
    instance_id: string;
    actor_id: string;
    reversal_reason: string;
    original_migration_event_id: string;
  };

  // Step lifecycle (B3 §7)
  'workflow.step.started': WorkflowStepStartedPayload;
  'workflow.step.completed': {
    instanceId: string;
    stepInstanceId: string;
    stepId: string;
    stepType: string;
    outcome: string;
    comment: string | null;
    documentId: string;
    actorId: string;
    fromOfficeId: string | null;
    toOfficeId: string | null;
    actionDescription: string;
    cityId: string;
  };
  'workflow.step.bypassed': {
    instanceId: string;
    stepInstanceId: string;
    bypassReason: string;
    bypassedBy: string | null;
    comment: string;
  };
  'workflow.step.failed': {
    instanceId: string;
    stepInstanceId: string;
    stepId: string;
    errorCode: string;
    errorMessage: string;
  };
  'workflow.context.updated': WorkflowContextUpdatedPayload;

  // Multi-referral events (B3 §8)
  // NOTE: these three events are emitted via
  // workflowRepository.createWorkflowEvent(...) — a raw Drizzle insert
  // (InferInsertModel<typeof workflowEvents>) — not via EventBus.emit().
  // EventBus.emit()'s generic signature (emit<K extends keyof
  // EventPayloadMap>(...)) is what actually enforces EventPayloadMap at
  // compile time; createWorkflowEvent has no such constraint. Typing these
  // three entries here provides real compile-time safety for a future
  // consumer that subscribes via bus.on(), but does NOT constrain what the
  // producer above actually writes to the database — the producer bypasses
  // EventBus entirely.
  'workflow.multi_referral.committee_submitted': {
    instanceId: string;
    stepInstanceId: string;
    committeeId: string;
    contributionDocumentId: string;
  };
  'workflow.multi_referral.all_submitted': {
    instanceId: string;
    stepInstanceId: string;
    allSubmittedAt: string;
  };
  'workflow.multi_referral.cutoff_missed': {
    instanceId: string;
    stepInstanceId: string;
  };
  'workflow.multi_referral.second_reading_eligible': {
    instanceId: string;
    stepInstanceId: string;
  };
  'workflow.multi_referral.secretary_advanced': {
    stepInstanceId: string;
    actorId: string;
    comment: string | null;
    missingCommitteeIds: string[];
    metadataSnapshot: Record<string, unknown>;
  };

  // Statutory-deadline events (B3 §8)
  'workflow.approval.lapsed': {
    instanceId: string;
    stepInstanceId: string;
  };
  'workflow.panlalawigan.deemed_approved': {
    instanceId: string;
    documentId: string;
  };

  // Certification urgency events (B3 §8)
  'workflow.certification_urgency.bypass_applied': {
    instanceId: string;
    stepInstanceId: string;
    certificationDocumentId: string;
  };
  'workflow.certification_urgency.bypass_deferred': {
    instanceId: string;
    certificationDocumentId: string;
  };
  'workflow.certification_urgency.already_past_referral': {
    instanceId: string;
    certificationDocumentId: string;
  };
  'workflow.certification_urgency.already_inactive': {
    instanceId: string;
    instanceStatus: 'completed' | 'cancelled' | 'stuck' | 'suspended';
    certificationDocumentId: string;
  };

  // SLA events (evaluate-sla-breaches.ts — step-level)
  'workflow.sla.warning': {
    stepInstanceId: string;
    slaDeadline: string;
    percentElapsed: number;
  };
  'workflow.sla.breached': {
    stepInstanceId: string;
    slaDeadline: string;
    breachDetectedAt: string;
    breachedAt: string;
  };
  'workflow.sla.critical': {
    stepInstanceId: string;
    slaDeadline: string;
  };

  // SLA events (evaluate-sla-breaches.ts — instance-level)
  'workflow.instance.sla.warning': {
    slaDeadline: string;
    percentElapsed: number;
  };
  'workflow.instance.sla.breached': {
    slaDeadline: string;
    breachDetectedAt: string;
    breachedAt: string;
  };
  'workflow.instance.sla.critical': {
    slaDeadline: string;
  };

  // ── Legacy / deprecated workflow keys ─────────────────────────────────────
  // These underscore-notation keys predate the B3 §8 dot-notation convention.
  // Consumers should migrate to the canonical dot-notation equivalents above.

  /** @deprecated Use 'workflow.step.completed' — retained for backward compat only. */
  'workflow.step_assigned': Stub;
  /** @deprecated Use 'workflow.step.completed' — retained for backward compat only. */
  'workflow.step_completed': WorkflowStepCompletedPayload;
  'workflow.lapsed': Stub;
  'workflow.escalated': Stub;
  'workflow.certified_urgent_applied': Stub;
  'workflow.manually_advanced': Stub;
  'workflow.completed': Stub;
}
