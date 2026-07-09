import { AppError } from '../AppError.js';

export class RoleCombinationForbiddenError extends AppError {
  readonly code = 'ROLE_COMBINATION_FORBIDDEN' as const;
  readonly httpStatus = 422;
  readonly trpcCode = 'FORBIDDEN' as const;

  constructor(details: { incomingRoleType: string; conflictingRoleType: string; userId: string }) {
    super(
      `Cannot assign a ${details.incomingRoleType} role to a user who already holds a ${details.conflictingRoleType} role.`,
      details,
    );
  }
}
