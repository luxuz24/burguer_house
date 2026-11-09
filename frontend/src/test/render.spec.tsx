import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { useEffect, useState } from 'react';
import '@testing-library/jest-dom/vitest';
import axios from 'axios';
import { renderComProviders, criarErroAxios } from './render';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useTheme } from '../context/ThemeContext';
import { api, mensagemDeErro } from '../lib/api';
import { mockUsuarioOperador } from './fixtures/auth.fixture';
import { mockListaInsumos } from './fixtures/insumos.fixture';

describe('test/render - Utilitário renderComProviders e criarErroAxios', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function TesteComponente({ buscarInsumos = false }: { buscarInsumos?: boolean }) {
    const { usuario, autenticado, token } = useAuth();
    const { toast } = useFeedback();
    const { theme } = useTheme();
    const [insumos, setInsumos] = useState<unknown[]>([]);
    const [erro, setErro] = useState<string | null>(null);

    useEffect(() => {
      if (!buscarInsumos) return;
      api
        .get('/insumos')
        .then((res) => setInsumos(res.data as unknown[]))
        .catch((err) => setErro(mensagemDeErro(err, 'Erro desconhecido')));
    }, [buscarInsumos]);

    return (
      <div>
        <span data-testid="autenticado">{autenticado ? 'SIM' : 'NAO'}</span>
        <span data-testid="usuario-nome">{usuario?.nome ?? 'SEM_USUARIO'}</span>
        <span data-testid="usuario-role">{usuario?.role ?? 'SEM_ROLE'}</span>
        <span data-testid="token">{token ?? 'SEM_TOKEN'}</span>
        <span data-testid="tema">{theme}</span>
        <span data-testid="insumos-total">{insumos.length}</span>
        {erro && <span data-testid="erro">{erro}</span>}
        <button
          type="button"
          onClick={() => toast.sucesso('Operação bem-sucedida!')}
        >
          Disparar Toast
        </button>
      </div>
    );
  }

  it('renderiza com os tres provedores e estado autenticado padrao', async () => {
    let renderResult!: ReturnType<typeof renderComProviders>;
    await act(async () => {
      renderResult = renderComProviders(<TesteComponente buscarInsumos />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
          },
        },
      });
    });

    expect(renderResult.usuario).not.toBeNull();
    expect(screen.getByTestId('autenticado').textContent).toBe('SIM');
    expect(screen.getByTestId('usuario-nome').textContent).toBe(renderResult.usuario?.nome);
    expect(screen.getByTestId('usuario-role').textContent).toBe('ADMIN');
    expect(screen.getByTestId('tema').textContent).toBe('light');
    expect(screen.getByTestId('insumos-total').textContent).toBe(String(mockListaInsumos.length));
  });

  it('permite renderizar no estado desautenticado', () => {
    renderComProviders(<TesteComponente />, {
      autenticado: false,
    });

    expect(screen.getByTestId('autenticado').textContent).toBe('NAO');
    expect(screen.getByTestId('usuario-nome').textContent).toBe('SEM_USUARIO');
    expect(screen.getByTestId('token').textContent).toBe('SEM_TOKEN');
  });

  it('permite customizar o usuario autenticado e o tema inicial', () => {
    renderComProviders(<TesteComponente />, {
      usuario: mockUsuarioOperador,
      tema: 'dark',
    });

    expect(screen.getByTestId('autenticado').textContent).toBe('SIM');
    expect(screen.getByTestId('usuario-nome').textContent).toBe(mockUsuarioOperador.nome);
    expect(screen.getByTestId('usuario-role').textContent).toBe('OPERADOR');
    expect(screen.getByTestId('tema').textContent).toBe('dark');
  });

  it('permite interagir com FeedbackContext (toasts)', () => {
    renderComProviders(<TesteComponente />);

    const botao = screen.getByText('Disparar Toast');
    act(() => {
      fireEvent.click(botao);
    });

    expect(screen.getByText('Operação bem-sucedida!')).toBeInTheDocument();
  });

  it('mockRoutes suporta handlers funcionais para POST', async () => {
    let payloadRecebido: unknown = null;

    renderComProviders(<div data-testid="dummy" />, {
      routes: {
        post: {
          '/produtos': (_url: string, body?: unknown) => {
            payloadRecebido = body;
            return { id: 'p-novo', nome: 'X-Burger' };
          },
        },
      },
    });

    const res = await api.post('/produtos', { nome: 'X-Burger' });
    expect(res.data).toEqual({ id: 'p-novo', nome: 'X-Burger' });
    expect(payloadRecebido).toEqual({ nome: 'X-Burger' });
  });

  it('suporta RouteMockDefinition com status de erro (>=400) rejeitando com criarErroAxios (🟡 4)', async () => {
    renderComProviders(<div />, {
      routes: {
        post: {
          '/produtos': {
            status: 409,
            data: { message: 'Já existe um produto com este nome' },
          },
        },
      },
    });

    await expect(api.post('/produtos', { nome: 'X-Bacon' })).rejects.toMatchObject({
      response: {
        status: 409,
        data: { message: 'Já existe um produto com este nome' },
      },
    });
  });

  it('suporta RouteMockDefinition com status de sucesso customizado (ex: 201 Created)', async () => {
    renderComProviders(<div />, {
      routes: {
        post: {
          '/produtos': {
            status: 201,
            data: { id: 'p-201', nome: 'X-Egg' },
          },
        },
      },
    });

    const res = await api.post('/produtos', { nome: 'X-Egg' });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 'p-201', nome: 'X-Egg' });
  });

  it('rotas nao configuradas em POST, PUT e DELETE rejeitam com 404 sem chamar axios real (🟡 4)', async () => {
    renderComProviders(<div />);

    await expect(api.post('/nao-existe')).rejects.toMatchObject({
      response: {
        status: 404,
        data: { message: 'Rota POST /nao-existe não configurada no teste.' },
      },
    });

    await expect(api.put('/nao-existe')).rejects.toMatchObject({
      response: {
        status: 404,
        data: { message: 'Rota PUT /nao-existe não configurada no teste.' },
      },
    });

    await expect(api.delete('/nao-existe')).rejects.toMatchObject({
      response: {
        status: 404,
        data: { message: 'Rota DELETE /nao-existe não configurada no teste.' },
      },
    });
  });

  it('criarErroAxios produz erro estruturado compativel com axios e mensagemDeErro', () => {
    const erro409 = criarErroAxios(409, {
      message: 'Não é possível alterar a unidade de medida',
    });

    expect(axios.isAxiosError(erro409)).toBe(true);
    expect(erro409.response?.status).toBe(409);
    expect(mensagemDeErro(erro409, 'Fallback')).toBe('Não é possível alterar a unidade de medida');

    const erro400Zod = criarErroAxios(400, {
      message: 'Dados inválidos',
      issues: [{ message: 'Fator de perda inválido' }],
    });
    expect(mensagemDeErro(erro400Zod, 'Fallback')).toBe('Fator de perda inválido');
  });
});
