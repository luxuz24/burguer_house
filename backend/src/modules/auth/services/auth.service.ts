import bcrypt from 'bcryptjs';
import { UsuariosRepository } from '../repositories/usuarios.repository.js';
import type { AtualizarPerfilDTO } from '../repositories/usuarios.repository.js';
import { Role } from '../../../../generated/prisma/client.js';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface UsuarioSemSenha {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: Role;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class AuthService {
  constructor(private readonly usuariosRepo = new UsuariosRepository()) {}

  async login(email: string, senha: string): Promise<UsuarioSemSenha> {
    const usuario = await this.usuariosRepo.buscarPorEmail(email.toLowerCase().trim());
    if (!usuario || !usuario.ativo) {
      throw new AuthError('E-mail ou senha inválidos', 401);
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new AuthError('E-mail ou senha inválidos', 401);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senha: _, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
  }

  async obterPerfil(id: string): Promise<UsuarioSemSenha> {
    const usuario = await this.usuariosRepo.buscarPorId(id);
    if (!usuario || !usuario.ativo) {
      throw new AuthError('Usuário não encontrado ou inativo', 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senha: _, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
  }

  async atualizarPerfil(
    id: string,
    dados: { nome?: string | undefined; telefone?: string | null | undefined }
  ): Promise<UsuarioSemSenha> {
    const usuarioExiste = await this.usuariosRepo.buscarPorId(id);
    if (!usuarioExiste || !usuarioExiste.ativo) {
      throw new AuthError('Usuário não encontrado ou inativo', 404);
    }

    const payload: AtualizarPerfilDTO = {};
    if (dados.nome !== undefined) {
      payload.nome = dados.nome.trim();
    }
    if (dados.telefone !== undefined) {
      payload.telefone = dados.telefone ? dados.telefone.trim() : null;
    }

    const usuarioAtualizado = await this.usuariosRepo.atualizarPerfil(id, payload);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senha: _, ...usuarioSemSenha } = usuarioAtualizado;
    return usuarioSemSenha;
  }

  async atualizarSenha(id: string, senhaAtual: string, novaSenha: string): Promise<{ sucesso: boolean }> {
    const usuario = await this.usuariosRepo.buscarPorId(id);
    if (!usuario || !usuario.ativo) {
      throw new AuthError('Usuário não encontrado ou inativo', 404);
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      throw new AuthError('Senha atual incorreta', 400);
    }

    if (novaSenha.length < 6) {
      throw new AuthError('A nova senha deve ter no mínimo 6 caracteres', 400);
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    await this.usuariosRepo.atualizarSenha(id, novaSenhaHash);

    return { sucesso: true };
  }
}
