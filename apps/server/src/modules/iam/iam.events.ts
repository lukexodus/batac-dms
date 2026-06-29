export const IAM_EVENTS = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  SESSION_TERMINATED: 'session.terminated',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REVOKED: 'role.revoked',
} as const;

export function registerIamEventSubscriptions(): void {
  // Stub function to register event subscriptions
}
