import { createNotificationsService } from './notifications.service.js';
export function createNotificationsPublicAPI(deps) {
    // Currently, the public API is a direct passthrough to the service.
    // In the future, this might perform additional mapping, filtering, or validation.
    return createNotificationsService(deps);
}
