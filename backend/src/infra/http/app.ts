import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.routes.js';
import { insumosRoutes } from './routes/insumos.routes.js';
import { produtosRoutes } from './routes/produtos.routes.js';
import { fichasTecnicasRoutes } from './routes/fichas_tecnicas.routes.js';
import { vendasRoutes } from './routes/vendas.routes.js';

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
app.register(produtosRoutes, { prefix: '/api/produtos' });
app.register(fichasTecnicasRoutes, { prefix: '/api/fichas-tecnicas' });
app.register(vendasRoutes, { prefix: '/api' });

