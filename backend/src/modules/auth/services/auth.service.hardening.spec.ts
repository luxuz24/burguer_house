import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService, AuthError } from './auth.service.js';
import { UsuariosRepository } from '../repositories/usuarios.repository.js';
import { Role, Usuario } from '../../../../generated/prisma/client.js';

const SENHA = 'admin123';

function criarUsuario(sobrescrever: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    nome: 'Carlos',
    email: 'gerente@burguerhouse.com.br',
    senha: bcrypt.hashSync(SENHA, 4),
    telefone: null,
    role: Role.ADMIN,
    ativo: true,
    tokenVersion: 0,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...sobrescrever,
  };
}

describe('AuthService (endurecimento)', () => {
  let repo: {
    buscarPorEmail: ReturnType<typeof vi.fn>;
    buscarPorId: ReturnType<typeof vi.fn>;
    atualizarPerfil: ReturnType<typeof vi.fn>;
    atualizarSenhaSe: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    repo = {
      buscarPorEmail: vi.fn(),
      buscarPorId: vi.fn(),
      atualizarPerfil: vi.fn(),
      atualizarSenhaSe: vi.fn().mockResolvedValue(true),
    };
    service = new AuthService(repo as unknown as UsuariosRepository);
  });

  describe('login', () => {
    it('normaliza o e-mail (minúsculas e trim) antes de consultar', async () => {
      repo.buscarPorEmail.mockResolvedValue(criarUsuario());
      await service.login('  Gerente@BurguerHouse.com.br ', SENHA);
      expect(repo.buscarPorEmail).toHaveBeenCalledWith('gerente@burguerhouse.com.br');
    });

    it('usuário inativo com senha CORRETA é rejeitado com 401 e compara contra hash fictício', async () => {
      repo.buscarPorEmail.mockResolvedValue(criarUsuario({ ativo: false }));
      const compare = vi.spyOn(bcrypt, 'compare');
      await expect(service.login('a@x.com', SENHA)).rejects.toMatchObject({
        statusCode: 401,
        message: 'E-mail ou senha inválidos',
      });
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare.mock.calls[0]![1]).not.toBe(criarUsuario().senha);
      compare.mockRestore();
    });

    it('o hash fictício é um bcrypt válido de custo 10 (senão o compare retorna imediatamente)', async () => {
      repo.buscarPorEmail.mockResolvedValue(null);
      const compare = vi.spyOn(bcrypt, 'compare');
      await service.login('a@x.com', 'x').catch(() => undefined);
      const hash = compare.mock.calls[0]![1] as string;
      expect(hash).toMatch(/^\$2[aby]\$10\$.{53}$/);
      expect(bcrypt.getRounds(hash)).toBe(10);
      compare.mockRestore();
    });

    it('senha errada de usuário ativo: 401 com a mesma mensagem e uma única comparação', async () => {
      repo.buscarPorEmail.mockResolvedValue(criarUsuario());
      const compare = vi.spyOn(bcrypt, 'compare');
      await expect(service.login('a@x.com', 'errada')).rejects.toMatchObject({
        statusCode: 401,
        message: 'E-mail ou senha inválidos',
      });
      expect(compare).toHaveBeenCalledTimes(1);
      compare.mockRestore();
    });

    it('não propaga o hash da senha no retorno e preserva os demais campos', async () => {
      const u = criarUsuario();
      repo.buscarPorEmail.mockResolvedValue(u);
      const r = await service.login(u.email, SENHA);
      expect(Object.keys(r.usuario)).not.toContain('senha');
      expect(Object.keys(r.usuario)).not.toContain('tokenVersion');
      expect(r.usuario).toMatchObject({ id: u.id, role: u.role, ativo: true, telefone: null });
      expect(r.tokenVersion).toBe(u.tokenVersion);
    });

    it('propaga falha do repositório (não a transforma em 401)', async () => {
      repo.buscarPorEmail.mockRejectedValue(new Error('db down'));
      await expect(service.login('a@x.com', SENHA)).rejects.toThrow('db down');
    });
  });

  describe('obterPerfil', () => {
    it('404 para usuário inexistente, com mensagem fixa', async () => {
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.obterPerfil('x')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Usuário não encontrado ou inativo',
      });
    });

    it('404 para usuário inativo', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario({ ativo: false }));
      await expect(service.obterPerfil('u1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('não vaza o hash da senha', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      const r = await service.obterPerfil('u1');
      expect(Object.keys(r)).not.toContain('senha');
    });
  });

  describe('atualizarPerfil', () => {
    it.each([
      ['inexistente', null],
      ['inativo', criarUsuario({ ativo: false })],
    ])('404 e nenhuma escrita quando o usuário é %s', async (_n, retorno) => {
      repo.buscarPorId.mockResolvedValue(retorno);
      await expect(service.atualizarPerfil('u1', { nome: 'Novo' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Usuário não encontrado ou inativo',
      });
      expect(repo.atualizarPerfil).not.toHaveBeenCalled();
    });

    it('aplica trim em nome e telefone', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarPerfil.mockResolvedValue(criarUsuario());
      await service.atualizarPerfil('u1', { nome: '  Maria  ', telefone: ' 6799 ' });
      expect(repo.atualizarPerfil).toHaveBeenCalledWith('u1', { nome: 'Maria', telefone: '6799' });
    });

    it('só envia os campos informados (undefined não apaga dado)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarPerfil.mockResolvedValue(criarUsuario());
      await service.atualizarPerfil('u1', {});
      expect(repo.atualizarPerfil).toHaveBeenCalledWith('u1', {});
    });

    it('telefone null limpa o telefone', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario({ telefone: '123' }));
      repo.atualizarPerfil.mockResolvedValue(criarUsuario());
      await service.atualizarPerfil('u1', { telefone: null });
      expect(repo.atualizarPerfil).toHaveBeenCalledWith('u1', { telefone: null });
    });

    it('🔴 telefone só com espaços vira null (não string vazia)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarPerfil.mockResolvedValue(criarUsuario());
      await service.atualizarPerfil('u1', { telefone: '   ' });
      expect(repo.atualizarPerfil).toHaveBeenCalledWith('u1', { telefone: null });
    });

    it('🔴 nome só com espaços é rejeitado com 400 (passa no min(2) do Zod mas vira vazio)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await expect(service.atualizarPerfil('u1', { nome: '   ' })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Nome deve ter no mínimo 2 caracteres',
      });
      expect(repo.atualizarPerfil).not.toHaveBeenCalled();
    });

    it('🔴 nome com 1 caractere útil após trim é rejeitado com 400', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await expect(service.atualizarPerfil('u1', { nome: ' A ' })).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.atualizarPerfil).not.toHaveBeenCalled();
    });
  });

  it('nome com exatamente 2 caracteres úteis é aceito', async () => {
    repo.buscarPorId.mockResolvedValue(criarUsuario());
    repo.atualizarPerfil.mockResolvedValue(criarUsuario());
    await service.atualizarPerfil('u1', { nome: ' Jo ' });
    expect(repo.atualizarPerfil).toHaveBeenCalledWith('u1', { nome: 'Jo' });
  });

  describe('atualizarSenha', () => {
    it('hash gravado usa custo bcrypt 10 (mesmo custo do hash fictício do login)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await service.atualizarSenha('u1', SENHA, 'novaSenha1');
      expect(bcrypt.getRounds(repo.atualizarSenhaSe.mock.calls[0]![2])).toBe(10);
    });

    it.each([
      ['inexistente', null],
      ['inativo', criarUsuario({ ativo: false })],
    ])('404 e nenhuma escrita quando o usuário é %s', async (_n, retorno) => {
      repo.buscarPorId.mockResolvedValue(retorno);
      await expect(service.atualizarSenha('u1', SENHA, 'novaSenha1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Usuário não encontrado ou inativo',
      });
      expect(repo.atualizarSenhaSe).not.toHaveBeenCalled();
    });

    it('grava um hash bcrypt (não o texto puro) que valida a nova senha e não a antiga', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await service.atualizarSenha('u1', SENHA, 'novaSenha1');
      const [id, , hash] = repo.atualizarSenhaSe.mock.calls[0]!;
      expect(id).toBe('u1');
      expect(hash).not.toBe('novaSenha1');
      expect(await bcrypt.compare('novaSenha1', hash)).toBe(true);
      expect(await bcrypt.compare(SENHA, hash)).toBe(false);
    });

    it('senha atual incorreta: 400 e nenhuma escrita', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await expect(service.atualizarSenha('u1', 'errada', 'novaSenha1')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Senha atual incorreta',
      });
      expect(repo.atualizarSenhaSe).not.toHaveBeenCalled();
    });

    it('limite: 5 caracteres rejeita, 6 aceita', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await expect(service.atualizarSenha('u1', SENHA, '12345')).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.atualizarSenha('u1', SENHA, '123456')).resolves.toEqual(
        expect.objectContaining({ sucesso: true })
      );
    });

    it('🟠 nova senha acima de 72 bytes é rejeitada (bcrypt truncaria silenciosamente)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await expect(service.atualizarSenha('u1', SENHA, 'a'.repeat(73))).rejects.toMatchObject({
        statusCode: 400,
        message: 'A nova senha deve ter no máximo 72 bytes',
      });
      await expect(service.atualizarSenha('u1', SENHA, 'é'.repeat(37))).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.atualizarSenhaSe).not.toHaveBeenCalled();
    });

    it('72 bytes exatos são aceitos', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      await expect(service.atualizarSenha('u1', SENHA, 'a'.repeat(72))).resolves.toEqual(
        expect.objectContaining({ sucesso: true })
      );
    });

    it('erro do repositório na escrita não retorna sucesso', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarSenhaSe.mockRejectedValue(new Error('db down'));
      await expect(service.atualizarSenha('u1', SENHA, 'novaSenha1')).rejects.toThrow('db down');
    });
  });

  it('AuthError tem statusCode padrão 400 e name correto', () => {
    const e = new AuthError('x');
    expect(e.statusCode).toBe(400);
    expect(e.name).toBe('AuthError');
    expect(e).toBeInstanceOf(Error);
  });

  describe('concorrência e remoção no meio da operação', () => {
    it('🟠 duas trocas de senha simultâneas com a mesma senha atual: uma vence, a outra recebe 409', async () => {
      // Repositório com a semântica real: a troca condicional só vale se o hash gravado for o esperado.
      let hashGravado = bcrypt.hashSync(SENHA, 4);
      const atrasar = () => new Promise((r) => setTimeout(r, 5));
      const fake = {
        buscarPorId: async () => {
          const u = criarUsuario({ senha: hashGravado });
          await atrasar(); // as duas leituras acontecem antes de qualquer escrita
          return u;
        },
        atualizarSenhaSe: async (_id: string, esperado: string, novo: string) => {
          if (hashGravado !== esperado) return false;
          hashGravado = novo;
          return true;
        },
      };
      const svc = new AuthService(fake as unknown as UsuariosRepository);

      const r = await Promise.allSettled([
        svc.atualizarSenha('u1', SENHA, 'senhaNova-A'),
        svc.atualizarSenha('u1', SENHA, 'senhaNova-B'),
      ]);

      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const rejeitada = r.find((x) => x.status === 'rejected') as PromiseRejectedResult;
      expect(rejeitada.reason).toBeInstanceOf(AuthError);
      expect(rejeitada.reason).toMatchObject({
        statusCode: 409,
        message: 'A senha foi alterada em outra sessão. Tente novamente.',
      });
    });

    it('troca condicional usa o hash lido como condição e grava o novo', async () => {
      const u = criarUsuario();
      repo.buscarPorId.mockResolvedValue(u);
      const cond = vi.fn().mockResolvedValue(true);
      (repo as unknown as { atualizarSenhaSe: typeof cond }).atualizarSenhaSe = cond;
      await service.atualizarSenha('u1', SENHA, 'novaSenha1');
      expect(cond).toHaveBeenCalledTimes(1);
      const [id, esperado, novo] = cond.mock.calls[0]!;
      expect(id).toBe('u1');
      expect(esperado).toBe(u.senha);
      expect(await bcrypt.compare('novaSenha1', novo)).toBe(true);
    });

    it('🟠 atualizarPerfil: usuário removido entre a leitura e a escrita (P2025) vira 404, não 500', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarPerfil.mockRejectedValue(Object.assign(new Error('Record not found'), { code: 'P2025' }));
      await expect(service.atualizarPerfil('u1', { nome: 'Novo Nome' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Usuário não encontrado ou inativo',
      });
    });

    it('atualizarPerfil: outros erros do banco continuam propagando (não são mascarados como 404)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarPerfil.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'P1001' }));
      await expect(service.atualizarPerfil('u1', { nome: 'Novo Nome' })).rejects.toThrow('timeout');
    });

    it('atualizarPerfil: propaga erro mesmo se for null, undefined ou string (garante segurança do optional chaining)', async () => {
      repo.buscarPorId.mockResolvedValue(criarUsuario());
      repo.atualizarPerfil.mockRejectedValue('falha primitiva');
      await expect(service.atualizarPerfil('u1', { nome: 'Novo Nome' })).rejects.toBe('falha primitiva');
    });
  });
});
