import { describe, it, expect } from 'vitest';
import {
  PolicyGuard,
  PolicyEvaluator,
  type SubjectContext,
  type ResourceDescriptor,
} from '../iam.policy.js';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Returns a minimal valid SubjectContext with overrides applied. */
function makeSubject(overrides: Partial<SubjectContext> = {}): SubjectContext {
  return {
    userId: 'user-001',
    sessionId: 'session-001',
    officeId: 'office-001',
    cityId: 'city-batac',
    roles: ['dept_encoder'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: ['office-001'],
    effectiveRoles: ['dept_encoder'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

/** Returns a minimal valid ResourceDescriptor with overrides applied. */
function makeResource(overrides: Partial<ResourceDescriptor> = {}): ResourceDescriptor {
  return {
    type: 'document',
    id: 'res-001',
    cityId: 'city-batac',
    ...overrides,
  };
}

// ─── PolicyGuard Unit Tests ─────────────────────────────────────────────────

describe('PolicyGuard', () => {
  const guard = new PolicyGuard();

  describe('Gate 1 — City Isolation', () => {
    it('returns DENY with reason tenant_isolation when subject.cityId !== resource.cityId', () => {
      const subject = makeSubject({ cityId: 'city-batac' });
      const resource = makeResource({ cityId: 'city-other' });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: false, reason: 'tenant_isolation' });
    });

    it('denies regardless of other attributes (IT Admin, Platform Admin, all permissions)', () => {
      const subject = makeSubject({
        cityId: 'city-batac',
        isItAdmin: true,
        isPlatformAdmin: true,
        permissions: ['document:read', 'session:read_all'],
        roles: ['sys_admin', 'platform_admin'],
      });
      const resource = makeResource({ cityId: 'city-different' });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: false, reason: 'tenant_isolation' });
    });

    it('allows when cityId matches', () => {
      const subject = makeSubject({ cityId: 'city-batac' });
      const resource = makeResource({ cityId: 'city-batac' });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('Gate 2 — IT Admin Content Isolation', () => {
    it('denies IT Admin reading confidential document_version', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document_version',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: false, reason: 'it_admin_content_isolation_invariant' });
    });

    it('denies IT Admin downloading restricted document_attachment', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document_attachment',
        classificationLevel: 'restricted',
      });
      const result = guard.checkGates(subject, resource, 'download');

      expect(result).toEqual({ allowed: false, reason: 'it_admin_content_isolation_invariant' });
    });

    it('denies IT Admin exporting confidential document_version', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document_version',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'export');

      expect(result).toEqual({ allowed: false, reason: 'it_admin_content_isolation_invariant' });
    });

    it('denies IT Admin bulk_export on restricted document_attachment', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document_attachment',
        classificationLevel: 'restricted',
      });
      const result = guard.checkGates(subject, resource, 'bulk_export');

      expect(result).toEqual({ allowed: false, reason: 'it_admin_content_isolation_invariant' });
    });

    it('denies IT Admin scan_qr_content on confidential document_version', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document_version',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'scan_qr_content');

      expect(result).toEqual({ allowed: false, reason: 'it_admin_content_isolation_invariant' });
    });

    it('allows IT Admin to read public document_version', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document_version',
        classificationLevel: 'public',
      });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: true });
    });

    it('allows IT Admin to read document metadata (type: document, not document_version)', () => {
      const subject = makeSubject({ isItAdmin: true });
      const resource = makeResource({
        type: 'document',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: true });
    });

    it('allows non-IT-Admin to read confidential document_version', () => {
      const subject = makeSubject({ isItAdmin: false });
      const resource = makeResource({
        type: 'document_version',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('Gate 3 — Platform Admin Operational Exclusion', () => {
    it('denies Platform Admin performing operational action (document:create)', () => {
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'create');

      expect(result).toEqual({
        allowed: false,
        reason: 'platform_admin_operational_exclusion_invariant',
      });
    });

    it('denies Platform Admin performing approve action', () => {
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'approve');

      expect(result).toEqual({
        allowed: false,
        reason: 'platform_admin_operational_exclusion_invariant',
      });
    });

    it('allows Platform Admin performing manage_roles', () => {
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'manage_roles');

      expect(result).toEqual({ allowed: true });
    });

    it('allows Platform Admin performing manage_workflow_def', () => {
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'manage_workflow_def');

      expect(result).toEqual({ allowed: true });
    });

    it('allows Platform Admin performing read_org_structure', () => {
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'read_org_structure');

      expect(result).toEqual({ allowed: true });
    });

    it('allows Platform Admin performing export_report', () => {
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'export_report');

      expect(result).toEqual({ allowed: true });
    });

    it('allows non-Platform-Admin performing operational actions', () => {
      const subject = makeSubject({ isPlatformAdmin: false });
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'create');

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('Gate 5 — Soft-Delete Gate', () => {
    it('denies non-read action on soft-deleted resource', () => {
      const subject = makeSubject();
      const resource = makeResource({ deletedAt: new Date() });
      const result = guard.checkGates(subject, resource, 'update');

      expect(result).toEqual({ allowed: false, reason: 'resource_soft_deleted' });
    });

    it('denies create action on soft-deleted resource', () => {
      const subject = makeSubject();
      const resource = makeResource({ deletedAt: new Date() });
      const result = guard.checkGates(subject, resource, 'create');

      expect(result).toEqual({ allowed: false, reason: 'resource_soft_deleted' });
    });

    it('allows read action on soft-deleted resource', () => {
      const subject = makeSubject();
      const resource = makeResource({ deletedAt: new Date() });
      const result = guard.checkGates(subject, resource, 'read');

      expect(result).toEqual({ allowed: true });
    });

    it('allows read_metadata action on soft-deleted resource', () => {
      const subject = makeSubject();
      const resource = makeResource({ deletedAt: new Date() });
      const result = guard.checkGates(subject, resource, 'read_metadata');

      expect(result).toEqual({ allowed: true });
    });

    it('allows view_audit_trail action on soft-deleted resource', () => {
      const subject = makeSubject();
      const resource = makeResource({ deletedAt: new Date() });
      const result = guard.checkGates(subject, resource, 'view_audit_trail');

      expect(result).toEqual({ allowed: true });
    });

    it('allows any action on non-deleted resource (deletedAt is null)', () => {
      const subject = makeSubject();
      const resource = makeResource({ deletedAt: null });
      const result = guard.checkGates(subject, resource, 'update');

      expect(result).toEqual({ allowed: true });
    });

    it('allows any action on resource without deletedAt field', () => {
      const subject = makeSubject();
      const resource = makeResource();
      const result = guard.checkGates(subject, resource, 'delete');

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('Gate 4 — Classification Gate (async)', () => {
    it('denies classified resource when no roles match allowlist', async () => {
      const guard4 = new PolicyGuard({
        getAllowlistRoles: async () => ['sp_secretary', 'mayor'],
      });
      const subject = makeSubject({ roles: ['dept_encoder'] });
      const resource = makeResource({
        classificationLevel: 'confidential',
        documentTypeId: 'admin-case-type',
      });

      const result = await guard4.checkClassificationGateAsync(subject, resource);
      expect(result).toEqual({ allowed: false, reason: 'classification_denied' });
    });

    it('allows classified resource when subject has a matching role', async () => {
      const guard4 = new PolicyGuard({
        getAllowlistRoles: async () => ['sp_secretary', 'mayor'],
      });
      const subject = makeSubject({ roles: ['sp_secretary'] });
      const resource = makeResource({
        classificationLevel: 'confidential',
        documentTypeId: 'admin-case-type',
      });

      const result = await guard4.checkClassificationGateAsync(subject, resource);
      expect(result).toEqual({ allowed: true });
    });

    it('allows non-classified resources without checking allowlist', async () => {
      const guard4 = new PolicyGuard({
        getAllowlistRoles: async () => {
          throw new Error('should not be called');
        },
      });
      const subject = makeSubject({ roles: ['dept_encoder'] });
      const resource = makeResource({ classificationLevel: 'public' });

      const result = await guard4.checkClassificationGateAsync(subject, resource);
      expect(result).toEqual({ allowed: true });
    });

    it('denies classified resource when no documentTypeId is provided', async () => {
      const guard4 = new PolicyGuard();
      const subject = makeSubject({ roles: ['sp_secretary'] });
      const resource = makeResource({ classificationLevel: 'restricted' });

      const result = await guard4.checkClassificationGateAsync(subject, resource);
      expect(result).toEqual({ allowed: false, reason: 'classification_denied' });
    });

    it('denies classified resource with default allowlist (no injection)', async () => {
      const guard4 = new PolicyGuard(); // default getAllowlistRoles returns []
      const subject = makeSubject({ roles: ['sp_secretary'] });
      const resource = makeResource({
        classificationLevel: 'confidential',
        documentTypeId: 'admin-case-type',
      });

      const result = await guard4.checkClassificationGateAsync(subject, resource);
      expect(result).toEqual({ allowed: false, reason: 'classification_denied' });
    });
  });

  describe('Gate ordering — first deny wins', () => {
    it('Gate 1 fires before Gate 2 (cross-city IT Admin)', () => {
      const subject = makeSubject({ cityId: 'city-A', isItAdmin: true });
      const resource = makeResource({
        cityId: 'city-B',
        type: 'document_version',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'read');

      // Should be tenant_isolation, not it_admin_content_isolation
      expect(result).toEqual({ allowed: false, reason: 'tenant_isolation' });
    });

    it('Gate 2 fires before Gate 3 (IT Admin who is also Platform Admin, somehow)', () => {
      const subject = makeSubject({ isItAdmin: true, isPlatformAdmin: true });
      const resource = makeResource({
        type: 'document_version',
        classificationLevel: 'confidential',
      });
      const result = guard.checkGates(subject, resource, 'read');

      // Should be it_admin_content_isolation, not platform_admin_operational_exclusion
      expect(result).toEqual({ allowed: false, reason: 'it_admin_content_isolation_invariant' });
    });
  });
});

// ─── PolicyEvaluator Unit Tests ─────────────────────────────────────────────

describe('PolicyEvaluator', () => {
  /** Create an evaluator with a default guard (no allowlist injection). */
  function makeEvaluator(guardOptions?: { getAllowlistRoles?: (id: string) => Promise<string[]> }) {
    const guard = new PolicyGuard(guardOptions);
    return new PolicyEvaluator(guard);
  }

  describe('Gate pass-through to PolicyGuard', () => {
    it('returns tenant_isolation when subject.cityId !== resource.cityId', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({ cityId: 'city-A' });
      const resource = makeResource({ cityId: 'city-B' });

      const result = await evaluator.evaluate(subject, resource, 'read');
      expect(result).toEqual({ allowed: false, reason: 'tenant_isolation' });
    });

    it('returns platform_admin_operational_exclusion_invariant for Platform Admin + operational action', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({ isPlatformAdmin: true });
      const resource = makeResource();

      const result = await evaluator.evaluate(subject, resource, 'create');
      expect(result).toEqual({
        allowed: false,
        reason: 'platform_admin_operational_exclusion_invariant',
      });
    });
  });

  describe('Step 4 — Classification Gate (async) via evaluate()', () => {
    it('denies classified resource via evaluate() when role not in allowlist', async () => {
      const evaluator = makeEvaluator({
        getAllowlistRoles: async () => ['mayor'],
      });
      const subject = makeSubject({
        roles: ['dept_encoder'],
        permissions: ['document:read'],
      });
      const resource = makeResource({
        classificationLevel: 'confidential',
        documentTypeId: 'admin-case-type',
      });

      const result = await evaluator.evaluate(subject, resource, 'read');
      expect(result).toEqual({ allowed: false, reason: 'classification_denied' });
    });
  });

  describe('Step 6 — RBAC Check', () => {
    it('denies when subject does not have matching permission', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({ permissions: ['document:update'] });
      const resource = makeResource({ type: 'document' });

      const result = await evaluator.evaluate(subject, resource, 'read');
      expect(result).toEqual({ allowed: false, reason: 'rbac_no_matching_permission' });
    });

    it('allows when subject has matching permission and no handler is registered', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({ permissions: ['document:read'] });
      const resource = makeResource({ type: 'document' });

      const result = await evaluator.evaluate(subject, resource, 'read');
      expect(result).toEqual({ allowed: true });
    });

    it('constructs permKey as resource.type:action', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({ permissions: ['workflow_step_instance:approve'] });
      const resource = makeResource({ type: 'workflow_step_instance' });

      const result = await evaluator.evaluate(subject, resource, 'approve');
      expect(result).toEqual({ allowed: true });
    });
  });

  describe('Steps 7–8 — ABAC Refinements via Resource Handler', () => {
    it('delegates to registered handler after RBAC passes', async () => {
      const evaluator = makeEvaluator();
      evaluator.registerResourceHandler('custom_resource', (_subject, _resource, action) => {
        if (action === 'special_action') {
          return { allowed: false, reason: 'custom_deny' };
        }
        return { allowed: true };
      });

      const subject = makeSubject({ permissions: ['custom_resource:special_action'] });
      const resource = makeResource({ type: 'custom_resource' });

      const result = await evaluator.evaluate(subject, resource, 'special_action');
      expect(result).toEqual({ allowed: false, reason: 'custom_deny' });
    });

    it('allows if handler returns allowed: true', async () => {
      const evaluator = makeEvaluator();
      evaluator.registerResourceHandler('custom_resource', () => ({ allowed: true }));

      const subject = makeSubject({ permissions: ['custom_resource:read'] });
      const resource = makeResource({ type: 'custom_resource' });

      const result = await evaluator.evaluate(subject, resource, 'read');
      expect(result).toEqual({ allowed: true });
    });

    it('supports async handlers', async () => {
      const evaluator = makeEvaluator();
      evaluator.registerResourceHandler('async_resource', async () => {
        return { allowed: false, reason: 'async_deny' };
      });

      const subject = makeSubject({ permissions: ['async_resource:read'] });
      const resource = makeResource({ type: 'async_resource' });

      const result = await evaluator.evaluate(subject, resource, 'read');
      expect(result).toEqual({ allowed: false, reason: 'async_deny' });
    });
  });

  describe('Session resource handler', () => {
    it('session:read_own — allows when resource.userId === subject.userId', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        userId: 'user-001',
        permissions: ['session:read_own'],
      });
      const resource = makeResource({
        type: 'session',
        userId: 'user-001',
      });

      const result = await evaluator.evaluate(subject, resource, 'read_own');
      expect(result).toEqual({ allowed: true });
    });

    it('session:read_own — denies when resource.userId !== subject.userId', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        userId: 'user-001',
        permissions: ['session:read_own'],
      });
      const resource = makeResource({
        type: 'session',
        userId: 'user-other',
      });

      const result = await evaluator.evaluate(subject, resource, 'read_own');
      expect(result).toEqual({ allowed: false, reason: 'session_action_not_permitted' });
    });

    it('session:read_all — allows IT Admin', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: true,
        permissions: ['session:read_all'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'read_all');
      expect(result).toEqual({ allowed: true });
    });

    it('session:read_all — denies non-IT-Admin', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: false,
        permissions: ['session:read_all'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'read_all');
      expect(result).toEqual({ allowed: false, reason: 'session_action_not_permitted' });
    });

    it('session:force_terminate — allows IT Admin with non-empty reason', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: true,
        permissions: ['session:force_terminate'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'force_terminate', {
        reason: 'Security incident',
      });
      expect(result).toEqual({ allowed: true });
    });

    it('session:force_terminate — denies IT Admin without reason', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: true,
        permissions: ['session:force_terminate'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'force_terminate');
      expect(result).toEqual({ allowed: false, reason: 'session_action_not_permitted' });
    });

    it('session:force_terminate — denies IT Admin with empty reason', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: true,
        permissions: ['session:force_terminate'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'force_terminate', {
        reason: '',
      });
      expect(result).toEqual({ allowed: false, reason: 'session_action_not_permitted' });
    });

    it('session:force_terminate — denies non-IT-Admin even with reason', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: false,
        permissions: ['session:force_terminate'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'force_terminate', {
        reason: 'Security incident',
      });
      expect(result).toEqual({ allowed: false, reason: 'session_action_not_permitted' });
    });

    it('session:unknown_action — denies with session_action_not_permitted', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        isItAdmin: true,
        permissions: ['session:unknown_action'],
      });
      const resource = makeResource({ type: 'session' });

      const result = await evaluator.evaluate(subject, resource, 'unknown_action');
      expect(result).toEqual({ allowed: false, reason: 'session_action_not_permitted' });
    });
  });

  describe('Full cascade integration', () => {
    it('Gate 1 denial stops before RBAC or ABAC evaluation', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        cityId: 'city-A',
        permissions: ['session:read_own'],
      });
      const resource = makeResource({
        type: 'session',
        cityId: 'city-B',
        userId: 'user-001',
      });

      const result = await evaluator.evaluate(subject, resource, 'read_own');
      // tenant_isolation, not session_action_not_permitted or rbac error
      expect(result).toEqual({ allowed: false, reason: 'tenant_isolation' });
    });

    it('RBAC denial stops before ABAC handler is called', async () => {
      const evaluator = makeEvaluator();
      const subject = makeSubject({
        permissions: [], // no permissions at all
        userId: 'user-001',
      });
      const resource = makeResource({
        type: 'session',
        userId: 'user-001',
      });

      const result = await evaluator.evaluate(subject, resource, 'read_own');
      // rbac_no_matching_permission, not session_action_not_permitted
      expect(result).toEqual({ allowed: false, reason: 'rbac_no_matching_permission' });
    });
  });
});
