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
import { registrarErrorHandler } from './error_handler.js';
import { resolverTrustProxy } from './trust_proxy.js';

export const app = Fastify({
  // Limite global pequeno (256 KB) para evitar que payloads gigantes exauram memória nas rotas padrão de CRUD.
  // Rotas que recebem arquivos/eventos maiores (XML de NF-e, webhook) declaram bodyLimit próprio.
  bodyLimit: 256 * 1024,
  // Atrás de proxy/CDN (deploy), TRUST_PROXY=<nº de proxies> (ex.: 1) faz request.ip refletir o cliente real (rate limit do login).
  // "true" ainda funciona, mas confia em todo o X-Forwarded-For (o cliente consegue forjar o IP).
  trustProxy: resolverTrustProxy(process.env.TRUST_PROXY),
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
if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY?.trim() === 'true') {
  console.warn('TRUST_PROXY=true confia em todo o X-Forwarded-For: use o número de proxies (ex.: TRUST_PROXY=1) para o rate limit não ser burlável.');
}
app.register(fastifyJwt, { secret: jwtSecret });

app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ message: 'Token JWT inválido ou ausente' });
  }
});

// Todas as rotas exigem JWT, exceto /health, login, webhook e consolidação (estes dois com segredo próprio)
registrarAuthGuard(app);
registrarErrorHandler(app);

//permitir que o front-end acesse a API
// CORS_ORIGINS="https://app.vercel.app,https://outro.com" restringe as origens em produção; sem a variável libera qualquer origem (dev).
const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
  console.warn('CORS_ORIGINS não definido em produção: qualquer origem poderá chamar a API.');
}
app.register(cors, { 
  origin: corsOrigins.length > 0 ? corsOrigins : true,
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


