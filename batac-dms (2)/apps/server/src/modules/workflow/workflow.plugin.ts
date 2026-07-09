import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createWorkflowRouter } from './workflow.router.js';
import { createSessionRouter } from './session.router.js';
import { NotImplementedError } from '../../errors/not-implemented.js';
import type { WorkflowPublicAPI } from './index.js';

declare module 'fastify' {
  interface FastifyInstance {
    workflowService: WorkflowPublicAPI;
    workflowTrpcRouter: ReturnType<typeof createWorkflowRouter>;
    sessionTrpcRouter: ReturnType<typeof createSessionRouter>;
  }
}

const workflowPlugin: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;
  if (!db) {
    throw new Error('Database client (fastify.db) is not initialized');
  }

  const workflowService: WorkflowPublicAPI = {
    async getInstanceById(instanceId: string) {
      throw new NotImplementedError('getInstanceById is not implemented');
    },
    async getActiveInstanceForDocument(documentId: string) {
      throw new NotImplementedError('getActiveInstanceForDocument is not implemented');
    },
    async getWorkflowSLAData(filter) {
      throw new NotImplementedError('getWorkflowSLAData is not implemented');
    },
  };

  fastify.decorate('workflowService', workflowService);

  const workflowTrpcRouter = createWorkflowRouter();
  fastify.decorate('workflowTrpcRouter', workflowTrpcRouter);

  const sessionTrpcRouter = createSessionRouter();
  fastify.decorate('sessionTrpcRouter', sessionTrpcRouter);

  fastify.log.info('workflow plugin registered');
};

export default fp(workflowPlugin, {
  name: 'workflow',
  dependencies: ['database', 'event-bus', 'audit'],
});
