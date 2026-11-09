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
  | unknown
  | ((url: string, payload?: unknown) => unknown);

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

/**
 * Renderiza um componente React encapsulado por todos os provedores globais da aplicação:
 * - ThemeProvider
 * - FeedbackProvider
 * - AuthProvider
 *
 * Facilita o mocking de rotas da API e configura por padrão sessão autenticada.
 */
export function renderComProviders(
  ui: ReactElement,
  options: RenderComProvidersOptions = {},
): RenderComProvidersRetorno {
  const {
    autenticado = true,
    usuario = mockUsuarioAdmin,
    token = mockTokenAuth,
    verificarSessao = false,
    mockAuthMe = true,
    tema = 'light',
    routes,
    ...renderOptions
  } = options;

  localStorage.setItem(CHAVE_TEMA, tema);
  configurarAuthStorage(autenticado, usuario, token);

  // Configuração automática de mocks da API caso haja rotas declaradas ou verificação ativa de sessão
  if (routes || (autenticado && verificarSessao && mockAuthMe)) {
    const rotasGet: Record<string, RouteResponseHandler> = {
      ...(autenticado && verificarSessao && mockAuthMe ? { '/auth/me': { usuario } } : {}),
      ...(routes?.get ?? {}),
    };

    const resolverResposta = (handler: RouteResponseHandler, url: string, payload?: unknown) => {
      if (typeof handler === 'function') {
        const resultado = handler(url, payload);
        return { data: resultado, status: 200 };
      }
      return { data: handler, status: 200 };
    };

    if (!vi.isMockFunction(api.get)) {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url in rotasGet) {
          return resolverResposta(rotasGet[url], url);
        }
        return Promise.reject(criarErroAxios(404, { message: `Rota GET ${url} não configurada no teste.` }));
      });
    }

    if (routes?.post && !vi.isMockFunction(api.post)) {
      vi.spyOn(api, 'post').mockImplementation(async (url: string, body?: unknown) => {
        if (routes.post && url in routes.post) {
          return resolverResposta(routes.post[url], url, body);
        }
        return Promise.reject(criarErroAxios(404, { message: `Rota POST ${url} não configurada no teste.` }));
      });
    }

    if (routes?.put && !vi.isMockFunction(api.put)) {
      vi.spyOn(api, 'put').mockImplementation(async (url: string, body?: unknown) => {
        if (routes.put && url in routes.put) {
          return resolverResposta(routes.put[url], url, body);
        }
        return Promise.reject(criarErroAxios(404, { message: `Rota PUT ${url} não configurada no teste.` }));
      });
    }

    if (routes?.delete && !vi.isMockFunction(api.delete)) {
      vi.spyOn(api, 'delete').mockImplementation(async (url: string) => {
        if (routes.delete && url in routes.delete) {
          return resolverResposta(routes.delete[url], url);
        }
        return Promise.reject(criarErroAxios(404, { message: `Rota DELETE ${url} não configurada no teste.` }));
      });
    }
  }

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
