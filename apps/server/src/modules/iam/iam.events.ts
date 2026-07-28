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
  // Added by TASK-IAM-EVT-001: mechanism change from auditService.writeEvent → eventBus.emit
  LOGOUT_SUCCESS: 'logout.success',
  LOGIN_FAILED: 'login.failed',
  SESSION_REPLACED: 'session.replaced',
  LOGIN_SUCCESS: 'login.success',
  TOKEN_REUSE_DETECTED: 'token.reuse_detected',
  FORCED_LOGOUT: 'session.forced_logout',
  ABAC_DENIAL: 'abac.denial',
} as const;

export function registerIamEventSubscriptions(): void {
  // Stub function to register event subscriptions
}
