import { createNotificationsPublicAPI } from './apps/server/src/modules/notifications/index.js';
import { createNotificationsRepository } from './apps/server/src/modules/notifications/notifications.repository.js';
import { getDb } from './apps/server/src/db.js'; // I'll check if this exists
import pino from 'pino';

async function main() {
  const db = getDb(); // Let's just import { db } from '@batac/database' directly?
  
}
main().catch(console.error);
