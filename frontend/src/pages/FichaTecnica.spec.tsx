import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FichaTecnica from './FichaTecnica';
import { renderComProviders } from '../test/render';
import {
  mockProdutoComFicha,
} from '../test/fixtures/produtos.fixture';
import { mockListaInsumos } from '../test/fixtures/insumos.fixture';

describe('pages/FichaTecnica - Engenharia de Cardápio e Fichas Técnicas (F2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // 🔴 1. Tela presa em “Carregando…” quando o produto não existe
  describe('🔴 1. Estado de erro e resiliência no carregamento', () => {
    it('com 404 em GET /produtos/:id, sai do loading, exibe "Produto não encontrado" e botão Voltar que chama onVoltar', async () => {
      const onVoltarMock = vi.fn();

      renderComProviders(<FichaTecnica produtoId="prod-inexistente" onVoltar={onVoltarMock} />, {
        routes: {
          get: {
            '/produtos/prod-inexistente': {
              status: 404,
              data: { message: 'Produto não encontrado' },
            },
            '/insumos': mockListaInsumos,
          },
        },
      });

      // Aguarda sair do spinner de carregamento inicial
      await waitFor(() => {
        expect(screen.queryByText('Carregando Ficha Técnica...')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: /Produto não encontrado/i })).toBeInTheDocument();

      const botaoVoltar = screen.getByRole('button', { name: /Voltar/i });
      expect(botaoVoltar).toBeInTheDocument();

      fireEvent.click(botaoVoltar);
      expect(onVoltarMock).toHaveBeenCalledTimes(1);
    });

    it('com 503 em GET /produtos/:id, exibe "Tentar novamente" e o clique refaz a chamada', async () => {
      let chamadas = 0;

      renderComProviders(<FichaTecnica produtoId="prod-503" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-503': () => {
              chamadas++;
              if (chamadas === 1) {
                return {
                  status: 503,
                  data: { message: 'Falha temporária no servidor' },
                };
              }
              return {
                status: 200,
                data: mockProdutoComFicha,
              };
            },
            '/insumos': mockListaInsumos,
          },
        },
      });

      // Aguarda erro inicial
      await waitFor(() => {
        expect(screen.getByText(/Erro ao carregar dados/i)).toBeInTheDocument();
      });

      expect(chamadas).toBe(1);

      const botaoTentar = screen.getByRole('button', { name: /Tentar novamente/i });
      fireEvent.click(botaoTentar);

      // Aguarda segunda chamada resolver com sucesso
      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      expect(chamadas).toBe(2);
    });

    it('se /produtos/:id funcionar e /insumos falhar, a ficha aparece normalmente e apenas o select indica falha', async () => {
      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': {
              status: 500,
              data: { message: 'Erro ao buscar insumos' },
            },
          },
        },
      });

      // A ficha técnica do produto é exibida normalmente
      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      expect(screen.getByText('Carne de Hambúrguer')).toBeInTheDocument();

      // Abrir o formulário de adicionar ingrediente
      const botaoAdicionar = screen.getByRole('button', { name: /Adicionar Insumo/i });
      fireEvent.click(botaoAdicionar);

      // O aviso sobre a lista de insumos deve estar presente com opção de tentar novamente
      await waitFor(() => {
        expect(screen.getByText('Erro ao buscar insumos')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
    });
  });

  // 🟡 2. A tela inteira vira spinner a cada alteração
  describe('🟡 2. Carregamento suave sem spinner de tela cheia nas mutações', () => {
    it('após adicionar ingrediente, a lista antiga continua visível na tela e o toast só aparece depois da atualização', async () => {
      let resolvePost: ((v: unknown) => void) | null = null;
      let resolveGetAtualizado: ((v: unknown) => void) | null = null;

      const postPromise = new Promise((res) => {
        resolvePost = res;
      });
      const getAtualizadoPromise = new Promise((res) => {
        resolveGetAtualizado = res;
      });

      let contagemGetProduto = 0;

      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': async () => {
              contagemGetProduto++;
              if (contagemGetProduto === 1) {
                return { status: 200, data: mockProdutoComFicha };
              }
              await getAtualizadoPromise;
              return {
                status: 200,
                data: {
                  ...mockProdutoComFicha,
                  fichasTecnicas: [
                    ...mockProdutoComFicha.fichasTecnicas!,
                    {
                      id: 'ft-003',
                      produtoId: 'prod-002',
                      insumoId: 'ins-queijo',
                      quantidade: 30,
                      insumo: { id: 'ins-queijo', nome: 'Queijo Prato', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 200 },
                    },
                  ],
                },
              };
            },
            '/insumos': [
              ...mockListaInsumos,
              { id: 'ins-queijo', nome: 'Queijo Prato', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 200 },
            ],
          },
          post: {
            '/fichas-tecnicas': async () => {
              await postPromise;
              return { status: 201, data: { id: 'ft-003' } };
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      // Abre form
      fireEvent.click(screen.getByRole('button', { name: /Adicionar Insumo/i }));

      // Seleciona o queijo
      fireEvent.change(screen.getByRole('combobox', { name: /Selecionar insumo/i }), {
        target: { value: 'ins-queijo' },
      });
      fireEvent.change(screen.getByRole('spinbutton', { name: /Quantidade utilizada/i }), {
        target: { value: '30' },
      });

      // Clica em confirmar
      const botaoConfirmar = screen.getByRole('button', { name: /Confirmar/i });
      fireEvent.click(botaoConfirmar);

      // A lista antiga de ingredientes continua no DOM (não sumiu substituída por spinner de tela cheia)
      expect(screen.getByText('Carne de Hambúrguer')).toBeInTheDocument();
      expect(screen.queryByText('Carregando Ficha Técnica...')).not.toBeInTheDocument();

      // O toast de sucesso NÃO deve ter aparecido ainda antes da resposta do POST e do recarregamento
      expect(screen.queryByText('Ingrediente vinculado à receita.')).not.toBeInTheDocument();

      // Libera POST
      await act(async () => {
        resolvePost!({ data: {} });
      });

      // Libera GET de atualização
      await act(async () => {
        resolveGetAtualizado!({ data: {} });
      });

      // Agora o toast aparece e o novo ingrediente é renderizado
      await waitFor(() => {
        expect(screen.getByText('Ingrediente vinculado à receita.')).toBeInTheDocument();
        expect(screen.getByText('Queijo Prato')).toBeInTheDocument();
      });
    });
  });

  // 🟡 3. Duplo clique em todas as ações que gravam (A2)
  describe('🟡 3. Prevenção de duplo clique via useEnvio (A2)', () => {
    it('dois cliques rápidos em "Confirmar" disparam apenas 1 POST /fichas-tecnicas', async () => {
      let chamadasPost = 0;
      let resolvePost: ((v: unknown) => void) | null = null;

      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': [
              ...mockListaInsumos,
              { id: 'ins-queijo', nome: 'Queijo Prato', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 200 },
            ],
          },
          post: {
            '/fichas-tecnicas': () => {
              chamadasPost++;
              return new Promise((res) => {
                resolvePost = res;
              });
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Insumo/i }));

      fireEvent.change(screen.getByRole('combobox', { name: /Selecionar insumo/i }), {
        target: { value: 'ins-queijo' },
      });
      fireEvent.change(screen.getByRole('spinbutton', { name: /Quantidade utilizada/i }), {
        target: { value: '50' },
      });

      const botaoConfirmar = screen.getByRole('button', { name: /Confirmar/i });

      // Dispara dois cliques simultâneos
      fireEvent.click(botaoConfirmar);
      fireEvent.click(botaoConfirmar);

      expect(chamadasPost).toBe(1);
      expect(screen.getByRole('button', { name: /Salvando.../i })).toBeDisabled();

      // Libera requisição
      await act(async () => {
        resolvePost!({ data: { id: 'ft-new' }, status: 201 });
      });
    });
  });

  // 🟡 4. Paridade do “desconto com perda” com o backend (A5)
  describe('🟡 4. Paridade do cálculo de desconto com perda (A5)', () => {
    // Casos confrontados diretamente com a fórmula do backend:
    // backend/src/modules/vendas/services/planejar_consolidacao.ts:197
    // fatorPerda = Math.max(0, ficha.insumo.fatorPerda || 0)
    // desconto = quantidade * (1 + fatorPerda)
    // backend/src/modules/vendas/services/consolidacao.service.ts:96
    // quantidadeArredondada = Number(info.desconto.toFixed(4))
    it('renderiza os 10 casos de desconto com perda com exata paridade com o backend', async () => {
      const produtoCasos = {
        id: 'prod-teste-a5',
        nome: 'Burger Teste A5',
        fichasTecnicas: [
          // 0.3333
          { id: 'f-1', insumoId: 'i-1', quantidade: 0.3333, insumo: { id: 'i-1', nome: 'Item Negativo Frac', unidade: 'g', fatorPerda: -0.1 } },
          { id: 'f-2', insumoId: 'i-2', quantidade: 0.3333, insumo: { id: 'i-2', nome: 'Item Nulo Frac', unidade: 'g', fatorPerda: null as unknown as number } },
          { id: 'f-3', insumoId: 'i-3', quantidade: 0.3333, insumo: { id: 'i-3', nome: 'Item Zero Frac', unidade: 'g', fatorPerda: 0 } },
          { id: 'f-4', insumoId: 'i-4', quantidade: 0.3333, insumo: { id: 'i-4', nome: 'Item 5pct Frac', unidade: 'g', fatorPerda: 0.05 } },
          { id: 'f-5', insumoId: 'i-5', quantidade: 0.3333, insumo: { id: 'i-5', nome: 'Item 100pct Frac', unidade: 'g', fatorPerda: 1 } },
          // 150
          { id: 'f-6', insumoId: 'i-6', quantidade: 150, insumo: { id: 'i-6', nome: 'Item Negativo Int', unidade: 'g', fatorPerda: -0.1 } },
          { id: 'f-7', insumoId: 'i-7', quantidade: 150, insumo: { id: 'i-7', nome: 'Item Nulo Int', unidade: 'g', fatorPerda: null as unknown as number } },
          { id: 'f-8', insumoId: 'i-8', quantidade: 150, insumo: { id: 'i-8', nome: 'Item Zero Int', unidade: 'g', fatorPerda: 0 } },
          { id: 'f-9', insumoId: 'i-9', quantidade: 150, insumo: { id: 'i-9', nome: 'Item 5pct Int', unidade: 'g', fatorPerda: 0.05 } },
          { id: 'f-10', insumoId: 'i-10', quantidade: 150, insumo: { id: 'i-10', nome: 'Item 100pct Int', unidade: 'g', fatorPerda: 1 } },
        ],
      };

      renderComProviders(<FichaTecnica produtoId="prod-teste-a5" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-teste-a5': produtoCasos,
            '/insumos': [],
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${produtoCasos.nome}`)).toBeInTheDocument();
      });

      // Validação dos textos formatados na tela:
      // 0.3333 com fator -0.1 -> backend = 0.3333 -> "0,3333 g"
      expect(screen.getAllByText('Desconto com perda: 0,3333 g').length).toBe(3); // cobre -0.1, null e 0
      // 0.3333 com fator 0.05 -> backend = 0.35 -> "0,35 g"
      expect(screen.getByText('Desconto com perda: 0,35 g')).toBeInTheDocument();
      // 0.3333 com fator 1 -> backend = 0.6666 -> "0,6666 g"
      expect(screen.getByText('Desconto com perda: 0,6666 g')).toBeInTheDocument();

      // 150 com fatores -0.1, null e 0 -> backend = 150 -> "150 g"
      expect(screen.getAllByText('Desconto com perda: 150 g').length).toBe(3);
      // 150 com fator 0.05 -> backend = 157.5 -> "157,5 g"
      expect(screen.getByText('Desconto com perda: 157,5 g')).toBeInTheDocument();
      // 150 com fator 1 -> backend = 300 -> "300 g"
      expect(screen.getByText('Desconto com perda: 300 g')).toBeInTheDocument();
    });

    it('trata fator de perda nulo na badge como 0% em vez de NaN%', async () => {
      const produtoComInsumoFatorNulo = {
        id: 'prod-fator-null',
        nome: 'Burger Fator Null',
        fichasTecnicas: [
          {
            id: 'ft-null',
            insumoId: 'ins-null',
            quantidade: 100,
            insumo: { id: 'ins-null', nome: 'Item Sem Perda', unidade: 'g', fatorPerda: null as unknown as number },
          },
        ],
      };

      renderComProviders(<FichaTecnica produtoId="prod-fator-null" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-fator-null': produtoComInsumoFatorNulo,
            '/insumos': [],
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Perda: 0%')).toBeInTheDocument();
      });
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });
  });

  // 🟡 5. Ingrediente apagado em outra aba (404) e corrida no 409
  describe('🟡 5. Tratamento de concorrência com 404 e 409 no vínculo de ingrediente', () => {
    it('quando POST /fichas-tecnicas retorna 404 (insumo excluído em outra aba), recarrega insumos e limpa seleção', async () => {
      let chamadasGetInsumos = 0;

      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': () => {
              chamadasGetInsumos++;
              if (chamadasGetInsumos === 1) {
                return {
                  data: [
                    ...mockListaInsumos,
                    { id: 'ins-apagado', nome: 'Molho Apagado', unidade: 'ml', fatorPerda: 0 },
                  ],
                  status: 200,
                };
              }
              return { data: mockListaInsumos, status: 200 };
            },
          },
          post: {
            '/fichas-tecnicas': {
              status: 404,
              data: { message: 'Insumo não encontrado' },
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Insumo/i }));

      const selectInsumo = screen.getByRole('combobox', { name: /Selecionar insumo/i });
      expect(screen.getByRole('option', { name: /Molho Apagado/i })).toBeInTheDocument();

      fireEvent.change(selectInsumo, { target: { value: 'ins-apagado' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: /Quantidade utilizada/i }), {
        target: { value: '20' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));

      // Aguarda tratamento do 404
      await waitFor(() => {
        expect(chamadasGetInsumos).toBe(2);
      });

      // O insumo foi removido da lista do select e a seleção foi resetada
      expect(screen.queryByRole('option', { name: /Molho Apagado/i })).not.toBeInTheDocument();
      expect(selectInsumo).toHaveValue('');
    });

    it('quando POST /fichas-tecnicas retorna 409 (ingrediente já na ficha), recarrega a ficha', async () => {
      let chamadasGetProduto = 0;

      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': () => {
              chamadasGetProduto++;
              return { data: mockProdutoComFicha, status: 200 };
            },
            '/insumos': [
              ...mockListaInsumos,
              { id: 'ins-ja-adicionado', nome: 'Alface', unidade: 'Unidade', fatorPerda: 0 },
            ],
          },
          post: {
            '/fichas-tecnicas': {
              status: 409,
              data: { message: 'Este ingrediente já faz parte da ficha técnica.' },
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Insumo/i }));

      fireEvent.change(screen.getByRole('combobox', { name: /Selecionar insumo/i }), {
        target: { value: 'ins-ja-adicionado' },
      });
      fireEvent.change(screen.getByRole('spinbutton', { name: /Quantidade utilizada/i }), {
        target: { value: '1' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));

      // Aguarda tratamento do 409 e recarga dos dados
      await waitFor(() => {
        expect(chamadasGetProduto).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // 🟡 6. Renomear e excluir o produto
  describe('🟡 6. Renomear e excluir o produto', () => {
    it('renomear com 400 (nome inválido): exibe mensagem e mantém campo de edição aberto com o texto digitado', async () => {
      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': mockListaInsumos,
          },
          put: {
            '/produtos/prod-002': {
              status: 400,
              data: { message: 'O nome deve conter pelo menos uma letra ou número' },
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      // Clica para renomear
      fireEvent.click(screen.getByRole('button', { name: /Renomear produto/i }));

      const inputNome = screen.getByRole('textbox', { name: /Editar nome do produto/i });
      fireEvent.change(inputNome, { target: { value: '---' } });

      fireEvent.click(screen.getByRole('button', { name: /Salvar nome do produto/i }));

      // O campo deve continuar aberto e preservando o texto digitado
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Editar nome do produto/i })).toBeInTheDocument();
      });
      expect(inputNome).toHaveValue('---');
    });

    it('renomear com 409 e produtoConflito: exibe aviso de conflito com o nome do produto existente e opção de abrir', async () => {
      const onSelecionarProdutoMock = vi.fn();

      renderComProviders(
        <FichaTecnica
          produtoId="prod-002"
          onVoltar={vi.fn()}
          onSelecionarProduto={onSelecionarProdutoMock}
        />,
        {
          routes: {
            get: {
              '/produtos/prod-002': mockProdutoComFicha,
              '/insumos': mockListaInsumos,
            },
            put: {
              '/produtos/prod-002': {
                status: 409,
                data: {
                  message: 'Já existe um produto com este nome',
                  produtoConflito: { id: 'prod-existente-099', nome: 'X-Bacon' },
                },
              },
            },
          },
        },
      );

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Renomear produto/i }));

      const inputNome = screen.getByRole('textbox', { name: /Editar nome do produto/i });
      fireEvent.change(inputNome, { target: { value: 'X-Bacon' } });

      fireEvent.click(screen.getByRole('button', { name: /Salvar nome do produto/i }));

      await waitFor(() => {
        expect(screen.getByText(/Já existe:/i)).toBeInTheDocument();
        expect(screen.getByText('X-Bacon')).toBeInTheDocument();
      });

      const botaoAbrir = screen.getByRole('button', { name: /Abrir produto existente/i });
      fireEvent.click(botaoAbrir);

      expect(onSelecionarProdutoMock).toHaveBeenCalledWith('prod-existente-099');
    });

    it('excluir com 404 (produto já havia sido excluído): trata como removido e chama onVoltar', async () => {
      const onVoltarMock = vi.fn();

      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={onVoltarMock} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': mockListaInsumos,
          },
          delete: {
            '/produtos/prod-002': {
              status: 404,
              data: { message: 'Produto não encontrado' },
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      // Clica em excluir
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Excluir produto ${mockProdutoComFicha.nome}`, 'i') }));

      // Confirma no modal de diálogo
      await waitFor(() => {
        expect(screen.getByText(/Deseja realmente excluir o produto/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Excluir produto' }));

      // Deve invocar onVoltar normalmente
      await waitFor(() => {
        expect(onVoltarMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  // 🟢 7. Detalhes
  describe('🟢 7. Validações e usabilidade de quantidades', () => {
    it('campos numéricos possuem inputMode="decimal"', async () => {
      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': mockListaInsumos,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      // Abre form de adicionar
      fireEvent.click(screen.getByRole('button', { name: /Adicionar Insumo/i }));
      const inputQtd = screen.getByRole('spinbutton', { name: /Quantidade utilizada/i });
      expect(inputQtd).toHaveAttribute('inputMode', 'decimal');

      // Abre edição de item existente
      const botaoEditar = screen.getByRole('button', { name: /Editar quantidade de Carne de Hambúrguer/i });
      fireEvent.click(botaoEditar);
      const inputEdit = screen.getByRole('spinbutton', { name: /Editar quantidade de Carne de Hambúrguer/i });
      expect(inputEdit).toHaveAttribute('inputMode', 'decimal');
    });

    it('bloqueia no cliente quantidade vazia, zero ou negativa ao tentar salvar com feedback explícito', async () => {
      let chamadasPost = 0;

      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': mockListaInsumos,
          },
          post: {
            '/fichas-tecnicas': () => {
              chamadasPost++;
              return { status: 201, data: {} };
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Insumo/i }));

      // Sem insumo selecionado
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
      });
      expect(chamadasPost).toBe(0);

      // Com insumo mas quantidade <= 0
      fireEvent.change(screen.getByRole('combobox', { name: /Selecionar insumo/i }), {
        target: { value: 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e' },
      });
      fireEvent.change(screen.getByRole('spinbutton', { name: /Quantidade utilizada/i }), {
        target: { value: '-5' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
      });
      expect(chamadasPost).toBe(0);
    });

    it('botões de ação possuem alvo de toque com dimensões mínimas de 44px', async () => {
      renderComProviders(<FichaTecnica produtoId="prod-002" onVoltar={vi.fn()} />, {
        routes: {
          get: {
            '/produtos/prod-002': mockProdutoComFicha,
            '/insumos': mockListaInsumos,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(`Ficha Técnica: ${mockProdutoComFicha.nome}`)).toBeInTheDocument();
      });

      const botaoVoltar = screen.getByRole('button', { name: /Voltar/i });
      expect(botaoVoltar.className).toContain('min-h-[44px]');
      expect(botaoVoltar.className).toContain('min-w-[44px]');

      const botaoEditar = screen.getByRole('button', { name: /Editar quantidade de Carne de Hambúrguer/i });
      expect(botaoEditar.className).toContain('min-h-[44px]');
      expect(botaoEditar.className).toContain('min-w-[44px]');

      const botaoRemover = screen.getByRole('button', { name: /Remover Carne de Hambúrguer/i });
      expect(botaoRemover.className).toContain('min-h-[44px]');
      expect(botaoRemover.className).toContain('min-w-[44px]');
    });
  });
});
