import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { UsuariosRepository } from './usuarios.repository.js';
import { prisma } from '../../../infra/database/prisma.js';
import { Role } from '../../../../generated/prisma/client.js';

// Banco real (DATABASE_URL_TEST). Só mexe em usuários com este domínio de e-mail.
const DOMINIO = '@repo-spec.test';

describe('UsuariosRepository (banco real)', () => {
  const repo = new UsuariosRepository();

  const novo = (n: string, senha = 'hash-antigo', extra: Partial<{ telefone: string | null; role: Role }> = {}) =>
    repo.criar({
      nome: `Teste ${n}`,
      email: `${n}${DOMINIO}`,
      senha,
      ...extra,
    });

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } });
    await prisma.$disconnect().catch(() => {});
  });

  describe('criar e buscar', () => {
    it('cria usuário com defaults (Role.OPERADOR e telefone null)', async () => {
      const u = await novo('default');
      expect(u.role).toBe(Role.OPERADOR);
      expect(u.telefone).toBeNull();

      const buscado = await repo.buscarPorEmail(`default${DOMINIO}`);
      expect(buscado).not.toBeNull();
      expect(buscado?.id).toBe(u.id);

      const porId = await repo.buscarPorId(u.id);
      expect(porId).not.toBeNull();
      expect(porId?.email).toBe(u.email);
    });

    it('cria usuário com role e telefone customizados', async () => {
      const u = await novo('custom', 'hash', { telefone: '67999990000', role: Role.ADMIN });
      expect(u.role).toBe(Role.ADMIN);
      expect(u.telefone).toBe('67999990000');
    });

    it('buscarPorEmail e buscarPorId retornam null para registros inexistentes', async () => {
      expect(await repo.buscarPorEmail(`inexistente${DOMINIO}`)).toBeNull();
      expect(await repo.buscarPorId('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('buscarStatusToken retorna status leve para validação de JWT ou null', async () => {
      const u = await novo('status', 'hash', { role: Role.ADMIN });
      const status = await repo.buscarStatusToken(u.id);
      expect(status).toEqual({
        ativo: true,
        role: Role.ADMIN,
        tokenVersion: 0,
      });

      expect(await repo.buscarStatusToken('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('invalidarTokens incrementa tokenVersion e retorna true (ou false se não existe)', async () => {
      const u = await novo('inv');
      expect(await repo.invalidarTokens(u.id)).toBe(true);
      const s = await repo.buscarStatusToken(u.id);
      expect(s?.tokenVersion).toBe(1);

      expect(await repo.invalidarTokens('00000000-0000-0000-0000-000000000000')).toBe(false);
    });
  });

  describe('atualizarPerfil', () => {
    it('atualiza apenas o nome quando telefone não é enviado', async () => {
      const u = await novo('up-nome', 'hash', { telefone: '67999991111' });
      const atualizado = await repo.atualizarPerfil(u.id, { nome: 'Novo Nome' });
      expect(atualizado.nome).toBe('Novo Nome');
      expect(atualizado.telefone).toBe('67999991111');
    });

    it('atualiza apenas o telefone quando nome não é enviado', async () => {
      const u = await novo('up-tel', 'hash', { telefone: '67999991111' });
      const atualizado = await repo.atualizarPerfil(u.id, { telefone: '67999992222' });
      expect(atualizado.nome).toBe(`Teste up-tel`);
      expect(atualizado.telefone).toBe('67999992222');
    });

    it('atualiza nome e telefone conjuntamente', async () => {
      const u = await novo('up-ambos');
      const atualizado = await repo.atualizarPerfil(u.id, { nome: 'Nome Duplo', telefone: '67999993333' });
      expect(atualizado.nome).toBe('Nome Duplo');
      expect(atualizado.telefone).toBe('67999993333');
    });

    it('usuário inexistente lança erro Prisma P2025 (premissa do mapeamento para 404)', async () => {
      await expect(
        repo.atualizarPerfil('00000000-0000-0000-0000-000000000000', { nome: 'X Y' })
      ).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  describe('atualizarSenhaSe (troca condicional, anti-corrida)', () => {
    it('troca a senha quando o hash esperado ainda é o gravado e devolve true, incrementando tokenVersion', async () => {
      const u = await novo('a');
      expect(u.tokenVersion).toBe(0);

      expect(await repo.atualizarSenhaSe(u.id, 'hash-antigo', 'hash-novo')).toBe(true);
      const atualizado = await repo.buscarPorId(u.id);
      expect(atualizado!.senha).toBe('hash-novo');
      expect(atualizado!.tokenVersion).toBe(1);
    });

    it('não troca e devolve false quando o hash esperado não é mais o gravado', async () => {
      const u = await novo('b', 'hash-ja-trocado');
      expect(await repo.atualizarSenhaSe(u.id, 'hash-antigo', 'hash-novo')).toBe(false);
      expect((await repo.buscarPorId(u.id))!.senha).toBe('hash-ja-trocado');
    });

    it('devolve false para usuário inexistente (sem lançar)', async () => {
      expect(await repo.atualizarSenhaSe('00000000-0000-0000-0000-000000000000', 'x', 'y')).toBe(false);
    });

    it('duas trocas simultâneas partindo do mesmo hash: só uma vence', async () => {
      const u = await novo('c');
      const resultados = await Promise.all([
        repo.atualizarSenhaSe(u.id, 'hash-antigo', 'hash-A'),
        repo.atualizarSenhaSe(u.id, 'hash-antigo', 'hash-B'),
      ]);
      expect(resultados.filter(Boolean)).toHaveLength(1);
      const final = (await repo.buscarPorId(u.id))!.senha;
      expect(final).toBe(resultados[0] ? 'hash-A' : 'hash-B');
    });
  });

  describe('listar', () => {
    it('lista usuários ordenados por nome em ordem ascendente', async () => {
      await novo('Zeta');
      await novo('Alfa');
      await novo('Beta');

      const lista = await repo.listar();
      const nossos = lista.filter((u) => u.email.endsWith(DOMINIO));
      expect(nossos.map((u) => u.nome)).toEqual(['Teste Alfa', 'Teste Beta', 'Teste Zeta']);
    });
  });
});
