import type { LifecycleState } from '@batac/shared';
// Assuming DocumentState exists in @batac/shared or ui, but the prompt says 
// "projecting backend LifecycleState values into frontend DocumentState values."
// If DocumentState is not defined, I will define it based on common states.
// Looking at the AI prompt:
// draft, submitted, in_workflow, completed, released, archived, disposed, cancelled
export type DocumentState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_WORKFLOW'
  | 'COMPLETED'
  | 'RELEASED'
  | 'ARCHIVED'
  | 'DISPOSED'
  | 'CANCELLED';

// WorkflowStepContext is a placeholder type if needed
export type WorkflowStepContext = any;

export function mapLifecycleStateToDocumentState(
  lifecycleState: LifecycleState,
  workflowStep?: WorkflowStepContext,
): DocumentState {
  switch (lifecycleState) {
    case 'draft':
      return 'DRAFT';
    case 'submitted':
      return 'SUBMITTED';
    case 'in_workflow':
      return 'IN_WORKFLOW';
    case 'completed':
      return 'COMPLETED';
    case 'released':
      return 'RELEASED';
    case 'archived':
      return 'ARCHIVED';
    case 'disposed':
      return 'DISPOSED';
    case 'cancelled':
      return 'CANCELLED';
    case 'superseded':
      // [Inference] superseded has no corresponding DocumentState, map to ARCHIVED pending future design decision.
      return 'ARCHIVED';
    default:
      // Fallback for any unmapped or unexpected state
      return 'DRAFT';
  }
}
