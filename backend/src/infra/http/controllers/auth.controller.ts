import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService, AuthError } from '../../../modules/auth/services/auth.service.js';

const loginSchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  senha: z.string().min(1, 'A senha é obrigatória'),
});

const atualizarPerfilSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres').optional(),
  telefone: z.string().max(30, 'Telefone deve ter no máximo 30 caracteres').optional().nullable(),
});

const atualizarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual é obrigatória'),
  novaSenha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, senha } = loginSchema.parse(request.body);
      const usuario = await this.authService.login(email, senha);

      const token = request.server.jwt.sign(
        {
          sub: usuario.id,
          email: usuario.email,
          role: usuario.role,
        },
        { expiresIn: '7d' }
      );

      return reply.status(200).send({
        token,
        usuario,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: 'Erro de validação nos dados de login',
          errors: error.issues,
        });
      }
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ message: error.message });
      }
      request.log.error({ err: error }, 'Erro inesperado em auth');
      return reply.status(500).send({ message: 'Erro interno no servidor' });
    }
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const usuarioId = request.user.sub;
      const usuario = await this.authService.obterPerfil(usuarioId);
      return reply.status(200).send({ usuario });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ message: error.message });
      }
      request.log.error({ err: error }, 'Erro inesperado em auth');
      return reply.status(500).send({ message: 'Erro ao buscar perfil do usuário' });
    }
  };

  atualizarPerfil = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const usuarioId = request.user.sub;
      const dados = atualizarPerfilSchema.parse(request.body);
      const usuario = await this.authService.atualizarPerfil(usuarioId, dados);
      return reply.status(200).send({ usuario });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: 'Erro de validação nos dados do perfil',
          errors: error.issues,
        });
      }
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ message: error.message });
      }
      request.log.error({ err: error }, 'Erro inesperado em auth');
      return reply.status(500).send({ message: 'Erro ao atualizar perfil' });
    }
  };

  atualizarSenha = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const usuarioId = request.user.sub;
      const { senhaAtual, novaSenha } = atualizarSenhaSchema.parse(request.body);
      await this.authService.atualizarSenha(usuarioId, senhaAtual, novaSenha);
      return reply.status(200).send({ message: 'Senha atualizada com sucesso' });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: 'Erro de validação na troca de senha',
          errors: error.issues,
        });
      }
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ message: error.message });
      }
      request.log.error({ err: error }, 'Erro inesperado em auth');
      return reply.status(500).send({ message: 'Erro ao alterar senha' });
    }
  };
}
