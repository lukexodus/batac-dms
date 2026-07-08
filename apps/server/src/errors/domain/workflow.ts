import { AppError } from '../AppError.js';
import type { TRPC_ERROR_CODE_KEY } from '../AppError.js';
import type { DomainErrorCode } from '@batac/shared';
import type { ValidationError } from '../../modules/workflow/engine/definition-validator.js';

export class InvalidWorkflowTransitionError extends AppError {
  readonly code: DomainErrorCode = 'INVALID_WORKFLOW_TRANSITION';
  readonly httpStatus = 409;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'CONFLICT';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * Thrown by publishDefinitionVersion when validateDefinitionForPublish returns
 * valid: false. Carries the full collected ValidationError[] (not just the
 * first failure) so the caller can surface every problem in one round trip.
 * Per TASK-WF-010's Integration note: raised before any publish write executes.
 */
export class DefinitionPublishValidationError extends AppError {
  readonly code: DomainErrorCode = 'DEFINITION_PUBLISH_VALIDATION_FAILED';
  readonly httpStatus = 422;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'UNPROCESSABLE_CONTENT';
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(
      `Definition version failed publish validation with ${errors.length} error(s).`,
      { errors }
    );
    this.errors = errors;
  }
}
