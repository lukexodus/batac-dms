/**
 * @batac/shared — barrel
 *
 * Public API surface for the shared package. Import from here rather than
 * from individual files to preserve the ability to reorganise internals.
 */

export type { DomainEvent } from './events/domain-event';
export type { EventPayloadMap } from './events/event-payload-map';
export type {
  IDeadLetterRepository,
  PendingDeadLetter,
} from './dead-letter-repository.interface';
export { EventBus } from './event-bus';
