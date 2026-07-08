import { AppError } from '../AppError.js';
import type { TRPC_ERROR_CODE_KEY } from '../AppError.js';
import type { DomainErrorCode } from '@batac/shared';

export class InvalidWorkflowTransitionError extends AppError {
  readonly code: DomainErrorCode = 'INVALID_WORKFLOW_TRANSITION';
  readonly httpStatus = 409;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'CONFLICT';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}
