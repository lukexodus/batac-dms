import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { MailerService } from './mailer.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    mailer: MailerService;
  }
}

async function mailerPlugin(fastify: FastifyInstance): Promise<void> {
  const mailer = new MailerService();
  fastify.decorate('mailer', mailer);
}

export default fp(mailerPlugin, {
  name: 'mailer',
});
