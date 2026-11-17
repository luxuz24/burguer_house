import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  HistoricoMovimentacoes,
  type MovimentacaoEstoqueItem,
  type RespostaMovimentacoesEstoque,
} from './HistoricoMovimentacoes';
import { api } from '../lib/api';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

function criarMovimentacao(
  overrides: Partial<MovimentacaoEstoqueItem> = {},
): MovimentacaoEstoqueItem {
  return {
    id: 'mov-1',
    tipo: 'ENTRADA_MANUAL',
    quantidade: 24,
    saldoAnterior: 10,
    saldoPosterior: 34,
    custoUnitario: 3.05,
    observacao: 'Nota perdida - Atacadão',
    criadoEm: '2026-11-16T16:10:00.000Z',
    insumo: {
      id: 'ins-1',
      nome: 'Coca Cola Zero 350ml',
      unidade: 'Unidade',
    },
    usuario: {
      id: 'usr-1',
      nome: 'Carlos Eduardo',
    },
    ...overrides,
  };
}

function ultimoParamsMovimentacoes(): { insumoId?: string; limite?: number; offset?: number } | undefined {
  const chamada = [...vi.mocked(api.get).mock.calls]
    .reverse()
    .find(([url]) => url === '/estoque/movimentacoes');
  return (chamada?.[1] as { params?: { insumoId?: string; limite?: number; offset?: number } } | undefined)
    ?.params;
}

describe('components/HistoricoMovimentacoes (tarefa 16)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('T1: lista as 20 movimentações mais recentes na ordem recebida com saldo, custo, observação e usuário', async () => {
    const resposta: RespostaMovimentacoesEstoque = {
      total: 2,
      limite: 20,
      offset: 0,
      movimentacoes: [
        criarMovimentacao({
          id: 'mov-2',
          tipo: 'ENTRADA_MANUAL',
          quantidade: 24,
          saldoAnterior: 10,
          saldoPosterior: 34,
          custoUnitario: 3.05,
          observacao: 'Nota perdida - Atacadão',
          criadoEm: '2026-11-16T16:10:00.000Z',
          usuario: { id: 'u-1', nome: 'Carlos Eduardo' },
        }),
        criarMovimentacao({
          id: 'mov-1',
          tipo: 'ENTRADA_MANUAL',
          quantidade: 10,
          saldoAnterior: 0,
          saldoPosterior: 10,
          custoUnitario: null,
          observacao: 'Estoque inicial',
          criadoEm: '2026-11-15T14:00:00.000Z',
          usuario: { id: 'u-2', nome: 'Ana Maria' },
        }),
      ],
    };

    renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-1" unidadeInsumo="Unidade" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': resposta,
          },
        },
      },
    );

    expect(await screen.findByText('Nota perdida - Atacadão')).toBeInTheDocument();
    expect(screen.getByText('Estoque inicial')).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith('/estoque/movimentacoes', {
      params: { insumoId: 'ins-1', limite: 20 },
    });

    expect(screen.getByRole('heading', { name: /Movimentações/i })).toBeInTheDocument();
    expect(screen.getAllByText('Entrada manual')).toHaveLength(2);
    expect(screen.getByText('+24 un')).toBeInTheDocument();
    expect(screen.getByText('+10 un')).toBeInTheDocument();
    expect(screen.getByText(/saldo 10 → 34 un/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo 0 → 10 un/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*3,05\/un/)).toBeInTheDocument();
    expect(screen.getByText('Carlos Eduardo')).toBeInTheDocument();
    expect(screen.getByText('Ana Maria')).toBeInTheDocument();

    // Ordem recebida (mais recente primeiro no DOM)
    const maisRecente = screen.getByText('Nota perdida - Atacadão');
    const maisAntiga = screen.getByText('Estoque inicial');
    expect(
      maisRecente.compareDocumentPosition(maisAntiga) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('T2: exibe "Usuário removido" quando usuario é null', async () => {
    const resposta: RespostaMovimentacoesEstoque = {
      total: 1,
      limite: 20,
      offset: 0,
      movimentacoes: [
        criarMovimentacao({
          id: 'mov-null-user',
          usuario: null,
          observacao: 'Compra antiga',
        }),
      ],
    };

    renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-1" unidadeInsumo="Unidade" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': resposta,
          },
        },
      },
    );

    expect(await screen.findByText('Usuário removido')).toBeInTheDocument();
    expect(screen.getByText('Compra antiga')).toBeInTheDocument();
  });

  it('T3: "Ver tudo" pede limite=50 com total, "Carregar mais" usa offset sem duplicar no duplo clique e some ao carregar tudo', async () => {
    const todasMovs = Array.from({ length: 55 }, (_, i) => {
      const numero = 55 - i;
      return criarMovimentacao({
        id: `mov-${numero}`,
        quantidade: 1,
        saldoAnterior: numero - 1,
        saldoPosterior: numero,
        custoUnitario: null,
        observacao: `Lote #${numero}`,
        criadoEm: '2026-11-16T15:00:00.000Z',
      });
    });

    let chamadasOffset50 = 0;
    let resolverOffset50!: (v: RespostaMovimentacoesEstoque) => void;

    renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-1" unidadeInsumo="Unidade" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': () => {
              const params = ultimoParamsMovimentacoes();
              const limite = params?.limite ?? 20;
              const offset = params?.offset ?? 0;

              if (limite === 50 && offset === 50) {
                chamadasOffset50++;
                return new Promise<RespostaMovimentacoesEstoque>((resolve) => {
                  resolverOffset50 = resolve;
                });
              }

              return {
                total: 55,
                limite,
                offset,
                movimentacoes: todasMovs.slice(offset, offset + limite),
              } satisfies RespostaMovimentacoesEstoque;
            },
          },
        },
      },
    );

    // Carga inicial: 20 mais recentes
    expect(await screen.findByText('Lote #55')).toBeInTheDocument();
    expect(screen.getByText('Lote #36')).toBeInTheDocument();
    expect(screen.queryByText('Lote #35')).not.toBeInTheDocument();

    const btnVerTudo = screen.getByRole('button', { name: /Ver tudo/i });
    expect(btnVerTudo.className).toContain('min-h-[44px]');
    fireEvent.click(btnVerTudo);

    // Após "Ver tudo": pede limite=50, mostra até Lote #6 e exibe total 55
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/estoque/movimentacoes', {
        params: { insumoId: 'ins-1', limite: 50 },
      });
    });
    expect(await screen.findByText('Lote #6')).toBeInTheDocument();
    expect(screen.getByText('50 de 55')).toBeInTheDocument();

    const btnCarregarMais = screen.getByRole('button', { name: /Carregar mais/i });
    expect(btnCarregarMais.className).toContain('min-h-[44px]');

    // Duplo clique rápido antes da resposta terminar deve gerar apenas 1 requisição offset=50
    fireEvent.click(btnCarregarMais);
    fireEvent.click(btnCarregarMais);

    expect(chamadasOffset50).toBe(1);
    expect(api.get).toHaveBeenCalledWith('/estoque/movimentacoes', {
      params: { insumoId: 'ins-1', limite: 50, offset: 50 },
    });

    // Resolve com os 5 restantes + 1 item repetido (Lote #6) para provar deduplicação
    await act(async () => {
      resolverOffset50({
        total: 55,
        limite: 50,
        offset: 50,
        movimentacoes: [todasMovs[49], ...todasMovs.slice(50, 55)],
      });
    });

    expect(await screen.findByText('Lote #1')).toBeInTheDocument();
    expect(screen.getByText('55 de 55')).toBeInTheDocument();
    expect(screen.getAllByText('Lote #6')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Carregar mais/i })).not.toBeInTheDocument();
  });

  it('T4: exibe estado vazio e erro de carga com botão "Tentar novamente" (>= 44px)', async () => {
    // 1. Estado vazio
    const { unmount } = renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-vazio" unidadeInsumo="Unidade" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': {
              total: 0,
              limite: 20,
              offset: 0,
              movimentacoes: [],
            },
          },
        },
      },
    );

    expect(await screen.findByText('Nenhuma movimentação manual neste insumo.')).toBeInTheDocument();
    unmount();

    // 2. Erro de carga + Tentar novamente
    let tentativa = 0;
    renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-erro" unidadeInsumo="Gramas" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': () => {
              tentativa++;
              if (tentativa === 1) {
                return { status: 500, data: { message: 'Falha ao consultar histórico no banco.' } };
              }
              return {
                total: 1,
                limite: 20,
                offset: 0,
                movimentacoes: [
                  criarMovimentacao({
                    id: 'mov-ok',
                    quantidade: 5000,
                    saldoAnterior: 1000,
                    saldoPosterior: 6000,
                    custoUnitario: 0.0349,
                    observacao: 'Reposição após falha',
                    insumo: { id: 'ins-erro', nome: 'Carne', unidade: 'Gramas' },
                  }),
                ],
              };
            },
          },
        },
      },
    );

    expect(await screen.findByText('Falha ao consultar histórico no banco.')).toBeInTheDocument();
    const btnTentar = screen.getByRole('button', { name: /Tentar novamente/i });
    expect(btnTentar.className).toContain('min-h-[44px]');
    fireEvent.click(btnTentar);

    expect(await screen.findByText('Reposição após falha')).toBeInTheDocument();
    expect(screen.getByText('+5.000 g')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,0349\/g/)).toBeInTheDocument();
  });

  it('T5: formata data/hora no fuso de Mato Grosso do Sul (2026-11-17T03:30:00Z = 16/11, 23:30)', async () => {
    renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-1" unidadeInsumo="Unidade" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': {
              total: 1,
              limite: 20,
              offset: 0,
              movimentacoes: [
                criarMovimentacao({
                  id: 'mov-fuso',
                  criadoEm: '2026-11-17T03:30:00Z',
                  observacao: 'Madrugada UTC / Noite MS',
                }),
              ],
            },
          },
        },
      },
    );

    expect(await screen.findByText('16/11, 23:30')).toBeInTheDocument();
    expect(screen.queryByText(/17\/11/)).not.toBeInTheDocument();
  });

  it('T6: formata variação com sinal pelo valor (+ / −) e exibe tipo desconhecido com nome cru', async () => {
    renderComProviders(
      <HistoricoMovimentacoes insumoId="ins-1" unidadeInsumo="Unidade" />,
      {
        verificarSessao: false,
        routes: {
          get: {
            '/estoque/movimentacoes': {
              total: 3,
              limite: 20,
              offset: 0,
              movimentacoes: [
                criarMovimentacao({
                  id: 'mov-ajuste-neg',
                  tipo: 'AJUSTE',
                  quantidade: -5,
                  saldoAnterior: 20,
                  saldoPosterior: 15,
                  custoUnitario: null,
                  observacao: 'Contagem física menor',
                }),
                criarMovimentacao({
                  id: 'mov-ajuste-positivo-saldo-menor',
                  tipo: 'AJUSTE',
                  quantidade: 3,
                  saldoAnterior: 15,
                  saldoPosterior: 12,
                  custoUnitario: null,
                  observacao: 'Ajuste redução com quantidade positiva',
                }),
                criarMovimentacao({
                  id: 'mov-desconhecido',
                  tipo: 'TRANSFERENCIA_LOJA',
                  quantidade: 8,
                  saldoAnterior: 12,
                  saldoPosterior: 20,
                  custoUnitario: null,
                  observacao: 'Veio de outra unidade',
                }),
              ],
            },
          },
        },
      },
    );

    expect(await screen.findAllByText('Ajuste')).toHaveLength(2);
    expect(screen.getByText('−5 un')).toBeInTheDocument();
    expect(screen.getByText(/saldo 20 → 15 un/i)).toBeInTheDocument();
    expect(screen.getByText('−3 un')).toBeInTheDocument();
    expect(screen.getByText(/saldo 15 → 12 un/i)).toBeInTheDocument();

    expect(screen.getByText('TRANSFERENCIA_LOJA')).toBeInTheDocument();
    expect(screen.getByText('+8 un')).toBeInTheDocument();
  });

  it('T7: usa apenas tokens de design em HistoricoMovimentacoes.tsx (sem cores literais)', () => {
    esperarSemCoresLiterais('src/components/HistoricoMovimentacoes.tsx');
  });
});
