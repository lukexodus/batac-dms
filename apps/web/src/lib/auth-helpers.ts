export function hasRole(roles: string[], ...allowed: string[]): boolean {
  const roleSet = new Set(roles);
  return allowed.some((r) => roleSet.has(r));
}
