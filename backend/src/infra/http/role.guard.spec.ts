import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { exigirRole } from './role.guard.js';
import { Role } from '../../../generated/prisma/client.js';

describe('exigirRole (RBAC)', () => {
  function criarApp() {
    const app = Fastify();

    // Rota restrita a ADMIN
    app.get(
      '/api/apenas-admin',
      { preHandler: [exigirRole(Role.ADMIN)] },
      async () => ({ ok: true })
    );

    // Rota restrita a ADMIN ou GERENTE
    app.get(
      '/api/gestao',
      { preHandler: [exigirRole(Role.ADMIN, Role.GERENTE)] },
      async () => ({ ok: true })
    );

    return app;
  }

  it('bloqueia com 403 se o usuário não tiver role anexado à requisição', async () => {
    const app = criarApp();
    const r = await app.inject({ method: 'GET', url: '/api/apenas-admin' });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toEqual({ message: 'Acesso negado: privilégios insuficientes' });
    await app.close();
  });

  it('bloqueia OPERADOR com 403 em rota exclusiva de ADMIN', async () => {
    const app = criarApp();
    app.addHook('onRequest', async (req) => {
      req.user = { sub: 'u1', email: 'op@x.com', role: Role.OPERADOR, tv: 0 };
    });

    const r = await app.inject({ method: 'GET', url: '/api/apenas-admin' });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toEqual({ message: 'Acesso negado: privilégios insuficientes' });
    await app.close();
  });

  it('bloqueia OPERADOR com 403 em rota de gestão (ADMIN ou GERENTE)', async () => {
    const app = criarApp();
    app.addHook('onRequest', async (req) => {
      req.user = { sub: 'u1', email: 'op@x.com', role: Role.OPERADOR, tv: 0 };
    });

    const r = await app.inject({ method: 'GET', url: '/api/gestao' });
    expect(r.statusCode).toBe(403);
    await app.close();
  });

  it('permite acesso de GERENTE em rota de gestão, mas bloqueia em rota de apenas ADMIN', async () => {
    const app = criarApp();
    app.addHook('onRequest', async (req) => {
      req.user = { sub: 'u2', email: 'ger@x.com', role: Role.GERENTE, tv: 0 };
    });

    const rGestao = await app.inject({ method: 'GET', url: '/api/gestao' });
    expect(rGestao.statusCode).toBe(200);
    expect(rGestao.json()).toEqual({ ok: true });

    const rAdmin = await app.inject({ method: 'GET', url: '/api/apenas-admin' });
    expect(rAdmin.statusCode).toBe(403);
    await app.close();
  });

  it('permite acesso de ADMIN em todas as rotas restritas', async () => {
    const app = criarApp();
    app.addHook('onRequest', async (req) => {
      req.user = { sub: 'u3', email: 'admin@x.com', role: Role.ADMIN, tv: 0 };
    });

    const r1 = await app.inject({ method: 'GET', url: '/api/apenas-admin' });
    expect(r1.statusCode).toBe(200);

    const r2 = await app.inject({ method: 'GET', url: '/api/gestao' });
    expect(r2.statusCode).toBe(200);
    await app.close();
  });
});
