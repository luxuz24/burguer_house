import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { vi } from 'vitest';
import { AuthProvider, type UsuarioAuth } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ThemeProvider } from '../context/ThemeContext';
import { api } from '../lib/api';
import { mockUsuarioAdmin, mockTokenAuth } from './fixtures/auth.fixture';

const CHAVE_TOKEN = 'burger_stock_token';
const CHAVE_USUARIO = 'burger_stock_usuario';
const CHAVE_TEMA = 'burger_stock_theme';

export interface RouteMockDefinition {
  status?: number;
  data: unknown;
}

export type RouteResponseHandler =
  | RouteMockDefinition
  | unknown
  | ((url: string, payload?: unknown) => RouteMockDefinition | unknown);

export interface MockRoutes {
  get?: Record<string, RouteResponseHandler>;
  post?: Record<string, RouteResponseHandler>;
  put?: Record<string, RouteResponseHandler>;
  delete?: Record<string, RouteResponseHandler>;
}

export interface RenderComProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  autenticado?: boolean;
  usuario?: UsuarioAuth;
  token?: string;
  verificarSessao?: boolean;
  mockAuthMe?: boolean;
  tema?: 'light' | 'dark' | 'system';
  routes?: MockRoutes;
}

export interface RenderComProvidersRetorno extends RenderResult {
  usuario: UsuarioAuth | null;
  token: string | null;
}

/**
 * Cria um erro com estrutura AxiosError padrão para simular respostas HTTP 4xx e 5xx.
 */
export function criarErroAxios(status: number, data: unknown, message = `Request failed with status ${status}`) {
  const error = new axios.AxiosError(message, String(status));
  error.response = {
    data,
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
  return error;
}

/**
 * Configura o estado de autenticação pré-existente no localStorage.
 */
export function configurarAuthStorage(
  autenticado = true,
  usuario: UsuarioAuth = mockUsuarioAdmin,
  token = mockTokenAuth,
) {
  if (autenticado) {
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  } else {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
  }
}

function resolverResposta(handler: RouteResponseHandler, url: string, payload?: unknown) {
  const resultado = typeof handler === 'function' ? handler(url, payload) : handler;

  if (
    typeof resultado === 'object' &&
    resultado !== null &&
    'data' in resultado &&
    typeof (resultado as RouteMockDefinition).status === 'number'
  ) {
    const { status = 200, data } = resultado as RouteMockDefinition;
    if (status >= 400) {
      return Promise.reject(criarErroAxios(status, data));
    }
    return Promise.resolve({ data, status });
  }

  return Promise.resolve({ data: resultado, status: 200 });
}

/**
 * Renderiza um componente React encapsulado por todos os provedores globais da aplicação:
 * - ThemeProvider
 * - FeedbackProvider
 * - AuthProvider
 *
 * Configura mock completo das rotas da API e autenticação ativa por padrão.
 */
export function renderComProviders(
  ui: ReactElement,
  options: RenderComProvidersOptions = {},
): RenderComProvidersRetorno {
  const {
    autenticado = true,
    usuario = mockUsuarioAdmin,
    token = mockTokenAuth,
    verificarSessao = true,
    mockAuthMe = true,
    tema = 'light',
    routes,
    ...renderOptions
  } = options;

  localStorage.setItem(CHAVE_TEMA, tema);
  configurarAuthStorage(autenticado, usuario, token);

  const rotasGet: Record<string, RouteResponseHandler> = {
    ...(autenticado && verificarSessao && mockAuthMe ? { '/auth/me': { usuario } } : {}),
    ...(routes?.get ?? {}),
  };

  // Mock completo de todos os métodos HTTP (evita chamadas reais acidentais ao backend)
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url in rotasGet) {
      return resolverResposta(rotasGet[url], url);
    }
    return Promise.reject(criarErroAxios(404, { message: `Rota GET ${url} não configurada no teste.` }));
  });

  vi.spyOn(api, 'post').mockImplementation(async (url: string, body?: unknown) => {
    if (routes?.post && url in routes.post) {
      return resolverResposta(routes.post[url], url, body);
    }
    return Promise.reject(criarErroAxios(404, { message: `Rota POST ${url} não configurada no teste.` }));
  });

  vi.spyOn(api, 'put').mockImplementation(async (url: string, body?: unknown) => {
    if (routes?.put && url in routes.put) {
      return resolverResposta(routes.put[url], url, body);
    }
    return Promise.reject(criarErroAxios(404, { message: `Rota PUT ${url} não configurada no teste.` }));
  });

  vi.spyOn(api, 'delete').mockImplementation(async (url: string) => {
    if (routes?.delete && url in routes.delete) {
      return resolverResposta(routes.delete[url], url);
    }
    return Promise.reject(criarErroAxios(404, { message: `Rota DELETE ${url} não configurada no teste.` }));
  });

  function ProvidersWrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider verificarSessao={verificarSessao}>{children}</AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    );
  }

  const renderResult = render(ui, {
    wrapper: ProvidersWrapper,
    ...renderOptions,
  });

  return {
    ...renderResult,
    usuario: autenticado ? usuario : null,
    token: autenticado ? token : null,
  };
}
