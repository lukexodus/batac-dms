import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInstance } from '../engine/create-instance.js';
import { buildMockRepo } from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

vi.mock('../engine/assignee-resolution.js', () => ({
  resolveAssignees: vi.fn().mockResolvedValue([{ user_id: 'user-mayor', resolved_via: 'static:user-mayor' }]),
}));

describe('Create Instance (CI)', () => {
  let mockRepo: any;
  let mockDeps: any;
  let mockTrx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrx = { _isMockTrx: true };
    mockRepo = buildMockRepo();

    const mockCreatedInstance = {
      id: 'inst-new',
      definitionVersionId: 'ver-1',
      documentId: 'doc-1',
      status: 'active',
      createdBy: 'user-encoder',
      context: {
        document_id: 'doc-1',
        document_type: 'RESOLUTION',
        created_by: 'user-encoder',
        certified_urgent: false,
        certified_urgent_document_id: null,
        sla_paused: false,
        requires_publication: false,
      },
    };

    mockDeps = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  then: vi.fn((fn: any) => Promise.resolve(fn([{ id: 'ver-1', isActive: true }]))),
                }),
              }),
            }),
          }),
        }),
        transaction: vi.fn(async (cb: any) => cb(mockTrx)),
      },
      workflowRepository: mockRepo,
      documentsService: {
        getDocumentById: vi.fn().mockResolvedValue({
          id: 'doc-1',
          documentTypeCode: 'RESOLUTION',
          hasPenaltyProvision: false,
        }),
      },
      orgService: {} as any,
      delegationService: {} as any,
      eventBus: { publish: vi.fn() } as any,
    };

    mockRepo.createInstance.mockResolvedValue(mockCreatedInstance);
    mockRepo.createStepInstance.mockResolvedValue({
      id: 'step-inst-1',
      instanceId: 'inst-new',
      stepId: 'step-mayor',
      status: 'active',
    });
    mockRepo.getDefinitionVersionWithSteps.mockResolvedValue({
      version: { id: 'ver-1', publishedAt: new Date() },
      steps: [
        {
          id: 'step-mayor',
          stepKey: 'mayor_review',
          stepType: 'approval',
          isStart: true,
          config: { allowed_outcomes: ['APPROVED', 'LAPSED'], assignee: 'static:user-mayor' },
        },
      ],
      transitionRules: [],
    });
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.updateStepInstance.mockResolvedValue({});
  });

  it('CI-01: creates instance with correct initial state and emits workflow.instance.created event', async () => {
    const result = await createInstance('doc-1', 'def-1', 'user-encoder', mockDeps);
    expect(result.status).toBe('active');
    expect(mockRepo.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        status: 'active',
        createdBy: 'user-encoder',
        context: expect.objectContaining({
          document_id: 'doc-1',
          created_by: 'user-encoder',
          certified_urgent: false,
        }),
      }),
      mockTrx
    );
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.instance.created' }),
      mockTrx
    );
  });

  it('CI-02: start step receives workflow.step.started event', async () => {
    await createInstance('doc-1', 'def-1', 'user-encoder', mockDeps);
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.step.started' }),
      mockTrx
    );
  });

  it('CI-03: step instance created with status active for approval start step', async () => {
    await createInstance('doc-1', 'def-1', 'user-encoder', mockDeps);
    expect(mockRepo.createStepInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-new',
        stepId: 'step-mayor',
        status: 'active',
      }),
      mockTrx
    );
  });

  it('CI-04: throws NO_ACTIVE_VERSION when no published current version found', async () => {
    // db.select chain returns empty list
    mockDeps.db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn((fn: any) => Promise.resolve(fn([]))),
            }),
          }),
        }),
      }),
    });

    await expect(
      createInstance('doc-1', 'def-1', 'user-encoder', mockDeps)
    ).rejects.toThrow('NO_ACTIVE_VERSION');
  });

  it('CI-05: slaDeadline is set 9 days from creation', async () => {
    const before = new Date();
    await createInstance('doc-1', 'def-1', 'user-encoder', mockDeps);
    const after = new Date();

    const callArgs = mockRepo.createInstance.mock.calls[0][0];
    const sla = new Date(callArgs.slaDeadline);
    const expectedMin = new Date(before.getTime() + 8 * 24 * 60 * 60 * 1000);
    const expectedMax = new Date(after.getTime() + 10 * 24 * 60 * 60 * 1000);
    expect(sla.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(sla.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });
});
