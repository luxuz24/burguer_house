import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RouteOptions } from 'fastify';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

// Decisão do dono (18/11/2026): por enquanto só o ADMIN altera dados; GERENTE e OPERADOR só leem.
// O teste percorre TODAS as rotas registradas (sem lista fixa): uma rota de escrita nova que escape da
// política falha aqui.

type Papel = 'ADMIN' | 'GERENTE' | 'OPERADOR';
const ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Escrita liberada: a própria conta (qualquer logado) e as rotas com autenticação própria por segredo.
const ESCRITA_LIBERADA = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'PUT /api/auth/perfil',
  'PUT /api/auth/senha',
  'POST /api/webhook/anota-ai',
  'POST /api/vendas/consolidar',
]);

// Leitura que já era só do ADMIN antes desta decisão (gestão de usuários).
const LEITURA_SO_ADMIN = new Set(['GET /api/usuarios']);

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const rotas: { metodo: string; url: string }[] = [];
const auth: Record<Papel, { authorization: string }> = {} as never;

function idDoUsuario(papel: Papel) {
  return `user-permissoes-${papel.toLowerCase()}`;
}

async function criarUsuario(papel: Papel) {
  const id = idDoUsuario(papel);
  const email = `${id}@burguerhouse.test`;
  await prisma.usuario.upsert({
    where: { id },
    update: { ativo: true, tokenVersion: 0, role: papel },
    create: { id, nome: `Usuário ${papel}`, email, senha: 'hash', role: papel, ativo: true, tokenVersion: 0 },
  });
  auth[papel] = { authorization: `Bearer ${app.jwt.sign({ sub: id, email, role: papel, tv: 0 })}` };
}

function chamar(metodo: string, url: string, papel: Papel) {
  return app.inject({
    method: metodo as 'GET',
    url: url.replace(/:[A-Za-z]+/g, ID_INEXISTENTE),
    headers: auth[papel],
  });
}

const escritasRestritas = () =>
  rotas.filter((r) => ESCRITA.has(r.metodo) && !ESCRITA_LIBERADA.has(`${r.metodo} ${r.url}`));
const leituras = () =>
  rotas.filter((r) => r.metodo === 'GET' && r.url !== '/health' && !LEITURA_SO_ADMIN.has(`${r.metodo} ${r.url}`));

describe('Permissões: só o ADMIN altera dados; GERENTE e OPERADOR só leem', () => {
  beforeAll(async () => {
    // Registrado antes do ready(): os plugins de rota carregam no ready() e herdam este hook.
    app.addHook('onRoute', (rota: RouteOptions) => {
      for (const metodo of [rota.method].flat()) rotas.push({ metodo, url: rota.url });
    });
    await app.ready();
    for (const papel of ['ADMIN', 'GERENTE', 'OPERADOR'] as const) await criarUsuario(papel);
  });

  afterAll(async () => {
    await prisma.usuario
      .deleteMany({ where: { id: { in: (['ADMIN', 'GERENTE', 'OPERADOR'] as const).map(idDoUsuario) } } })
      .catch(() => {});
    await app.close();
  });

  it('coletou as rotas da aplicação (o teste não é vazio)', () => {
    expect(rotas.length).toBeGreaterThan(50);
    expect(escritasRestritas().length).toBeGreaterThanOrEqual(25);
    expect(escritasRestritas()).toContainEqual({ metodo: 'POST', url: '/api/insumos' });
    expect(escritasRestritas()).toContainEqual({ metodo: 'POST', url: '/api/estoque/ajustes' });
    expect(leituras().length).toBeGreaterThanOrEqual(15);
  });

  it('GERENTE e OPERADOR recebem 403 em toda rota de escrita (exceto a própria conta e as rotas por segredo)', async () => {
    const liberadas: string[] = [];
    for (const { metodo, url } of escritasRestritas()) {
      for (const papel of ['GERENTE', 'OPERADOR'] as const) {
        const r = await chamar(metodo, url, papel);
        if (r.statusCode !== 403 || r.json().message !== 'Acesso negado: privilégios insuficientes') {
          liberadas.push(`${papel} ${metodo} ${url} -> ${r.statusCode}`);
        }
      }
    }
    expect(liberadas).toEqual([]);
  });

  it('ADMIN passa pela autorização em toda rota de escrita (a resposta vem da validação ou do recurso)', async () => {
    const barradas: string[] = [];
    for (const { metodo, url } of escritasRestritas()) {
      const r = await chamar(metodo, url, 'ADMIN');
      if (r.statusCode === 401 || r.statusCode === 403) barradas.push(`${metodo} ${url} -> ${r.statusCode}`);
    }
    expect(barradas).toEqual([]);
  });

  it('GERENTE e OPERADOR continuam lendo: nenhuma rota GET responde 401 ou 403', async () => {
    const barradas: string[] = [];
    for (const { url } of leituras()) {
      for (const papel of ['GERENTE', 'OPERADOR'] as const) {
        const r = await chamar('GET', url, papel);
        if (r.statusCode === 401 || r.statusCode === 403) barradas.push(`${papel} GET ${url} -> ${r.statusCode}`);
      }
    }
    expect(barradas).toEqual([]);
  });

  it('OPERADOR ainda edita o próprio perfil e troca a própria senha (a autorização não barra)', async () => {
    const perfil = await app.inject({ method: 'PUT', url: '/api/auth/perfil', headers: auth.OPERADOR, payload: {} });
    expect([401, 403]).not.toContain(perfil.statusCode);
    const senha = await app.inject({ method: 'PUT', url: '/api/auth/senha', headers: auth.OPERADOR, payload: {} });
    expect(senha.statusCode).toBe(400);
  });
});
