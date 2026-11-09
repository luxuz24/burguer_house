import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { mensagemDeErro } from './api';

describe('lib/api - mensagemDeErro', () => {
  it('retorna fallback para erros desconhecidos ou nao-Axios', () => {
    expect(mensagemDeErro(new Error('Erro comum'), 'Erro padrao')).toBe('Erro padrao');
    expect(mensagemDeErro('string de erro', 'Erro padrao')).toBe('Erro padrao');
    expect(mensagemDeErro(null, 'Erro padrao')).toBe('Erro padrao');
    expect(mensagemDeErro(undefined, 'Erro padrao')).toBe('Erro padrao');
  });

  it('retorna mensagem amigavel quando nao ha conexao com o servidor (!error.response)', () => {
    const semResposta = new AxiosError('Network Error');
    semResposta.response = undefined;

    expect(mensagemDeErro(semResposta, 'Fallback')).toBe(
      'Sem conexão com o servidor. Verifique se o backend está rodando.',
    );
  });

  it('extrai message de erro simples retornado pelo backend ({ message })', () => {
    const headers = new AxiosHeaders();
    const erroComMessage = new AxiosError(
      'Bad Request',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: { message: 'Insumo não encontrado' },
        status: 404,
        statusText: 'Not Found',
        headers,
        config: { headers },
      },
    );

    expect(mensagemDeErro(erroComMessage, 'Fallback')).toBe('Insumo não encontrado');
  });

  it('extrai issues[0].message com prioridade quando o backend retorna erro do Zod (Achado A3)', () => {
    const headers = new AxiosHeaders();
    const erroZod = new AxiosError(
      'Bad Request',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: {
          message: 'Dados inválidos',
          issues: [
            {
              message: 'O nome do produto deve conter ao menos uma letra ou número',
              path: ['nome'],
              code: 'custom',
            },
            {
              message: 'Segunda issue que deve ser ignorada',
              path: ['outro'],
            },
          ],
        },
        status: 400,
        statusText: 'Bad Request',
        headers,
        config: { headers },
      },
    );

    expect(mensagemDeErro(erroZod, 'Fallback')).toBe(
      'O nome do produto deve conter ao menos uma letra ou número',
    );
  });

  it('faz fallback para data.message se issues estiver vazio ou sem message valido', () => {
    const headers = new AxiosHeaders();
    const erroIssuesVazio = new AxiosError(
      'Bad Request',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: {
          message: 'Dados inválidos genérico',
          issues: [],
        },
        status: 400,
        statusText: 'Bad Request',
        headers,
        config: { headers },
      },
    );

    expect(mensagemDeErro(erroIssuesVazio, 'Fallback')).toBe('Dados inválidos genérico');

    const erroIssueSemTexto = new AxiosError(
      'Bad Request',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: {
          message: 'Dados inválidos genérico',
          issues: [{ message: '   ' }],
        },
        status: 400,
        statusText: 'Bad Request',
        headers,
        config: { headers },
      },
    );

    expect(mensagemDeErro(erroIssueSemTexto, 'Fallback')).toBe('Dados inválidos genérico');
  });

  it('faz fallback para o valor padrao se data.message for vazio', () => {
    const headers = new AxiosHeaders();
    const erroSemMensagem = new AxiosError(
      'Server Error',
      'ERR_500',
      undefined,
      undefined,
      {
        data: { message: '   ' },
        status: 500,
        statusText: 'Internal Server Error',
        headers,
        config: { headers },
      },
    );

    expect(mensagemDeErro(erroSemMensagem, 'Erro padrão fallback')).toBe('Erro padrão fallback');
  });
});
