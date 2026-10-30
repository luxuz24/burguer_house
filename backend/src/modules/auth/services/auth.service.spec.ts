import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService, AuthError } from './auth.service.js';
import { UsuariosRepository } from '../repositories/usuarios.repository.js';
import { Role, Usuario } from '../../../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosRepoMock: Partial<UsuariosRepository>;

  const usuarioMock: Usuario = {
    id: 'user-uuid-1',
    nome: 'Carlos Eduardo',
    email: 'gerente@burguerhouse.com.br',
    senha: bcrypt.hashSync('admin123', 10),
    telefone: '(67) 99876-5432',
    role: Role.ADMIN,
    ativo: true,
    tokenVersion: 0,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  beforeEach(() => {
    usuariosRepoMock = {
      buscarPorEmail: vi.fn(),
      buscarPorId: vi.fn(),
      atualizarPerfil: vi.fn(),
      atualizarSenhaSe: vi.fn().mockResolvedValue(true),
    };
    service = new AuthService(usuariosRepoMock as UsuariosRepository);
  });

  describe('login', () => {
    it('deve realizar login com sucesso e retornar usuário sem senha e tokenVersion', async () => {
      vi.mocked(usuariosRepoMock.buscarPorEmail!).mockResolvedValue(usuarioMock);

      const resultado = await service.login('gerente@burguerhouse.com.br', 'admin123');

      expect(resultado.usuario.id).toBe(usuarioMock.id);
      expect(resultado.usuario.email).toBe(usuarioMock.email);
      expect(resultado.usuario.nome).toBe(usuarioMock.nome);
      expect(resultado.tokenVersion).toBe(usuarioMock.tokenVersion);
      expect((resultado.usuario as unknown as { senha?: string }).senha).toBeUndefined();
      expect((resultado.usuario as unknown as { tokenVersion?: number }).tokenVersion).toBeUndefined();
    });

    it('deve lançar AuthError 401 quando o email não for encontrado', async () => {
      vi.mocked(usuariosRepoMock.buscarPorEmail!).mockResolvedValue(null);

      await expect(service.login('naoexiste@burguerhouse.com.br', 'admin123')).rejects.toThrow(AuthError);
      await expect(service.login('naoexiste@burguerhouse.com.br', 'admin123')).rejects.toMatchObject({
        statusCode: 401,
        message: 'E-mail ou senha inválidos',
      });
    });

    it('deve lançar AuthError 401 quando a senha estiver incorreta', async () => {
      vi.mocked(usuariosRepoMock.buscarPorEmail!).mockResolvedValue(usuarioMock);

      await expect(service.login('gerente@burguerhouse.com.br', 'senha_errada')).rejects.toThrow(AuthError);
      await expect(service.login('gerente@burguerhouse.com.br', 'senha_errada')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('obterPerfil', () => {
    it('deve retornar o perfil do usuário existente sem a senha', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(usuarioMock);

      const perfil = await service.obterPerfil(usuarioMock.id);

      expect(perfil.id).toBe(usuarioMock.id);
      expect(perfil.nome).toBe(usuarioMock.nome);
      expect((perfil as unknown as { senha?: string }).senha).toBeUndefined();
    });

    it('deve lançar erro 404 se o usuário não existir', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(null);

      await expect(service.obterPerfil('id-inexistente')).rejects.toThrow(AuthError);
    });
  });

  describe('atualizarPerfil', () => {
    it('deve atualizar o nome e telefone do usuário', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(usuarioMock);
      vi.mocked(usuariosRepoMock.atualizarPerfil!).mockResolvedValue({
        ...usuarioMock,
        nome: 'Carlos Atualizado',
        telefone: '(67) 99999-8888',
      });

      const atualizado = await service.atualizarPerfil(usuarioMock.id, {
        nome: 'Carlos Atualizado',
        telefone: '(67) 99999-8888',
      });

      expect(atualizado.nome).toBe('Carlos Atualizado');
      expect(atualizado.telefone).toBe('(67) 99999-8888');
    });
  });

  describe('atualizarSenha', () => {
    it('deve atualizar a senha quando a senha atual estiver correta', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(usuarioMock);
      const resultado = await service.atualizarSenha(usuarioMock.id, 'admin123', 'novaSenhaForte');

      expect(resultado.sucesso).toBe(true);
      expect(usuariosRepoMock.atualizarSenhaSe).toHaveBeenCalled();
    });

    it('deve lançar erro 400 se a senha atual estiver incorreta', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(usuarioMock);

      await expect(
        service.atualizarSenha(usuarioMock.id, 'senha_atual_errada', 'novaSenhaForte')
      ).rejects.toThrow('Senha atual incorreta');
    });

    it('deve lançar erro 400 se a nova senha for menor que 6 caracteres', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(usuarioMock);

      await expect(
        service.atualizarSenha(usuarioMock.id, 'admin123', '123')
      ).rejects.toThrow('A nova senha deve ter no mínimo 6 caracteres');
    });

    it('deve atualizar senha com sucesso e retornar novoTokenVersion e usuário sem senha', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!)
        .mockResolvedValueOnce(usuarioMock)
        .mockResolvedValueOnce({ ...usuarioMock, tokenVersion: 1 });

      const resultado = await service.atualizarSenha(usuarioMock.id, 'admin123', 'novaSenhaForte');
      expect(resultado.sucesso).toBe(true);
      expect(resultado.novoTokenVersion).toBe(1);
      expect(resultado.usuario.id).toBe(usuarioMock.id);
      expect((resultado.usuario as unknown as { senha?: string }).senha).toBeUndefined();
      expect((resultado.usuario as unknown as { tokenVersion?: number }).tokenVersion).toBeUndefined();
    });
  });

  describe('invalidarSessoes', () => {
    it('deve chamar usuariosRepo.invalidarTokens para o usuário ativo', async () => {
      usuariosRepoMock.invalidarTokens = vi.fn().mockResolvedValue(true);
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(usuarioMock);

      await service.invalidarSessoes(usuarioMock.id);
      expect(usuariosRepoMock.invalidarTokens).toHaveBeenCalledWith(usuarioMock.id);
    });

    it('deve lançar 404 se o usuário não for encontrado', async () => {
      vi.mocked(usuariosRepoMock.buscarPorId!).mockResolvedValue(null);
      await expect(service.invalidarSessoes('inexistente')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe('AuthService.login (mitigação de enumeração por tempo)', () => {
  it('compara contra hash fictício quando o e-mail não existe', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');
    const repo = { buscarPorEmail: vi.fn().mockResolvedValue(null) } as unknown as UsuariosRepository;

    await expect(new AuthService(repo).login('ninguem@x.com', 'qualquer')).rejects.toMatchObject({ statusCode: 401 });
    expect(compare).toHaveBeenCalledTimes(1);
    compare.mockRestore();
  });

  it('usa a mesma mensagem para usuário inativo e senha errada', async () => {
    const base = { id: '1', nome: 'A', email: 'a@x.com', telefone: null, role: Role.ADMIN, senha: bcrypt.hashSync('correta', 4) };
    const inativo = { buscarPorEmail: vi.fn().mockResolvedValue({ ...base, ativo: false }) } as unknown as UsuariosRepository;
    const ativo = { buscarPorEmail: vi.fn().mockResolvedValue({ ...base, ativo: true }) } as unknown as UsuariosRepository;

    const e1 = await new AuthService(inativo).login('a@x.com', 'correta').catch((e) => e);
    const e2 = await new AuthService(ativo).login('a@x.com', 'errada').catch((e) => e);
    expect(e1).toBeInstanceOf(AuthError);
    expect(e1.message).toBe(e2.message);
  });
});

