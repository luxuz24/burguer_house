import bcrypt from 'bcryptjs';
import type { Role, Usuario } from '../../../../generated/prisma/client.js';
import { UsuariosRepository } from '../repositories/usuarios.repository.js';
import type { UsuarioSemSenha } from './auth.service.js';

export class UsuarioAdminError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'UsuarioAdminError';
  }
}

export interface CriarUsuarioAdminInput {
  nome: string;
  email: string;
  senha: string;
  telefone?: string | null | undefined;
  role: Role;
}

export interface AtualizarUsuarioAdminInput {
  nome?: string | undefined;
  telefone?: string | null | undefined;
  role?: Role | undefined;
  ativo?: boolean | undefined;
}

function semSenha(usuario: Usuario): UsuarioSemSenha {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    role: usuario.role,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm,
    atualizadoEm: usuario.atualizadoEm,
  };
}

/**
 * Gestão de usuários pelo administrador (decisão do dono, 17/11/2026: só ADMIN cadastra usuários).
 * Não há exclusão: usuários aparecem em vendas e movimentações, então a saída é desativar.
 */
export class UsuariosAdminService {
  constructor(private readonly usuariosRepo = new UsuariosRepository()) {}

  async listar(): Promise<UsuarioSemSenha[]> {
    return (await this.usuariosRepo.listar()).map(semSenha);
  }

  async criar(input: CriarUsuarioAdminInput): Promise<UsuarioSemSenha> {
    const email = input.email.trim().toLowerCase();
    if (await this.usuariosRepo.buscarPorEmail(email)) {
      throw new UsuarioAdminError('Já existe um usuário com este e-mail', 409);
    }
    const senhaHash = await bcrypt.hash(input.senha, 10);
    // Corrida entre dois cadastros do mesmo e-mail cai no índice único (P2002 → 409 no error handler global)
    const usuario = await this.usuariosRepo.criar({
      nome: input.nome.trim(),
      email,
      senha: senhaHash,
      telefone: input.telefone?.trim() || null,
      role: input.role,
    });
    return semSenha(usuario);
  }

  async atualizar(adminId: string, id: string, input: AtualizarUsuarioAdminInput): Promise<UsuarioSemSenha> {
    // Como quem chama é um ADMIN ativo e não pode se desativar nem se rebaixar, sempre sobra pelo menos um ADMIN ativo.
    if (id === adminId && (input.ativo === false || (input.role !== undefined && input.role !== 'ADMIN'))) {
      throw new UsuarioAdminError('Você não pode desativar nem rebaixar a própria conta', 400);
    }
    if (!(await this.usuariosRepo.buscarPorId(id))) {
      throw new UsuarioAdminError('Usuário não encontrado', 404);
    }

    const dados: { nome?: string; telefone?: string | null; role?: Role; ativo?: boolean } = {};
    if (input.nome !== undefined) dados.nome = input.nome.trim();
    if (input.telefone !== undefined) dados.telefone = input.telefone?.trim() || null;
    if (input.role !== undefined) dados.role = input.role;
    if (input.ativo !== undefined) dados.ativo = input.ativo;

    return semSenha(await this.usuariosRepo.atualizarPeloAdmin(id, dados));
  }

  async redefinirSenha(adminId: string, id: string, novaSenha: string): Promise<void> {
    if (id === adminId) {
      throw new UsuarioAdminError('Para trocar a sua própria senha, use a troca de senha do perfil', 400);
    }
    const hash = await bcrypt.hash(novaSenha, 10);
    if (!(await this.usuariosRepo.redefinirSenha(id, hash))) {
      throw new UsuarioAdminError('Usuário não encontrado', 404);
    }
  }
}
