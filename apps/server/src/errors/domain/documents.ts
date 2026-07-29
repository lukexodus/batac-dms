import { AppError } from '../AppError.js';
import type { TRPC_ERROR_CODE_KEY } from '../AppError.js';
import type { DomainErrorCode } from '@batac/shared';

/**
 * Thrown by NumberingService.assignFinalNumber when the target document
 * already has a non-null final_number. This is an idempotency guard, not
 * a true failure state — callers that treat this as expected (e.g. the
 * TASK-WF-016 automatic-numbering event subscriber in documents.plugin.ts)
 * should catch this specific error type and treat it as a no-op. Callers
 * that don't expect it (e.g. a manual "Finalize Number" button click on an
 * already-numbered document) should surface it as a clear, non-alarming
 * message to the user rather than a generic server error.
 *
 * Added by TASK-DOCS-FE-021.
 */
export class FinalNumberAlreadyAssignedError extends AppError {
  readonly code: DomainErrorCode = 'FINAL_NUMBER_ALREADY_ASSIGNED';
  readonly httpStatus = 409;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = 'CONFLICT';

  constructor(documentId: string, existingFinalNumber: string) {
    super(`Document ${documentId} already has a final number: ${existingFinalNumber}`, {
      documentId,
      existingFinalNumber,
    });
  }
}
