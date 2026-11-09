import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { FeedbackProvider, useFeedback } from './FeedbackContext';

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
      expect(screen.getByText('Salvo com sucesso!')).toBeInTheDocument();
    });

    it('renderiza toast de erro, info e aviso', () => {
      render(
        <FeedbackProvider>
          <TesteFeedback />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByText('Disparar Erro'));
      expect(screen.getByText('Ocorreu uma falha!')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Disparar Info'));
      expect(screen.getByText('Aviso informativo')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Disparar Aviso'));
      expect(screen.getByText('Atenção ao estoque')).toBeInTheDocument();
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
});
