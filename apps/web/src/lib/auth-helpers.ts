import type { ActiveUserIdentity } from '@/stores';

export function hasRole(identity: ActiveUserIdentity | null, ...allowed: string[]): boolean {
  if (!identity || !identity.roleCodes) return false;
  const roleSet = new Set(identity.roleCodes);
  return allowed.some((r) => roleSet.has(r));
}
