import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import Sheet from './Sheet';

describe('UI Component — Sheet (Modal & Drawer)', () => {
  function TestSheetComponent({ initialOpen = true, onClose = vi.fn() }: { initialOpen?: boolean; onClose?: () => void }) {
    const [open, setOpen] = useState(initialOpen);

    const handleClose = () => {
      onClose();
      setOpen(false);
    };

    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>Abrir</button>
        <Sheet
          open={open}
          onClose={handleClose}
          title="Título do Painel"
          subtitle="Subtítulo descritivo"
          footer={<button type="button">Salvar</button>}
        >
          <p>Conteúdo interno do painel</p>
          <input type="text" placeholder="Campo de teste" />
        </Sheet>
      </div>
    );
  }

  it('monta o painel com role="dialog", título e conteúdo', () => {
    render(<TestSheetComponent initialOpen={true} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Título do Painel')).toBeInTheDocument();
    expect(screen.getByText('Subtítulo descritivo')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo interno do painel')).toBeInTheDocument();
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });

  it('fecha o painel ao pressionar a tecla Escape de forma síncrona com skipAnimations', async () => {
    const onClose = vi.fn();
    render(<TestSheetComponent initialOpen={true} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    // Verificação síncrona imediata sem waitFor para provar MotionGlobalConfig.skipAnimations
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha o painel ao clicar no botão Fechar de forma síncrona com skipAnimations', async () => {
    const onClose = vi.fn();
    render(<TestSheetComponent initialOpen={true} onClose={onClose} />);

    const botaoFechar = screen.getByLabelText('Fechar');
    await act(async () => {
      fireEvent.click(botaoFechar);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    // Verificação síncrona imediata sem waitFor para provar MotionGlobalConfig.skipAnimations
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('bloqueia o scroll do body quando aberto e restaura ao fechar', () => {
    const { unmount } = render(<TestSheetComponent initialOpen={true} />);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

