import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { api, EVENTO_SESSAO_EXPIRADA } from '../lib/api';

const CHAVE_TOKEN = 'burger_stock_token';
const CHAVE_USUARIO = 'burger_stock_usuario';

describe('AuthContext - Ciclo de Vida da Sessão e Logout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('logout: envia o header Authorization explicito antes de limpar o localStorage (regressão PR #38)', async () => {
    const tokenInicial = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token-inicial';
    localStorage.setItem(CHAVE_TOKEN, tokenInicial);
    localStorage.setItem(
      CHAVE_USUARIO,
      JSON.stringify({ id: 'u1', nome: 'Carlos', email: 'c@x.com', role: 'ADMIN', ativo: true })
    );

    // Mock do /auth/me na montagem e /auth/logout no logout
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { usuario: { id: 'u1', nome: 'Carlos', email: 'c@x.com', role: 'ADMIN', ativo: true } },
    });
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { message: 'Logout realizado' } });

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe(tokenInicial);

    // Executa logout
    await act(async () => {
      result.current.logout();
    });

    // 1. Verifica que a chamada foi feita com o cabeçalho explícito
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      '/auth/logout',
      null,
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${tokenInicial}`,
        },
      })
    );

    // 2. Verifica que os dados foram limpos do localStorage
    expect(localStorage.getItem(CHAVE_TOKEN)).toBeNull();
    expect(localStorage.getItem(CHAVE_USUARIO)).toBeNull();

    // 3. Verifica que o estado local foi resetado
    expect(result.current.token).toBeNull();
    expect(result.current.usuario).toBeNull();
    expect(result.current.autenticado).toBe(false);
  });

  it('EVENTO_SESSAO_EXPIRADA: limpa a sessao localmente sem disparar POST /auth/logout para o servidor', async () => {
    const tokenInicial = 'token-expirado';
    localStorage.setItem(CHAVE_TOKEN, tokenInicial);
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { usuario: { id: 'u1', nome: 'Carlos', email: 'c@x.com', role: 'ADMIN', ativo: true } },
    });
    const postSpy = vi.spyOn(api, 'post');

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe(tokenInicial);

    // Dispara o evento de sessão expirada (ex: interceptor de 401 da API)
    await act(async () => {
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    });

    // Storage limpo
    expect(localStorage.getItem(CHAVE_TOKEN)).toBeNull();
    expect(localStorage.getItem(CHAVE_USUARIO)).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.usuario).toBeNull();

    // NENHUMA requisição de logout enviada ao servidor (o token já era inválido)
    expect(postSpy).not.toHaveBeenCalledWith('/auth/logout', expect.anything(), expect.anything());
  });

  it('atualizarSenha: salva novo token recebido no localStorage e atualiza estado do contexto', async () => {
    const tokenAntigo = 'token-antigo';
    const tokenNovo = 'token-novo-pos-troca-senha';
    localStorage.setItem(CHAVE_TOKEN, tokenAntigo);
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { usuario: { id: 'u1', nome: 'Carlos', email: 'c@x.com', role: 'ADMIN', ativo: true } },
    });

    const putSpy = vi.spyOn(api, 'put').mockResolvedValueOnce({
      data: { message: 'Senha atualizada com sucesso', token: tokenNovo },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.atualizarSenha('admin123', 'novaSenhaForte456');
    });

    expect(putSpy).toHaveBeenCalledWith('/auth/senha', {
      senhaAtual: 'admin123',
      novaSenha: 'novaSenhaForte456',
    });

    // Novo token gravado no localStorage e no estado
    expect(localStorage.getItem(CHAVE_TOKEN)).toBe(tokenNovo);
    expect(result.current.token).toBe(tokenNovo);
  });

  it('login: autentica, salva credenciais e atualiza o estado para autenticado', async () => {
    const usuarioMock = {
      id: 'u-login',
      nome: 'Administrador',
      email: 'admin@burguerhouse.com',
      telefone: null,
      role: 'ADMIN' as const,
      ativo: true,
    };
    const tokenLogin = 'token-jwt-do-login';

    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: { token: tokenLogin, usuario: usuarioMock },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.autenticado).toBe(false);

    await act(async () => {
      await result.current.login('admin@burguerhouse.com', 'senha123');
    });

    expect(postSpy).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@burguerhouse.com',
      senha: 'senha123',
    });

    expect(localStorage.getItem(CHAVE_TOKEN)).toBe(tokenLogin);
    expect(JSON.parse(localStorage.getItem(CHAVE_USUARIO)!)).toEqual(usuarioMock);
    expect(result.current.token).toBe(tokenLogin);
    expect(result.current.usuario).toEqual(usuarioMock);
    expect(result.current.autenticado).toBe(true);
  });
});
