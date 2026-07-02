import type { DomainEvent, EventPayloadMap } from '@batac/shared';

export class TrackingEventConsumer {
  async handleDocumentCreated(
    event: DomainEvent<EventPayloadMap['document.created']>
  ): Promise<void> {
    throw new Error('not implemented');
  }

  async handleWorkflowStepCompleted(
    event: DomainEvent<EventPayloadMap['workflow.step_completed']>
  ): Promise<void> {
    throw new Error('not implemented');
  }
}
