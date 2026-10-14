import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.routes.js';
import { insumosRoutes } from './routes/insumos.routes.js';
import { produtosRoutes } from './routes/produtos.routes.js';
import { fichasTecnicasRoutes } from './routes/fichas_tecnicas.routes.js';
import { vendasRoutes } from './routes/vendas.routes.js';
import { perdasRoutes } from './routes/perdas.routes.js';
import { preparoInternoRoutes } from './routes/preparo_interno.routes.js';
import { notasFiscaisRoutes } from './routes/notas_fiscais.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import fastifyJwt from '@fastify/jwt';

export const app = Fastify({ logger: true });

// Registrar JWT para autenticação
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'burguer-house-jwt-secret-key-change-in-prod',
});

app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ message: 'Token JWT inválido ou ausente' });
  }
});

//permitir que o front-end acesse a API
app.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Rotas Base
app.register(healthRoutes);

// Rotas de Domínio
app.register(authRoutes, { prefix: '/api/auth' });
app.register(insumosRoutes, { prefix: '/api/insumos' });
app.register(produtosRoutes, { prefix: '/api/produtos' });
app.register(fichasTecnicasRoutes, { prefix: '/api/fichas-tecnicas' });
app.register(perdasRoutes, { prefix: '/api/perdas' });
app.register(preparoInternoRoutes, { prefix: '/api/preparo-interno' });
app.register(notasFiscaisRoutes, { prefix: '/api/notas-fiscais' });
app.register(dashboardRoutes, { prefix: '/api/dashboard' });
app.register(vendasRoutes, { prefix: '/api' });


