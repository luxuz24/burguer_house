import Fastify from 'fastify';
import { healthRoutes } from './routes/health.routes.js';
import { insumosRoutes } from './routes/insumos.routes.js';

export const app = Fastify({ logger: true });

// Rotas Base
app.register(healthRoutes);

// Rotas de Domínio
app.register(insumosRoutes, { prefix: '/api/insumos' });