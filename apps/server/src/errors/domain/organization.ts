import { AppError } from '../AppError.js';

/**
 * Thrown when the ABAC policy evaluation denies a delegation grant operation.
 * Source: I1 §11.1; TASK-ORG-005.
 */
export class PolicyDeniedError extends AppError {
  readonly code = 'POLICY_DENIED' as const;
  readonly httpStatus = 403;
  readonly trpcCode = 'FORBIDDEN' as const;

  constructor(details: { reason: string; action: string }) {
    super(`ABAC policy denied: ${details.reason}`, details);
  }
}

/**
 * Thrown when Invariant #16 is violated:
 * the delegatee already has an active delegation grant.
 *
 * Source: I1 §11.1 Invariant; TASK-ORG-005.
 */
export class ActiveDesignationExistsError extends AppError {
  readonly code = 'ACTIVE_DESIGNATION_EXISTS' as const;
  readonly httpStatus = 422;
  readonly trpcCode = 'CONFLICT' as const;

  constructor(details: { delegatedToEmployeeId: string }) {
    super(
      `Delegatee already has an active designation grant (Invariant #16). ` +
        `delegatedToEmployeeId=${details.delegatedToEmployeeId}`,
      details,
    );
  }
}
