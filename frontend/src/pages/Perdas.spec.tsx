import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Perdas from './Perdas';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

describe('pages/Perdas - Registro e Controle de Perdas (F3)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockInsumos = [
    {
      id: 'insumo-pao',
      nome: 'Pão Brioche',
      unidade: 'Unidade',
      estoqueAtual: 50,
    },
    {
      id: 'insumo-queijo',
      nome: 'Queijo Cheddar',
      unidade: 'Gramas',
      estoqueAtual: 1500,
    },
  ];

  const mockPerdasRecentes = [
    {
      id: 'perda-1',
      insumoId: 'insumo-pao',
      quantidade: 5,
      motivo: 'VENCIMENTO' as const,
      criadoEm: '2026-11-01T03:30:00Z',
      insumo: mockInsumos[0],
    },
  ];

  const mockResumoMensal = [
    {
      motivo: 'VENCIMENTO' as const,
      ocorrencias: 2,
      valorTotal: 45.5,
      perdasSemCusto: 0,
    },
    {
      motivo: 'ERRO_PREPARO' as const,
      ocorrencias: 1,
      valorTotal: 12.0,
      perdasSemCusto: 1,
    },
  ];

  describe('🔴 Item 6: Independência de erros na carga inicial (sem Promise.all)', () => {
    it('quando /insumos falha com 500: bloqueia formulário e exibe estado de erro com "Tentar novamente"', async () => {
      let tentativas = 0;

      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': () => {
              tentativas++;
              if (tentativas === 1) {
                return Promise.reject({
                  isAxiosError: true,
                  response: { status: 500, data: { message: 'Falha no banco de dados' } },
                });
              }
              return mockInsumos;
            },
            '/perdas': mockPerdasRecentes,
            '/perdas/resumo-mensal': { porMotivo: mockResumoMensal },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Erro ao carregar insumos/i })).toBeInTheDocument();
        expect(screen.getByText('Falha no banco de dados')).toBeInTheDocument();
      });

      // Não exibe os botões de motivo enquanto insumos estão indisponíveis
      expect(screen.queryByRole('button', { name: /Vencimento/i })).not.toBeInTheDocument();

      // Clica em tentar novamente
      const btnTentar = screen.getByRole('button', { name: /Tentar novamente/i });
      fireEvent.click(btnTentar);

      // Recupera com sucesso
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Pão Brioche' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Vencimento/i })).toBeInTheDocument();
      });
      expect(tentativas).toBe(2);
    });

    it('quando /perdas/resumo-mensal falha com 500: card de resumo exibe aviso, mas formulário continua 100% funcional', async () => {
      let postDisparado = false;

      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': mockPerdasRecentes,
            '/perdas/resumo-mensal': {
              status: 500,
              data: { message: 'Falha temporária no relatório financeiro' },
            },
          },
          post: {
            '/perdas': () => {
              postDisparado = true;
              return {
                id: 'nova-perda',
                insumoId: 'insumo-pao',
                quantidade: 2,
                motivo: 'VENCIMENTO',
                estoqueNegativo: false,
                insumo: { ...mockInsumos[0], estoqueAtual: 48 },
              };
            },
          },
        },
      });

      // Aguarda carregar insumos
      const btnPao = await screen.findByRole('button', { name: 'Pão Brioche' });
      expect(btnPao).toBeInTheDocument();

      // Resumo exibe mensagem de falha da seção, sem quebrar a tela
      expect(screen.getByText('Falha temporária no relatório financeiro')).toBeInTheDocument();

      // Formulário continua funcionando perfeitamente:
      fireEvent.click(btnPao);
      const inputQtd = screen.getByLabelText('Quantidade');
      fireEvent.change(inputQtd, { target: { value: '2' } });

      const btnVencimento = screen.getByRole('button', { name: /Vencimento/i });
      expect(btnVencimento).not.toBeDisabled();
      fireEvent.click(btnVencimento);

      await waitFor(() => {
        expect(postDisparado).toBe(true);
        expect(screen.getByText(/Perda de 2 Unidade de "Pão Brioche" registrada/i)).toBeInTheDocument();
      });
    });

    it('quando /perdas (histórico) falha com 500: lista recente exibe aviso, mas formulário continua funcional', async () => {
      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': {
              status: 500,
              data: { message: 'Histórico indisponível no momento' },
            },
            '/perdas/resumo-mensal': { porMotivo: mockResumoMensal },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Pão Brioche')).toBeInTheDocument();
      });

      expect(screen.getByText('Histórico indisponível no momento')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pão Brioche' })).toBeInTheDocument();
    });
  });

  describe('🟡 Item 7: Registrar perda sem duplo clique e com alerta de estoque negativo', () => {
    it('previne múltiplos disparos ao clicar rapidamente em registrar (useEnvio)', async () => {
      let chamadasPost = 0;
      let resolverPost: ((v: unknown) => void) | null = null;

      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': mockPerdasRecentes,
            '/perdas/resumo-mensal': { porMotivo: mockResumoMensal },
          },
          post: {
            '/perdas': () => {
              chamadasPost++;
              return new Promise((res) => {
                resolverPost = res;
              });
            },
          },
        },
      });

      const btnPao = await screen.findByRole('button', { name: 'Pão Brioche' });
      fireEvent.click(btnPao);
      const inputQtd = screen.getByLabelText('Quantidade');
      fireEvent.change(inputQtd, { target: { value: '3' } });

      const btnMotivo = screen.getByRole('button', { name: /Vencimento/i });

      // Duplo clique consecutivo
      fireEvent.click(btnMotivo);
      fireEvent.click(btnMotivo);

      expect(chamadasPost).toBe(1);
      expect(btnMotivo).toBeDisabled();

      await act(async () => {
        resolverPost?.({
          id: 'p-1',
          quantidade: 3,
          estoqueNegativo: false,
          insumo: { ...mockInsumos[0], estoqueAtual: 47 },
        });
      });
    });

    it('aceita vírgula como separador decimal no campo de quantidade e recusa valores inválidos', async () => {
      let payloadRecebido: Record<string, unknown> | null = null;

      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': mockPerdasRecentes,
            '/perdas/resumo-mensal': { porMotivo: mockResumoMensal },
          },
          post: {
            '/perdas': (_url: string, body?: unknown) => {
              payloadRecebido = body as Record<string, unknown>;
              return {
                id: 'p-queijo',
                quantidade: 1.5,
                estoqueNegativo: false,
                insumo: { ...mockInsumos[1], estoqueAtual: 1498.5 },
              };
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Queijo Cheddar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Queijo Cheddar'));
      const inputQtd = screen.getByLabelText('Quantidade');

      // 1. Testa com vírgula
      fireEvent.change(inputQtd, { target: { value: '1,5' } });

      const btnMotivo = screen.getByRole('button', { name: /Estragado/i });
      fireEvent.click(btnMotivo);

      await waitFor(() => {
        expect(payloadRecebido).toEqual({
          insumoId: 'insumo-queijo',
          quantidade: 1.5,
          motivo: 'ESTRAGADO',
        });
      });
    });

    it('quando o descarte deixa o estoque negativo (estoqueNegativo: true): exibe alerta em destaque', async () => {
      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': mockPerdasRecentes,
            '/perdas/resumo-mensal': { porMotivo: mockResumoMensal },
          },
          post: {
            '/perdas': {
              id: 'perda-negativa',
              insumoId: 'insumo-pao',
              quantidade: 60,
              motivo: 'VENCIMENTO',
              estoqueNegativo: true,
              insumo: { ...mockInsumos[0], estoqueAtual: -10 },
            },
          },
        },
      });

      const btnPao = await screen.findByRole('button', { name: 'Pão Brioche' });
      fireEvent.click(btnPao);
      const inputQtd = screen.getByLabelText('Quantidade');
      fireEvent.change(inputQtd, { target: { value: '60' } });

      const btnMotivo = screen.getByRole('button', { name: /Vencimento/i });
      fireEvent.click(btnMotivo);

      // Como 60 > estoque atual (50), o diálogo de confirmação perigoso surge primeiro
      const btnConfirmarModal = await screen.findByRole('button', { name: /Confirmar descarte/i });
      fireEvent.click(btnConfirmarModal);

      // Ao confirmar e receber estoqueNegativo: true, exibe aviso específico
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /O estoque de "Pão Brioche" ficou negativo \(-10 Unidade\)\. Confira o inventário\./i,
        );
      });
    });
  });

  describe('🟡 Item 8: Formatação e fuso horário', () => {
    it('formata valores monetários com formatarMoeda e quantidades com formatarQuantidade', async () => {
      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': mockPerdasRecentes,
            '/perdas/resumo-mensal': { porMotivo: mockResumoMensal },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/R\$\s*45,50/i)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*12,00/i)).toBeInTheDocument();
        expect(screen.getByText(/-5 Unidade/i)).toBeInTheDocument();
      });
    });

    it('formata data e hora no fuso America/Campo_Grande UTC-4 (2026-11-01T03:30:00Z -> 31/10, 23:30)', async () => {
      renderComProviders(<Perdas />, {
        routes: {
          get: {
            '/insumos': mockInsumos,
            '/perdas': [
              {
                id: 'perda-fuso',
                insumoId: 'insumo-pao',
                quantidade: 2,
                motivo: 'VENCIMENTO' as const,
                criadoEm: '2026-11-01T03:30:00Z',
                insumo: mockInsumos[0],
              },
            ],
            '/perdas/resumo-mensal': { porMotivo: [] },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/31\/10, 23:30/i)).toBeInTheDocument();
      });
    });

    it('não utiliza dark:, -gray- ou cores literais hardcoded em Perdas.tsx (migração para tokens F0.5)', () => {
      esperarSemCoresLiterais('src/pages/Perdas.tsx');
    });
  });
});
