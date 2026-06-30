import type { OrgService, OrgServiceDeps } from './organization.types.js';
import { NotImplementedError } from '../../errors/not-implemented.js';

export function createOrgService(deps: OrgServiceDeps): OrgService {
  return {
    async resolveCurrentHolder(): Promise<any> {
      throw new NotImplementedError();
    },
    async getOfficeById(): Promise<any> {
      throw new NotImplementedError();
    },
    async getOfficeHierarchy(): Promise<any> {
      throw new NotImplementedError();
    },
    async getEmployeeByUserId(): Promise<any> {
      throw new NotImplementedError();
    },
    async getPrimaryOfficeForUser(): Promise<any> {
      throw new NotImplementedError();
    },
    async getCommitteeIdsForUser(): Promise<any> {
      throw new NotImplementedError();
    },
  };
}
