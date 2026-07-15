import { AppError } from '../AppError.js';
import type { TRPC_ERROR_CODE_KEY } from '../AppError.js';
import type { DomainErrorCode } from '@batac/shared';
type ValidationError = {
  code: string;
  step_key?: string;
  missing_outcome_code?: string;
  message: string;
};

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
    super(`Definition version failed publish validation with ${errors.length} error(s).`, {
      errors,
    });
    this.errors = errors;
  }
}

export class ValidationFailedError extends AppError {
  readonly code: DomainErrorCode = 'VALIDATION_FAILED';
  readonly httpStatus = 422;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'UNPROCESSABLE_CONTENT';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class NoAdminApprovalError extends AppError {
  readonly code: DomainErrorCode = 'NO_ADMIN_APPROVAL';
  readonly httpStatus = 403;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'FORBIDDEN';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ApprovalExpiredError extends AppError {
  readonly code: DomainErrorCode = 'APPROVAL_EXPIRED';
  readonly httpStatus = 403;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'FORBIDDEN';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class InstanceNotActiveError extends AppError {
  readonly code: DomainErrorCode = 'INSTANCE_NOT_ACTIVE';
  readonly httpStatus = 409;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'CONFLICT';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class StepKeyNotFoundInTargetVersionError extends AppError {
  readonly code: DomainErrorCode = 'STEP_KEY_NOT_FOUND_IN_TARGET_VERSION';
  readonly httpStatus = 422;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'UNPROCESSABLE_CONTENT';
  readonly missingStepKeys: string[];

  constructor(missingStepKeys: string[]) {
    super(
      `Cannot migrate instance: target version is missing step keys: ${missingStepKeys.join(', ')}`,
      { missingStepKeys },
    );
    this.missingStepKeys = missingStepKeys;
  }
}
