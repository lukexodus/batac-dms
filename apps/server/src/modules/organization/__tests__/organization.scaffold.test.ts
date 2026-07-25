import { describe, it, expect } from 'vitest';
import { createOrgService, createDelegationService } from '../index.js';
import { OfficeSummarySchema } from '@batac/shared/schemas/organization';

describe('Organization Module Scaffold', () => {
  it('provides createOrgService and createDelegationService which return typed objects', () => {
    const orgRepo = {} as any; // mock
    const db = {} as any;
    const eventBus = {} as any;

    const orgService = createOrgService({ db, orgRepository: orgRepo, eventBus });
    const delegationService = createDelegationService({ db, orgRepository: orgRepo, eventBus });

    expect(orgService).toBeDefined();
    expect(delegationService).toBeDefined();
    expect(typeof orgService.getOfficeById).toBe('function');
    expect(typeof delegationService.getActiveDelegationForUser).toBe('function');
  });

  it('resolves OfficeSummarySchema and validates correctly', () => {
    const validData = {
      officeId: '00000000-0000-4000-8000-000000000001',
      name: 'Office of the Mayor',
      parentOfficeId: null,
      type: 'executive',
    };

    const parsed = OfficeSummarySchema.parse(validData);
    expect(parsed).toEqual(validData);

    const invalidData = {
      officeId: 'invalid-uuid',
      name: 'Invalid Office',
      parentOfficeId: null,
      type: 'invalid-type',
    };

    expect(() => OfficeSummarySchema.parse(invalidData)).toThrow();
  });
});
