import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

const ADMIN_ID = 'user-usuarios-admin';
const GERENTE_ID = 'user-usuarios-gerente';
const DOMINIO = '@usuarios-http.test';
let authAdmin: { authorization: string };
let authGerente: { authorization: string };

async function criarUsuarioBase(id: string, role: 'ADMIN' | 'GERENTE') {
  await prisma.usuario.upsert({
    where: { id },
    update: { ativo: true, tokenVersion: 0, role },
    create: { id, nome: `Base ${role}`, email: `${id}${DOMINIO}`, senha: 'hash', role, ativo: true, tokenVersion: 0 },
  });
  return { authorization: `Bearer ${app.jwt.sign({ sub: id, email: `${id}${DOMINIO}`, role, tv: 0 })}` };
}

async function limparCriados() {
  await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO }, id: { notIn: [ADMIN_ID, GERENTE_ID] } } });
}

function criar(payload: unknown, headers = authAdmin) {
  return app.inject({ method: 'POST', url: '/api/usuarios', headers, payload: payload as object });
}

function login(email: string, senha: string) {
  return app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha } });
}

const novo = { nome: 'Ana Caixa', email: `Ana.Caixa${DOMINIO}`, senha: 'senha-forte-1', role: 'OPERADOR' };

describe('Cadastro de usuários pelo admin (/api/usuarios)', () => {
  beforeAll(async () => {
    await app.ready();
    authAdmin = await criarUsuarioBase(ADMIN_ID, 'ADMIN');
    authGerente = await criarUsuarioBase(GERENTE_ID, 'GERENTE');
  });

  beforeEach(limparCriados);

  afterAll(async () => {
    await limparCriados();
    await prisma.usuario.deleteMany({ where: { id: { in: [ADMIN_ID, GERENTE_ID] } } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('todas as rotas exigem JWT (401) e papel ADMIN (GERENTE recebe 403)', async () => {
    const rotas = [
      { method: 'GET', url: '/api/usuarios' },
      { method: 'POST', url: '/api/usuarios', payload: novo },
      { method: 'PATCH', url: `/api/usuarios/${ADMIN_ID}`, payload: { nome: 'Outro nome' } },
      { method: 'POST', url: `/api/usuarios/${ADMIN_ID}/senha`, payload: { novaSenha: 'nova-senha-1' } },
    ] as const;
    for (const rota of rotas) {
      const semJwt = await app.inject({ ...rota });
      expect(semJwt.statusCode, `${rota.method} ${rota.url}`).toBe(401);
      const gerente = await app.inject({ ...rota, headers: authGerente });
      expect(gerente.statusCode, `${rota.method} ${rota.url}`).toBe(403);
    }
    expect(await prisma.usuario.count({ where: { email: { endsWith: DOMINIO } } })).toBe(2);
  });

  it('ADMIN cria usuário (201): e-mail em minúsculas, senha em hash, resposta sem senha, e o usuário consegue entrar', async () => {
    const res = await criar({ ...novo, telefone: ' 67 99999-0000 ' });
    expect(res.statusCode).toBe(201);
    const corpo = res.json();
    expect(corpo).toMatchObject({ nome: 'Ana Caixa', email: `ana.caixa${DOMINIO}`, role: 'OPERADOR', ativo: true, telefone: '67 99999-0000' });
    expect(corpo).not.toHaveProperty('senha');
    expect(corpo).not.toHaveProperty('tokenVersion');

    const gravado = await prisma.usuario.findUniqueOrThrow({ where: { id: corpo.id } });
    expect(gravado.senha).not.toBe(novo.senha);
    expect(await bcrypt.compare(novo.senha, gravado.senha)).toBe(true);

    const entrar = await login(`ANA.caixa${DOMINIO}`, novo.senha);
    expect(entrar.statusCode).toBe(200);
  });

  it('papel padrão é OPERADOR; valida com 400 (e-mail, nome, senha de 6 a 72 bytes, papel)', async () => {
    const semPapel = await criar({ nome: 'Bruno', email: `bruno${DOMINIO}`, senha: '123456' });
    expect(semPapel.statusCode).toBe(201);
    expect(semPapel.json().role).toBe('OPERADOR');

    const invalidos = [
      { ...novo, email: 'sem-arroba' },
      { ...novo, nome: 'A' },
      { ...novo, senha: '12345' },
      { ...novo, senha: 'ç'.repeat(37) }, // 74 bytes em UTF-8
      { ...novo, role: 'DONO' },
      { nome: 'Sem email', senha: '123456' },
    ];
    for (const payload of invalidos) {
      const res = await criar(payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it('e-mail já cadastrado (mesmo com outra caixa) devolve 409', async () => {
    expect((await criar(novo)).statusCode).toBe(201);
    const repetido = await criar({ ...novo, nome: 'Outra Ana', email: `ANA.CAIXA${DOMINIO}` });
    expect(repetido.statusCode).toBe(409);
  });

  it('GET lista os usuários por nome, sem senha nem tokenVersion', async () => {
    await criar({ ...novo, nome: 'Zeca', email: `zeca${DOMINIO}` });
    await criar({ ...novo, nome: 'Bia', email: `bia${DOMINIO}` });

    const res = await app.inject({ method: 'GET', url: '/api/usuarios', headers: authAdmin });
    expect(res.statusCode).toBe(200);
    const nossos = res.json().filter((u: { email: string }) => u.email.endsWith(DOMINIO));
    expect(nossos.map((u: { nome: string }) => u.nome)).toEqual(['Base ADMIN', 'Base GERENTE', 'Bia', 'Zeca']);
    for (const u of res.json()) {
      expect(u).not.toHaveProperty('senha');
      expect(u).not.toHaveProperty('tokenVersion');
    }
  });

  it('PATCH muda nome e papel; desativar derruba as sessões, e reativar não ressuscita o token antigo', async () => {
    const criado = (await criar(novo)).json();
    const tokenDele = (await login(novo.email, novo.senha)).json().token as string;
    const authDele = { authorization: `Bearer ${tokenDele}` };
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: authDele })).statusCode).toBe(200);

    const promover = await app.inject({ method: 'PATCH', url: `/api/usuarios/${criado.id}`, headers: authAdmin, payload: { nome: 'Ana Gerente', role: 'GERENTE' } });
    expect(promover.statusCode).toBe(200);
    expect(promover.json()).toMatchObject({ nome: 'Ana Gerente', role: 'GERENTE', ativo: true });

    const desativar = await app.inject({ method: 'PATCH', url: `/api/usuarios/${criado.id}`, headers: authAdmin, payload: { ativo: false } });
    expect(desativar.statusCode).toBe(200);
    expect(desativar.json().ativo).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: authDele })).statusCode).toBe(401);
    expect((await login(novo.email, novo.senha)).statusCode).toBe(401);

    const reativar = await app.inject({ method: 'PATCH', url: `/api/usuarios/${criado.id}`, headers: authAdmin, payload: { ativo: true } });
    expect(reativar.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: authDele })).statusCode).toBe(401);
  });

  it('o admin não pode desativar nem rebaixar a própria conta, nem redefinir a própria senha por esta rota (400)', async () => {
    const desativarSe = await app.inject({ method: 'PATCH', url: `/api/usuarios/${ADMIN_ID}`, headers: authAdmin, payload: { ativo: false } });
    expect(desativarSe.statusCode).toBe(400);
    const rebaixarSe = await app.inject({ method: 'PATCH', url: `/api/usuarios/${ADMIN_ID}`, headers: authAdmin, payload: { role: 'GERENTE' } });
    expect(rebaixarSe.statusCode).toBe(400);
    const senhaPropria = await app.inject({ method: 'POST', url: `/api/usuarios/${ADMIN_ID}/senha`, headers: authAdmin, payload: { novaSenha: 'nova-senha-1' } });
    expect(senhaPropria.statusCode).toBe(400);

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: ADMIN_ID } });
    expect(admin).toMatchObject({ ativo: true, role: 'ADMIN', senha: 'hash' });
    // Mudar só o próprio nome continua permitido
    const renomear = await app.inject({ method: 'PATCH', url: `/api/usuarios/${ADMIN_ID}`, headers: authAdmin, payload: { nome: 'Base ADMIN' } });
    expect(renomear.statusCode).toBe(200);
  });

  it('redefinir a senha de outro usuário (204): a senha nova entra, a antiga não, e as sessões dele caem', async () => {
    const criado = (await criar(novo)).json();
    const tokenDele = (await login(novo.email, novo.senha)).json().token as string;

    const res = await app.inject({ method: 'POST', url: `/api/usuarios/${criado.id}/senha`, headers: authAdmin, payload: { novaSenha: 'trocada-pelo-admin' } });
    expect(res.statusCode).toBe(204);

    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${tokenDele}` } })).statusCode).toBe(401);
    expect((await login(novo.email, novo.senha)).statusCode).toBe(401);
    expect((await login(novo.email, 'trocada-pelo-admin')).statusCode).toBe(200);

    const curta = await app.inject({ method: 'POST', url: `/api/usuarios/${criado.id}/senha`, headers: authAdmin, payload: { novaSenha: '123' } });
    expect(curta.statusCode).toBe(400);
  });

  it('usuário inexistente devolve 404 no PATCH e na redefinição de senha', async () => {
    const patch = await app.inject({ method: 'PATCH', url: '/api/usuarios/nao-existe', headers: authAdmin, payload: { nome: 'Fulano' } });
    expect(patch.statusCode).toBe(404);
    const senha = await app.inject({ method: 'POST', url: '/api/usuarios/nao-existe/senha', headers: authAdmin, payload: { novaSenha: 'qualquer-1' } });
    expect(senha.statusCode).toBe(404);
  });

  it('dois admins se desativando ao mesmo tempo não deixam a loja sem ADMIN ativo (um 200, o outro 409)', async () => {
    const A = 'user-usuarios-admin-a';
    const B = 'user-usuarios-admin-b';
    // Neste cenário só A e B são ADMIN ativos; os outros são guardados e devolvidos no fim
    const outrosAdmins = await prisma.usuario.findMany({ where: { role: 'ADMIN', ativo: true }, select: { id: true } });
    await prisma.usuario.updateMany({ where: { id: { in: outrosAdmins.map((u) => u.id) } }, data: { ativo: false } });
    try {
      for (const id of [A, B]) {
        await prisma.usuario.create({ data: { id, nome: id, email: `${id}${DOMINIO}`, senha: 'hash', role: 'ADMIN' } });
      }
      const tokenDe = (id: string) => ({ authorization: `Bearer ${app.jwt.sign({ sub: id, email: `${id}${DOMINIO}`, role: 'ADMIN', tv: 0 })}` });

      const respostas = await Promise.all([
        app.inject({ method: 'PATCH', url: `/api/usuarios/${B}`, headers: tokenDe(A), payload: { ativo: false } }),
        app.inject({ method: 'PATCH', url: `/api/usuarios/${A}`, headers: tokenDe(B), payload: { role: 'OPERADOR' } }),
      ]);

      expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      const recusada = respostas.find((r) => r.statusCode === 409)!;
      expect(recusada.json().message).toBe('Não é possível remover o último administrador ativo');
      expect(await prisma.usuario.count({ where: { id: { in: [A, B] }, role: 'ADMIN', ativo: true } })).toBe(1);
    } finally {
      await prisma.usuario.updateMany({ where: { id: { in: outrosAdmins.map((u) => u.id) } }, data: { ativo: true } });
    }
  });
});
