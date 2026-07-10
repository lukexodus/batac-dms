import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCertificationUrgencyEvent } from '../engine/certified-urgent-bypass.handler.js';
import { buildMockInstance, buildMockStepInstance, buildMockRepo } from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Certified Urgent Bypass Handler (CU)', () => {
  let mockRepo: any;
  let mockDeps: any;
  let mockTrx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrx = { _isMockTrx: true };
    mockRepo = buildMockRepo();
    mockDeps = {
      db: {
        transaction: vi.fn(async (cb: any) => cb(mockTrx)),
      },
      workflowRepository: mockRepo,
      documentsService: {},
      eventBus: { publish: vi.fn() },
      orgService: {},
      delegationService: {},
    };
  });

  const makePayload = (instanceIds: string[]) => ({
    certificationDocumentId: 'cert-doc-1',
    associatedInstanceIds: instanceIds,
    loggedBy: 'user-clerk',
    loggedAt: new Date().toISOString(),
  });

  it('CU-02: instance not found → error logged but does not throw (per-instance try/catch)', async () => {
    mockRepo.getInstanceById.mockResolvedValue(null);
    // Should not throw; error is caught per-instance
    await expect(
      processCertificationUrgencyEvent(makePayload(['inst-missing']), mockDeps)
    ).resolves.not.toThrow();
  });

  it('CU-03: instance already inactive → emits already_inactive event, no bypass', async () => {
    const inst = buildMockInstance({ id: 'inst-1', status: 'completed' });
    mockRepo.getInstanceById.mockResolvedValue(inst);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    await processCertificationUrgencyEvent(makePayload(['inst-1']), mockDeps);
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.certification_urgency.already_inactive' }),
      mockTrx
    );
    expect(mockRepo.updateStepInstance).not.toHaveBeenCalled();
  });

  it('CU-04: CASE A — multi_referral step is active → bypass applied immediately', async () => {
    const inst = buildMockInstance({ id: 'inst-1', status: 'active' });
    const step = buildMockStepInstance({ status: 'active', stepId: 'step-mref' });
    mockRepo.getInstanceById.mockResolvedValue(inst);
    mockRepo.updateInstanceContext.mockResolvedValue(undefined);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.getMultiReferralStepInstanceForInstance.mockResolvedValue(step);
    mockRepo.updateStepInstance.mockResolvedValue({ ...step, status: 'bypassed' });
    mockRepo.getStepInstanceById.mockResolvedValue({ ...step, status: 'bypassed' });
    await processCertificationUrgencyEvent(makePayload(['inst-1']), mockDeps);
    expect(mockRepo.updateStepInstance).toHaveBeenCalledWith(
      step.id,
      expect.objectContaining({
        status: 'bypassed',
        bypassReason: 'CERTIFIED_URGENT',
        outcome: 'BYPASSED_CERTIFIED_URGENT',
      }),
      mockTrx
    );
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.step.bypassed' }),
      mockTrx
    );
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.certification_urgency.bypass_applied' }),
      mockTrx
    );
  });

  it('CU-05: CASE B — multi_referral step is pending → creates pending bypass record', async () => {
    const inst = buildMockInstance({ id: 'inst-1', status: 'active' });
    const step = buildMockStepInstance({ status: 'pending', stepId: 'step-mref' });
    mockRepo.getInstanceById.mockResolvedValue(inst);
    mockRepo.updateInstanceContext.mockResolvedValue(undefined);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.getMultiReferralStepInstanceForInstance.mockResolvedValue(step);
    mockRepo.createPendingBypass.mockResolvedValue({ id: 'pending-1' });
    await processCertificationUrgencyEvent(makePayload(['inst-1']), mockDeps);
    expect(mockRepo.createPendingBypass).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-1', certificationDocumentId: 'cert-doc-1' }),
      mockTrx
    );
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.certification_urgency.bypass_deferred' }),
      mockTrx
    );
  });

  it('CU-06: CASE C — multi_referral step already completed → emits already_past_referral', async () => {
    const inst = buildMockInstance({ id: 'inst-1', status: 'active' });
    const step = buildMockStepInstance({ status: 'completed', stepId: 'step-mref' });
    mockRepo.getInstanceById.mockResolvedValue(inst);
    mockRepo.updateInstanceContext.mockResolvedValue(undefined);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.getMultiReferralStepInstanceForInstance.mockResolvedValue(step);
    await processCertificationUrgencyEvent(makePayload(['inst-1']), mockDeps);
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'workflow.certification_urgency.already_past_referral' }),
      mockTrx
    );
    expect(mockRepo.updateStepInstance).not.toHaveBeenCalled();
  });

  it('CU-07: sets certified_urgent context keys before bypass', async () => {
    const inst = buildMockInstance({ id: 'inst-1', status: 'active' });
    const step = buildMockStepInstance({ status: 'active', stepId: 'step-mref' });
    mockRepo.getInstanceById.mockResolvedValue(inst);
    mockRepo.updateInstanceContext.mockResolvedValue(undefined);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.getMultiReferralStepInstanceForInstance.mockResolvedValue(step);
    mockRepo.updateStepInstance.mockResolvedValue({ ...step, status: 'bypassed' });
    mockRepo.getStepInstanceById.mockResolvedValue({ ...step, status: 'bypassed' });
    await processCertificationUrgencyEvent(makePayload(['inst-1']), mockDeps);
    expect(mockRepo.updateInstanceContext).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({
        certified_urgent: true,
        certified_urgent_document_id: 'cert-doc-1',
      }),
      mockTrx
    );
  });

  it('CU-08: one failed instance does not block others (per-instance isolation)', async () => {
    const inst1 = buildMockInstance({ id: 'inst-fail', status: 'active' });
    const inst2 = buildMockInstance({ id: 'inst-ok', status: 'active' });
    const step = buildMockStepInstance({ status: 'active', stepId: 'step-mref' });

    mockRepo.getInstanceById
      .mockResolvedValueOnce(inst1)
      .mockResolvedValueOnce(inst2);
    // First instance: getMultiReferralStepInstanceForInstance throws
    mockRepo.getMultiReferralStepInstanceForInstance
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(step);
    mockRepo.updateInstanceContext.mockResolvedValue(undefined);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.updateStepInstance.mockResolvedValue({ ...step, status: 'bypassed' });
    mockRepo.getStepInstanceById.mockResolvedValue({ ...step, status: 'bypassed' });

    // Should not throw even with inst-fail erroring
    await expect(
      processCertificationUrgencyEvent(makePayload(['inst-fail', 'inst-ok']), mockDeps)
    ).resolves.not.toThrow();
  });

  it('CU-09: context.updated event emitted with correct keys', async () => {
    const inst = buildMockInstance({ id: 'inst-1', status: 'active' });
    const step = buildMockStepInstance({ status: 'active', stepId: 'step-mref' });
    mockRepo.getInstanceById.mockResolvedValue(inst);
    mockRepo.updateInstanceContext.mockResolvedValue(undefined);
    mockRepo.createWorkflowEvent.mockResolvedValue({ id: 'evt-1' });
    mockRepo.getMultiReferralStepInstanceForInstance.mockResolvedValue(step);
    mockRepo.updateStepInstance.mockResolvedValue({ ...step, status: 'bypassed' });
    mockRepo.getStepInstanceById.mockResolvedValue({ ...step, status: 'bypassed' });
    await processCertificationUrgencyEvent(makePayload(['inst-1']), mockDeps);
    expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'workflow.context.updated',
        payload: expect.objectContaining({
          updatedKeys: ['certified_urgent', 'certified_urgent_document_id'],
        }),
      }),
      mockTrx
    );
  });
});
