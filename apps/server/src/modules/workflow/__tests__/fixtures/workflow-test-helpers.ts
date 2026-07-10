import { vi } from 'vitest';

export function buildMinimalWorkflowDefinitionSeed() {
  return {
    steps: [
      {
        id: 'step-mayor',
        stepKey: 'mayor_review',
        stepType: 'approval' as const,
        isStart: true,
        config: {
          allowed_outcomes: ['APPROVED', 'VETOED', 'LAPSED'],
          assignee: 'static:user-mayor',
          require_comment_on: ['VETOED'],
        },
      },
    ],
    transitionRules: [
      {
        id: 'rule-1',
        fromStepId: 'step-mayor',
        toStepId: 'step-end',
        outcomeFilter: 'APPROVED',
        priority: 10,
        conditionExpression: null,
      },
      {
        id: 'rule-lapsed',
        fromStepId: 'step-mayor',
        toStepId: 'step-end',
        outcomeFilter: 'LAPSED',
        priority: 20,
        conditionExpression: null,
      },
    ],
  };
}

export function buildMockInstance(overrides: Record<string, any> = {}) {
  return {
    id: 'inst-1',
    definitionVersionId: 'ver-1',
    documentId: 'doc-1',
    status: 'active' as const,
    createdBy: 'user-encoder',
    context: {
      document_id: 'doc-1',
      document_type: 'resolution',
      created_by: 'user-encoder',
      certified_urgent: false,
      certified_urgent_document_id: null,
      sla_paused: false,
      requires_publication: false,
    },
    slaDeadline: new Date('2026-12-31'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

export function buildMockStepInstance(overrides: Record<string, any> = {}) {
  return {
    id: 'step-inst-1',
    instanceId: 'inst-1',
    stepId: 'step-mayor',
    status: 'active' as const,
    outcome: null,
    outcomeComment: null,
    assignedTo: [{ user_id: 'user-mayor' }],
    metadata: {},
    startedAt: new Date('2026-01-01'),
    completedAt: null,
    bypassedAt: null,
    bypassedBy: null,
    bypassReason: null,
    slaDeadline: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildMockRepo(overrides: Record<string, any> = {}) {
  return {
    getDefinitionVersionWithSteps: vi.fn(),
    updateStepInstance: vi.fn(),
    createWorkflowEvent: vi.fn(),
    getStepInstanceById: vi.fn(),
    updateInstanceStatus: vi.fn(),
    updateInstanceContext: vi.fn(),
    updateInstance: vi.fn(),
    createInstance: vi.fn(),
    createStepInstance: vi.fn(),
    getInstanceById: vi.fn(),
    getStepsAndRulesForValidation: vi.fn(),
    getActiveInstancesByDefinitionAndStepConfig: vi.fn(),
    lockStepInstanceForUpdate: vi.fn(),
    lockInstanceForUpdate: vi.fn(),
    runInTransaction: vi.fn(async (cb: any) => cb('mock-tx' as any)),
    cancelActiveAndPendingStepInstancesForInstance: vi.fn(),
    getActiveStepInstancesForInstance: vi.fn(),
    getApprovalGrant: vi.fn(),
    markApprovalGrantUsed: vi.fn(),
    migrateInstanceVersion: vi.fn(),
    getMultiReferralStepInstanceForInstance: vi.fn(),
    createPendingBypass: vi.fn(),
    getPendingBypassForInstance: vi.fn(),
    markBypassApplied: vi.fn(),
    getActiveInstancesWithSla: vi.fn(),
    ...overrides,
  };
}

export function buildMockApprovalDeps(repoOverrides: Record<string, any> = {}) {
  const workflowRepository = buildMockRepo(repoOverrides);
  return {
    workflowRepository,
    db: { transaction: vi.fn(async (cb: any) => cb('mock-tx' as any)) },
    documentsService: { getDocumentById: vi.fn() },
    eventBus: { publish: vi.fn() },
    orgService: {},
    delegationService: {},
  };
}

export async function withFakeTimers<T>(fn: (setTime: (d: Date) => void) => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    return await fn((d: Date) => vi.setSystemTime(d));
  } finally {
    vi.useRealTimers();
  }
}
