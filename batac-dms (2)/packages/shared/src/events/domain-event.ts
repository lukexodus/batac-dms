/**
 * DomainEvent envelope
 *
 * All events published to the in-process event bus carry this envelope.
 * Individual payload shapes are defined per event in EventPayloadMap.
 *
 * Sources: B2 §"Common Event Envelope"; ADR-B2-1.
 */
export interface DomainEvent<TPayload = unknown> {
  /** UUID v4 — unique per event instance */
  eventId: string;
  /** Namespaced string, e.g. 'document.created' — must be a key of EventPayloadMap */
  eventType: string;
  /** ISO 8601 / TIMESTAMPTZ precision */
  occurredAt: string;
  /** UUID — tenant isolation; Batac City UUID in Phase 1 */
  cityId: string;
  /** Starts at 1; increment on breaking payload change */
  schemaVersion: number;
  payload: TPayload;
}
