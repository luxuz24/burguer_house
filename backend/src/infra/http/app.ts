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
import { registrarAuthGuard } from './auth.guard.js';

export const app = Fastify({
  logger: {
    serializers: {
      // Não vazar segredos passados por query string (?token=) nos logs
      req(req) {
        return {
          method: req.method,
          url: req.url?.replace(/([?&]token=)[^&]*/gi, '$1[REDACTED]'),
          host: req.headers?.host ?? '',
          remoteAddress: req.ip,
        };
      },
    },
  },
});

// Registrar JWT para autenticação (sem segredo padrão: fora de teste, JWT_SECRET é obrigatório)
const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-only-secret' : '');
if (jwtSecret.length < 16) {
  throw new Error('JWT_SECRET ausente ou curto demais (mínimo 16 caracteres). Defina no .env.');
}
app.register(fastifyJwt, { secret: jwtSecret });

app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ message: 'Token JWT inválido ou ausente' });
  }
});

// Todas as rotas exigem JWT, exceto /health, login e webhook
registrarAuthGuard(app);

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


