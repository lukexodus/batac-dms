import type { WorkflowRepository } from '../workflow.repository.js';
export type ValidationError = {
    code: string;
    step_key?: string;
    missing_outcome_code?: string;
    message: string;
};
export type ValidationResult = {
    valid: true;
} | {
    valid: false;
    errors: ValidationError[];
};
export type DefinitionValidatorDeps = {
    workflowRepository: WorkflowRepository;
};
export declare function validateDefinitionForPublish(versionId: string, deps: DefinitionValidatorDeps): Promise<ValidationResult>;
//# sourceMappingURL=definition-validator.d.ts.map