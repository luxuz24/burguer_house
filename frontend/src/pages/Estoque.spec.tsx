import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Estoque from './Estoque';
import { categoriaDoInsumo } from '../lib/categoriaInsumo';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { renderComProviders } from '../test/render';
import { api } from '../lib/api';
import {
  mockListaInsumos,
  mockInsumoBruto,
  mockInsumoBeneficiado,
  mockErroUnidadeComVinculos,
  mockErroInsumoComVinculoDeletar,
} from '../test/fixtures/insumos.fixture';
import {
  mockListaProdutos,
  mockErroColisaoNomeProduto,
} from '../test/fixtures/produtos.fixture';
import { mockUsuarioGerente, mockUsuarioOperador } from '../test/fixtures/auth.fixture';

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
    const abaProdutos = screen.getByRole('tab', { name: /Prontos/i });
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
    const abaProdutos = screen.getByRole('tab', { name: /Prontos/i });
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

    const abaProdutos = screen.getByRole('tab', { name: /Prontos/i });
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

  it('trocar de produto via conflito 409 exibe loading e reseta o formulário de renomear com nova key', async () => {
    let resolverProd2!: (val: { status: number; data: unknown }) => void;
    const promessaProd2 = new Promise<{ status: number; data: unknown }>((res) => {
      resolverProd2 = res;
    });

    const prod1 = { id: 'prod-001', nome: 'X-Salada', fichasTecnicas: [] };
    const prod2 = { id: 'prod-002', nome: 'X-Bacon', fichasTecnicas: [] };

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': [],
          '/produtos': [prod1, prod2],
          '/produtos/prod-001': prod1,
          '/produtos/prod-002': () => promessaProd2,
        },
        put: {
          '/produtos/prod-001': {
            status: 409,
            data: {
              message: 'Já existe um produto cadastrado com este nome.',
              produtoConflito: { id: 'prod-002', nome: 'X-Bacon' },
            },
          },
        },
      },
    });

    // Navega para aba de produtos
    const abaProdutos = screen.getByRole('tab', { name: /Prontos/i });
    fireEvent.click(abaProdutos);

    // Clica no produto X-Salada para abrir sua Ficha Técnica
    await waitFor(() => {
      expect(screen.getByText('X-Salada')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('X-Salada'));

    // Aguarda carregar Ficha Técnica do X-Salada
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /X-Salada/i })).toBeInTheDocument();
    });

    // Clica para renomear e digita "X-Bacon"
    fireEvent.click(screen.getByRole('button', { name: /Renomear produto/i }));
    const inputRenomear = screen.getByRole('textbox', { name: /Editar nome do produto/i });
    fireEvent.change(inputRenomear, { target: { value: 'X-Bacon' } });

    // Salva o nome gerando o 409
    fireEvent.click(screen.getByRole('button', { name: /Salvar nome do produto/i }));

    // Alerta de conflito surge na tela com opção de abrir produto existente
    await waitFor(() => {
      expect(screen.getByText(/Já existe:/i)).toBeInTheDocument();
      expect(screen.getByText('X-Bacon')).toBeInTheDocument();
    });

    const btnAbrirExistente = screen.getByRole('button', { name: /Abrir produto existente/i });
    fireEvent.click(btnAbrirExistente);

    // 1. Durante a carga de prod-002: exibe o estado de carregamento e o campo de renomear NÃO vaza aberto
    expect(screen.getByText('Carregando Ficha Técnica...')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Editar nome do produto/i })).not.toBeInTheDocument();

    // 2. Libera a resposta de prod-002
    await act(async () => {
      resolverProd2({ status: 200, data: prod2 });
    });

    // 3. Após carregar o X-Bacon: a ficha do X-Bacon é exibida e o campo de renomear permanece fechado
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /X-Bacon/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: /Editar nome do produto/i })).not.toBeInTheDocument();
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

    const cardInsumo = await screen.findByRole('button', {
      name: `Gerenciar ${mockInsumoBruto.nome}`,
    });
    fireEvent.click(cardInsumo);

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

    const cardInsumo = await screen.findByRole('button', {
      name: `Gerenciar ${mockInsumoBruto.nome}`,
    });
    fireEvent.click(cardInsumo);

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
    // O Sheet do insumo deve permanecer aberto após erro 409
    expect(screen.getByRole('button', { name: `Excluir ${mockInsumoBruto.nome}` })).toBeInTheDocument();
  });

  it('garante que edicao de insumo via PUT nao envia estoqueAtual no corpo e atualiza o card ao salvar', async () => {
    let payloadPut: Record<string, unknown> | null = null;
    let insumosAtuais = [{ ...mockInsumoBruto }];

    renderComProviders(<Estoque />, {
      routes: {
        get: {
          '/insumos': () => insumosAtuais,
        },
        put: {
          [`/insumos/${mockInsumoBruto.id}`]: (_url: string, body?: unknown) => {
            payloadPut = body as Record<string, unknown>;
            const atualizado = { ...mockInsumoBruto, ...payloadPut };
            insumosAtuais = [atualizado];
            return atualizado;
          },
        },
      },
    });

    const cardInsumo = await screen.findByRole('button', {
      name: `Gerenciar ${mockInsumoBruto.nome}`,
    });
    fireEvent.click(cardInsumo);

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
    expect(await screen.findByText('Carne Moída Especial')).toBeInTheDocument();
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

  it('impede submissão de insumo com nome vazio sem realizar requisição', async () => {
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

    const botaoSalvar = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(botaoSalvar);

    expect(postSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/O nome do insumo é obrigatório/i)).toBeInTheDocument();
    });
  });

  describe('busca', () => {
    it('ignora acento: "pao" encontra "Pão Brioche"', async () => {
      renderComProviders(<Estoque />, { routes: { get: { '/insumos': mockListaInsumos } } });
      await screen.findByText('Pão Brioche');
      fireEvent.change(screen.getByLabelText('Buscar insumo'), { target: { value: 'pao' } });
      expect(screen.getByText('Pão Brioche')).toBeInTheDocument();
      expect(screen.queryByText('Carne de Hambúrguer')).not.toBeInTheDocument();
    });

    it('sem resultado diz "nenhum encontrado" em todos os filtros, e não "tudo em ordem"', async () => {
      renderComProviders(<Estoque />, { routes: { get: { '/insumos': mockListaInsumos } } });
      await screen.findByText('Pão Brioche');
      fireEvent.change(screen.getByLabelText('Buscar insumo'), { target: { value: 'xyz' } });
      expect(screen.getByText('Nenhum insumo encontrado')).toBeInTheDocument();

      // Pão Brioche está abaixo do mínimo: "Tudo em ordem por aqui" seria falso
      fireEvent.click(screen.getByRole('button', { name: /Alertas/ }));
      expect(screen.getByText('Nenhum insumo encontrado')).toBeInTheDocument();
      expect(screen.queryByText('Tudo em ordem por aqui')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Preparo Interno/ }));
      expect(screen.getByText('Nenhum insumo encontrado')).toBeInTheDocument();
      expect(screen.queryByText('Nenhum item de preparo interno')).not.toBeInTheDocument();
    });

    it('na aba Produtos também avisa quando nada corresponde, e ignora acento', async () => {
      renderComProviders(<Estoque />, { routes: { get: { '/insumos': mockListaInsumos, '/produtos': mockListaProdutos } } });
      await screen.findByText('Pão Brioche');
      fireEvent.click(screen.getByRole('tab', { name: /Prontos/i }));
      await screen.findByText('X-Bacon House');
      fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'BÁCON' } });
      expect(screen.getByText('X-Bacon House')).toBeInTheDocument();
      expect(screen.queryByText('X-Burguer Tradicional')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'xyz' } });
      expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
    });
  });

  describe('vendas retidas na aba Produtos (tarefa 09)', () => {
    const retidas = {
      retidas: [
        {
          id: 'v-1',
          externalId: 'ped-700',
          criadoEm: '2026-11-13T18:00:00.000Z',
          check: 1,
          motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'X-Tudo' }],
        },
      ],
      resumoPorProduto: [
        { produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 2 },
        { produto: 'X-Burguer Tradicional', tipo: 'PRODUTO_SEM_FICHA', vendas: 1 },
      ],
      aguardandoEstado: 2,
      totalRetidas: 3,
      totalPendentesAnalisadas: 8,
      totalPendentes: 8,
      limite: 200,
      offset: 0,
      temMais: false,
    };

    it('exibe resumo acionável na aba Produtos: "Criar produto" pré-preenche nome e "Montar ficha" abre FichaTecnica', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
            '/produtos': mockListaProdutos,
            '/produtos/prod-001': mockListaProdutos[0],
            '/vendas/retidas': retidas,
          },
        },
      });

      await screen.findByText('Pão Brioche');
      fireEvent.click(screen.getByRole('tab', { name: /Prontos/i }));

      expect(await screen.findByText('3 vendas retidas')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Criar produto X-Tudo/i }));
      const inputNome = await screen.findByLabelText('Nome do novo produto');
      expect((inputNome as HTMLInputElement).value).toBe('X-Tudo');

      // Fecha Sheet e testa o atalho direto para montar a ficha de produto já existente
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
      fireEvent.click(screen.getByRole('button', { name: /Montar ficha de X-Burguer Tradicional/i }));
      expect(await screen.findByRole('heading', { name: 'X-Burguer Tradicional' })).toBeInTheDocument();
    });

    it('COLISAO_NOME filtra a busca na aba Produtos e exibe lista detalhada ao expandir', async () => {
      renderComProviders(<Estoque destinoInicial={{ seq: 1, aba: 'produtos' }} />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
            '/produtos': mockListaProdutos,
            '/vendas/retidas': {
              ...retidas,
              resumoPorProduto: [{ produto: 'X-Bacon', tipo: 'COLISAO_NOME', vendas: 1 }],
            },
          },
        },
      });

      await screen.findByText('X-Bacon House');
      fireEvent.click(screen.getByRole('button', { name: /Revisar X-Bacon no cardápio/i }));
      expect((screen.getByLabelText('Buscar produto') as HTMLInputElement).value).toBe('X-Bacon');

      fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/i }));
      expect(screen.getByText(/Pedido ped-700/)).toBeInTheDocument();
      expect(screen.getByText(/2 pedidos aguardando confirmação de status/)).toBeInTheDocument();
    });

    it('Carregar próximas mantém o resumo e atalho da primeira página junto com os da segunda', async () => {
      let chamadas = 0;
      renderComProviders(<Estoque destinoInicial={{ seq: 1, aba: 'produtos' }} />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
            '/produtos': mockListaProdutos,
            '/vendas/retidas': () => {
              chamadas++;
              if (chamadas === 1) {
                return {
                  retidas: [
                    {
                      id: 'v-p1',
                      externalId: 'ped-p1',
                      criadoEm: '2026-11-16T15:00:00.000Z',
                      check: 1,
                      motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'Lanche A' }],
                    },
                  ],
                  resumoPorProduto: [{ produto: 'Lanche A', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 }],
                  aguardandoEstado: 1,
                  totalRetidas: 1,
                  totalPendentesAnalisadas: 200,
                  totalPendentes: 250,
                  limite: 200,
                  offset: 0,
                  temMais: true,
                };
              }
              return {
                retidas: [
                  {
                    id: 'v-p2',
                    externalId: 'ped-p2',
                    criadoEm: '2026-11-16T16:00:00.000Z',
                    check: 1,
                    motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'Lanche B' }],
                  },
                ],
                resumoPorProduto: [{ produto: 'Lanche B', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 }],
                aguardandoEstado: 2,
                totalRetidas: 1,
                totalPendentesAnalisadas: 50,
                totalPendentes: 250,
                limite: 200,
                offset: 200,
                temMais: false,
              };
            },
          },
        },
      });

      expect(await screen.findByText('1 venda retida')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/i }));
      fireEvent.click(screen.getByRole('button', { name: /Carregar próximas/i }));

      expect(await screen.findByText('2 vendas retidas')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Criar produto Lanche A' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Criar produto Lanche B' })).toBeInTheDocument();
    });
  });

  describe('ações de insumo dentro do Sheet (tarefa 07)', () => {
    it('card não exibe ícones soltos de Editar/Excluir e tocar no card abre Sheet com Editar e Excluir >= 44px', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');
      expect(screen.queryByRole('button', { name: 'Editar Carne de Hambúrguer' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Excluir Carne de Hambúrguer' })).not.toBeInTheDocument();

      // Tocar em "Produzir" continua abrindo PreparoInterno sem abrir o Sheet de ações
      expect(screen.getByRole('button', { name: 'Produzir Maionese da Casa' })).toBeInTheDocument();

      const cardCarne = screen.getByRole('button', { name: 'Gerenciar Carne de Hambúrguer' });
      expect(cardCarne.className).toContain('min-h-[44px]');
      expect(screen.getByRole('heading', { level: 3, name: 'Carne de Hambúrguer' })).toBeInTheDocument();
      expect(cardCarne).toHaveAccessibleDescription(/Estoque:.*mínimo/i);
      expect(cardCarne.querySelector('h1, h2, h3, h4, h5, h6, div, p')).toBeNull();
      const descId = cardCarne.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      expect(cardCarne.contains(document.getElementById(descId!))).toBe(false);
      fireEvent.click(cardCarne);

      const dialogo = await screen.findByRole('dialog', { name: 'Carne de Hambúrguer' });
      expect(dialogo).toBeInTheDocument();

      const btnEditar = screen.getByRole('button', { name: 'Editar Carne de Hambúrguer' });
      const btnExcluir = screen.getByRole('button', { name: 'Excluir Carne de Hambúrguer' });
      expect(btnEditar.className).toContain('min-h-[44px]');
      expect(btnExcluir.className).toContain('min-h-[44px]');
    });

    it('excluir no Sheet pede confirmação: cancelar não chama DELETE e confirmar chama uma única vez (duplo clique)', async () => {
      let chamadasDelete = 0;
      let resolverDelete: ((v: unknown) => void) | null = null;
      let lista = [...mockListaInsumos];

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': () => lista,
          },
          delete: {
            [`/insumos/${mockInsumoBruto.id}`]: () => {
              chamadasDelete++;
              lista = lista.filter((i) => i.id !== mockInsumoBruto.id);
              return new Promise((resolve) => {
                resolverDelete = resolve;
              });
            },
          },
        },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar Carne de Hambúrguer' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Excluir Carne de Hambúrguer' }));

      // Cancelar no ConfirmDialog não chama DELETE, mantém Sheet aberto e libera o botão
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
      expect(chamadasDelete).toBe(0);
      const btnExcluir = screen.getByRole('button', { name: 'Excluir Carne de Hambúrguer' });
      expect(btnExcluir).toBeInTheDocument();
      await waitFor(() => expect(btnExcluir).not.toBeDisabled());

      // Duplo toque rápido em Excluir não abre duas confirmações; confirmar dispara DELETE uma única vez
      fireEvent.click(btnExcluir);
      fireEvent.click(btnExcluir);
      expect(btnExcluir).toBeDisabled();

      const btnApagar = await screen.findByRole('button', { name: 'Apagar' });
      fireEvent.click(btnApagar);
      fireEvent.click(btnApagar);

      await waitFor(() => {
        expect(chamadasDelete).toBe(1);
      });

      await act(async () => {
        resolverDelete?.({ ok: true });
      });

      await waitFor(() => {
        expect(screen.queryByText('Carne de Hambúrguer')).not.toBeInTheDocument();
      });
    });

    it('card expõe estoque/alerta na descrição acessível, exibe custo subcentavo sem arredondar e Cancelar na edição volta aos detalhes', async () => {
      const insumoSubcentavo = {
        ...mockInsumoBruto,
        id: 'ins-sub',
        nome: 'Queijo Cheddar',
        unidade: 'Gramas',
        estoqueAtual: 300,
        estoqueMinimo: 900,
        custoUnitario: 0.035,
      };

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': [insumoSubcentavo],
          },
        },
      });

      const cardQueijo = await screen.findByRole('button', { name: 'Gerenciar Queijo Cheddar' });
      expect(cardQueijo).toHaveAccessibleDescription(/Estoque: 300 Gramas.*Abaixo do mínimo \(900\)/i);

      fireEvent.click(cardQueijo);
      const dialogo = await screen.findByRole('dialog', { name: 'Queijo Cheddar' });
      expect(dialogo).toBeInTheDocument();
      expect(screen.getByText('R$ 0,035')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Queijo Cheddar' }));
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(await screen.findByRole('button', { name: 'Editar Queijo Cheddar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Excluir Queijo Cheddar' })).toBeInTheDocument();
    });
  });

  describe('abas por categoria no Estoque (tarefa 10)', () => {
    const insumoSemCategoria = {
      ...mockInsumoBruto,
      id: 'ins-sem-cat',
      nome: 'Bacon Defumado',
      estoqueAtual: 1000,
      estoqueMinimo: 200,
    };

    const embalagemAlerta = {
      ...mockInsumoBruto,
      id: 'emb-1',
      nome: 'Caixa Kraft Burger',
      unidade: 'Unidades',
      categoria: 'EMBALAGEM',
      estoqueAtual: 5,
      estoqueMinimo: 20,
    };

    const embalagemNormal = {
      ...mockInsumoBruto,
      id: 'emb-2',
      nome: 'Saco Delivery M',
      unidade: 'Unidades',
      categoria: 'EMBALAGEM',
      estoqueAtual: 100,
      estoqueMinimo: 20,
    };

    const bebidaNormal = {
      ...mockInsumoBruto,
      id: 'beb-1',
      nome: 'Coca-Cola 350ml',
      unidade: 'Unidades',
      categoria: 'BEBIDA',
      estoqueAtual: 50,
      estoqueMinimo: 12,
    };

    const bebidaAlerta = {
      ...mockInsumoBruto,
      id: 'beb-2',
      nome: 'Guaraná 350ml',
      unidade: 'Unidades',
      categoria: 'BEBIDA',
      estoqueAtual: 2,
      estoqueMinimo: 12,
    };

    const listaTresCategorias = [
      ...mockListaInsumos,
      insumoSemCategoria,
      embalagemAlerta,
      embalagemNormal,
      bebidaNormal,
      bebidaAlerta,
    ];

    it('helper categoriaDoInsumo trata ausência ou null de categoria como INGREDIENTE', () => {
      expect(categoriaDoInsumo({})).toBe('INGREDIENTE');
      expect(categoriaDoInsumo({ categoria: null })).toBe('INGREDIENTE');
      expect(categoriaDoInsumo({ categoria: 'INGREDIENTE' })).toBe('INGREDIENTE');
      expect(categoriaDoInsumo({ categoria: 'EMBALAGEM' })).toBe('EMBALAGEM');
      expect(categoriaDoInsumo({ categoria: 'BEBIDA' })).toBe('BEBIDA');
    });

    it('filtra por categoria no cliente em uma única requisição GET /insumos, com selos de alerta corretos', async () => {
      let chamadasGetInsumos = 0;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': () => {
              chamadasGetInsumos++;
              return listaTresCategorias;
            },
            '/produtos': mockListaProdutos,
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');
      expect(screen.getByText('Bacon Defumado')).toBeInTheDocument();
      expect(screen.queryByText('Caixa Kraft Burger')).not.toBeInTheDocument();
      expect(screen.queryByText('Coca-Cola 350ml')).not.toBeInTheDocument();

      const tablist = screen.getByRole('tablist');
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      expect(tabs.map((t) => t.textContent?.replace(/\d+/g, '').trim())).toEqual([
        'Insumos',
        'Embalagens',
        'Bebidas',
        'Prontos',
      ]);
      tabs.forEach((tab) => {
        expect(tab.className).toContain('min-h-[44px]');
      });

      const tabInsumos = screen.getByRole('tab', { name: /Insumos/i });
      const tabEmbalagens = screen.getByRole('tab', { name: /Embalagens/i });
      const tabBebidas = screen.getByRole('tab', { name: /Bebidas/i });
      const tabProntos = screen.getByRole('tab', { name: /Prontos/i });

      // Selo de alerta por categoria: Insumos tem 2 (Maionese vencida + Pão Brioche), Embalagens tem 1, Bebidas tem 1
      expect(tabInsumos).toHaveTextContent('2');
      expect(tabEmbalagens).toHaveTextContent('1');
      expect(tabBebidas).toHaveTextContent('1');
      expect(tabProntos).not.toHaveTextContent(/\d/);

      // Preparo Interno aparece apenas na aba Insumos
      expect(screen.getByRole('button', { name: /Preparo Interno/i })).toBeInTheDocument();

      // Troca para Embalagens (sem nova requisição HTTP)
      fireEvent.click(tabEmbalagens);
      expect(screen.getByText('Caixa Kraft Burger')).toBeInTheDocument();
      expect(screen.getByText('Saco Delivery M')).toBeInTheDocument();
      expect(screen.queryByText('Carne de Hambúrguer')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Preparo Interno/i })).not.toBeInTheDocument();

      // Troca para Bebidas
      fireEvent.click(tabBebidas);
      expect(screen.getByText('Coca-Cola 350ml')).toBeInTheDocument();
      expect(screen.queryByText('Caixa Kraft Burger')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Preparo Interno/i })).not.toBeInTheDocument();

      expect(chamadasGetInsumos).toBe(1);
    });

    it('omite selo de alerta quando a categoria não tem alertas', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': [insumoSemCategoria, embalagemNormal],
          },
        },
      });

      await screen.findByText('Bacon Defumado');
      expect(screen.getByRole('tab', { name: /^Insumos$/i })).not.toHaveTextContent(/\d/);
      expect(screen.getByRole('tab', { name: /^Embalagens$/i })).not.toHaveTextContent(/\d/);
      expect(screen.getByRole('tab', { name: /^Bebidas$/i })).not.toHaveTextContent(/\d/);
    });

    it('mantém busca ao trocar de aba e isola resultado por categoria', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': listaTresCategorias,
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');
      fireEvent.click(screen.getByRole('tab', { name: /Bebidas/i }));

      const inputBusca = screen.getByLabelText(/Buscar bebida/i);
      fireEvent.change(inputBusca, { target: { value: 'coca' } });
      expect(screen.getByText('Coca-Cola 350ml')).toBeInTheDocument();
      expect(screen.queryByText('Guaraná 350ml')).not.toBeInTheDocument();

      // Troca para Insumos mantendo "coca" digitado -> não mostra Coca-Cola
      fireEvent.click(screen.getByRole('tab', { name: /Insumos/i }));
      expect((screen.getByLabelText(/Buscar insumo/i) as HTMLInputElement).value).toBe('coca');
      expect(screen.queryByText('Coca-Cola 350ml')).not.toBeInTheDocument();
      expect(screen.getByText('Nenhum insumo encontrado')).toBeInTheDocument();
    });

    it('exibe estado vazio próprio em Embalagens e Bebidas quando não há itens', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');

      fireEvent.click(screen.getByRole('tab', { name: /Embalagens/i }));
      expect(
        screen.getByText('Nenhuma embalagem cadastrada. Toque em + para cadastrar.'),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /Bebidas/i }));
      expect(
        screen.getByText('Nenhuma bebida cadastrada. Toque em + para cadastrar.'),
      ).toBeInTheDocument();
    });

    it('botão + na aba Embalagens pré-define categoria EMBALAGEM no POST /insumos', async () => {
      let bodyEnviado: Record<string, unknown> | null = null;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': listaTresCategorias,
          },
          post: {
            '/insumos': (_url: string, payload: unknown) => {
              bodyEnviado = payload as Record<string, unknown>;
              return { ...embalagemNormal, id: 'emb-nova', nome: 'Copo 400ml' };
            },
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');
      fireEvent.click(screen.getByRole('tab', { name: /Embalagens/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Novo insumo' }));

      fireEvent.change(screen.getByLabelText('Nome do insumo'), { target: { value: 'Copo 400ml' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(bodyEnviado?.categoria).toBe('EMBALAGEM');
      });
    });

    it('navegação por teclado (ArrowRight / ArrowLeft) troca de aba e atualiza aria-selected', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': listaTresCategorias,
            '/produtos': mockListaProdutos,
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');

      const tabInsumos = screen.getByRole('tab', { name: /Insumos/i });
      const tabEmbalagens = screen.getByRole('tab', { name: /Embalagens/i });
      const tabBebidas = screen.getByRole('tab', { name: /Bebidas/i });
      const tabProntos = screen.getByRole('tab', { name: /Prontos/i });

      expect(tabInsumos).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(tabInsumos, { key: 'ArrowRight' });
      expect(tabEmbalagens).toHaveAttribute('aria-selected', 'true');
      expect(tabInsumos).toHaveAttribute('aria-selected', 'false');

      fireEvent.keyDown(tabEmbalagens, { key: 'ArrowRight' });
      expect(tabBebidas).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(tabBebidas, { key: 'ArrowRight' });
      expect(tabProntos).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(tabProntos, { key: 'ArrowLeft' });
      expect(tabBebidas).toHaveAttribute('aria-selected', 'true');
    });

    it('GET /insumos falhando e troca entre abas de insumos não repete o aviso de erro', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': { status: 500, data: { message: 'Falha ao carregar insumos do servidor' } },
          },
        },
      });

      expect(await screen.findAllByText('Falha ao carregar insumos do servidor')).toHaveLength(1);

      fireEvent.click(screen.getByRole('tab', { name: /Embalagens/i }));
      fireEvent.click(screen.getByRole('tab', { name: /Bebidas/i }));
      fireEvent.click(screen.getByRole('tab', { name: /Insumos/i }));

      expect(screen.getAllByText('Falha ao carregar insumos do servidor')).toHaveLength(1);
    });

    it('falhas seguidas de recarga com a mesma mensagem avisam todas as vezes, sem repetir ao trocar de aba', async () => {
      let chamadasGetInsumos = 0;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': () => {
              chamadasGetInsumos++;
              if (chamadasGetInsumos === 1) return mockListaInsumos;
              return { status: 500, data: { message: 'Falha ao sincronizar insumos' } };
            },
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');

      // 1ª falha de recarga ao voltar de Importar NF-e
      fireEvent.click(screen.getByRole('button', { name: 'Importar NF-e' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }));
      expect(await screen.findAllByText('Falha ao sincronizar insumos')).toHaveLength(1);

      // Troca entre abas não duplica o aviso da mesma falha
      fireEvent.click(screen.getByRole('tab', { name: /Embalagens/i }));
      fireEvent.click(screen.getByRole('tab', { name: /Bebidas/i }));
      fireEvent.click(screen.getByRole('tab', { name: /Insumos/i }));
      expect(screen.getAllByText('Falha ao sincronizar insumos')).toHaveLength(1);

      // 2ª falha seguida de recarga com a MESMA mensagem volta a avisar
      fireEvent.click(screen.getByRole('button', { name: 'Importar NF-e' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }));
      await waitFor(() => {
        expect(screen.getAllByText('Falha ao sincronizar insumos')).toHaveLength(2);
      });
    });
  });

  describe('categoria do insumo no cadastro e na edição (tarefa 11)', () => {
    it('abrir + na aba Embalagens pré-marca Embalagem, ajusta título do Sheet, oculta beneficiado/validade e envia categoria no POST', async () => {
      let bodyEnviado: Record<string, unknown> | null = null;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
          },
          post: {
            '/insumos': (_url: string, payload: unknown) => {
              bodyEnviado = payload as Record<string, unknown>;
              return { ...mockInsumoBruto, id: 'emb-99', nome: 'Copo 500ml', categoria: 'EMBALAGEM' };
            },
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');

      // Apenas a aba ativa deve apontar aria-controls para o painel montado
      expect(screen.getByRole('tab', { name: /Insumos/i })).toHaveAttribute('aria-controls', 'panel-insumos');
      expect(screen.getByRole('tab', { name: /Embalagens/i })).not.toHaveAttribute('aria-controls');

      fireEvent.click(screen.getByRole('tab', { name: /Embalagens/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Novo insumo' }));

      expect(await screen.findByRole('dialog', { name: 'Nova embalagem' })).toBeInTheDocument();
      const radiogroup = screen.getByRole('radiogroup', { name: 'Categoria' });
      expect(radiogroup).toBeInTheDocument();

      const radioIngrediente = screen.getByRole('radio', { name: 'Ingrediente' });
      const radioEmbalagem = screen.getByRole('radio', { name: 'Embalagem' });
      const radioBebida = screen.getByRole('radio', { name: 'Bebida' });

      expect(radioEmbalagem).toBeChecked();
      expect(radioIngrediente).not.toBeChecked();
      expect(radioIngrediente.closest('label')?.className).toContain('min-h-[44px]');
      expect(radioEmbalagem.closest('label')?.className).toContain('min-h-[44px]');
      expect(radioBebida.closest('label')?.className).toContain('min-h-[44px]');

      // Beneficiado e validade ficam ocultos em Embalagem
      expect(screen.queryByLabelText(/Produzido na casa/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Validade em dias/i)).not.toBeInTheDocument();

      // Trocar para Bebida muda o título do Sheet para "Nova bebida" e envia BEBIDA
      fireEvent.click(radioBebida);
      expect(screen.getByRole('dialog', { name: 'Nova bebida' })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Produzido na casa/i)).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Nome do insumo'), { target: { value: 'Refrigerante Lata' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(bodyEnviado?.categoria).toBe('BEBIDA');
      });
    });

    it('editar insumo INGREDIENTE e trocar para Bebida envia categoria BEBIDA no PUT, exibe toast "Movido para Bebidas." e move de aba', async () => {
      let lista = [
        { ...mockInsumoBruto, id: 'ins-1', nome: 'Coca Cola 600ml', categoria: 'INGREDIENTE' },
      ];
      let bodyPut: Record<string, unknown> | null = null;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': () => lista,
          },
          put: {
            '/insumos/ins-1': (_url: string, payload: unknown) => {
              bodyPut = payload as Record<string, unknown>;
              const atualizado = { ...lista[0], ...bodyPut };
              lista = [atualizado];
              return atualizado;
            },
          },
        },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar Coca Cola 600ml' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Editar Coca Cola 600ml' }));

      expect(screen.getByRole('radio', { name: 'Ingrediente' })).toBeChecked();
      expect(screen.getByLabelText(/Produzido na casa/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('radio', { name: 'Bebida' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(bodyPut?.categoria).toBe('BEBIDA');
      });
      expect(await screen.findByText('Movido para Bebidas.')).toBeInTheDocument();

      // Muda automaticamente para a aba Bebidas e o item não aparece mais na aba Insumos
      expect(screen.getByRole('tab', { name: /Bebidas/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Coca Cola 600ml')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /Insumos/i }));
      expect(screen.queryByText('Coca Cola 600ml')).not.toBeInTheDocument();
    });

    it('insumo novo marcado como beneficiado zera e oculta beneficiado/validade ao trocar para Embalagem', async () => {
      let bodyEnviado: Record<string, unknown> | null = null;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': mockListaInsumos,
          },
          post: {
            '/insumos': (_url: string, payload: unknown) => {
              bodyEnviado = payload as Record<string, unknown>;
              return { ...mockInsumoBruto, id: 'emb-100', nome: 'Caixa Nova', categoria: 'EMBALAGEM' };
            },
          },
        },
      });

      await screen.findByText('Carne de Hambúrguer');
      fireEvent.click(screen.getByRole('button', { name: 'Novo insumo' }));

      fireEvent.change(screen.getByLabelText('Nome do insumo'), { target: { value: 'Caixa Nova' } });
      fireEvent.click(screen.getByLabelText(/Produzido na casa/i));
      fireEvent.change(screen.getByLabelText(/Validade em dias/i), { target: { value: '3' } });

      // Trocar para Embalagem oculta e zera os campos de beneficiado
      fireEvent.click(screen.getByRole('radio', { name: 'Embalagem' }));
      expect(screen.queryByLabelText(/Produzido na casa/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Validade em dias/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(bodyEnviado).toMatchObject({
          categoria: 'EMBALAGEM',
          produzidoInternamente: false,
          validadeDias: null,
        });
      });
    });

    it('insumo beneficiado existente mantém campos de Beneficiado e Validade visíveis mesmo fora de Ingrediente e após desmarcar', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': [mockInsumoBeneficiado],
          },
        },
      });

      fireEvent.click(await screen.findByRole('button', { name: `Gerenciar ${mockInsumoBeneficiado.nome}` }));
      fireEvent.click(await screen.findByRole('button', { name: `Editar ${mockInsumoBeneficiado.nome}` }));

      const checkbox = screen.getByLabelText(/Produzido na casa/i);
      expect(checkbox).toBeChecked();
      expect(screen.getByLabelText(/Validade em dias/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('radio', { name: 'Bebida' }));
      expect(checkbox).toBeChecked();
      expect(screen.getByLabelText(/Validade em dias/i)).toBeInTheDocument();

      // Desmarcar o checkbox em um item que já era beneficiado não faz o campo sumir
      fireEvent.click(checkbox);
      expect(screen.getByLabelText(/Produzido na casa/i)).not.toBeChecked();
    });

    it('erro 400 na troca de categoria mantém o Sheet aberto com a mensagem do backend e trava duplo clique', async () => {
      let chamadasPut = 0;
      let rejeitarPut!: (err: unknown) => void;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': [{ ...mockInsumoBruto, categoria: 'INGREDIENTE' }],
          },
          put: {
            [`/insumos/${mockInsumoBruto.id}`]: () => {
              chamadasPut++;
              return new Promise((_res, rej) => {
                rejeitarPut = rej;
              });
            },
          },
        },
      });

      fireEvent.click(await screen.findByRole('button', { name: `Gerenciar ${mockInsumoBruto.nome}` }));
      fireEvent.click(await screen.findByRole('button', { name: `Editar ${mockInsumoBruto.nome}` }));
      fireEvent.click(screen.getByRole('radio', { name: 'Embalagem' }));

      const btnSalvar = screen.getByRole('button', { name: 'Salvar' });
      fireEvent.click(btnSalvar);
      fireEvent.click(btnSalvar);

      expect(chamadasPut).toBe(1);
      expect(btnSalvar).toBeDisabled();

      await act(async () => {
        rejeitarPut({
          isAxiosError: true,
          response: { status: 400, data: { message: 'Categoria incompatível com validação' } },
        });
      });

      expect(await screen.findByText('Categoria incompatível com validação')).toBeInTheDocument();
      // Sheet permanece aberto com a opção Embalagem preservada
      expect(screen.getByRole('dialog', { name: 'Editar insumo' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Embalagem' })).toBeChecked();
    });
  });

  describe('entrada manual no Estoque (tarefa 15)', () => {
    it('botão "Entrada sem nota" (>= 44px) abre Entrada manual e sucesso recarrega a lista do Estoque', async () => {
      const paoBase = mockListaInsumos[2];
      let lista = [{ ...paoBase, estoqueAtual: 10 }];
      let chamadasGetInsumos = 0;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': () => {
              chamadasGetInsumos++;
              return lista;
            },
          },
          post: {
            '/estoque/entradas-manuais': () => {
              lista = [{ ...paoBase, estoqueAtual: 34 }];
              return {
                reaproveitado: false,
                chaveIdempotencia: '11111111-2222-4333-8444-555555555555',
                itens: [
                  {
                    insumoId: paoBase.id,
                    nome: paoBase.nome,
                    unidade: paoBase.unidade,
                    quantidade: 24,
                    saldoAnterior: 10,
                    saldoPosterior: 34,
                    custoUnitario: null,
                  },
                ],
                avisos: [],
              };
            },
          },
        },
      });

      await screen.findByText('Pão Brioche');
      expect(screen.getByText('10 Unidade')).toBeInTheDocument();

      const btnEntradaSemNota = screen.getByRole('button', { name: 'Entrada sem nota' });
      expect(btnEntradaSemNota.className).toContain('min-h-[44px]');
      fireEvent.click(btnEntradaSemNota);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Entrada manual' }),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
        target: { value: paoBase.id },
      });
      fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '24' } });
      fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

      await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));

      await screen.findByText('34 Unidade');
      expect(chamadasGetInsumos).toBeGreaterThanOrEqual(2);
    });
  });

  describe('histórico de movimentações no Sheet do insumo (tarefa 16)', () => {
    it('Sheet do insumo exibe seção Movimentações e reflete entrada manual recém-registrada ao voltar ao Estoque', async () => {
      const paoBase = mockListaInsumos[2];
      let lista = [{ ...paoBase, estoqueAtual: 10 }];
      let movimentacoes = [
        {
          id: 'mov-antiga',
          tipo: 'ENTRADA_MANUAL',
          quantidade: 10,
          saldoAnterior: 0,
          saldoPosterior: 10,
          custoUnitario: 1.5,
          observacao: 'Saldo inicial',
          criadoEm: '2026-11-15T14:00:00.000Z',
          insumo: { id: paoBase.id, nome: paoBase.nome, unidade: paoBase.unidade },
          usuario: { id: 'u-1', nome: 'Carlos Eduardo' },
        },
      ];
      let chamadasMovimentacoes = 0;

      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': () => lista,
            '/estoque/movimentacoes': () => {
              chamadasMovimentacoes++;
              return {
                total: movimentacoes.length,
                limite: 20,
                offset: 0,
                movimentacoes,
              };
            },
          },
          post: {
            '/estoque/entradas-manuais': () => {
              lista = [{ ...paoBase, estoqueAtual: 34, custoUnitario: 1.75 }];
              movimentacoes = [
                {
                  id: 'mov-nova',
                  tipo: 'ENTRADA_MANUAL',
                  quantidade: 24,
                  saldoAnterior: 10,
                  saldoPosterior: 34,
                  custoUnitario: 1.75,
                  observacao: 'Compra urgente padaria',
                  criadoEm: '2026-11-16T16:10:00.000Z',
                  insumo: { id: paoBase.id, nome: paoBase.nome, unidade: paoBase.unidade },
                  usuario: { id: 'u-1', nome: 'Carlos Eduardo' },
                },
                ...movimentacoes,
              ];
              return {
                reaproveitado: false,
                chaveIdempotencia: '11111111-2222-4333-8444-555555555555',
                itens: [
                  {
                    insumoId: paoBase.id,
                    nome: paoBase.nome,
                    unidade: paoBase.unidade,
                    quantidade: 24,
                    saldoAnterior: 10,
                    saldoPosterior: 34,
                    custoUnitario: 1.75,
                  },
                ],
                avisos: [],
              };
            },
          },
        },
      });

      // Abre Sheet antes da entrada manual
      fireEvent.click(await screen.findByRole('button', { name: `Gerenciar ${paoBase.nome}` }));
      expect(await screen.findByRole('heading', { name: /Movimentações/i })).toBeInTheDocument();
      expect(await screen.findByText('Saldo inicial')).toBeInTheDocument();
      const chamadasAntes = chamadasMovimentacoes;

      // Fecha Sheet e registra entrada manual
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Entrada sem nota' }));

      await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
      fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
        target: { value: paoBase.id },
      });
      fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '24' } });
      fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), { target: { value: '1,75' } });
      fireEvent.change(screen.getByLabelText(/Observação/i), {
        target: { value: 'Compra urgente padaria' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

      await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));

      await screen.findByText('34 Unidade');

      // Reabre Sheet e confirma que o histórico refletiu a entrada manual recém-criada
      fireEvent.click(screen.getByRole('button', { name: `Gerenciar ${paoBase.nome}` }));
      expect(await screen.findByText('Compra urgente padaria')).toBeInTheDocument();
      expect(screen.getByText('+24 un')).toBeInTheDocument();
      expect(screen.getByText(/saldo 10 → 34 un/i)).toBeInTheDocument();
      expect(chamadasMovimentacoes).toBeGreaterThan(chamadasAntes);
    });
  });

  describe('contagem de estoque e texto do Sheet (tarefa 21)', () => {
    it('E1: OPERADOR não vê o botão "Contagem"; GERENTE vê (>= 44px), registra contagem e Estoque + histórico refletem o ajuste', async () => {
      const paoBase = mockListaInsumos[2];
      let lista = [{ ...paoBase, estoqueAtual: 10 }];
      let movs = [
        {
          id: 'mov-0',
          tipo: 'ENTRADA_MANUAL',
          quantidade: 10,
          saldoAnterior: 0,
          saldoPosterior: 10,
          custoUnitario: null,
          observacao: 'Saldo inicial',
          criadoEm: '2026-11-16T14:00:00.000Z',
          insumo: { id: paoBase.id, nome: paoBase.nome, unidade: paoBase.unidade },
          usuario: { id: 'u-1', nome: 'Carlos Eduardo' },
        },
      ];

      // 1. Papel OPERADOR não vê "Contagem"
      const { unmount } = renderComProviders(<Estoque />, {
        usuario: mockUsuarioOperador,
        verificarSessao: false,
        routes: { get: { '/insumos': lista } },
      });
      await screen.findByText('Pão Brioche');
      expect(screen.queryByRole('button', { name: /Contagem/i })).not.toBeInTheDocument();
      unmount();

      // 2. Papel GERENTE vê "Contagem", abre a tela, envia ajuste e volta com saldo e histórico atualizados
      renderComProviders(<Estoque />, {
        usuario: mockUsuarioGerente,
        verificarSessao: false,
        routes: {
          get: {
            '/insumos': () => lista,
            '/estoque/movimentacoes': () => ({
              total: movs.length,
              limite: 20,
              offset: 0,
              movimentacoes: movs,
            }),
          },
          post: {
            '/estoque/ajustes': () => {
              lista = [{ ...paoBase, estoqueAtual: 25 }];
              movs = [
                {
                  id: 'mov-ajuste-1',
                  tipo: 'AJUSTE',
                  quantidade: 15,
                  saldoAnterior: 10,
                  saldoPosterior: 25,
                  custoUnitario: null,
                  observacao: 'Contagem inicial',
                  criadoEm: '2026-11-17T12:00:00.000Z',
                  insumo: { id: paoBase.id, nome: paoBase.nome, unidade: paoBase.unidade },
                  usuario: { id: 'u-gerente-1', nome: 'Ana Paula Gerente' },
                },
                ...movs,
              ];
              return {
                reaproveitado: false,
                chaveIdempotencia: 'chave-contagem-123',
                itens: [
                  {
                    insumoId: paoBase.id,
                    nome: paoBase.nome,
                    unidade: paoBase.unidade,
                    saldoAnterior: 10,
                    saldoContado: 25,
                    diferenca: 15,
                  },
                ],
              };
            },
          },
        },
      });

      const btnContagem = await screen.findByRole('button', { name: 'Contagem' });
      expect(btnContagem.className).toContain('min-h-[44px]');
      fireEvent.click(btnContagem);

      await screen.findByRole('heading', { level: 1, name: 'Contagem de estoque' });
      fireEvent.change(screen.getByLabelText(`Contado de ${paoBase.nome}`), {
        target: { value: '25' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Contagem inicial' }));
      fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

      await screen.findByRole('heading', { level: 1, name: 'Contagem registrada' });
      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));

      await screen.findByText('25 Unidade');
      fireEvent.click(screen.getByRole('button', { name: `Gerenciar ${paoBase.nome}` }));
      expect(await screen.findByText('Ajuste')).toBeInTheDocument();
      expect(screen.getByText('+15 un')).toBeInTheDocument();
      expect(screen.getByText(/saldo 10 → 25 un/i)).toBeInTheDocument();
    });

    it('E2: Sheet de detalhes do insumo exibe texto atualizado e ADMIN também vê botão Contagem', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': [mockInsumoBruto],
            '/estoque/movimentacoes': {
              total: 0,
              limite: 20,
              offset: 0,
              movimentacoes: [],
            },
          },
        },
      });

      expect(await screen.findByRole('button', { name: 'Contagem' })).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: `Gerenciar ${mockInsumoBruto.nome}` }),
      );
      expect(
        await screen.findByText(
          'Muda só por NF, entrada sem nota, contagem, perdas, vendas e produção.',
        ),
      ).toBeInTheDocument();
    });

    it('E3: usuário deslogado oculta Contagem; abas/filtro Preparo Interno e atalhos Home/End/ArrowLeft/ArrowRight', async () => {
      const rDeslogado = renderComProviders(<Estoque />, {
        autenticado: false,
        verificarSessao: false,
        routes: { get: { '/insumos': [], '/produtos': [] } },
      });
      expect(screen.queryByRole('button', { name: /Contagem/i })).not.toBeInTheDocument();
      rDeslogado.unmount();

      const ingredienteComum = {
        ...mockInsumoBruto,
        id: 'ins-comum-f4',
        nome: 'Carne Acém Teste',
        categoria: 'INGREDIENTE',
        produzidoInternamente: false,
      };
      const ingredientePreparo = {
        ...mockInsumoBruto,
        id: 'ins-prep-f4',
        nome: 'Molho Casa Teste',
        categoria: 'INGREDIENTE',
        produzidoInternamente: true,
      };
      const embalagemTeste = {
        ...mockInsumoBruto,
        id: 'ins-emb-f4',
        nome: 'Caixa Kraft Teste',
        categoria: 'EMBALAGEM',
        produzidoInternamente: false,
      };

      renderComProviders(<Estoque />, {
        verificarSessao: false,
        routes: {
          get: {
            '/insumos': [ingredienteComum, ingredientePreparo, embalagemTeste],
            '/produtos': [],
          },
        },
      });

      await screen.findByText('Carne Acém Teste');

      const tabInsumos = screen.getByRole('tab', { name: /Insumos/i });
      const tabEmbalagens = screen.getByRole('tab', { name: /Embalagens/i });
      const tabProdutos = screen.getByRole('tab', { name: /Prontos/i });
      expect(tabInsumos.id).toBe('tab-insumos');
      expect(tabInsumos.tabIndex).toBe(0);
      expect(tabInsumos.className).toContain('bg-card');
      expect(tabEmbalagens.tabIndex).toBe(-1);
      expect(tabEmbalagens.className).toContain('text-muted');

      const painel = screen.getByRole('tabpanel');
      expect(painel.id).toBe('panel-insumos');
      expect(painel).toHaveAttribute('aria-labelledby', 'tab-insumos');

      // Filtro Preparo Interno filtra na aba Insumos e reseta para Todos ao sair da aba Insumos
      fireEvent.click(screen.getByRole('button', { name: /Preparo Interno/i }));
      expect(screen.getByText('Molho Casa Teste')).toBeInTheDocument();
      expect(screen.queryByText('Carne Acém Teste')).not.toBeInTheDocument();

      fireEvent.click(tabEmbalagens);
      expect(await screen.findByText('Caixa Kraft Teste')).toBeInTheDocument();
      fireEvent.click(tabInsumos);
      expect(screen.getByText('Carne Acém Teste')).toBeInTheDocument();
      expect(screen.getByText('Molho Casa Teste')).toBeInTheDocument();

      // Navegação por teclado nas abas (End -> Home -> ArrowLeft -> Enter -> ArrowRight) e ações ocultas em Prontos
      fireEvent.keyDown(tabInsumos, { key: 'End' });
      expect(screen.getByRole('tabpanel').id).toBe('panel-produtos');
      expect(document.activeElement).toBe(tabProdutos);
      expect(screen.queryByRole('button', { name: /Contagem/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Entrada sem nota/i })).not.toBeInTheDocument();

      fireEvent.keyDown(tabProdutos, { key: 'Enter' });
      expect(screen.getByRole('tabpanel').id).toBe('panel-produtos');

      fireEvent.keyDown(tabProdutos, { key: 'Home' });
      expect(screen.getByRole('tabpanel').id).toBe('panel-insumos');
      expect(document.activeElement).toBe(tabInsumos);
      expect(screen.getByRole('button', { name: /Entrada sem nota/i })).toBeInTheDocument();

      fireEvent.keyDown(tabInsumos, { key: 'ArrowLeft' });
      expect(screen.getByRole('tabpanel').id).toBe('panel-produtos');

      fireEvent.keyDown(tabProdutos, { key: 'ArrowRight' });
      expect(screen.getByRole('tabpanel').id).toBe('panel-insumos');
    });
  });

  it('não utiliza dark:, -gray- ou cores literais hardcoded em Estoque.tsx (migração para tokens F0.5)', () => {
    esperarSemCoresLiterais('src/pages/Estoque.tsx');
  });
});
