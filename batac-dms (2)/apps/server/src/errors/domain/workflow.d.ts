import { AppError } from '../AppError.js';
import type { TRPC_ERROR_CODE_KEY } from '../AppError.js';
import type { DomainErrorCode } from '@batac/shared';
import type { ValidationError } from '../../modules/workflow/engine/definition-validator.js';
export declare class InvalidWorkflowTransitionError extends AppError {
    readonly code: DomainErrorCode;
    readonly httpStatus = 409;
    readonly trpcCode: TRPC_ERROR_CODE_KEY;
    constructor(message: string, details?: Record<string, unknown>);
}
/**
 * Thrown by publishDefinitionVersion when validateDefinitionForPublish returns
 * valid: false. Carries the full collected ValidationError[] (not just the
 * first failure) so the caller can surface every problem in one round trip.
 * Per TASK-WF-010's Integration note: raised before any publish write executes.
 */
export declare class DefinitionPublishValidationError extends AppError {
    readonly code: DomainErrorCode;
    readonly httpStatus = 422;
    readonly trpcCode: TRPC_ERROR_CODE_KEY;
    readonly errors: ValidationError[];
    constructor(errors: ValidationError[]);
}
//# sourceMappingURL=workflow.d.ts.map