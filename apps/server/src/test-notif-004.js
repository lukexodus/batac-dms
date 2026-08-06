import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import pino from 'pino';
import { createNotificationsRepository } from './modules/notifications/notifications.repository.js';
import { createNotificationsPublicAPI } from './modules/notifications/notifications.public-api.js';
async function main() {
    const client = postgres('postgresql://batac_app:app_devpassword@127.0.0.1:5435/batac_lgu');
    const db = drizzle(client);
    const repository = createNotificationsRepository(db);
    const logger = pino({ level: 'info' });
    const notifService = createNotificationsPublicAPI({
        repository,
        logger,
    });
    console.log('--- Testing Missing Template ---');
    await notifService.sendNotification({
        templateId: 'does.not.exist',
        templateData: { name: 'John Doe' },
        channel: 'in_app',
    });
    console.log('Missing template test complete (should not have thrown).');
    console.log('--- Testing Happy Path ---');
    // First, let's insert a dummy template
    const template = await repository.insertTemplate({
        name: 'test.template.in_app',
        channel: 'in_app',
        bodyTemplate: 'Hello {{name}}, this is a {{missing}} test!',
        isActive: true,
    });
    await notifService.sendNotification({
        templateId: 'test.template.in_app',
        templateData: { name: 'Luke' },
        channel: 'in_app',
    });
    console.log('Happy path test complete.');
    await client.end();
}
main().catch(console.error);
