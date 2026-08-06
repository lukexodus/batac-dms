export type { AuthContext, IamPublicAPI } from './iam.types.js';
export type { ResourcePolicyHandler, ResourceDescriptor, EvaluationResult } from './iam.policy.js';
export { PolicyGuard, PolicyEvaluator } from './iam.policy.js';
export { authMiddlewarePlugin, verifyAccessToken } from './iam.middleware.js';
