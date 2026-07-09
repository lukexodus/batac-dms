import { NotImplementedError } from '../../../errors/not-implemented.js';
import type { WorkflowInstance } from './types.js';

export async function createInstance(
  documentId: string,
  definitionId: string
): Promise<WorkflowInstance> {
  throw new NotImplementedError('createInstance is not implemented');
}

export async function submitStepAction(
  stepInstanceId: string,
  actorId: string,
  outcome: string,
  comment: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  throw new NotImplementedError('submitStepAction is not implemented');
}

export async function bypassStep(
  stepInstanceId: string,
  actorId: string,
  bypassReason: string,
  comment: string
): Promise<void> {
  throw new NotImplementedError('bypassStep is not implemented');
}

export async function cancelInstance(
  instanceId: string,
  actorId: string,
  reason: string
): Promise<void> {
  throw new NotImplementedError('cancelInstance is not implemented');
}

export async function migrateInstance(
  instanceId: string,
  targetVersionId: string,
  actorId: string,
  reason: string
): Promise<{ reversibleUntil: Date }> {
  throw new NotImplementedError('migrateInstance is not implemented');
}

export async function evaluateTimers(): Promise<void> {
  throw new NotImplementedError('evaluateTimers is not implemented');
}

export async function evaluateSlaBreaches(): Promise<void> {
  throw new NotImplementedError('evaluateSlaBreaches is not implemented');
}
