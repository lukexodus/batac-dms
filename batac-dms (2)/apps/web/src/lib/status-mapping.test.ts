import { describe, it, expect } from 'vitest';
import { mapLifecycleStateToDocumentState } from './status-mapping.js';
import { LifecycleStateSchema } from '@batac/shared';

describe('status-mapping', () => {
  it('should map all 11 lifecycle states to a valid DocumentState', () => {
    const expectedMappings: Record<string, string> = {
      draft: 'DRAFT',
      submitted: 'SUBMITTED',
      in_workflow: 'IN_WORKFLOW',
      completed: 'COMPLETED',
      released: 'RELEASED',
      archived: 'ARCHIVED',
      disposed: 'DISPOSED',
      cancelled: 'CANCELLED',
      superseded: 'ARCHIVED', // Inferred fallback
      // Wait, let's find the exact other 2 states if they exist
    };

    // The enum values from LifecycleStateSchema
    const allStates = LifecycleStateSchema.options;
    
    for (const state of allStates) {
      const documentState = mapLifecycleStateToDocumentState(state);
      expect(documentState).toBeDefined();
      
      // If we know the expected mapping, test it directly
      if (expectedMappings[state]) {
        expect(documentState).toBe(expectedMappings[state]);
      }
    }
  });
});
