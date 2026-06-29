import type { AuthContext } from './iam.types.js';

export type EvaluationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export type SubjectContext = AuthContext;

export type ResourceDescriptor = {
  type:                 string;
  id:                   string;
  cityId:               string;
  classificationLevel?: string;
  deletedAt?:           Date | null;
  [key: string]: unknown;
};

export class PolicyGuard {
  checkGates(_subject: SubjectContext, _resource: ResourceDescriptor, _action: string): EvaluationResult {
    throw new Error('not implemented');
  }
}

export class PolicyEvaluator {
  evaluate(_subject: SubjectContext, _resource: ResourceDescriptor, _action: string, _ctx?: Record<string, unknown>): Promise<EvaluationResult> {
    throw new Error('not implemented');
  }
  registerResourceHandler(_resourceType: string, _handler: unknown): void {
    throw new Error('not implemented');
  }
}
