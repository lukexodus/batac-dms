import { describe, it, expect } from 'vitest';

import { buildIntakeFormSchema } from './intake-schema';

describe('buildIntakeFormSchema', () => {
  it('validates required metadata properties dynamically', () => {
    const mockMetadataSchema = {
      type: 'object',
      required: ['subject_matter'],
      properties: {
        subject_matter: { type: 'string' }
      }
    };

    const schema = buildIntakeFormSchema(mockMetadataSchema as Record<string, unknown>);

    const result = schema.safeParse({
      documentTypeId: 'test',
      title: 'test title',
      metadata: {} // missing subject_matter
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const issues = result.error.issues;
      // Expect an issue for the missing 'subject_matter' field
      const missingPropertyIssue = issues.find(issue =>
        issue.path.includes('metadata') && issue.path.includes('subject_matter')
      );
      
      expect(missingPropertyIssue).toBeDefined();
      expect(missingPropertyIssue?.message).toBe('required property missing');
    }
  });
});
