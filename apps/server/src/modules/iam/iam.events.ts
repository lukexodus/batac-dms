export const IAM_EVENTS = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  SESSION_TERMINATED: 'session.terminated',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REVOKED: 'role.revoked',
  USER_CREATED: 'user.created',
  PASSWORD_CHANGED: 'password.changed',
  SESSION_LOCKED: 'session.locked',
  SESSION_UNLOCKED: 'session.unlocked',
  PASSWORD_RESET_TOKEN_GENERATED: 'password_reset_token.generated',
  PASSWORD_RESET_COMPLETED: 'password_reset.completed',
} as const;

export function registerIamEventSubscriptions(): void {
  // Stub function to register event subscriptions
}
