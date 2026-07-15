import { describe, it, expect, vi } from 'vitest';
import { resolveAssignees } from '../engine/assignee-resolution.js';

describe('Assignee Resolution (ASSIGN)', () => {
  const mockDeps = {
    orgService: {} as any,
    delegationService: {} as any,
  };

  describe('ASSIGN-V: Implemented strategies', () => {
    it('ASSIGN-V-01: static:userId resolves to single user', async () => {
      const result = await resolveAssignees('static:user-mayor', {}, mockDeps);
      expect(result).toEqual([{ user_id: 'user-mayor', resolved_via: 'static:user-mayor' }]);
    });

    it('ASSIGN-V-02: actor_from_context:key resolves from context', async () => {
      const result = await resolveAssignees(
        'actor_from_context:submitted_by',
        { submitted_by: 'user-123' },
        mockDeps,
      );
      expect(result).toEqual([
        { user_id: 'user-123', resolved_via: 'actor_from_context:submitted_by' },
      ]);
    });

    it('ASSIGN-V-03: actor_from_context with missing key returns empty array', async () => {
      const result = await resolveAssignees('actor_from_context:nonexistent_key', {}, mockDeps);
      expect(result).toEqual([]);
    });

    it('ASSIGN-V-04: static:userId returns correct resolved_via value', async () => {
      const result = await resolveAssignees('static:user-vice-mayor', {}, mockDeps);
      expect(result[0]).toMatchObject({
        user_id: 'user-vice-mayor',
        resolved_via: 'static:user-vice-mayor',
      });
    });
  });

  describe('ASSIGN-I: NotImplemented strategies', () => {
    it('ASSIGN-I-01: role: throws NotImplemented error', async () => {
      await expect(resolveAssignees('role:secretary', {}, mockDeps)).rejects.toThrow(
        'NotImplemented',
      );
    });

    it('ASSIGN-I-02: office_role: throws NotImplemented error', async () => {
      await expect(resolveAssignees('office_role:chairman', {}, mockDeps)).rejects.toThrow(
        'NotImplemented',
      );
    });

    it('ASSIGN-I-03: delegation_aware: throws NotImplemented error', async () => {
      await expect(resolveAssignees('delegation_aware:mayor_role', {}, mockDeps)).rejects.toThrow(
        'NotImplemented',
      );
    });

    it('ASSIGN-I-04: unknown expression format throws', async () => {
      await expect(resolveAssignees('unknown:format', {}, mockDeps)).rejects.toThrow(
        'Unsupported assignee expression format',
      );
    });
  });
});
