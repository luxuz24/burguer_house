import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UsuariosAdminService, UsuarioAdminError } from '../../../modules/auth/services/usuarios_admin.service.js';

const ROLES = ['ADMIN', 'GERENTE', 'OPERADOR'] as const;

// bcrypt ignora tudo após 72 bytes; a mesma regra da troca de senha do perfil (auth.service.ts).
const senhaSchema = z
  .string()
  .min(6, 'A senha deve ter no mínimo 6 caracteres')
  .refine((s) => Buffer.byteLength(s, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes');

const nomeSchema = z
  .string()
  .trim()
  .min(2, 'Nome deve ter no mínimo 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres');

const telefoneSchema = z.string().max(30, 'Telefone deve ter no máximo 30 caracteres').nullable();

const criarUsuarioSchema = z.object({
  nome: nomeSchema,
  email: z.string().trim().email('E-mail em formato inválido'),
  senha: senhaSchema,
  telefone: telefoneSchema.optional(),
  role: z.enum(ROLES, 'Papel inválido (use ADMIN, GERENTE ou OPERADOR)').default('OPERADOR'),
});

const atualizarUsuarioSchema = z
  .object({
    nome: nomeSchema.optional(),
    telefone: telefoneSchema.optional(),
    role: z.enum(ROLES, 'Papel inválido (use ADMIN, GERENTE ou OPERADOR)').optional(),
    ativo: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'Informe ao menos um campo para alterar');

const redefinirSenhaSchema = z.object({ novaSenha: senhaSchema });

const paramsSchema = z.object({ id: z.string().min(1) });

export class UsuariosController {
  private readonly service = new UsuariosAdminService();

  listar = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.listar());
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    const dados = criarUsuarioSchema.parse(request.body);
    return this.responder(reply, async () => reply.status(201).send(await this.service.criar(dados)));
  };

  atualizar = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarUsuarioSchema.parse(request.body);
    return this.responder(reply, async () => reply.send(await this.service.atualizar(request.user.sub, id, dados)));
  };

  redefinirSenha = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = paramsSchema.parse(request.params);
    const { novaSenha } = redefinirSenhaSchema.parse(request.body);
    return this.responder(reply, async () => {
      await this.service.redefinirSenha(request.user.sub, id, novaSenha);
      return reply.status(204).send();
    });
  };

  private async responder(reply: FastifyReply, acao: () => Promise<FastifyReply>) {
    try {
      return await acao();
    } catch (error) {
      if (error instanceof UsuarioAdminError) {
        return reply.status(error.status).send({ message: error.message });
      }
      throw error;
    }
  }
}
