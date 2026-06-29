import type { IamService, IamServiceDeps } from './iam.types.js';

export function createIamService(_deps: IamServiceDeps): IamService {
  return {
    evaluatePolicy: () => { throw new Error('not implemented'); },
    getUserById: () => { throw new Error('not implemented'); },
    login: () => { throw new Error('not implemented'); },
    logout: () => { throw new Error('not implemented'); },
    refresh: () => { throw new Error('not implemented'); },
    verifyAccessToken: () => { throw new Error('not implemented'); },
    resolveActiveDelegationGrant: () => { throw new Error('not implemented'); },
  };
}
