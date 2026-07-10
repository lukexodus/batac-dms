import { describe, it, expect } from 'vitest';
import { mapLifecycleStateToDocumentState } from './status-mapping.js';
import { LifecycleStateSchema } from '@batac/shared';

describe('status-mapping', () => {
  it('should map all 11 lifecycle states to a valid DocumentState', () => {
    const expectedMappings: Record<string, string> = {
      draft: 'DRAFT',
      submitted: 'SUBMITTED',
      in_workflow: 'IN_WORKFLOW',
      pending_mayor_action: 'PENDING_MAYOR',
      pending_panlalawigan_review: 'PANLALAWIGAN_REVIEW',
      completed: 'COMPLETED',
      released: 'RELEASED',
      archived: 'ARCHIVED',
      disposed: 'DISPOSED',
      cancelled: 'CANCELLED',
      superseded: 'ARCHIVED', // Inferred fallback mapped to ARCHIVED pending design decision
    };

    // The enum values from LifecycleStateSchema
    const allStates = LifecycleStateSchema.options;
    
    // Ensure the test defines expected mappings for every state in the schema
    expect(allStates.length).toBe(11);
    
    for (const state of allStates) {
      const documentState = mapLifecycleStateToDocumentState(state);
      expect(documentState).toBeDefined();
      
      // Every lifecycle state must have an explicit expected mapping in this test
      expect(expectedMappings[state]).toBeDefined();
      expect(documentState).toBe(expectedMappings[state]);
    }
  });
});
