import { AppError } from '../AppError.js';
export class RoleCombinationForbiddenError extends AppError {
    code = 'ROLE_COMBINATION_FORBIDDEN';
    httpStatus = 422;
    trpcCode = 'FORBIDDEN';
    constructor(details) {
        super(`Cannot assign a ${details.incomingRoleType} role to a user who already holds a ${details.conflictingRoleType} role.`, details);
    }
}
