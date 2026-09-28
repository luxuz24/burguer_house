import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// Endpoint exigido pela Fase 1 (usado para ping de aquecimento do Koyeb futuramente)
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'BurgerStock API - Banco e API respondendo (simulado por enquanto)' 
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info(`Servidor rodando em http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();