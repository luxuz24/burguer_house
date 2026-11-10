import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PreparoInterno from './PreparoInterno';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';

describe('pages/PreparoInterno - Produção Interna e Sub-fichas Técnicas (F3)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const insumoBeneficiadoMock = {
    id: 'insumo-maionese',
    nome: 'Maionese da Casa',
    unidade: 'Gramas',
    estoqueAtual: 500,
    produzidoInternamente: true,
    validadeDias: 3,
  };

  const insumoOleoMock = {
    id: 'insumo-oleo',
    nome: 'Óleo de Soja',
    unidade: 'Mililitros',
    estoqueAtual: 1000,
    fatorPerda: 0,
    produzidoInternamente: false,
  };

  const insumoOvoMock = {
    id: 'insumo-ovo',
    nome: 'Ovo Pasteurizado',
    unidade: 'Gramas',
    estoqueAtual: 200,
    fatorPerda: 0.05,
    produzidoInternamente: false,
  };

  const subFichaItensMock = [
    {
      id: 'sub-1',
      insumoBeneficiadoId: 'insumo-maionese',
      insumoBrutoId: 'insumo-oleo',
      quantidadeNecessaria: 0.6,
      insumoBruto: insumoOleoMock,
    },
    {
      id: 'sub-2',
      insumoBeneficiadoId: 'insumo-maionese',
      insumoBrutoId: 'insumo-ovo',
      quantidadeNecessaria: 0.4,
      insumoBruto: insumoOvoMock,
    },
  ];

  describe('🔴 1. Estado de erro e resiliência no carregamento', () => {
    it('com 404 em /preparo-interno/sub-fichas/:id ou insumo ausente: exibe tela de item não encontrado e botão Voltar chama onVoltar', async () => {
      const onVoltarMock = vi.fn();

      renderComProviders(<PreparoInterno insumoId="insumo-inexistente" onVoltar={onVoltarMock} />, {
        routes: {
          get: {
            '/insumos': [insumoOleoMock],
            '/preparo-interno/sub-fichas/insumo-inexistente': {
              status: 404,
              data: { message: 'Insumo beneficiado não encontrado' },
            },
          },
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Item não encontrado ou não é mais produzido na casa/i }),
        ).toBeInTheDocument();
      });

      const botaoVoltar = screen.getByRole('button', { name: /Voltar ao estoque/i });
      fireEvent.click(botaoVoltar);
      expect(onVoltarMock).toHaveBeenCalledTimes(1);
    });

    it('quando insumo existe mas produzidoInternamente é false: trata como não encontrado e exibe botão Voltar', async () => {
      const onVoltarMock = vi.fn();
      const insumoNaoBeneficiado = {
        ...insumoBeneficiadoMock,
        id: 'insumo-comum',
        produzidoInternamente: false,
      };

      renderComProviders(<PreparoInterno insumoId="insumo-comum" onVoltar={onVoltarMock} />, {
        routes: {
          get: {
            '/insumos': [insumoNaoBeneficiado, insumoOleoMock],
            '/preparo-interno/sub-fichas/insumo-comum': [],
          },
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Item não encontrado ou não é mais produzido na casa/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Voltar ao estoque/i }));
      expect(onVoltarMock).toHaveBeenCalledTimes(1);
    });

    it('quando a carga inicial falha com 500: exibe tela de erro com "Tentar novamente" e recupera', async () => {
      const onVoltarMock = vi.fn();
      let tentativa = 0;

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={onVoltarMock} />, {
        routes: {
          get: {
            '/insumos': () => {
              tentativa++;
              if (tentativa === 1) {
                return Promise.reject({
                  isAxiosError: true,
                  response: { status: 500, data: { message: 'Instabilidade no banco' } },
                });
              }
              return [insumoBeneficiadoMock, insumoOleoMock];
            },
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Erro ao carregar dados do preparo/i })).toBeInTheDocument();
        expect(screen.getByText(/Instabilidade no banco/i)).toBeInTheDocument();
      });

      const botaoTentar = screen.getByRole('button', { name: /Tentar novamente/i });
      fireEvent.click(botaoTentar);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });
      expect(tentativa).toBe(2);
    });
  });

  describe('🟡 2. Prévia de consumo durante digitação e paridade com backend', () => {
    it('calcula consumo previsto usando consumoProducao e compara estoque atual', async () => {
      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const inputQtd = screen.getByLabelText(/Quantidade a produzir/i);
      // Digita 100g para produzir
      fireEvent.change(inputQtd, { target: { value: '100' } });

      // Óleo: 0.6 * (1 + 0) * 100 = 60 ml (estoque: 1000 ml -> suficiente)
      // Ovo: 0.4 * (1 + 0.05) * 100 = 42 g (estoque: 200 g -> suficiente)
      await waitFor(() => {
        expect(screen.getByText(/Óleo de Soja:\s*60 Mililitros/i)).toBeInTheDocument();
        expect(screen.getByText(/Ovo Pasteurizado:\s*42 Gramas/i)).toBeInTheDocument();
      });

      const botaoProduzir = screen.getByRole('button', { name: /Produzir 100 Gramas/i });
      expect(botaoProduzir).not.toBeDisabled();
    });

    it('desabilita botão Produzir e exibe alerta se algum ingrediente tiver estoque insuficiente', async () => {
      const insumoOvoInsuficiente = {
        ...insumoOvoMock,
        estoqueAtual: 10, // Menos que os 42 necessários
      };

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoInsuficiente],
            '/preparo-interno/sub-fichas/insumo-maionese': [
              subFichaItensMock[0],
              { ...subFichaItensMock[1], insumoBruto: insumoOvoInsuficiente },
            ],
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const inputQtd = screen.getByLabelText(/Quantidade a produzir/i);
      fireEvent.change(inputQtd, { target: { value: '100' } });

      await waitFor(() => {
        expect(screen.getByText(/estoque: 10 g/i)).toBeInTheDocument();
      });

      const botaoProduzir = screen.getByRole('button', { name: /Produzir 100 Gramas/i });
      expect(botaoProduzir).toBeDisabled();
    });

    it('caso de borda: arredondamento em 4 casas decimais do backend permite produzir quando consumo teórico arredonda para o estoque exato', async () => {
      const insumoBorda = {
        id: 'insumo-borda',
        nome: 'Insumo Borda',
        unidade: 'Gramas',
        estoqueAtual: 10,
        fatorPerda: 0,
        produzidoInternamente: false,
      };

      const subFichaBorda = [
        {
          id: 'sub-borda',
          insumoBeneficiadoId: 'insumo-maionese',
          insumoBrutoId: 'insumo-borda',
          quantidadeNecessaria: 1.000004,
          insumoBruto: insumoBorda,
        },
      ];

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoBorda],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaBorda,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const inputQtd = screen.getByLabelText(/Quantidade a produzir/i);
      fireEvent.change(inputQtd, { target: { value: '10' } });

      // 1.000004 * 10 = 10.00004 -> arredondado em 4 casas = 10 -> estoque 10 é suficiente!
      const botaoProduzir = await screen.findByRole('button', { name: /Produzir 10 Gramas/i });
      expect(botaoProduzir).not.toBeDisabled();
    });
  });

  describe('🟡 3. "Produzir" sem duplo clique e com tratamento de 409', () => {
    it('previne múltiplos disparos ao clicar repetidamente em Produzir (useEnvio)', async () => {
      let chamadasPost = 0;
      let resolverPost: ((v: unknown) => void) | null = null;

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
          post: {
            '/preparo-interno/produzir': () => {
              chamadasPost++;
              return new Promise((res) => {
                resolverPost = res;
              });
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const inputQtd = screen.getByLabelText(/Quantidade a produzir/i);
      fireEvent.change(inputQtd, { target: { value: '50' } });

      const botaoProduzir = screen.getByRole('button', { name: /Produzir 50 Gramas/i });

      // Duplo clique consecutivo
      fireEvent.click(botaoProduzir);
      fireEvent.click(botaoProduzir);

      expect(chamadasPost).toBe(1);
      expect(botaoProduzir).toBeDisabled();

      await act(async () => {
        resolverPost?.({
          quantidadeProduzida: 50,
          insumo: { ...insumoBeneficiadoMock, estoqueAtual: 550 },
        });
      });
    });

    it('quando POST /preparo-interno/produzir retorna 409: exibe mensagem detalhada do backend e recarrega dados', async () => {
      let chamadasGetInsumos = 0;

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': () => {
              chamadasGetInsumos++;
              return [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock];
            },
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
          post: {
            '/preparo-interno/produzir': {
              status: 409,
              data: { message: 'Estoque insuficiente: Óleo de Soja' },
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });
      expect(chamadasGetInsumos).toBe(1);

      const inputQtd = screen.getByLabelText(/Quantidade a produzir/i);
      fireEvent.change(inputQtd, { target: { value: '50' } });

      const botaoProduzir = screen.getByRole('button', { name: /Produzir 50 Gramas/i });
      fireEvent.click(botaoProduzir);

      await waitFor(() => {
        expect(screen.getByText('Estoque insuficiente: Óleo de Soja')).toBeInTheDocument();
      });
      // Recarregou os insumos e a sub-ficha em segundo plano
      expect(chamadasGetInsumos).toBeGreaterThanOrEqual(2);
    });
  });

  describe('🟡 4. Sub-ficha: vincular e editar ingrediente', () => {
    it('aceita vírgula como separador decimal ao vincular novo ingrediente', async () => {
      let payloadEnviado: Record<string, unknown> | null = null;
      const insumoSal = {
        id: 'insumo-sal',
        nome: 'Sal Refinado',
        unidade: 'Gramas',
        estoqueAtual: 500,
        fatorPerda: 0,
        produzidoInternamente: false,
      };

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock, insumoSal],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
          post: {
            '/preparo-interno/sub-fichas': (_url: string, body?: unknown) => {
              payloadEnviado = body as Record<string, unknown>;
              return {
                id: 'sub-sal',
                insumoBeneficiadoId: 'insumo-maionese',
                insumoBrutoId: 'insumo-sal',
                quantidadeNecessaria: 1.5,
              };
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const selectInsumo = screen.getByLabelText(/Selecionar insumo bruto/i);
      fireEvent.change(selectInsumo, { target: { value: 'insumo-sal' } });

      const inputQtd = screen.getByLabelText(/Quantidade por 1 Gramas/i);
      fireEvent.change(inputQtd, { target: { value: '1,5' } });

      const botaoAdicionar = screen.getByRole('button', { name: /Adicionar ingrediente/i });
      fireEvent.click(botaoAdicionar);

      await waitFor(() => {
        expect(payloadEnviado).toEqual({
          insumoBeneficiadoId: 'insumo-maionese',
          insumoBrutoId: 'insumo-sal',
          quantidadeNecessaria: 1.5,
        });
        expect(screen.getByText('Ingrediente adicionado à sub-ficha.')).toBeInTheDocument();
      });
    });

    it('upsert: se ingrediente já existia na sub-ficha, exibe toast de quantidade atualizada', async () => {
      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
          post: {
            '/preparo-interno/sub-fichas': {
              id: 'sub-1',
              insumoBeneficiadoId: 'insumo-maionese',
              insumoBrutoId: 'insumo-oleo',
              quantidadeNecessaria: 0.8,
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      // Clica em Editar Óleo de Soja
      const botaoEditar = screen.getByRole('button', { name: /Editar Óleo de Soja/i });
      fireEvent.click(botaoEditar);

      const inputEditarQtd = screen.getByLabelText(/Editar quantidade/i);
      fireEvent.change(inputEditarQtd, { target: { value: '0,8' } });

      const botaoSalvar = screen.getByRole('button', { name: /Salvar quantidade/i });
      fireEvent.click(botaoSalvar);

      await waitFor(() => {
        expect(screen.getByText('Quantidade atualizada na sub-ficha.')).toBeInTheDocument();
      });
    });

    it('recusa zero e negativos no campo de quantidade e não envia requisição', async () => {
      const postSpy = vi.spyOn(api, 'post');

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const botaoEditar = screen.getByRole('button', { name: /Editar Óleo de Soja/i });
      fireEvent.click(botaoEditar);

      const inputEditarQtd = screen.getByLabelText(/Editar quantidade/i);
      fireEvent.change(inputEditarQtd, { target: { value: '0' } });

      const botaoSalvar = screen.getByRole('button', { name: /Salvar quantidade/i });
      fireEvent.click(botaoSalvar);

      expect(postSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText('Informe uma quantidade maior que zero.')).toBeInTheDocument();
      });
    });

    it('quando a recarga em segundo plano falha após mutação: exibe aviso de que não foi possível atualizar', async () => {
      let chamadasGet = 0;

      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': () => {
              chamadasGet++;
              if (chamadasGet > 1) {
                return Promise.reject({
                  isAxiosError: true,
                  response: { status: 500, data: { message: 'Erro no servidor' } },
                });
              }
              return [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock];
            },
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
          post: {
            '/preparo-interno/sub-fichas': {
              id: 'sub-1',
              insumoBeneficiadoId: 'insumo-maionese',
              insumoBrutoId: 'insumo-oleo',
              quantidadeNecessaria: 0.9,
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      const botaoEditar = screen.getByRole('button', { name: /Editar Óleo de Soja/i });
      fireEvent.click(botaoEditar);

      const inputEditarQtd = screen.getByLabelText(/Editar quantidade/i);
      fireEvent.change(inputEditarQtd, { target: { value: '0.9' } });

      const botaoSalvar = screen.getByRole('button', { name: /Salvar quantidade/i });
      fireEvent.click(botaoSalvar);

      await waitFor(() => {
        expect(
          screen.getByText('Salvo, mas não foi possível atualizar os dados em segundo plano.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('🟢 5. Usabilidade e toques mínimos', () => {
    it('inputs numéricos possuem inputMode="decimal" apropriado', async () => {
      renderComProviders(<PreparoInterno insumoId="insumo-maionese" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/insumos': [insumoBeneficiadoMock, insumoOleoMock, insumoOvoMock],
            '/preparo-interno/sub-fichas/insumo-maionese': subFichaItensMock,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Maionese da Casa/i })).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Quantidade a produzir/i)).toHaveAttribute('inputMode', 'decimal');
      expect(screen.getByLabelText(/Quantidade por 1 Gramas/i)).toHaveAttribute('inputMode', 'decimal');
    });

    it('não utiliza dark:, -gray- ou cores literais hardcoded em PreparoInterno.tsx (migração para tokens F0.5)', () => {
      esperarSemCoresLiterais('src/pages/PreparoInterno.tsx');
    });
  });
});
