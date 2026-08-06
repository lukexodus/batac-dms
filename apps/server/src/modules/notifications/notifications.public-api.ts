import type { NotificationsPublicAPI } from './notifications.types.js';
import { createNotificationsService, NotificationsServiceDeps } from './notifications.service.js';

export function createNotificationsPublicAPI(deps: NotificationsServiceDeps): NotificationsPublicAPI {
  // Currently, the public API is a direct passthrough to the service.
  // In the future, this might perform additional mapping, filtering, or validation.
  return createNotificationsService(deps);
}
