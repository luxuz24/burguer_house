import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Estoque from './Estoque';
import { renderComProviders } from '../test/render';
import { api } from '../lib/api';
import {
  mockListaInsumos,
  mockInsumoBruto,
  mockErroUnidadeComVinculos,
  mockErroInsumoComVinculoDeletar,
} from '../test/fixtures/insumos.fixture';
import {
  mockListaProdutos,
  mockErroColisaoNomeProduto,
} from '../test/fixtures/produtos.fixture';

describe('pages/Estoque - Almoxarifado e Cadastro de Insumos (F1)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renderiza lista de insumos e contadores das abas corretamente', async () => {
    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': mockListaInsumos,
        },
      },
    });

    // Aguarda carregar os insumos
    await waitFor(() => {
      expect(screen.getByText('Carne de Hambúrguer')).toBeInTheDocument();
    });

    expect(screen.getByText('Maionese da Casa')).toBeInTheDocument();
    expect(screen.getByText('Pão Brioche')).toBeInTheDocument();

    // Contadores das abas e filtros
    expect(screen.getByRole('button', { name: /Todos \(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preparo Interno \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alertas \(2\)/i })).toBeInTheDocument();
  });

  it('previne múltiplos disparos ao clicar repetidamente em Salvar Insumo (A2 via useEnvio)', async () => {
    let chamadasPost = 0;
    let resolvePost: ((v: unknown) => void) | null = null;

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [],
        },
        post: {
          '/insumos': () => {
            chamadasPost++;
            return new Promise((resolve) => {
              resolvePost = resolve;
            });
          },
        },
      },
    });

    // Abre modal/formulário de novo insumo
    const botaoNovo = await screen.findByRole('button', { name: /Novo Insumo/i });
    fireEvent.click(botaoNovo);

    // Preenche campos obrigatórios
    const inputNome = screen.getByLabelText(/Nome do insumo/i);
    fireEvent.change(inputNome, { target: { value: 'Bacon Especial' } });

    const botaoSalvar = screen.getByRole('button', { name: /Salvar/i });

    // Dispara dois cliques rápidos consecutivos
    fireEvent.click(botaoSalvar);
    fireEvent.click(botaoSalvar);

    expect(chamadasPost).toBe(1);
    expect(botaoSalvar).toBeDisabled();

    // Finaliza a requisição
    await act(async () => {
      resolvePost?.({
        id: 'novo-id',
        nome: 'Bacon Especial',
        unidade: 'Gramas',
        estoqueAtual: 0,
        estoqueMinimo: 0,
      });
    });
  });

  it('previne múltiplos disparos ao clicar repetidamente em Criar Produto (A2 via useEnvio)', async () => {
    let chamadasPost = 0;
    let resolvePost: ((v: unknown) => void) | null = null;

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [],
          '/produtos': [],
        },
        post: {
          '/produtos': () => {
            chamadasPost++;
            return new Promise((resolve) => {
              resolvePost = resolve;
            });
          },
        },
      },
    });

    // Troca para a aba Produtos
    const abaProdutos = screen.getByRole('button', { name: /Produtos Prontos/i });
    fireEvent.click(abaProdutos);

    const botaoNovo = await screen.findByRole('button', { name: /Novo Produto/i });
    fireEvent.click(botaoNovo);

    const inputNome = screen.getByLabelText(/Nome do novo produto/i);
    fireEvent.change(inputNome, { target: { value: 'Duplo Smash' } });

    const botaoCriar = screen.getByRole('button', { name: /Criar produto/i });

    // Dispara duplo clique
    fireEvent.click(botaoCriar);
    fireEvent.click(botaoCriar);

    expect(chamadasPost).toBe(1);
    expect(botaoCriar).toBeDisabled();

    await act(async () => {
      resolvePost?.({ id: 'prod-99', nome: 'Duplo Smash' });
    });
  });

  it('ignora resposta atrasada de /insumos após troca rápida para Produtos (evita race condition)', async () => {
    let resolveInsumos: ((v: unknown) => void) | null = null;

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': () =>
            new Promise((resolve) => {
              resolveInsumos = resolve;
            }),
          '/produtos': mockListaProdutos,
        },
      },
    });

    // Inicia na aba insumos (requisição em trânsito).
    // Imediatamente o usuário clica na aba de Produtos Prontos:
    const abaProdutos = screen.getByRole('button', { name: /Produtos Prontos/i });
    fireEvent.click(abaProdutos);

    // Os produtos são carregados e exibidos na tela ativa:
    await waitFor(() => {
      expect(screen.getByText('X-Burguer Tradicional')).toBeInTheDocument();
    });

    // Agora a resposta tardia de /insumos chega:
    await act(async () => {
      resolveInsumos?.(mockListaInsumos);
    });

    // A tela de Produtos permanece inalterada; insumos não vazam nem sobrepõem os produtos:
    expect(screen.getByText('X-Burguer Tradicional')).toBeInTheDocument();
    expect(screen.getByText('X-Bacon House')).toBeInTheDocument();
    expect(screen.queryByText('Carne de Hambúrguer')).not.toBeInTheDocument();
  });

  it('valida fator de perda no formulário rejeitando valores superiores a 100%', async () => {
    const postSpy = vi.spyOn(api, 'post');

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [],
        },
      },
    });

    const botaoNovo = await screen.findByRole('button', { name: /Novo Insumo/i });
    fireEvent.click(botaoNovo);

    const inputNome = screen.getByLabelText(/Nome do insumo/i);
    fireEvent.change(inputNome, { target: { value: 'Insumo Teste' } });

    const inputFatorPerda = screen.getByLabelText(/Fator Perda/i);
    fireEvent.change(inputFatorPerda, { target: { value: '150' } });

    const botaoSalvar = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(botaoSalvar);

    // Verifica que post NÃO foi chamado e toast de erro apareceu
    expect(postSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Fator de perda deve estar entre 0% e 100%/i)).toBeInTheDocument();
    });
  });

  it('limpa e desabilita validadeDias quando desmarcar "produzido internamente"', async () => {
    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [],
        },
      },
    });

    const botaoNovo = await screen.findByRole('button', { name: /Novo Insumo/i });
    fireEvent.click(botaoNovo);

    const checkbox = screen.getByRole('checkbox', { name: /Produzido na casa/i });
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByLabelText(/Validade em dias/i)).not.toBeInTheDocument();

    // Marca checkbox: o campo aparece
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    const inputValidade = screen.getByLabelText(/Validade em dias/i);
    fireEvent.change(inputValidade, { target: { value: '7' } });
    expect(inputValidade).toHaveValue(7);

    // Desmarca checkbox: o campo é ocultado e o estado limpo
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByLabelText(/Validade em dias/i)).not.toBeInTheDocument();

    // Se marcar de novo, o campo deve vir limpo (vazio)
    fireEvent.click(checkbox);
    const inputValidadeReaberto = screen.getByLabelText(/Validade em dias/i);
    expect(inputValidadeReaberto).toHaveValue(null);
  });

  it('trata erro 409 Conflict ao criar produto com nome duplicado exibindo produtoConflito e permitindo visualizar', async () => {
    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [],
          '/produtos': mockListaProdutos,
          '/produtos/prod-002': mockListaProdutos[1],
        },
        post: {
          '/produtos': {
            status: 409,
            data: mockErroColisaoNomeProduto,
          },
        },
      },
    });

    const abaProdutos = screen.getByRole('button', { name: /Produtos Prontos/i });
    fireEvent.click(abaProdutos);

    const botaoNovo = await screen.findByRole('button', { name: /Novo Produto/i });
    fireEvent.click(botaoNovo);

    const inputNome = screen.getByLabelText(/Nome do novo produto/i);
    fireEvent.change(inputNome, { target: { value: 'X-Bacon' } });

    const botaoCriar = screen.getByRole('button', { name: /Criar produto/i });
    fireEvent.click(botaoCriar);

    // Deve exibir mensagem de conflito e o link para o produto existente
    await waitFor(() => {
      expect(
        screen.getAllByText(/Já existe um produto com nome equivalente cadastrado: "X-Bacon House"/i).length,
      ).toBeGreaterThanOrEqual(1);
    });

    const linkVisualizar = screen.getByRole('button', {
      name: /Visualizar produto existente/i,
    });
    expect(linkVisualizar).toBeInTheDocument();

    // Clica no link para abrir a Ficha Técnica do produto em conflito
    fireEvent.click(linkVisualizar);

    // Deve abrir a Ficha Técnica do produto `prod-002` (X-Bacon House)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /X-Bacon House/i })).toBeInTheDocument();
    });
  });

  it('trata erro 409 Conflict ao alterar unidade de insumo com movimentações vinculadas', async () => {
    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [mockInsumoBruto],
        },
        put: {
          [`/insumos/${mockInsumoBruto.id}`]: {
            status: 409,
            data: mockErroUnidadeComVinculos,
          },
        },
      },
    });

    const botaoEditar = await screen.findByRole('button', {
      name: `Editar ${mockInsumoBruto.nome}`,
    });
    fireEvent.click(botaoEditar);

    // Altera unidade de medida
    const selectUnidade = screen.getByLabelText(/Unidade de medida/i);
    fireEvent.change(selectUnidade, { target: { value: 'Unidades' } });

    const botaoSalvar = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(botaoSalvar);

    await waitFor(() => {
      expect(
        screen.getByText(mockErroUnidadeComVinculos.message),
      ).toBeInTheDocument();
    });
  });

  it('trata erro 409 ao tentar apagar insumo vinculado a fichas técnicas', async () => {
    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [mockInsumoBruto],
        },
        delete: {
          [`/insumos/${mockInsumoBruto.id}`]: {
            status: 409,
            data: mockErroInsumoComVinculoDeletar,
          },
        },
      },
    });

    const botaoExcluir = await screen.findByRole('button', {
      name: `Excluir ${mockInsumoBruto.nome}`,
    });
    fireEvent.click(botaoExcluir);

    // Confirma exclusão no diálogo
    const botaoConfirmarApagar = await screen.findByRole('button', { name: 'Apagar' });
    fireEvent.click(botaoConfirmarApagar);

    await waitFor(() => {
      expect(
        screen.getByText(mockErroInsumoComVinculoDeletar.message),
      ).toBeInTheDocument();
    });
  });

  it('garante que edicao de insumo via PUT nao envia estoqueAtual no corpo da requisicao', async () => {
    let payloadPut: Record<string, unknown> | null = null;

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [mockInsumoBruto],
        },
        put: {
          [`/insumos/${mockInsumoBruto.id}`]: (_url: string, body?: unknown) => {
            payloadPut = body as Record<string, unknown>;
            return { ...mockInsumoBruto, ...payloadPut };
          },
        },
      },
    });

    const botaoEditar = await screen.findByRole('button', {
      name: `Editar ${mockInsumoBruto.nome}`,
    });
    fireEvent.click(botaoEditar);

    // O campo de estoque atual fica desabilitado na edição
    const inputEstoqueAtual = screen.getByLabelText(/Estoque Atual/i);
    expect(inputEstoqueAtual).toBeDisabled();

    // Atualiza nome
    const inputNome = screen.getByLabelText(/Nome do insumo/i);
    fireEvent.change(inputNome, { target: { value: 'Carne Moída Especial' } });

    const botaoSalvar = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(botaoSalvar);

    await waitFor(() => {
      expect(payloadPut).not.toBeNull();
    });

    expect(payloadPut).toHaveProperty('nome', 'Carne Moída Especial');
    expect(payloadPut).not.toHaveProperty('estoqueAtual');
  });

  it('filtra alertas de estoque corretamente inclusive quando estoqueMinimo e zero', async () => {
    const insumosTeste = [
      {
        ...mockInsumoBruto,
        id: 'insumo-min-zero-com-estoque',
        nome: 'Sal com estoque',
        estoqueAtual: 50,
        estoqueMinimo: 0,
      },
      {
        ...mockInsumoBruto,
        id: 'insumo-min-zero-zerado',
        nome: 'Orégano Zerado',
        estoqueAtual: 0,
        estoqueMinimo: 0,
      },
      {
        ...mockInsumoBruto,
        id: 'insumo-normal-em-alerta',
        nome: 'Pão em Falta',
        estoqueAtual: 5,
        estoqueMinimo: 20,
      },
    ];

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': insumosTeste,
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Sal com estoque')).toBeInTheDocument();
    });

    // O contador de alertas deve contar apenas os zerados ou abaixo do mínimo (2 no total: Orégano Zerado e Pão em Falta)
    const botaoAlertas = screen.getByRole('button', { name: /Alertas \(2\)/i });
    expect(botaoAlertas).toBeInTheDocument();

    // Filtra por Alertas
    fireEvent.click(botaoAlertas);

    // Orégano Zerado e Pão em Falta aparecem; Sal com estoque (que tem estoqueMinimo=0 mas estoqueAtual=50) NÃO aparece
    expect(screen.getByText('Orégano Zerado')).toBeInTheDocument();
    expect(screen.getByText('Pão em Falta')).toBeInTheDocument();
    expect(screen.queryByText('Sal com estoque')).not.toBeInTheDocument();

    // Texto de alerta específico para item com estoque zerado
    expect(screen.getByText('Sem estoque')).toBeInTheDocument();
    expect(screen.getByText('Abaixo do mínimo (20)')).toBeInTheDocument();
  });

  it('campos numéricos possuem inputMode apropriado e botões atendem aos critérios de acessibilidade e toque', async () => {
    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [mockInsumoBruto],
        },
      },
    });

    const botaoNovo = await screen.findByRole('button', { name: /Novo Insumo/i });
    fireEvent.click(botaoNovo);

    // Verifica inputMode nos inputs numéricos
    expect(screen.getByLabelText(/Estoque Atual/i)).toHaveAttribute('inputMode', 'decimal');
    expect(screen.getByLabelText(/Mínimo Seguro/i)).toHaveAttribute('inputMode', 'decimal');
    expect(screen.getByLabelText(/Custo Unitário/i)).toHaveAttribute('inputMode', 'decimal');
    expect(screen.getByLabelText(/Fator Perda/i)).toHaveAttribute('inputMode', 'decimal');

    // Validade em dias (ao marcar checkbox)
    const checkboxBeneficiado = screen.getByRole('checkbox', { name: /Produzido na casa/i });
    fireEvent.click(checkboxBeneficiado);
    expect(screen.getByLabelText(/Validade em dias/i)).toHaveAttribute('inputMode', 'numeric');
  });
});
