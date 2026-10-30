import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { registrarAuthGuard } from './auth.guard.js';
import type { UsuariosRepository } from '../modules/auth/repositories/usuarios.repository.js';
import { Role } from '../../../generated/prisma/client.js';

describe('registrarAuthGuard (unitário)', () => {
  const secret = 'segredo-de-teste-muito-seguro-1234';

  function criarApp(usuariosRepoMock: Partial<UsuariosRepository>) {
    const app = Fastify();
    app.register(fastifyJwt, { secret });
    registrarAuthGuard(app, usuariosRepoMock as UsuariosRepository);

    // Rotas de teste
    app.get('/health', async () => ({ status: 'ok' }));
    app.post('/api/auth/login', async () => ({ status: 'login' }));
    app.get('/api/protegida', async (req) => ({ user: req.user }));

    return app;
  }

  it('rotas públicas (/health, /api/auth/login) e OPTIONS não exigem token nem consultam o banco', async () => {
    const buscarStatusToken = vi.fn();
    const app = criarApp({ buscarStatusToken });

    const r1 = await app.inject({ method: 'GET', url: '/health' });
    expect(r1.statusCode).toBe(200);

    const r2 = await app.inject({ method: 'POST', url: '/api/auth/login' });
    expect(r2.statusCode).toBe(200);

    const r3 = await app.inject({ method: 'OPTIONS', url: '/api/protegida' });
    expect([200, 204, 404]).toContain(r3.statusCode);

    expect(buscarStatusToken).not.toHaveBeenCalled();
    await app.close();
  });

  it('token ausente ou malformado retorna 401 sem consultar o banco', async () => {
    const buscarStatusToken = vi.fn();
    const app = criarApp({ buscarStatusToken });

    const r = await app.inject({ method: 'GET', url: '/api/protegida' });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ message: 'Token JWT inválido ou ausente' });
    expect(buscarStatusToken).not.toHaveBeenCalled();
    await app.close();
  });

  it('token válido de usuário inexistente no banco retorna 401', async () => {
    const buscarStatusToken = vi.fn().mockResolvedValue(null);
    const app = criarApp({ buscarStatusToken });
    await app.ready();

    const token = app.jwt.sign({ sub: 'u-inexistente', email: 'x@x.com', role: 'OPERADOR', tv: 0 });
    const r = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ message: 'Usuário não encontrado ou inativo' });
    expect(buscarStatusToken).toHaveBeenCalledWith('u-inexistente');
    await app.close();
  });

  it('token válido de usuário inativo no banco retorna 401', async () => {
    const buscarStatusToken = vi.fn().mockResolvedValue({
      ativo: false,
      role: Role.OPERADOR,
      tokenVersion: 0,
    });
    const app = criarApp({ buscarStatusToken });
    await app.ready();

    const token = app.jwt.sign({ sub: 'u1', email: 'x@x.com', role: 'OPERADOR', tv: 0 });
    const r = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ message: 'Usuário não encontrado ou inativo' });
    await app.close();
  });

  it('token sem claim tv retorna 401 "Token revogado"', async () => {
    const buscarStatusToken = vi.fn().mockResolvedValue({
      ativo: true,
      role: Role.OPERADOR,
      tokenVersion: 0,
    });
    const app = criarApp({ buscarStatusToken });
    await app.ready();

    // Token legado ou gerado sem versão
    const token = app.jwt.sign({ sub: 'u1', email: 'x@x.com', role: 'OPERADOR' } as never);
    const r = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ message: 'Token revogado. Faça login novamente.' });
    await app.close();
  });

  it('token com tv desatualizado (após troca de senha ou logout) retorna 401 "Token revogado"', async () => {
    const buscarStatusToken = vi.fn().mockResolvedValue({
      ativo: true,
      role: Role.OPERADOR,
      tokenVersion: 2, // No banco já está na versão 2
    });
    const app = criarApp({ buscarStatusToken });
    await app.ready();

    // Cliente envia token antigo com tv: 1
    const token = app.jwt.sign({ sub: 'u1', email: 'x@x.com', role: 'OPERADOR', tv: 1 });
    const r = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ message: 'Token revogado. Faça login novamente.' });
    await app.close();
  });

  it('token com tv atualizado permite acesso e atualiza request.user.role com o banco', async () => {
    const buscarStatusToken = vi.fn().mockResolvedValue({
      ativo: true,
      role: Role.ADMIN, // Promovido para ADMIN no banco
      tokenVersion: 3,
    });
    const app = criarApp({ buscarStatusToken });
    await app.ready();

    // Token emitido quando era OPERADOR, mas com tv: 3
    const token = app.jwt.sign({ sub: 'u1', email: 'x@x.com', role: 'OPERADOR', tv: 3 });
    const r = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(r.statusCode).toBe(200);
    expect(r.json().user).toMatchObject({
      sub: 'u1',
      role: 'ADMIN', // Sincronizado dinamicamente com o banco!
      tv: 3,
    });
    await app.close();
  });
});
