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
  tokenVersion: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

// Hash fictício para gastar o mesmo tempo de bcrypt quando o e-mail não existe (evita enumeração por tempo de resposta).
const HASH_FICTICIO = '$2b$10$Bh6YoaaDVw/M/USOnV1Bf.rLXBZNFqt9JMIM8Sx6JITB/jCZ4/H2y';

const BCRYPT_MAX_BYTES = 72;

export class AuthService {
  constructor(private readonly usuariosRepo = new UsuariosRepository()) {}

  async login(email: string, senha: string): Promise<UsuarioSemSenha> {
    const usuario = await this.usuariosRepo.buscarPorEmail(email.toLowerCase().trim());
    if (!usuario || !usuario.ativo) {
      await bcrypt.compare(senha, HASH_FICTICIO);
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
      const nome = dados.nome.trim();
      if (nome.length < 2) {
        throw new AuthError('Nome deve ter no mínimo 2 caracteres', 400);
      }
      payload.nome = nome;
    }
    if (dados.telefone !== undefined) {
      payload.telefone = dados.telefone?.trim() || null;
    }

    let usuarioAtualizado;
    try {
      usuarioAtualizado = await this.usuariosRepo.atualizarPerfil(id, payload);
    } catch (error: unknown) {
      // Usuário removido entre a leitura e a escrita: o Prisma lança P2025 (registro não encontrado)
      if ((error as { code?: unknown } | null)?.code === 'P2025') {
        throw new AuthError('Usuário não encontrado ou inativo', 404);
      }
      throw error;
    }

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

    // bcrypt ignora silenciosamente tudo após 72 bytes; rejeitar evita senha mais fraca que o aparente.
    if (Buffer.byteLength(novaSenha, 'utf8') > BCRYPT_MAX_BYTES) {
      throw new AuthError('A nova senha deve ter no máximo 72 bytes', 400);
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    // Troca condicional ao hash lido acima: se outra sessão trocou a senha nesse meio tempo, não sobrescreve.
    const trocou = await this.usuariosRepo.atualizarSenhaSe(id, usuario.senha, novaSenhaHash);
    if (!trocou) {
      throw new AuthError('A senha foi alterada em outra sessão. Tente novamente.', 409);
    }

    return { sucesso: true };
  }
}
