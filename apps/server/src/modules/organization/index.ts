import type {
  UserSummary,
  OfficeSummary,
  OfficeTree,
  EmployeeSummary,
  DelegationSummary,
} from './organization.types.js';

// Re-export types
export * from './organization.types.js';
export { createOrgService } from './organization.service.js';
export { createDelegationService } from './delegation.service.js';

// All eight methods are stubs returning safe no-ops.
// TASK-ORG-004 replaces these with real implementations.

export async function resolveCurrentHolder(
  _positionId: string,
  _asOf?: Date
): Promise<UserSummary | null> {
  return null;
}

export async function getActiveDelegationForUser(
  _userId: string
): Promise<DelegationSummary | null> {
  return null;
}

export async function getOfficeById(
  _officeId: string
): Promise<OfficeSummary | null> {
  return null;
}

export async function getOfficeHierarchy(): Promise<OfficeTree> {
  return { offices: [] };
}

export async function getEmployeeByUserId(
  _userId: string
): Promise<EmployeeSummary | null> {
  return null;
}

export async function getPrimaryOfficeForUser(
  _userId: string
): Promise<{ officeId: string; officeCode: string } | null> {
  return null;
}

export async function getCommitteeIdsForUser(
  _userId: string
): Promise<string[]> {
  return [];
}

export async function getDelegationGrantById(
  _delegationGrantId: string
): Promise<{ scope: { roles: string[]; officeIds: string[]; actions: string[] } } | null> {
  return null;
}
