import type { RouteHandlerMethod } from 'fastify';

export const publicLookupHandler: RouteHandlerMethod = async (request, reply) => {
  return reply.status(501).send({ error: 'Not Implemented' });
};
