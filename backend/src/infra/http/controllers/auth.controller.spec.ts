import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller.js';
import { AuthError } from '../../../modules/auth/services/auth.service.js';

type Acao = 'login' | 'me' | 'atualizarPerfil' | 'atualizarSenha';

const usuario = { id: 'u1', nome: 'Carlos', email: 'a@x.com', role: 'ADMIN', tokenVersion: 0 };

const corpoValido: Record<Acao, unknown> = {
  login: { email: 'a@x.com', senha: 'x' },
  me: undefined,
  atualizarPerfil: { nome: 'Nome Ok' },
  atualizarSenha: { senhaAtual: 'x', novaSenha: 'novaSenha1' },
};
const corpoInvalido: Record<'login' | 'atualizarPerfil' | 'atualizarSenha', unknown> = {
  login: { email: 'nao-e-email', senha: '' },
  atualizarPerfil: { nome: 'a' },
  atualizarSenha: { senhaAtual: '', novaSenha: '123' },
};
const mensagemZod = {
  login: 'Erro de validação nos dados de login',
  atualizarPerfil: 'Erro de validação nos dados do perfil',
  atualizarSenha: 'Erro de validação na troca de senha',
};
const mensagem500: Record<Acao, string> = {
  login: 'Erro interno no servidor',
  me: 'Erro ao buscar perfil do usuário',
  atualizarPerfil: 'Erro ao atualizar perfil',
  atualizarSenha: 'Erro ao alterar senha',
};
const metodoServico: Record<Acao, string> = {
  login: 'login',
  me: 'obterPerfil',
  atualizarPerfil: 'atualizarPerfil',
  atualizarSenha: 'atualizarSenha',
};

function montar(acao: Acao, comportamento: 'ok' | Error, body: unknown = corpoValido[acao]) {
  const servico = {
    login: vi.fn(),
    obterPerfil: vi.fn(),
    atualizarPerfil: vi.fn(),
    atualizarSenha: vi.fn(),
  };
  const metodo = servico[metodoServico[acao] as keyof typeof servico]!;
  if (comportamento === 'ok') metodo.mockResolvedValue(acao === 'atualizarSenha' ? { sucesso: true } : usuario);
  else metodo.mockRejectedValue(comportamento);

  const log = { error: vi.fn() };
  const sign = vi.fn().mockReturnValue('TOKEN');
  const request = { body, user: { sub: 'u1' }, log, server: { jwt: { sign } } } as unknown as FastifyRequest;
  const raw = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
  const controller = new AuthController(servico as never);
  const executar = () => controller[acao](request, raw as unknown as FastifyReply);
  return { executar, raw, log, sign, servico, metodo };
}

describe('AuthController', () => {
  describe('sucesso', () => {
    it('login: 200 com token e usuário; JWT leva sub/email/role/tv e expira em 12h', async () => {
      const { executar, raw, sign } = montar('login', 'ok');
      await executar();
      expect(sign).toHaveBeenCalledWith({ sub: 'u1', email: 'a@x.com', role: 'ADMIN', tv: 0 }, { expiresIn: '12h' });
      expect(raw.status).toHaveBeenCalledWith(200);
      expect(raw.send).toHaveBeenCalledWith({ token: 'TOKEN', usuario });
    });

    it('me: 200 com o usuário do token', async () => {
      const { executar, raw, metodo } = montar('me', 'ok');
      await executar();
      expect(metodo).toHaveBeenCalledWith('u1');
      expect(raw.status).toHaveBeenCalledWith(200);
      expect(raw.send).toHaveBeenCalledWith({ usuario });
    });

    it('atualizarPerfil: 200 usando o id do token e só os campos do schema', async () => {
      const { executar, raw, metodo } = montar('atualizarPerfil', 'ok', { nome: 'Nome Ok', role: 'ADMIN', id: 'x' });
      await executar();
      expect(metodo).toHaveBeenCalledWith('u1', { nome: 'Nome Ok' });
      expect(raw.status).toHaveBeenCalledWith(200);
      expect(raw.send).toHaveBeenCalledWith({ usuario });
    });

    it('atualizarSenha: 200 com mensagem fixa e id do token', async () => {
      const { executar, raw, metodo } = montar('atualizarSenha', 'ok');
      await executar();
      expect(metodo).toHaveBeenCalledWith('u1', 'x', 'novaSenha1');
      expect(raw.status).toHaveBeenCalledWith(200);
      expect(raw.send).toHaveBeenCalledWith({ message: 'Senha atualizada com sucesso' });
    });
  });

  describe('validação (Zod)', () => {
    it.each(['login', 'atualizarPerfil', 'atualizarSenha'] as const)('%s: 400 com issues e sem chamar o serviço', async (acao) => {
      const { executar, raw, servico } = montar(acao, 'ok', corpoInvalido[acao]);
      await executar();
      expect(raw.status).toHaveBeenCalledWith(400);
      const corpo = raw.send.mock.calls[0]![0];
      expect(corpo.message).toBe(mensagemZod[acao]);
      expect(corpo.errors.length).toBeGreaterThan(0);
      for (const fn of Object.values(servico)) expect(fn).not.toHaveBeenCalled();
    });

    it('perfil: limites de tamanho (nome 100, telefone 30) e telefone null permitido', async () => {
      for (const [body, status] of [
        [{ nome: 'a'.repeat(100) }, 200],
        [{ nome: 'a'.repeat(101) }, 400],
        [{ telefone: '9'.repeat(30) }, 200],
        [{ telefone: '9'.repeat(31) }, 400],
        [{ telefone: null }, 200],
        [{ nome: 'ab' }, 200],
        [{}, 200],
      ] as const) {
        const { executar, raw } = montar('atualizarPerfil', 'ok', body);
        await executar();
        expect(raw.status, JSON.stringify(body).slice(0, 40)).toHaveBeenCalledWith(status);
      }
    });

    it('senha: limite de 6 caracteres na nova senha', async () => {
      for (const [nova, status] of [['12345', 400], ['123456', 200]] as const) {
        const { executar, raw } = montar('atualizarSenha', 'ok', { senhaAtual: 'x', novaSenha: nova });
        await executar();
        expect(raw.status).toHaveBeenCalledWith(status);
      }
    });
  });

  describe('erros do serviço', () => {
    it.each(['login', 'me', 'atualizarPerfil', 'atualizarSenha'] as const)(
      '%s: AuthError mantém statusCode e mensagem, sem log de erro',
      async (acao) => {
        const { executar, raw, log } = montar(acao, new AuthError('regra de negócio', 418));
        await executar();
        expect(raw.status).toHaveBeenCalledWith(418);
        expect(raw.send).toHaveBeenCalledWith({ message: 'regra de negócio' });
        expect(log.error).not.toHaveBeenCalled();
      }
    );

    it.each(['login', 'me', 'atualizarPerfil', 'atualizarSenha'] as const)(
      '%s: erro inesperado → 500 genérico (sem vazar detalhe) e log com o erro original',
      async (acao) => {
        const erro = new Error('senha do banco: hunter2');
        const { executar, raw, log } = montar(acao, erro);
        await executar();
        expect(raw.status).toHaveBeenCalledWith(500);
        expect(raw.send).toHaveBeenCalledWith({ message: mensagem500[acao] });
        expect(log.error).toHaveBeenCalledWith({ err: erro }, 'Erro inesperado em auth');
      }
    );
  });
});
