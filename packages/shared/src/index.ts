/**
 * @batac/shared — barrel
 *
 * Public API surface for the shared package. Import from here rather than
 * from individual files to preserve the ability to reorganise internals.
 */

export type { DomainEvent } from './events/domain-event.js';
export type { EventPayloadMap } from './events/event-payload-map.js';
export type {
  IDeadLetterRepository,
  PendingDeadLetter,
} from './dead-letter-repository.interface.js';
export { EventBus } from './event-bus.js';
export { DOMAIN_ERROR_CODES } from './errors.js';
export type { DomainErrorCode } from './errors.js';

