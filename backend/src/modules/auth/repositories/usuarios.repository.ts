import { prisma } from '../../../infra/database/prisma.js';
import { Role } from '../../../../generated/prisma/client.js';
import type { Usuario } from '../../../../generated/prisma/client.js';

export interface CriarUsuarioDTO {
  nome: string;
  email: string;
  senha: string;
  telefone?: string | null;
  role?: Role;
}

export interface AtualizarPerfilDTO {
  nome?: string | undefined;
  telefone?: string | null | undefined;
}

export class UsuariosRepository {
  constructor(private readonly db = prisma) {}

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({
      where: { email },
    });
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({
      where: { id },
    });
  }

  async criar(data: CriarUsuarioDTO): Promise<Usuario> {
    return this.db.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        telefone: data.telefone ?? null,
        role: data.role ?? Role.OPERADOR,
      },
    });
  }

  async atualizarPerfil(id: string, data: AtualizarPerfilDTO): Promise<Usuario> {
    const updateData: { nome?: string; telefone?: string | null } = {};
    if (data.nome !== undefined) {
      updateData.nome = data.nome;
    }
    if (data.telefone !== undefined) {
      updateData.telefone = data.telefone;
    }

    return this.db.usuario.update({
      where: { id },
      data: updateData,
    });
  }

  async atualizarSenha(id: string, novaSenhaHash: string): Promise<Usuario> {
    return this.db.usuario.update({
      where: { id },
      data: { senha: novaSenhaHash },
    });
  }

  async listar(): Promise<Usuario[]> {
    return this.db.usuario.findMany({
      orderBy: { nome: 'asc' },
    });
  }
}
