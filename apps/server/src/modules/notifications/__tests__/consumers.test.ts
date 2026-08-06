/**
 * TASK-NOTIF-014: consumers.test.ts
 *
 * Tests all 5 event-bus consumer registrations:
 *  - step-assignment.consumer.ts (TASK-NOTIF-006)
 *  - sla-escalation.consumer.ts (TASK-NOTIF-008)
 *  - legislative-lapse.consumer.ts (TASK-NOTIF-009)
 *  - document-state-changed.consumer.ts (TASK-NOTIF-007)
 *  - session-displaced.consumer.ts (TASK-NOTIF-011, corrected)
 *
 * Isolation strategy: build a fake FastifyInstance with all required service
 * mocks, call the register* function to wire the consumer, then fire the
 * eventBus.on() handler directly (captured via on.mock.calls). This avoids
 * any real Fastify or real DB. The pattern mirrors workflow/__tests__/lapse-timers.test.ts.
 *
 * IMPORTANT: The consumers use run().catch(...) and return undefined from the
 * outer handler. The EventBus dead-letter/retry mechanism therefore never fires
 * for these consumers (as noted in TASK-NOTIF-013's commit). Tests for error
 * isolation verify the consumer's own catch-and-log behavior, NOT dead-letter
 * table writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerStepAssignmentConsumer } from '../consumers/step-assignment.consumer.js';
import { registerSlaEscalationConsumer } from '../consumers/sla-escalation.consumer.js';
import { registerLegislativeLapseConsumer } from '../consumers/legislative-lapse.consumer.js';
import { registerDocumentStateChangedConsumer } from '../consumers/document-state-changed.consumer.js';
import { registerSessionDisplacedConsumer } from '../consumers/session-displaced.consumer.js';

// ---------------------------------------------------------------------------
// Fake Fastify builder
// ---------------------------------------------------------------------------
function makeFastify(overrides: Record<string, any> = {}) {
  const eventBus: Record<string, Function> = {};
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const notificationsService = {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  };
  const documentsService = {
    getDocumentById: vi.fn().mockResolvedValue({
      id: 'doc-1',
      title: 'Test Document',
      finalNumber: 'RES-2024-001',
      preliminaryNumber: null,
      originatingOfficeId: 'office-1',
    }),
  };
  const workflowService = {
    getStepInstanceSummary: vi.fn(),
    getInstanceById: vi.fn(),
    getEscalationConfigForInstance: vi.fn(),
  };
  const organizationService = {
    getPrimaryOfficeForUser: vi.fn(),
    listEmployeesByRoleAndOffice: vi.fn(),
  };
  const iamService = {
    getUsersByRole: vi.fn(),
  };

  const fastify: any = {
    eventBus: {
      on: vi.fn().mockImplementation((event: string, handler: Function) => {
        eventBus[event] = handler;
      }),
    },
    log,
    notificationsService,
    documentsService,
    workflowService,
    organizationService,
    iamService,
    _eventBus: eventBus, // for test access
    ...overrides,
  };

  return fastify;
}

// Helper: fire a registered event handler and wait for the internal run() promise to settle
async function fireEvent(fastify: any, eventName: string, payload: unknown, eventId = 'evt-test-id') {
  const handler = fastify._eventBus[eventName];
  if (!handler) throw new Error(`No handler registered for ${eventName}`);
  handler({ eventId, payload });
  // Wait one macrotask to let run() settle (consumers use run().catch(...) pattern)
  await new Promise((r) => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// CONS-01: Step Assignment Consumer (TASK-NOTIF-006)
// ---------------------------------------------------------------------------
describe('Consumer: step-assignment (CONS-01)', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = makeFastify();
    registerStepAssignmentConsumer(fastify);
  });

  it('CONS-01-01: registers on workflow.step.started', () => {
    expect(fastify.eventBus.on).toHaveBeenCalledWith(
      'workflow.step.started',
      expect.any(Function),
      'notifications',
    );
  });

  it('CONS-01-02: assignedTo=null is a no-op — sendNotification never called', async () => {
    await fireEvent(fastify, 'workflow.step.started', {
      instanceId: 'inst-1',
      stepInstanceId: 'step-1',
      stepType: 'action',
      stepKey: 'review',
      assignedTo: null,
      documentId: 'doc-1',
      dueAt: null,
    });
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('CONS-01-03: assignedTo=[] (empty array) is a no-op', async () => {
    await fireEvent(fastify, 'workflow.step.started', {
      instanceId: 'inst-1',
      stepInstanceId: 'step-1',
      stepType: 'action',
      stepKey: 'review',
      assignedTo: [],
      documentId: 'doc-1',
      dueAt: null,
    });
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('CONS-01-04: single assignee — sends one notification with correct templateId and channel', async () => {
    await fireEvent(fastify, 'workflow.step.started', {
      instanceId: 'inst-1',
      stepInstanceId: 'step-1',
      stepType: 'action',
      stepKey: 'review',
      assignedTo: ['user-a'],
      documentId: 'doc-1',
      dueAt: new Date('2024-06-01T00:00:00Z'),
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledOnce();
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-a',
        templateId: 'notif.workflow.step_assignment.in_app',
        channel: 'in_app',
      }),
    );
  });

  it('CONS-01-05: multiple assignees — sends one notification per assignee', async () => {
    await fireEvent(fastify, 'workflow.step.started', {
      instanceId: 'inst-1',
      stepInstanceId: 'step-1',
      stepType: 'action',
      stepKey: 'review',
      assignedTo: ['user-a', 'user-b', 'user-c'],
      documentId: 'doc-1',
      dueAt: null,
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledTimes(3);
    const calls = fastify.notificationsService.sendNotification.mock.calls;
    const recipients = calls.map((c: any[]) => c[0].recipientUserId);
    expect(recipients).toContain('user-a');
    expect(recipients).toContain('user-b');
    expect(recipients).toContain('user-c');
  });

  it('CONS-01-06: sendNotification error is caught and logged — process does not crash', async () => {
    fastify.notificationsService.sendNotification.mockRejectedValueOnce(new Error('Service error'));
    await fireEvent(fastify, 'workflow.step.started', {
      instanceId: 'inst-1',
      stepInstanceId: 'step-1',
      stepType: 'action',
      stepKey: 'review',
      assignedTo: ['user-a'],
      documentId: 'doc-1',
      dueAt: null,
    });
    expect(fastify.log.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CONS-02: SLA Escalation Consumer (TASK-NOTIF-008)
// ---------------------------------------------------------------------------
describe('Consumer: sla-escalation (CONS-02)', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = makeFastify();

    fastify.workflowService.getStepInstanceSummary.mockResolvedValue({
      instanceId: 'inst-1',
      assignedTo: [{ user_id: 'assignee-user-1' }],
    });
    fastify.workflowService.getInstanceById.mockResolvedValue({
      id: 'inst-1',
      documentId: 'doc-1',
    });
    fastify.workflowService.getEscalationConfigForInstance.mockResolvedValue({
      supervisor_role: 'dept_supervisor',
      records_officer_role: 'records_officer',
    });
    fastify.organizationService.getPrimaryOfficeForUser.mockResolvedValue({
      officeId: 'office-1',
    });
    fastify.organizationService.listEmployeesByRoleAndOffice.mockImplementation(
      (role: string) => {
        if (role === 'dept_supervisor') return Promise.resolve([{ userId: 'supervisor-1' }]);
        if (role === 'records_officer') return Promise.resolve([{ userId: 'records-officer-1' }]);
        if (role === 'department_head') return Promise.resolve([{ userId: 'dept-head-1' }]);
        return Promise.resolve([]);
      },
    );

    registerSlaEscalationConsumer(fastify);
  });

  it('CONS-02-01: registers on workflow.sla.warning, workflow.sla.breached, workflow.sla.critical', () => {
    const registeredEvents = fastify.eventBus.on.mock.calls.map((c: any[]) => c[0]);
    expect(registeredEvents).toContain('workflow.sla.warning');
    expect(registeredEvents).toContain('workflow.sla.breached');
    expect(registeredEvents).toContain('workflow.sla.critical');
  });

  // WARNING → assignee only
  it('CONS-02-02: SLA WARNING sends notification to assignee only', async () => {
    await fireEvent(fastify, 'workflow.sla.warning', {
      stepInstanceId: 'step-1',
      slaDeadline: '2024-06-01T00:00:00Z',
      percentElapsed: 75,
    });
    const calls = fastify.notificationsService.sendNotification.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]![0].recipientUserId).toBe('assignee-user-1');
    expect(calls[0]![0].templateId).toBe('notif.workflow.sla_warning.in_app');
  });

  // BREACHED → supervisor + records officer (NOT department head)
  it('CONS-02-03: SLA BREACHED sends notification to supervisor and records officer only', async () => {
    await fireEvent(fastify, 'workflow.sla.breached', {
      stepInstanceId: 'step-1',
      slaDeadline: '2024-06-01T00:00:00Z',
      breachDetectedAt: '2024-06-02T00:00:00Z',
      breachedAt: '2024-06-01T00:30:00Z',
    });
    const calls = fastify.notificationsService.sendNotification.mock.calls;
    const recipients = calls.map((c: any[]) => c[0].recipientUserId);
    expect(recipients).toContain('supervisor-1');
    expect(recipients).toContain('records-officer-1');
    // department head should NOT be notified on breach (only on critical)
    expect(recipients).not.toContain('dept-head-1');
    // All calls use the breach template
    for (const call of calls) {
      expect(call[0].templateId).toBe('notif.workflow.sla_breach.in_app');
    }
  });

  // CRITICAL → supervisor + records officer + department head
  it('CONS-02-04: SLA CRITICAL sends notification to supervisor, records officer, AND department head', async () => {
    await fireEvent(fastify, 'workflow.sla.critical', {
      stepInstanceId: 'step-1',
      slaDeadline: '2024-06-01T00:00:00Z',
    });
    const calls = fastify.notificationsService.sendNotification.mock.calls;
    const recipients = calls.map((c: any[]) => c[0].recipientUserId);
    expect(recipients).toContain('supervisor-1');
    expect(recipients).toContain('records-officer-1');
    expect(recipients).toContain('dept-head-1');
    for (const call of calls) {
      expect(call[0].templateId).toBe('notif.workflow.sla_critical.in_app');
    }
  });

  // Deduplication: same userId in both supervisor and records_officer → sent once
  it('CONS-02-05: deduplication — same userId in multiple roles receives notification only once', async () => {
    fastify.organizationService.listEmployeesByRoleAndOffice.mockImplementation(
      (role: string) => {
        if (role === 'dept_supervisor') return Promise.resolve([{ userId: 'shared-user' }]);
        if (role === 'records_officer') return Promise.resolve([{ userId: 'shared-user' }]);
        if (role === 'department_head') return Promise.resolve([{ userId: 'shared-user' }]);
        return Promise.resolve([]);
      },
    );
    await fireEvent(fastify, 'workflow.sla.critical', {
      stepInstanceId: 'step-1',
      slaDeadline: '2024-06-01T00:00:00Z',
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledOnce();
    expect(fastify.notificationsService.sendNotification.mock.calls[0]![0].recipientUserId).toBe('shared-user');
  });

  it('CONS-02-06: early return when stepSummary has no assignedTo', async () => {
    fastify.workflowService.getStepInstanceSummary.mockResolvedValue({ instanceId: 'inst-1', assignedTo: null });
    await fireEvent(fastify, 'workflow.sla.warning', { stepInstanceId: 'step-1', slaDeadline: '2024-06-01', percentElapsed: 80 });
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('CONS-02-07: error in run() is caught and logged — process does not crash', async () => {
    fastify.workflowService.getStepInstanceSummary.mockRejectedValueOnce(new Error('DB down'));
    await fireEvent(fastify, 'workflow.sla.warning', { stepInstanceId: 'step-1', slaDeadline: '2024-06-01', percentElapsed: 80 });
    expect(fastify.log.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CONS-03: Legislative Lapse Consumer (TASK-NOTIF-009)
// ---------------------------------------------------------------------------
describe('Consumer: legislative-lapse (CONS-03)', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = makeFastify();
    fastify.iamService.getUsersByRole.mockResolvedValue([{ userId: 'sp-secretary-user' }]);
    registerLegislativeLapseConsumer(fastify);
  });

  it('CONS-03-01: registers on workflow.approval.lapsed and workflow.panlalawigan.deemed_approved', () => {
    const registeredEvents = fastify.eventBus.on.mock.calls.map((c: any[]) => c[0]);
    expect(registeredEvents).toContain('workflow.approval.lapsed');
    expect(registeredEvents).toContain('workflow.panlalawigan.deemed_approved');
  });

  it('CONS-03-02: workflow.approval.lapsed notifies sp_secretary', async () => {
    await fireEvent(fastify, 'workflow.approval.lapsed', {
      stepInstanceId: 'step-1',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: '2024-05-20T00:00:00Z',
    });
    expect(fastify.iamService.getUsersByRole).toHaveBeenCalledWith('sp_secretary');
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'sp-secretary-user',
        templateId: 'notif.workflow.mayor_lapse.in_app',
        channel: 'in_app',
      }),
    );
  });

  // Verbatim legal basis string for mayor lapse (RA 7160 Section 47)
  it('CONS-03-03: templateData.legalBasis is the exact verbatim string "RA 7160 Section 47"', async () => {
    await fireEvent(fastify, 'workflow.approval.lapsed', {
      stepInstanceId: 'step-2',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: '2024-05-20T00:00:00Z',
    });
    const call = fastify.notificationsService.sendNotification.mock.calls[0]!;
    expect(call[0].templateData.legalBasis).toBe('RA 7160 Section 47');
  });

  it('CONS-03-04: workflow.panlalawigan.deemed_approved notifies sp_secretary', async () => {
    await fireEvent(fastify, 'workflow.panlalawigan.deemed_approved', {
      stepInstanceId: 'step-3',
      legalBasis: 'RA 7160 Section 56(d)',
      transmissionDate: '2024-04-01T00:00:00Z',
      deadlineWas: '2024-05-01T00:00:00Z',
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'sp-secretary-user',
        templateId: 'notif.workflow.panlalawigan_deemed_approved.in_app',
        channel: 'in_app',
      }),
    );
  });

  // Verbatim legal basis string for panlalawigan (RA 7160 Section 56(d))
  it('CONS-03-05: templateData.legalBasis is the exact verbatim string "RA 7160 Section 56(d)"', async () => {
    await fireEvent(fastify, 'workflow.panlalawigan.deemed_approved', {
      stepInstanceId: 'step-4',
      legalBasis: 'RA 7160 Section 56(d)',
      transmissionDate: '2024-04-01T00:00:00Z',
      deadlineWas: '2024-05-01T00:00:00Z',
    });
    const call = fastify.notificationsService.sendNotification.mock.calls[0]!;
    expect(call[0].templateData.legalBasis).toBe('RA 7160 Section 56(d)');
  });

  // NOTE: seed template body for mayor_lapse currently has the citation appearing twice:
  // once via {{legalBasis}} (rendered at runtime) and once as hardcoded suffix text "(RA 7160 Section 47)".
  // This is the current live state of notifications.seed.ts as of TASK-NOTIF-014.
  // This test asserts the templateData passed to sendNotification — the double-occurrence is
  // a seed-level concern, not a consumer logic concern. No assertion on rendered body here.
  it('CONS-03-06: seed note — templateData carries legalBasis field (rendering is service-layer concern)', async () => {
    await fireEvent(fastify, 'workflow.approval.lapsed', {
      stepInstanceId: 'step-5',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: '2024-05-20T00:00:00Z',
    });
    const call = fastify.notificationsService.sendNotification.mock.calls[0]!;
    expect(call[0].templateData).toMatchObject({
      legalBasis: 'RA 7160 Section 47',
      stepInstanceId: 'step-5',
      deadlineWas: '2024-05-20T00:00:00Z',
    });
  });

  it('CONS-03-07: no SP Secretary users — logs warn and skips notification', async () => {
    fastify.iamService.getUsersByRole.mockResolvedValue([]);
    await fireEvent(fastify, 'workflow.approval.lapsed', {
      stepInstanceId: 'step-6',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: '2024-05-20T00:00:00Z',
    });
    expect(fastify.log.warn).toHaveBeenCalled();
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('CONS-03-08: error in run() is caught and logged — process does not crash', async () => {
    fastify.iamService.getUsersByRole.mockRejectedValueOnce(new Error('IAM error'));
    await fireEvent(fastify, 'workflow.approval.lapsed', {
      stepInstanceId: 'step-7',
      legalBasis: 'RA 7160 Section 47',
      deadlineWas: '2024-05-20T00:00:00Z',
    });
    expect(fastify.log.error).toHaveBeenCalled();
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CONS-04: Document State Changed Consumer (TASK-NOTIF-007)
// ---------------------------------------------------------------------------
describe('Consumer: document-state-changed (CONS-04)', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = makeFastify();
    registerDocumentStateChangedConsumer(fastify);
  });

  it('CONS-04-01: registers on document.state_changed', () => {
    expect(fastify.eventBus.on).toHaveBeenCalledWith(
      'document.state_changed',
      expect.any(Function),
      'notifications',
    );
  });

  it('CONS-04-02: when getUserByOfficeRole is unavailable, logs warn and skips notification', async () => {
    // organizationService does NOT have getUserByOfficeRole (the current state)
    await fireEvent(fastify, 'document.state_changed', {
      documentId: 'doc-1',
      fromState: 'draft',
      toState: 'submitted',
      actorId: 'user-actor',
      reason: null,
    });
    expect(fastify.log.warn).toHaveBeenCalled();
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('CONS-04-03: when getUserByOfficeRole returns a recipient, sends notification', async () => {
    (fastify.organizationService as any).getUserByOfficeRole = vi
      .fn()
      .mockResolvedValue([{ userId: 'recipient-user' }]);
    await fireEvent(fastify, 'document.state_changed', {
      documentId: 'doc-1',
      fromState: 'draft',
      toState: 'submitted',
      actorId: 'different-actor',
      reason: null,
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'recipient-user',
        templateId: 'notif.document.state_changed.in_app',
      }),
    );
  });

  it('CONS-04-04: actorId === recipientUserId is skipped (H4 §4.2)', async () => {
    (fastify.organizationService as any).getUserByOfficeRole = vi
      .fn()
      .mockResolvedValue([{ userId: 'same-user' }]);
    await fireEvent(fastify, 'document.state_changed', {
      documentId: 'doc-1',
      fromState: 'draft',
      toState: 'submitted',
      actorId: 'same-user', // same as recipient
      reason: null,
    });
    expect(fastify.notificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('CONS-04-05: error in run() is caught and logged — process does not crash', async () => {
    fastify.documentsService.getDocumentById.mockRejectedValueOnce(new Error('DB error'));
    await fireEvent(fastify, 'document.state_changed', {
      documentId: 'doc-missing',
      fromState: 'draft',
      toState: 'submitted',
      actorId: 'user-actor',
      reason: null,
    });
    expect(fastify.log.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CONS-05: Session Displaced Consumer (TASK-NOTIF-011, corrected)
// ---------------------------------------------------------------------------
describe('Consumer: session-displaced (CONS-05)', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = makeFastify();
    registerSessionDisplacedConsumer(fastify);
  });

  it('CONS-05-01: registers on session.replaced (NOT session.terminated)', () => {
    const registeredEvents = fastify.eventBus.on.mock.calls.map((c: any[]) => c[0]);
    expect(registeredEvents).toContain('session.replaced');
    expect(registeredEvents).not.toContain('session.terminated');
  });

  it('CONS-05-02: session.replaced notifies payload.user_id with correct templateId', async () => {
    await fireEvent(fastify, 'session.replaced', {
      user_id: 'displaced-user',
      old_session_id: 'old-sess-abc',
      new_session_id: 'new-sess-xyz',
      new_ip_address: '10.0.0.1',
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'displaced-user',
        templateId: 'notif.iam.session_displaced.in_app',
        channel: 'in_app',
      }),
    );
  });

  it('CONS-05-03: templateData matches real payload fields — old_session_id, new_session_id, new_ip_address', async () => {
    await fireEvent(fastify, 'session.replaced', {
      user_id: 'displaced-user',
      old_session_id: 'old-sess-abc',
      new_session_id: 'new-sess-xyz',
      new_ip_address: '10.0.0.1',
    });
    const call = fastify.notificationsService.sendNotification.mock.calls[0]!;
    expect(call[0].templateData).toMatchObject({
      oldSessionId: 'old-sess-abc',
      newSessionId: 'new-sess-xyz',
      newIpAddress: '10.0.0.1',
    });
    // Specifically assert the OLD field names that existed before the correction do NOT appear:
    expect(call[0].templateData).not.toHaveProperty('sessionId');
    expect(call[0].templateData).not.toHaveProperty('reason');
  });

  it('CONS-05-04: null new_ip_address falls back to "unknown location"', async () => {
    await fireEvent(fastify, 'session.replaced', {
      user_id: 'displaced-user',
      old_session_id: 'old-sess-abc',
      new_session_id: 'new-sess-xyz',
      new_ip_address: null,
    });
    const call = fastify.notificationsService.sendNotification.mock.calls[0]!;
    expect(call[0].templateData.newIpAddress).toBe('unknown location');
  });

  // TASK-NOTIF-014 correction #1: no reason-filter branching exists — there is only one
  // code path (session.replaced always means displacement). No 'timeout' case to test.
  it('CONS-05-05: session.replaced always triggers notification — no reason-filter branching', async () => {
    // Fire two events with completely different payloads — both should trigger sendNotification
    await fireEvent(fastify, 'session.replaced', {
      user_id: 'user-A',
      old_session_id: 'sess-1',
      new_session_id: 'sess-2',
      new_ip_address: '192.168.1.1',
    });
    await fireEvent(fastify, 'session.replaced', {
      user_id: 'user-B',
      old_session_id: 'sess-3',
      new_session_id: 'sess-4',
      new_ip_address: null,
    });
    expect(fastify.notificationsService.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('CONS-05-06: error in run() is caught and logged — process does not crash', async () => {
    fastify.notificationsService.sendNotification.mockRejectedValueOnce(new Error('Notification failed'));
    await fireEvent(fastify, 'session.replaced', {
      user_id: 'displaced-user',
      old_session_id: 'old-sess',
      new_session_id: 'new-sess',
      new_ip_address: '127.0.0.1',
    });
    expect(fastify.log.error).toHaveBeenCalled();
  });
});
