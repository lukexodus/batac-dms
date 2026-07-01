/**
 * EventPayloadMap — Phase 1 Master Event Bus Registry
 *
 * 18 typed entries covering all domain events confirmed in B2 §"Master Event
 * Bus Registry". Each payload is a stub `Record<string, unknown>` until the
 * owning module's task fills it in with a concrete type.
 *
 * Compiler rules (ADR-API-001 §6):
 *   - `bus.emit()` and `bus.on()` accept only keys defined in this interface.
 *   - Using an unlisted event name is a TypeScript compile error, not a runtime error.
 *   - Any new domain event added to B2 §"Master Event Bus Registry" must also be
 *     added here in the same PR, or the build fails.
 *
 * Sources: B2 §"Master Event Bus Registry"; ADR-B2-1; B1 Appendix A.
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

export interface EventPayloadMap {
  // ── IAM module ─────────────────────────────────────────────────────────────
  'user.login': Stub;
  'user.logout': Stub;
  'session.terminated': Stub;
  'role.assigned': Stub;
  'role.revoked': Stub;
  'user.created': Stub;
  'password.changed': Stub;
  'session.locked': Stub;
  'session.unlocked': Stub;

  // ── Organization module ────────────────────────────────────────────────────
  'delegation.granted': Stub;
  'delegation.expired': Stub;
  'delegation.revoked': DelegationRevokedEvent;

  // ── Documents module ───────────────────────────────────────────────────────
  'document.created': Stub;
  'document.state_changed': Stub;
  'document.number_assigned': Stub;

  // ── Workflow module ────────────────────────────────────────────────────────
  'workflow.step_assigned': Stub;
  'workflow.step_completed': Stub;
  'workflow.lapsed': Stub;
  'workflow.escalated': Stub;
  'workflow.certified_urgent_applied': Stub;
  'workflow.manually_advanced': Stub;
  'workflow.completed': Stub;
}
