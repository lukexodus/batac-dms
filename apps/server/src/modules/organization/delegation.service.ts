import type { DelegationService, DelegationServiceDeps } from './organization.types.js';
import { NotImplementedError } from '../../errors/not-implemented.js';

export function createDelegationService(deps: DelegationServiceDeps): DelegationService {
  return {
    async getActiveDelegationForUser(): Promise<any> {
      throw new NotImplementedError();
    },
    async getDelegationGrantById(): Promise<any> {
      throw new NotImplementedError();
    },
  };
}
