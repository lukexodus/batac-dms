import type {
  UserSummary,
  OfficeSummary,
  OfficeTree,
  EmployeeSummary,
  DelegationSummary,
  DbClient,
} from './organization.types.js';
import { createOrgRepository } from './organization.repository.js';
import { createOrgService } from './organization.service.js';
import { createDelegationService } from './delegation.service.js';

// Re-export types
export * from './organization.types.js';
export { createOrgService } from './organization.service.js';
export { createDelegationService } from './delegation.service.js';

let orgService: ReturnType<typeof createOrgService> | null = null;
let delegationService: ReturnType<typeof createDelegationService> | null = null;

/**
 * Initialize the module-level singleton services for the Published API functions.
 * This is called by the Fastify plugin registration during startup, or directly
 * inside the test suites.
 */
export function initializePublishedAPI(db: DbClient) {
  const repo = createOrgRepository(db);
  orgService = createOrgService({ db, orgRepository: repo } as any);
  delegationService = createDelegationService({ db, orgRepository: repo } as any);
}

function getOrgService() {
  if (!orgService) {
    throw new Error('OrgService not initialized. Call initializePublishedAPI(db) first.');
  }
  return orgService;
}

function getDelegationService() {
  if (!delegationService) {
    throw new Error('DelegationService not initialized. Call initializePublishedAPI(db) first.');
  }
  return delegationService;
}

export async function resolveCurrentHolder(
  positionId: string,
  asOf?: Date
): Promise<UserSummary | null> {
  return getOrgService().resolveCurrentHolder(positionId, asOf);
}

export async function getActiveDelegationForUser(
  userId: string
): Promise<DelegationSummary | null> {
  return getDelegationService().getActiveDelegationForUser(userId);
}

export async function getOfficeById(
  officeId: string
): Promise<OfficeSummary | null> {
  return getOrgService().getOfficeById(officeId);
}

export async function getOfficeHierarchy(): Promise<OfficeTree> {
  return getOrgService().getOfficeHierarchy();
}

export async function getEmployeeByUserId(
  userId: string
): Promise<EmployeeSummary | null> {
  return getOrgService().getEmployeeByUserId(userId);
}

export async function getPrimaryOfficeForUser(
  userId: string
): Promise<{ officeId: string; officeCode: string } | null> {
  return getOrgService().getPrimaryOfficeForUser(userId);
}

export async function getCommitteeIdsForUser(
  userId: string
): Promise<string[]> {
  return getOrgService().getCommitteeIdsForUser(userId);
}

export async function getDelegationGrantById(
  delegationGrantId: string
): Promise<{ scope: { roles: string[]; officeIds: string[]; actions: string[] } } | null> {
  return getDelegationService().getDelegationGrantById(delegationGrantId);
}
