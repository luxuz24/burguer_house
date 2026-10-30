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

  /**
   * Troca a senha somente se o hash gravado ainda for `hashEsperado` (compare-and-set).
   * Evita que duas trocas simultâneas, validadas contra a mesma senha atual, se sobrescrevam.
   * Retorna false se não houve troca (hash mudou no meio, ou usuário não existe/foi removido).
   */
  async atualizarSenhaSe(id: string, hashEsperado: string, novaSenhaHash: string): Promise<boolean> {
    const { count } = await this.db.usuario.updateMany({
      where: { id, senha: hashEsperado },
      data: {
        senha: novaSenhaHash,
        tokenVersion: { increment: 1 },
      },
    });
    return count === 1;
  }

  /**
   * Consulta leve por ID para validação de JWT no auth.guard.
   * Retorna apenas os campos necessários para checar revogação e role atualizado.
   */
  async buscarStatusToken(id: string): Promise<{ ativo: boolean; role: Role; tokenVersion: number } | null> {
    return this.db.usuario.findUnique({
      where: { id },
      select: {
        ativo: true,
        role: true,
        tokenVersion: true,
      },
    });
  }

  /**
   * Incrementa tokenVersion para forçar logout / revogar todos os JWTs ativos do usuário.
   */
  async invalidarTokens(id: string): Promise<boolean> {
    const { count } = await this.db.usuario.updateMany({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
    return count === 1;
  }

  async listar(): Promise<Usuario[]> {
    return this.db.usuario.findMany({
      orderBy: { nome: 'asc' },
    });
  }
}
