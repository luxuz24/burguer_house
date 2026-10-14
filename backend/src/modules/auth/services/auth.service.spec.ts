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
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  beforeEach(() => {
    usuariosRepoMock = {
      buscarPorEmail: vi.fn(),
      buscarPorId: vi.fn(),
      atualizarPerfil: vi.fn(),
      atualizarSenha: vi.fn(),
    };
    service = new AuthService(usuariosRepoMock as UsuariosRepository);
  });

  describe('login', () => {
    it('deve realizar login com sucesso e retornar usuário sem senha', async () => {
      vi.mocked(usuariosRepoMock.buscarPorEmail!).mockResolvedValue(usuarioMock);

      const resultado = await service.login('gerente@burguerhouse.com.br', 'admin123');

      expect(resultado.id).toBe(usuarioMock.id);
      expect(resultado.email).toBe(usuarioMock.email);
      expect(resultado.nome).toBe(usuarioMock.nome);
      expect((resultado as unknown as { senha?: string }).senha).toBeUndefined();
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
      vi.mocked(usuariosRepoMock.atualizarSenha!).mockResolvedValue({
        ...usuarioMock,
        senha: 'nova_hash_mock',
      });

      const resultado = await service.atualizarSenha(usuarioMock.id, 'admin123', 'novaSenhaForte');

      expect(resultado.sucesso).toBe(true);
      expect(usuariosRepoMock.atualizarSenha).toHaveBeenCalled();
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
  });
});
