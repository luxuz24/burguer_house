import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.routes.js';
import { insumosRoutes } from './routes/insumos.routes.js';

export const app = Fastify({ logger: true });

//permitir que o front-end acesse a API
app.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Rotas Base
app.register(healthRoutes);

// Rotas de Domínio
app.register(insumosRoutes, { prefix: '/api/insumos' });

