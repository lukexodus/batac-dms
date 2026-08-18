import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export default fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Batac City LGU Platform — Public REST API', version: '1.0.0' },
      servers: [{ url: process.env['API_BASE_URL'] ?? 'http://localhost:3000/v1' }],
      tags: [
        { name: 'health' }, { name: 'tracking' }, { name: 'documents' },
        { name: 'complaints' }, { name: 'document-requests' },
      ],
      components: { securitySchemes: {} },
    },
  });
  if (process.env['NODE_ENV'] !== 'production') {
    await fastify.register(swaggerUi, {
      routePrefix: '/v1/docs',
      uiConfig: { docExpansion: 'list' },
    });
  }
});
