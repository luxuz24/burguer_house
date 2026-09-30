import Fastify from 'fastify';
import { healthRoutes } from './routes/health.routes.js'; 

export const app = Fastify({ logger: true });

// Registro de rotas
app.register(healthRoutes);