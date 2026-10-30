import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { AuthController } from './controllers/auth.controller.js';
import { Role } from '../../../generated/prisma/client.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const SENHA = 'admin123';
let ipSeq = 10;
const novoIp = () => `10.1.0.${ipSeq++}`;

function usuario(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    nome: 'Carlos',
    email: 'a@x.com',
    senha: bcrypt.hashSync(SENHA, 4),
    telefone: null,
    role: Role.OPERADOR,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...sobrescrever,
  };
}

const tokenValido = () => app.jwt.sign({ sub: 'u1', email: 'a@x.com', role: 'OPERADOR' });
const bearer = (t = tokenValido()) => ({ authorization: `Bearer ${t}` });
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('Auth HTTP: superfície de ataque', () => {
  beforeAll(async () => {
    await app.ready();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('JWT', () => {
    const rotaProtegida = { method: 'GET' as const, url: '/api/auth/me' };

    it('rejeita token alg=none', async () => {
      const t = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u1', email: 'a@x.com', role: 'ADMIN' })}.`;
      const r = await app.inject({ ...rotaProtegida, headers: bearer(t) });
      expect(r.statusCode).toBe(401);
    });

    it('rejeita token com payload adulterado (assinatura original)', async () => {
      const [h, , s] = tokenValido().split('.');
      const t = `${h}.${b64({ sub: 'u1', email: 'a@x.com', role: 'ADMIN' })}.${s}`;
      expect((await app.inject({ ...rotaProtegida, headers: bearer(t) })).statusCode).toBe(401);
    });

    it('rejeita token assinado com outro segredo', async () => {
      const { default: Fastify } = await import('fastify');
      const { default: jwt } = await import('@fastify/jwt');
      const outro = Fastify();
      await outro.register(jwt, { secret: 'outro-segredo-bem-longo-123' });
      const t = outro.jwt.sign({ sub: 'u1', email: 'a@x.com', role: 'ADMIN' });
      await outro.close();
      expect((await app.inject({ ...rotaProtegida, headers: bearer(t) })).statusCode).toBe(401);
    });

    it('rejeita token expirado', async () => {
      const exp = Math.floor(Date.now() / 1000) - 60;
      const t = app.jwt.sign({ sub: 'u1', email: 'a@x.com', role: 'OPERADOR', exp } as never);
      expect((await app.inject({ ...rotaProtegida, headers: bearer(t) })).statusCode).toBe(401);
    });

    it('401 tem corpo padronizado', async () => {
      const r = await app.inject({ method: 'GET', url: '/api/insumos' });
      expect(r.json()).toEqual({ message: 'Token JWT inválido ou ausente' });
    });

    it.each(['', 'Bearer', 'Bearer ', 'Basic abc', 'bearer', 'Token xyz'])('rejeita Authorization %j', async (h) => {
      const r = await app.inject({ ...rotaProtegida, headers: { authorization: h } });
      expect(r.statusCode).toBe(401);
    });

    it.each([
      '/API/AUTH/ME',
      '//api/auth/me',
      '/api/auth/me;x=1',
      '/api/auth/me%2F',
      '/api/auth/%6De',
      '/api/auth/me/',
      '/api/insumos/',
      '/api/insumos?/health',
    ])('variação de caminho %s nunca devolve 200 sem token', async (url) => {
      const r = await app.inject({ method: 'GET', url });
      expect([401, 404]).toContain(r.statusCode);
    });
  });

  describe('POST /api/auth/login', () => {
    it.each([
      ['corpo null', 'null'],
      ['array', '[]'],
      ['string', '"x"'],
      ['email objeto (operador Prisma)', '{"email":{"contains":""},"senha":"x"}'],
      ['senha objeto', '{"email":"a@x.com","senha":{"a":1}}'],
      ['senha número', '{"email":"a@x.com","senha":123}'],
      ['__proto__ no JSON', '{"email":"a@x.com","senha":"x","__proto__":{"role":"ADMIN"}}'],
    ])('%s → 400, sem consultar o banco', async (_n, body) => {
      const find = vi.spyOn(prisma.usuario, 'findUnique');
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: body,
        remoteAddress: novoIp(),
      });
      expect(r.statusCode).toBe(400);
      expect(find).not.toHaveBeenCalled();
    });

    it('usuário inexistente e senha errada: mesma resposta (status e corpo)', async () => {
      const find = vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>;
      find.mockResolvedValueOnce(null);
      const a = await app.inject({
        method: 'POST', url: '/api/auth/login', payload: { email: 'x@x.com', senha: 'errada' }, remoteAddress: novoIp(),
      });
      find.mockResolvedValueOnce(usuario());
      const b = await app.inject({
        method: 'POST', url: '/api/auth/login', payload: { email: 'a@x.com', senha: 'errada' }, remoteAddress: novoIp(),
      });
      expect(a.statusCode).toBe(401);
      expect(b.statusCode).toBe(401);
      expect(a.body).toBe(b.body);
    });

    it('login válido: token usa sub/email/role do banco, expira, e a resposta não vaza o hash', async () => {
      (vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        usuario({ role: Role.ADMIN })
      );
      const r = await app.inject({
        method: 'POST', url: '/api/auth/login', payload: { email: 'A@X.com', senha: SENHA }, remoteAddress: novoIp(),
      });
      expect(r.statusCode).toBe(200);
      expect(r.body).not.toContain('$2');
      expect(r.json().usuario).not.toHaveProperty('senha');
      const claims = app.jwt.decode<{ sub: string; role: string; exp: number; iat: number }>(r.json().token)!;
      expect(claims).toMatchObject({ sub: 'u1', role: 'ADMIN' });
      expect(claims.exp - claims.iat).toBe(7 * 24 * 3600);
    });

    it('e-mail do corpo é normalizado antes da consulta ao banco', async () => {
      const find = vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>;
      find.mockResolvedValue(null);
      await app.inject({
        method: 'POST', url: '/api/auth/login', payload: { email: 'A@X.COM', senha: 'x' }, remoteAddress: novoIp(),
      });
      expect(find).toHaveBeenCalledWith({ where: { email: 'a@x.com' } });
    });
  });

  describe('PUT /api/auth/perfil', () => {
    it('ignora campos privilegiados (role, ativo, email, senha): sem mass assignment', async () => {
      const find = vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>;
      find.mockResolvedValue(usuario());
      const update = vi.spyOn(prisma.usuario, 'update' as never) as unknown as ReturnType<typeof vi.fn>;
      update.mockResolvedValue(usuario());
      const r = await app.inject({
        method: 'PUT',
        url: '/api/auth/perfil',
        headers: bearer(),
        payload: { nome: 'Novo Nome', role: 'ADMIN', ativo: false, email: 'h@x.com', senha: 'hack', id: 'outro' },
      });
      expect(r.statusCode).toBe(200);
      expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { nome: 'Novo Nome' } });
    });

    it('atua sempre sobre o id do token (não aceita id no corpo)', async () => {
      const find = vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>;
      find.mockResolvedValue(usuario());
      (vi.spyOn(prisma.usuario, 'update' as never) as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(usuario());
      await app.inject({ method: 'PUT', url: '/api/auth/perfil', headers: bearer(), payload: { nome: 'Ok Nome', id: 'vitima' } });
      expect(find).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('🟠 nome e telefone têm tamanho máximo (corpo de 1 MB não vai para o banco)', async () => {
      const find = vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>;
      find.mockResolvedValue(usuario());
      const update = vi.spyOn(prisma.usuario, 'update' as never) as unknown as ReturnType<typeof vi.fn>;
      update.mockResolvedValue(usuario());
      const r1 = await app.inject({ method: 'PUT', url: '/api/auth/perfil', headers: bearer(), payload: { nome: 'a'.repeat(5000) } });
      const r2 = await app.inject({ method: 'PUT', url: '/api/auth/perfil', headers: bearer(), payload: { telefone: '9'.repeat(5000) } });
      expect(r1.statusCode).toBe(400);
      expect(r2.statusCode).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/auth/senha', () => {
    it('🟠 limita tentativas de senha atual por usuário (token roubado não vira força bruta)', async () => {
      (vi.spyOn(prisma.usuario, 'findUnique' as never) as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(usuario());
      const status: number[] = [];
      for (let i = 0; i < 12; i++) {
        const r = await app.inject({
          method: 'PUT', url: '/api/auth/senha', headers: bearer(),
          payload: { senhaAtual: `chute-${i}`, novaSenha: 'novaSenha1' },
          remoteAddress: novoIp(), // IP diferente a cada tentativa: o limite deve ser por usuário
        });
        status.push(r.statusCode);
      }
      expect(status).toContain(429);
      expect(status.slice(0, 5).every((s) => s === 400)).toBe(true);
    });
  });

  describe('AuthController: falhas inesperadas', () => {
    function fakes() {
      const log = { error: vi.fn() };
      const request = { body: { email: 'a@x.com', senha: 'x' }, user: { sub: 'u1' }, log, server: { jwt: { sign: vi.fn() } } };
      const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
      return { log, request: request as unknown as FastifyRequest, reply: reply as unknown as FastifyReply, raw: reply };
    }
    const servicoQuebrado = {
      login: vi.fn().mockRejectedValue(new Error('conexão com o banco caiu')),
      obterPerfil: vi.fn().mockRejectedValue(new Error('boom')),
      atualizarPerfil: vi.fn().mockRejectedValue(new Error('boom')),
      atualizarSenha: vi.fn().mockRejectedValue(new Error('boom')),
    };

    it.each(['login', 'me', 'atualizarPerfil', 'atualizarSenha'] as const)(
      '🟠 %s: erro inesperado vira 500 genérico E é registrado no log',
      async (acao) => {
        const { log, request, reply, raw } = fakes();
        (request as unknown as { body: unknown }).body =
          acao === 'atualizarSenha' ? { senhaAtual: 'x', novaSenha: 'novaSenha1' } : acao === 'atualizarPerfil' ? { nome: 'Nome Ok' } : request.body;
        const c = new AuthController(servicoQuebrado as never);
        await c[acao](request, reply);
        expect(raw.status).toHaveBeenCalledWith(500);
        expect(JSON.stringify(raw.send.mock.calls)).not.toContain('conexão com o banco');
        expect(log.error).toHaveBeenCalledTimes(1);
      }
    );
  });
});
