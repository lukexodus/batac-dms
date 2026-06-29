import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

async function iamPlugin(_fastify: FastifyInstance): Promise<void> {
  // Implementations added by TASK-IAM-006 through TASK-IAM-014
}

export default fp(iamPlugin, {
  name: 'iam',
  dependencies: ['database', 'event-bus', 'audit'],
});
