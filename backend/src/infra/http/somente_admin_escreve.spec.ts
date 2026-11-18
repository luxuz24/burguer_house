import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registrarSomenteAdminEscreve } from './somente_admin_escreve.js';

// A política é testada em todas as rotas reais por `permissoes.http.spec.ts`. Aqui ficam os formatos de
// rota que a aplicação ainda não usa, mas que uma rota nova pode usar: PATCH, vários métodos na mesma
// rota e um preHandler próprio (que precisa continuar rodando depois da checagem de papel).

let app: FastifyInstance;

function criarApp(role: 'ADMIN' | 'OPERADOR') {
  app = Fastify();
  app.addHook('onRequest', async (req) => {
    req.user = { sub: 'u1', email: 'u1@x.com', role, tv: 0 };
  });
  registrarSomenteAdminEscreve(app);

  app.patch('/api/recurso/:id', async () => ({ ok: true }));
  app.route({ method: ['GET', 'POST'], url: '/api/misto', handler: async () => ({ ok: true }) });
  app.post(
    '/api/com-prehandler',
    {
      preHandler: async (_req, reply) => {
        reply.header('x-prehandler-proprio', 'rodou');
      },
    },
    async () => ({ ok: true }),
  );
  app.put('/api/auth/perfil', async () => ({ ok: true }));
  return app;
}

afterEach(async () => {
  await app?.close();
});

describe('registrarSomenteAdminEscreve', () => {
  it('restringe PATCH e rota com vários métodos quando um deles é de escrita', async () => {
    criarApp('OPERADOR');
    expect((await app.inject({ method: 'PATCH', url: '/api/recurso/1' })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/misto' })).statusCode).toBe(403);
  });

  it('mantém o preHandler próprio da rota, rodando depois da checagem de papel', async () => {
    criarApp('OPERADOR');
    const negado = await app.inject({ method: 'POST', url: '/api/com-prehandler' });
    expect(negado.statusCode).toBe(403);
    expect(negado.headers['x-prehandler-proprio']).toBeUndefined();

    await app.close();
    criarApp('ADMIN');
    const permitido = await app.inject({ method: 'POST', url: '/api/com-prehandler' });
    expect(permitido.statusCode).toBe(200);
    expect(permitido.headers['x-prehandler-proprio']).toBe('rodou');
  });

  it('não restringe a própria conta (rota liberada)', async () => {
    criarApp('OPERADOR');
    expect((await app.inject({ method: 'PUT', url: '/api/auth/perfil' })).statusCode).toBe(200);
  });
});
