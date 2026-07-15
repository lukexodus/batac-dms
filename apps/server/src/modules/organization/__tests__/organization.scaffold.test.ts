import { describe, it, expect } from 'vitest';
import {
  resolveCurrentHolder,
  getActiveDelegationForUser,
  getOfficeById,
  getOfficeHierarchy,
  getEmployeeByUserId,
  getPrimaryOfficeForUser,
  getCommitteeIdsForUser,
  getDelegationGrantById,
  createOrgService,
  createDelegationService,
  initializePublishedAPI,
} from '../index.js';
import { OfficeSummarySchema } from '@batac/shared/schemas/organization';

describe('Organization Module Scaffold', () => {
  it('exposes the eight B2 Published API methods', () => {
    expect(resolveCurrentHolder).toBeDefined();
    expect(getActiveDelegationForUser).toBeDefined();
    expect(getOfficeById).toBeDefined();
    expect(getOfficeHierarchy).toBeDefined();
    expect(getEmployeeByUserId).toBeDefined();
    expect(getPrimaryOfficeForUser).toBeDefined();
    expect(getCommitteeIdsForUser).toBeDefined();
    expect(getDelegationGrantById).toBeDefined();
  });

  it('allows calling public API methods returning stub values', async () => {
    const mockQueryBuilder = {
      from: function () {
        return this;
      },
      where: function () {
        return this;
      },
      innerJoin: function () {
        return this;
      },
      leftJoin: function () {
        return this;
      },
      limit: function () {
        return this;
      },
      then: function (resolve: any) {
        resolve([]);
      },
    };
    const mockDb = {
      select: () => mockQueryBuilder,
    } as any;
    initializePublishedAPI(mockDb);
    expect(await resolveCurrentHolder('pos-id')).toBeNull();
    expect(await getActiveDelegationForUser('user-id')).toBeNull();
    expect(await getOfficeById('office-id')).toBeNull();
    expect(await getOfficeHierarchy()).toEqual({ offices: [] });
    expect(await getEmployeeByUserId('user-id')).toBeNull();
    expect(await getPrimaryOfficeForUser('user-id')).toBeNull();
    expect(await getCommitteeIdsForUser('user-id')).toEqual([]);
    expect(await getDelegationGrantById('grant-id')).toBeNull();
  });

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
