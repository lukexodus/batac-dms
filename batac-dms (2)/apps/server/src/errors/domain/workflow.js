import { AppError } from '../AppError.js';
export class InvalidWorkflowTransitionError extends AppError {
    code = 'INVALID_WORKFLOW_TRANSITION';
    httpStatus = 409;
    trpcCode = 'CONFLICT';
    constructor(message, details) {
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
    code = 'DEFINITION_PUBLISH_VALIDATION_FAILED';
    httpStatus = 422;
    trpcCode = 'UNPROCESSABLE_CONTENT';
    errors;
    constructor(errors) {
        super(`Definition version failed publish validation with ${errors.length} error(s).`, { errors });
        this.errors = errors;
    }
}
//# sourceMappingURL=workflow.js.map