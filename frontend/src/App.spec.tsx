import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import App from './App';
import { api } from './lib/api';
import { mockUsuarioAdmin } from './test/fixtures/auth.fixture';
import { mockResumoDashboard } from './test/fixtures/dashboard.fixture';

const CHAVE_TOKEN = 'burger_stock_token';
const CHAVE_USUARIO = 'burger_stock_usuario';

type Resposta = { status: number; data: unknown };

/**
 * Backend falso no nível do adapter do axios: as requisições passam pelos interceptors reais
 * (Bearer e tratamento de 401), que é o que este arquivo quer provar.
 */
function backendFalso(rotear: (metodo: string, url: string, token: string | null) => Resposta) {
  const chamadas: Array<{ metodo: string; url: string; token: string | null }> = [];
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const auth = AxiosHeaders.from(config.headers).get('Authorization');
    const token = typeof auth === 'string' ? auth.replace('Bearer ', '') : null;
    const metodo = (config.method ?? 'get').toUpperCase();
    const url = config.url ?? '';
    chamadas.push({ metodo, url, token });
    const { status, data } = rotear(metodo, url, token);
    const resposta = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status ${status}`, String(status), config, undefined, resposta);
    }
    return resposta;
  };
  api.defaults.adapter = adapter;
  return chamadas;
}


describe('App - guarda de sessão e redirecionamento', () => {
  const adapterOriginal = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = adapterOriginal;
  });

  it('sem sessão abre o Login e não chama rota protegida', async () => {
    const chamadas = backendFalso(() => ({ status: 200, data: {} }));
    render(<App />);
    expect(screen.getByRole('button', { name: /Entrar/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
    await act(async () => {});
    expect(chamadas).toHaveLength(0);
  });

  it('com token mas sem usuário em cache mostra o carregamento até o /auth/me responder', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    let liberar!: () => void;
    const segurar = new Promise<void>((r) => {
      liberar = r;
    });
    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/me') await segurar;
      const data = config.url === '/auth/me' ? { usuario: mockUsuarioAdmin } : mockResumoDashboard;
      return { data, status: 200, statusText: '200', headers: {}, config };
    };

    render(<App />);
    expect(screen.getByText('Carregando BurgerStock...')).toBeInTheDocument();
    await act(async () => {
      liberar();
    });
    expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('401 numa tela protegida volta ao Login uma vez só, sem loop de requisições', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    const chamadas = backendFalso((_m, url) =>
      url === '/auth/me' ? { status: 200, data: { usuario: mockUsuarioAdmin } } : { status: 401, data: { message: 'Token revogado. Faça login novamente.' } },
    );

    render(<App />);

    expect(await screen.findByRole('button', { name: /Entrar/ })).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_TOKEN)).toBeNull();
    const quantas = chamadas.length;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(chamadas.length).toBe(quantas);
    expect(chamadas.filter((c) => c.url === '/auth/logout')).toHaveLength(0);
  });

  it('senha errada no Login (401 em /auth/login) não entra em loop nem limpa nada', async () => {
    const chamadas = backendFalso(() => ({ status: 401, data: { message: 'E-mail ou senha incorretos' } }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'carlos@teste.local' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
    expect(chamadas).toHaveLength(1);
  });

  it('quando a sessão cai e outra pessoa entra, o shell começa do zero (Início, sem Perfil aberto)', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    const outro = { ...mockUsuarioAdmin, id: 'u-2', nome: 'Bruna Silva', email: 'bruna@teste.local' };
    let sessaoValida = true;
    backendFalso((metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (metodo === 'POST' && url === '/auth/login') {
        sessaoValida = true;
        return { status: 200, data: { token: 'tok-2', usuario: outro } };
      }
      if (url === '/dashboard/resumo') {
        return sessaoValida ? { status: 200, data: mockResumoDashboard } : { status: 401, data: { message: 'Token revogado.' } };
      }
      return { status: 200, data: [] };
    });

    render(<App />);
    await act(async () => {});

    // Vai para Estoque e abre o Perfil a partir do Início
    fireEvent.click(await screen.findByRole('button', { name: /Perfil de/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Estoque' }));

    // A sessão cai (401 do interceptor numa requisição com o token atual)
    sessaoValida = false;
    await act(async () => {
      await api.get('/dashboard/resumo').catch(() => {});
    });
    expect(await screen.findByRole('button', { name: /Entrar/ })).toBeInTheDocument();

    // Outra pessoa entra
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'bruna@teste.local' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
    });

    await screen.findByRole('navigation', { name: 'Navegação principal' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Início/ })).toHaveAttribute('aria-current', 'page'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando a sessão cai, diálogos de confirmação abertos são cancelados e não cobrem o Login nem a nova sessão', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    let sessaoValida = true;
    const chamadas = backendFalso((metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/produtos') return { status: 200, data: [{ id: 'p1', nome: 'Smash Burger' }] };
      if (url === '/insumos') return { status: 200, data: [] };
      if (metodo === 'POST' && url === '/auth/login') {
        sessaoValida = true;
        return { status: 200, data: { token: 'tok-2', usuario: { ...mockUsuarioAdmin, id: 'u-2', nome: 'Bruna' } } };
      }
      if (url === '/dashboard/resumo') {
        return sessaoValida ? { status: 200, data: mockResumoDashboard } : { status: 401, data: { message: 'Token revogado.' } };
      }
      return { status: 200, data: [] };
    });

    render(<App />);
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    // Navega para Estoque e aba Produtos
    fireEvent.click(screen.getByRole('button', { name: 'Estoque' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Produtos Prontos' }));
    const btnExcluir = await screen.findByLabelText('Excluir Smash Burger');

    // Clica para excluir e abre o diálogo de confirmação
    fireEvent.click(btnExcluir);
    expect(await screen.findByText('Apagar produto')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // A sessão cai com 401
    sessaoValida = false;
    await act(async () => {
      await api.get('/dashboard/resumo').catch(() => {});
    });

    // Login visível e diálogo de confirmação NÃO deve estar na tela
    expect(await screen.findByRole('button', { name: /Entrar/ })).toBeInTheDocument();
    expect(screen.queryByText('Apagar produto')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // A promise resolveu false: nenhum DELETE foi enviado pelo handler da tela
    expect(chamadas.filter((c) => c.metodo === 'DELETE')).toHaveLength(0);

    // Novo login: nada da sessão anterior reaparece
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'bruna@teste.local' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
    });

    await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Apagar produto')).not.toBeInTheDocument();
  });

  it('navegação entre as abas do shell: Início, Estoque, Perdas e Relatórios', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    backendFalso((_metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/dashboard/resumo') return { status: 200, data: mockResumoDashboard };
      return { status: 200, data: [] };
    });

    render(<App />);
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    // Navega para Estoque
    fireEvent.click(screen.getByRole('button', { name: 'Estoque' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Estoque' })).toBeInTheDocument();

    // Navega para Perdas
    fireEvent.click(screen.getByRole('button', { name: 'Perdas' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Registrar perda' })).toBeInTheDocument();

    // Navega para Relatórios
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Relatórios' })).toBeInTheDocument();

    // Volta para Início
    fireEvent.click(screen.getByRole('button', { name: 'Início' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Início' })).toHaveAttribute('aria-current', 'page'));
    expect(screen.getByRole('button', { name: /Ler QR code/i })).toBeInTheDocument();
  });

  it('abre e fecha a tela cheia de Importar Nota Fiscal pelo botão do Início', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    backendFalso((_metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/dashboard/resumo') return { status: 200, data: mockResumoDashboard };
      return { status: 200, data: [] };
    });

    render(<App />);
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    // Clica no botão Ler QR code / Importar NF
    fireEvent.click(screen.getByRole('button', { name: /Ler QR code/i }));

    // A tela cheia de ImportarNotaFiscal substitui o shell
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrada por nota fiscal' })).toBeInTheDocument();

    // Clica no botão Voltar
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

    // O shell volta a ser exibido
    expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('abre e fecha a tela cheia de Fechar o dia pelo atalho do Início', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    backendFalso((_metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/dashboard/resumo') return { status: 200, data: mockResumoDashboard };
      return { status: 200, data: [] };
    });

    render(<App />);
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    fireEvent.click(screen.getByRole('button', { name: /Fechar o dia/ }));
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Fechar o dia' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('quando a sessão cai com o Fechar o dia aberto, a tela fecha e volta ao Login', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    let sessaoValida = true;
    backendFalso((_metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/dashboard/resumo') {
        return sessaoValida ? { status: 200, data: mockResumoDashboard } : { status: 401, data: { message: 'Token revogado.' } };
      }
      return { status: 200, data: [] };
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Fechar o dia/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Fechar o dia' })).toBeInTheDocument();

    sessaoValida = false;
    await act(async () => {
      await api.get('/dashboard/resumo').catch(() => {});
    });
    expect(await screen.findByRole('button', { name: /Entrar/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Fechar o dia' })).not.toBeInTheDocument();
  });

  it('abre e fecha Configurações e Perfil, permitindo navegar de Perfil para Configurações', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    backendFalso((_metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/dashboard/resumo') return { status: 200, data: mockResumoDashboard };
      return { status: 200, data: [] };
    });

    render(<App />);
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    // Abre Configurações pelo botão do topo
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    let dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();

    // Fecha Configurações
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Abre Perfil pelo botão do topo e fecha diretamente
    fireEvent.click(screen.getByRole('button', { name: /Perfil de/ }));
    dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Abre Perfil novamente e clica em Configurações dentro dele
    fireEvent.click(screen.getByRole('button', { name: /Perfil de/ }));
    dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();

    // Clica no botão Configurações dentro do Perfil
    fireEvent.click(within(dialogo).getByRole('button', { name: /Configurações/ }));

    // Perfil fecha e Configurações abre
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Configurações' })).toBeInTheDocument());

    // Fecha Configurações
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('clicar em atalho de venda retida no Início navega para aba Produtos do Estoque com o nome pré-preenchido', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(mockUsuarioAdmin));
    backendFalso((_metodo, url) => {
      if (url === '/auth/me') return { status: 200, data: { usuario: mockUsuarioAdmin } };
      if (url === '/dashboard/resumo') return { status: 200, data: mockResumoDashboard };
      if (url === '/vendas/retidas') {
        return {
          status: 200,
          data: {
            retidas: [
              {
                id: 'vr-1',
                externalId: 'ped-1',
                criadoEm: '2026-11-16T18:00:00.000Z',
                check: 1,
                motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'X-Tudo' }],
              },
            ],
            resumoPorProduto: [{ produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 }],
            aguardandoEstado: 0,
            totalRetidas: 1,
            totalPendentesAnalisadas: 1,
            totalPendentes: 1,
            limite: 200,
            offset: 0,
            temMais: false,
          },
        };
      }
      return { status: 200, data: [] };
    });

    render(<App />);
    const atalho = await screen.findByRole('button', { name: 'Criar produto X-Tudo' });
    fireEvent.click(atalho);

    const inputNovo = await screen.findByLabelText('Nome do novo produto');
    expect((inputNovo as HTMLInputElement).value).toBe('X-Tudo');
    expect(screen.getByRole('button', { name: 'Produtos Prontos' })).toHaveAttribute('aria-pressed', 'true');
  });
});
