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
app.register(perdasRoutes, { prefix: '/api/perdas' });
app.register(preparoInternoRoutes, { prefix: '/api/preparo-interno' });
app.register(notasFiscaisRoutes, { prefix: '/api/notas-fiscais' });
app.register(dashboardRoutes, { prefix: '/api/dashboard' });
app.register(vendasRoutes, { prefix: '/api' });

