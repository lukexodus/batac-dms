import type { LifecycleState } from '@batac/shared';
import type { DocumentState } from '@batac/ui';

export function mapLifecycleStateToDocumentState(
  lifecycleState: LifecycleState,
): DocumentState {
  switch (lifecycleState) {
    case 'draft':
      return 'DRAFT';
    case 'submitted':
      return 'SUBMITTED';
    case 'in_workflow':
      return 'IN_WORKFLOW';
    case 'pending_mayor_action':
      return 'PENDING_MAYOR';
    case 'pending_panlalawigan_review':
      return 'PANLALAWIGAN_REVIEW';
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
      // superseded has no corresponding DocumentState, map to ARCHIVED pending future design decision (see LOG-0070).
      return 'ARCHIVED';
    default:
      // Fallback for any unmapped or unexpected state
      return 'DRAFT';
  }
}
