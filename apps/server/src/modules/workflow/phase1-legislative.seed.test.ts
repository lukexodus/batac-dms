import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedPhase1WorkflowDefinitions } from '../../../../../packages/database/src/seeds/workflow/phase1-legislative.ts';
import * as validatorMod from './engine/definition-validator.js';

// Mock the validator module
vi.mock('./engine/definition-validator.js', () => ({
  validateDefinitionForPublish: vi.fn(),
}));

describe('seedPhase1WorkflowDefinitions validation rollback', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
  });

  it('rolls back and does not publish/activate if validation fails', async () => {
    // Mock docType query to return a valid id
    mockDb.limit.mockResolvedValue([{ id: 'doc-type-1' }]);

    // Mock validateDefinitionForPublish to return invalid
    vi.mocked(validatorMod.validateDefinitionForPublish).mockResolvedValue({
      valid: false,
      errors: [{ path: 'step', message: 'invalid step' }]
    });

    // Run the seed function — it should throw
    await expect(
      seedPhase1WorkflowDefinitions(mockDb)
    ).rejects.toThrow(/Validation failed for/);

    // Verify that we inserted definitions and definitionVersions with inactive/null state
    expect(mockDb.insert).toHaveBeenCalled();
    
    // Check insert values
    const insertCalls = mockDb.values.mock.calls;
    const definitionsInsert = insertCalls.find((call: any) => call[0].isActive === false);
    const versionsInsert = insertCalls.find((call: any) => call[0].publishedAt === null);

    expect(definitionsInsert).toBeDefined();
    expect(versionsInsert).toBeDefined();

    // Verify that we did NOT call update to activate/publish them
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
