import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, renderHook } from '@testing-library/react';
import { FeedbackProvider, useFeedback } from './FeedbackContext';
import { renderComProviders } from '../test/render';
import { api } from '../lib/api';
import Estoque from '../pages/Estoque';

const mockReducedMotion = vi.fn(() => false);

vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return {
    ...mod,
    useReducedMotion: () => mockReducedMotion(),
  };
});

describe('FeedbackContext (Toasts e Diálogos de Confirmação)', () => {
  function TesteFeedback({ perigoso = false }: { perigoso?: boolean }) {
    const { toast, confirmar } = useFeedback();

    return (
      <div>
        <button type="button" onClick={() => toast.sucesso('Salvo com sucesso!')}>
          Disparar Sucesso
        </button>
        <button type="button" onClick={() => toast.erro('Ocorreu uma falha!')}>
          Disparar Erro
        </button>
        <button type="button" onClick={() => toast.info('Aviso informativo')}>
          Disparar Info
        </button>
        <button type="button" onClick={() => toast.aviso('Atenção ao estoque')}>
          Disparar Aviso
        </button>
        <button
          type="button"
          onClick={async () => {
            const resposta = await confirmar({
              titulo: 'Excluir Item',
              mensagem: 'Deseja realmente excluir este insumo?',
              textoConfirmar: 'Sim, excluir',
              textoCancelar: 'Não, manter',
              perigoso,
            });
            const statusEl = document.getElementById('resultado-confirmacao');
            if (statusEl) statusEl.textContent = resposta ? 'CONFIRMADO' : 'CANCELADO';
          }}
        >
          Abrir Confirmação
        </button>
        <div id="resultado-confirmacao">PENDENTE</div>
      </div>
    );
  }

  describe('Toasts', () => {
    it('renderiza toast de sucesso com classes e mensagem corretas', () => {
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar Sucesso'));
      const texto = screen.getByText('Salvo com sucesso!');
      expect(texto).toBeInTheDocument();

      const container = texto.parentElement;
      expect(container).toHaveClass('bg-card', 'border-success/30');
      const iconeContainer = container?.querySelector('.rounded-xl');
      expect(iconeContainer).toHaveClass('w-9', 'h-9', 'bg-success-soft', 'text-success');
    });

    it('renderiza toast de erro, info e aviso com suas respectivas classes de variante', () => {
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar Erro'));
      const textoErro = screen.getByText('Ocorreu uma falha!');
      expect(textoErro.parentElement).toHaveClass('border-danger/30');
      expect(textoErro.parentElement?.querySelector('.rounded-xl')).toHaveClass('bg-danger-soft', 'text-danger');

      fireEvent.click(screen.getByText('Disparar Info'));
      const textoInfo = screen.getByText('Aviso informativo');
      expect(textoInfo.parentElement).toHaveClass('border-secondary/30');
      expect(textoInfo.parentElement?.querySelector('.rounded-xl')).toHaveClass('bg-secondary-soft', 'text-secondary');

      fireEvent.click(screen.getByText('Disparar Aviso'));
      const textoAviso = screen.getByText('Atenção ao estoque');
      expect(textoAviso.parentElement).toHaveClass('border-primary/40');
      expect(textoAviso.parentElement?.querySelector('.rounded-xl')).toHaveClass('bg-primary-soft', 'text-brand');
    });

    it('useFeedback fora do provider lança erro descritivo', () => {
      expect(() => renderHook(() => useFeedback())).toThrow(
        'useFeedback deve ser usado dentro de um FeedbackProvider'
      );
    });

    it('permite fechar toast manualmente ao clicar no botão de fechar', async () => {
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar Sucesso'));
      expect(screen.getByText('Salvo com sucesso!')).toBeInTheDocument();

      const botaoFechar = screen.getByLabelText('Fechar notificação');
      await act(async () => {
        fireEvent.click(botaoFechar);
      });

      await waitFor(() => {
        expect(screen.queryByText('Salvo com sucesso!')).not.toBeInTheDocument();
      });
    });

    it('com múltiplos toasts na tela, fechar um mantém os outros visíveis', async () => {
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar Sucesso'));
      fireEvent.click(screen.getByText('Disparar Erro'));

      expect(screen.getByText('Salvo com sucesso!')).toBeInTheDocument();
      expect(screen.getByText('Ocorreu uma falha!')).toBeInTheDocument();

      const botoesFechar = screen.getAllByLabelText('Fechar notificação');
      await act(async () => {
        fireEvent.click(botoesFechar[0]!);
      });

      expect(screen.queryByText('Salvo com sucesso!')).not.toBeInTheDocument();
      expect(screen.getByText('Ocorreu uma falha!')).toBeInTheDocument();
    });

    it('com preferência por movimento reduzido (reduce motion), renderiza toast normalmente', () => {
      mockReducedMotion.mockReturnValue(true);
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar Sucesso'));
      expect(screen.getByText('Salvo com sucesso!')).toBeInTheDocument();
      mockReducedMotion.mockReturnValue(false);
    });
  });

  describe('Diálogo de Confirmação', () => {
    it('exibe confirmação com variante primary por padrão quando perigoso é falso', () => {
      render(
        <FeedbackProvider>
          <TesteFeedback perigoso={false} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir Confirmação'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Excluir Item')).toBeInTheDocument();
      expect(screen.getByText('Deseja realmente excluir este insumo?')).toBeInTheDocument();

      const botaoConfirmar = screen.getByText('Sim, excluir');
      // Botão primário usa a classe bg-primary
      expect(botaoConfirmar.className).toContain('bg-primary');
    });

    it('exibe confirmação com variante danger quando perigoso=true (F0.5)', () => {
      render(
        <FeedbackProvider>
          <TesteFeedback perigoso={true} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir Confirmação'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const botaoConfirmar = screen.getByText('Sim, excluir');
      // Botão perigoso usa a classe bg-danger
      expect(botaoConfirmar.className).toContain('bg-danger');
    });

    it('resolve com true ao clicar em confirmar', async () => {
      render(
        <FeedbackProvider>
          <TesteFeedback perigoso={true} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir Confirmação'));
      const botaoConfirmar = screen.getByText('Sim, excluir');

      await act(async () => {
        fireEvent.click(botaoConfirmar);
      });

      await waitFor(() => {
        expect(screen.getByText('CONFIRMADO')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('resolve com false ao clicar em cancelar', async () => {
      render(
        <FeedbackProvider>
          <TesteFeedback perigoso={true} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir Confirmação'));
      const botaoCancelar = screen.getByText('Não, manter');

      await act(async () => {
        fireEvent.click(botaoCancelar);
      });

      await waitFor(() => {
        expect(screen.getByText('CANCELADO')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('confirmar() concorrente e desmonte (F5)', () => {
    function DuasConfirmacoes({ onResultado }: { onResultado: (nome: string, valor: boolean) => void }) {
      const { confirmar } = useFeedback();
      return (
        <button
          type="button"
          onClick={() => {
            void confirmar({ titulo: 'Primeira', mensagem: 'Primeira pergunta?' }).then((v) => onResultado('primeira', v));
            void confirmar({ titulo: 'Segunda', mensagem: 'Segunda pergunta?' }).then((v) => onResultado('segunda', v));
          }}
        >
          Abrir duas
        </button>
      );
    }

    it('duas confirmações simultâneas entram em fila e cada promise resolve com a sua resposta', async () => {
      const onResultado = vi.fn();
      render(
        <FeedbackProvider>
          <DuasConfirmacoes onResultado={onResultado} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir duas'));
      // A primeira aparece antes; a segunda espera na fila
      expect(screen.getByText('Primeira pergunta?')).toBeInTheDocument();
      expect(screen.queryByText('Segunda pergunta?')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      });
      await waitFor(() => expect(onResultado).toHaveBeenCalledWith('primeira', true));
      expect(await screen.findByText('Segunda pergunta?')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      });
      await waitFor(() => expect(onResultado).toHaveBeenCalledWith('segunda', false));
      expect(onResultado).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('duplo clique em Confirmar responde só o diálogo da vez, não o próximo da fila', async () => {
      const onResultado = vi.fn();
      render(
        <FeedbackProvider>
          <DuasConfirmacoes onResultado={onResultado} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir duas'));
      const confirmarPrimeira = screen.getByRole('button', { name: 'Confirmar' });
      await act(async () => {
        fireEvent.click(confirmarPrimeira);
        fireEvent.click(confirmarPrimeira);
      });

      await waitFor(() => expect(onResultado).toHaveBeenCalledWith('primeira', true));
      expect(onResultado).not.toHaveBeenCalledWith('segunda', expect.anything());
      expect(await screen.findByText('Segunda pergunta?')).toBeInTheDocument();
    });

    it('desmontar o provider com diálogo aberto e outro na fila resolve todas as promises com false', async () => {
      const onResultado = vi.fn();
      const { unmount } = render(
        <FeedbackProvider>
          <DuasConfirmacoes onResultado={onResultado} />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir duas'));
      unmount();

      await waitFor(() => expect(onResultado).toHaveBeenCalledTimes(2));
      expect(onResultado).toHaveBeenCalledWith('primeira', false);
      expect(onResultado).toHaveBeenCalledWith('segunda', false);
    });

    it('cancelarConfirmacoes() resolve diálogos pendentes com false e limpa a fila', async () => {
      const onResultado = vi.fn();
      let cancelar!: () => void;
      function TesteCancelar() {
        const { confirmar, cancelarConfirmacoes } = useFeedback();
        cancelar = cancelarConfirmacoes;
        return (
          <button
            type="button"
            onClick={() => {
              void confirmar('Primeira').then((v) => onResultado('primeira', v));
              void confirmar('Segunda').then((v) => onResultado('segunda', v));
            }}
          >
            Abrir
          </button>
        );
      }
      render(
        <FeedbackProvider>
          <TesteCancelar />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir'));
      expect(screen.getByText('Primeira')).toBeInTheDocument();

      act(() => {
        cancelar();
      });

      await waitFor(() => expect(onResultado).toHaveBeenCalledTimes(2));
      expect(onResultado).toHaveBeenCalledWith('primeira', false);
      expect(onResultado).toHaveBeenCalledWith('segunda', false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Segunda chamada não reexecuta callbacks já limpos
      act(() => {
        cancelar();
      });
      expect(onResultado).toHaveBeenCalledTimes(2);
    });

    it('diálogo respondido normalmente remove o resolver e não é afetado por cancelarConfirmacoes posterior', async () => {
      const onResultado = vi.fn();
      let cancelar!: () => void;
      function TesteResponder() {
        const { confirmar, cancelarConfirmacoes } = useFeedback();
        cancelar = cancelarConfirmacoes;
        return (
          <button
            type="button"
            onClick={() => {
              void confirmar('Pergunta').then((v) => onResultado('pergunta', v));
            }}
          >
            Abrir
          </button>
        );
      }
      render(
        <FeedbackProvider>
          <TesteResponder />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Abrir'));
      const botaoConfirmar = screen.getByRole('button', { name: 'Confirmar' });
      await act(async () => {
        fireEvent.click(botaoConfirmar);
      });

      await waitFor(() => expect(onResultado).toHaveBeenCalledWith('pergunta', true));
      expect(onResultado).toHaveBeenCalledTimes(1);

      act(() => {
        cancelar();
      });
      expect(onResultado).toHaveBeenCalledTimes(1);
    });

    it('aceita string como atalho de mensagem e usa os rótulos padrão', async () => {
      let resposta: boolean | undefined;
      function Atalho() {
        const { confirmar } = useFeedback();
        return (
          <button type="button" onClick={() => void confirmar('Apagar tudo?').then((v) => { resposta = v; })}>
            Atalho
          </button>
        );
      }
      render(
        <FeedbackProvider>
          <Atalho />
        </FeedbackProvider>
      );
      fireEvent.click(screen.getByText('Atalho'));
      expect(screen.getByText('Confirmar ação')).toBeInTheDocument();
      expect(screen.getByText('Apagar tudo?')).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      });
      await waitFor(() => expect(resposta).toBe(false));
    });
  });

  describe('Timers dos toasts', () => {
    it.each([
      ['Disparar Sucesso', 'Salvo com sucesso!', 3500],
      ['Disparar Erro', 'Ocorreu uma falha!', 5000],
    ])('"%s" some sozinho no tempo certo (%s, %i ms)', async (botao, texto, prazo) => {
      // Só o setTimeout é falso enquanto o prazo corre; a saída do AnimatePresence termina com timers reais
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        render(
          <FeedbackProvider>
            <TesteFeedback />
          </FeedbackProvider>
        );
        fireEvent.click(screen.getByText(botao));
        act(() => {
          vi.advanceTimersByTime(prazo - 1);
        });
        expect(screen.getByText(texto)).toBeInTheDocument();
        act(() => {
          vi.advanceTimersByTime(1);
        });
      } finally {
        vi.useRealTimers();
      }
      await waitFor(() => expect(screen.queryByText(texto)).not.toBeInTheDocument());
    });

    it('toast de erro dura 5000 ms enquanto sucesso dura 3500 ms (em 4000 ms o erro continua e sucesso sumiu)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        render(
          <FeedbackProvider>
            <TesteFeedback />
          </FeedbackProvider>
        );
        fireEvent.click(screen.getByText('Disparar Sucesso'));
        fireEvent.click(screen.getByText('Disparar Erro'));

        // Em 3600 ms: sucesso sumiu do estado, erro ainda permanece
        act(() => {
          vi.advanceTimersByTime(3600);
        });
        expect(screen.getByText('Ocorreu uma falha!')).toBeInTheDocument();

        // Em 5001 ms total: erro também expira do estado
        act(() => {
          vi.advanceTimersByTime(1500);
        });
      } finally {
        vi.useRealTimers();
      }
      await waitFor(() => {
        expect(screen.queryByText('Salvo com sucesso!')).not.toBeInTheDocument();
        expect(screen.queryByText('Ocorreu uma falha!')).not.toBeInTheDocument();
      });
    });

    it('mantém no máximo 4 toasts na pilha (os mais recentes)', async () => {
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );
      fireEvent.click(screen.getByText('Disparar Sucesso'));
      fireEvent.click(screen.getByText('Disparar Erro'));
      fireEvent.click(screen.getByText('Disparar Info'));
      fireEvent.click(screen.getByText('Disparar Aviso'));
      expect(screen.getAllByLabelText('Fechar notificação')).toHaveLength(4);
      fireEvent.click(screen.getByText('Disparar Info'));
      await waitFor(() => expect(screen.queryByText('Salvo com sucesso!')).not.toBeInTheDocument());
      expect(screen.getAllByLabelText('Fechar notificação')).toHaveLength(4);
    });

    it('desmontar o provider cancela os timers pendentes dos toasts', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const { unmount } = render(
          <FeedbackProvider>
            <TesteFeedback />
          </FeedbackProvider>
        );
        const antes = vi.getTimerCount();
        fireEvent.click(screen.getByText('Disparar Sucesso'));
        fireEvent.click(screen.getByText('Disparar Erro'));
        expect(vi.getTimerCount()).toBeGreaterThanOrEqual(antes + 2);
        unmount();
        expect(vi.getTimerCount()).toBeLessThanOrEqual(antes);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Estabilidade e Prevenção de Loops Infinitos (Item 1)', () => {
    it('mantém a mesma referência de toast após novo render disparado por toast', () => {
      let toastInicial: unknown;
      let toastDepois: unknown;

      function Consumidor() {
        const { toast } = useFeedback();
        if (!toastInicial) {
          toastInicial = toast;
        } else {
          toastDepois = toast;
        }

        return (
          <button type="button" onClick={() => toast.sucesso('Mensagem de sucesso')}>
            Disparar
          </button>
        );
      }

      const { rerender } = render(
        <FeedbackProvider>
          <Consumidor />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar'));

      rerender(
        <FeedbackProvider>
          <Consumidor />
        </FeedbackProvider>
      );

      expect(toastDepois).toBeDefined();
      expect(toastDepois).toBe(toastInicial);
    });

    it('evita loop infinito quando o carregamento de insumos falha no Estoque', async () => {
      renderComProviders(<Estoque />, {
        routes: {
          get: {
            '/insumos': { status: 502, data: { message: 'Bad Gateway' } },
            '/produtos': [],
          },
        },
      });

      // Espera 1 segundo conforme especificado no teste de regressão
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const chamadasInsumos = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/insumos');
      expect(chamadasInsumos).toHaveLength(1);

      // Verifica que existe exatamente 1 toast de erro exibindo a mensagem
      const toastsErro = screen.getAllByText('Bad Gateway');
      expect(toastsErro).toHaveLength(1);
    });
  });

  it('posiciona a pilha de toasts embaixo, acima da barra inferior, e não no topo (não cobre o título das telas)', () => {
    renderComProviders(<div />);
    const pilha = screen.getByRole('status');
    expect(pilha.className).toMatch(/\bbottom-/);
    expect(pilha.className).not.toMatch(/\btop-/);
  });
});
