import type { FastifyInstance, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../iam/index.js';

const registry = new Map<string, FastifyReply[]>();

export function pushToUser(userId: string, payload: unknown): void {
  const connections = registry.get(userId);
  if (!connections || connections.length === 0) return; // silent no-op — no offline queue in Phase 1
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of connections) {
    res.raw.write(frame);
  }
}

export async function notificationsSseRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/notifications/stream',
    {
      preHandler: [verifyAccessToken],
    },
    (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const userId = auth.userId;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      reply.raw.write(': connected\n\n');

      let userConnections = registry.get(userId);
      if (!userConnections) {
        userConnections = [];
        registry.set(userId, userConnections);
      }
      userConnections.push(reply);

      request.raw.on('close', () => {
        const conns = registry.get(userId);
        if (conns) {
          const index = conns.indexOf(reply);
          if (index !== -1) {
            conns.splice(index, 1);
          }
          if (conns.length === 0) {
            registry.delete(userId);
          }
        }
      });

      // Returning a never-resolving promise is discouraged in Fastify without Hijacking the response.
      // But for SSE in Fastify without a plugin, setting reply.hijack() stops Fastify's normal response lifecycle.
      reply.hijack();
    }
  );
}
