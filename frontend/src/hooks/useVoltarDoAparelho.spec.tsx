import { StrictMode, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useVoltarDoAparelho } from './useVoltarDoAparelho';

/** Simula o gesto/botão Voltar do celular (o navegador dispara popstate de forma assíncrona). */
async function voltarDoAparelho() {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 30));
  });
}

async function esperarHistorico() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

function Camada({ nome, aoVoltar }: { nome: string; aoVoltar: () => void }) {
  useVoltarDoAparelho(true, aoVoltar);
  return <p>{nome}</p>;
}

function Tela() {
  const [aberta, setAberta] = useState(false);
  const [filha, setFilha] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAberta(true)}>abrir</button>
      {aberta && (
        <>
          <Camada nome="subtela" aoVoltar={() => setAberta(false)} />
          <button type="button" onClick={() => setAberta(false)}>fechar pela tela</button>
          <button type="button" onClick={() => setFilha(true)}>abrir filha</button>
          {filha && <Camada nome="filha" aoVoltar={() => setFilha(false)} />}
        </>
      )}
    </div>
  );
}

describe('hooks/useVoltarDoAparelho', () => {
  it('abrir empilha uma entrada no histórico e o Voltar do aparelho fecha a camada sem sair da página', async () => {
    render(<Tela />);
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    expect(window.history.state?.camadaVoltar).toBeDefined();

    await voltarDoAparelho();
    expect(screen.queryByText('subtela')).not.toBeInTheDocument();
    await esperarHistorico();
    expect(window.history.state?.camadaVoltar).toBeUndefined();
  });

  it('fechar pela própria tela tira a entrada do histórico: o Voltar seguinte não reabre nem chama a camada', async () => {
    const aoVoltar = vi.fn();
    function TelaComEspiao() {
      const [aberta, setAberta] = useState(true);
      return (
        <>
          {aberta && <Camada nome="subtela" aoVoltar={aoVoltar} />}
          <button type="button" onClick={() => setAberta(false)}>fechar</button>
        </>
      );
    }
    render(<TelaComEspiao />);
    const id = window.history.state?.camadaVoltar;
    expect(id).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'fechar' }));
    await esperarHistorico();
    expect(window.history.state?.camadaVoltar).not.toBe(id);

    await voltarDoAparelho();
    expect(aoVoltar).not.toHaveBeenCalled();
  });

  it('com duas camadas, o Voltar fecha só a de cima; o seguinte fecha a de baixo', async () => {
    render(<Tela />);
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    fireEvent.click(screen.getByRole('button', { name: 'abrir filha' }));
    expect(screen.getByText('filha')).toBeInTheDocument();

    await voltarDoAparelho();
    expect(screen.queryByText('filha')).not.toBeInTheDocument();
    expect(screen.getByText('subtela')).toBeInTheDocument();

    await esperarHistorico();
    await voltarDoAparelho();
    expect(screen.queryByText('subtela')).not.toBeInTheDocument();
  });

  it('se a tela não fechar no Voltar (ex.: confirmação cancelada), a camada continua protegida', async () => {
    const aoVoltar = vi.fn();
    render(<Camada nome="com dados" aoVoltar={aoVoltar} />);

    await voltarDoAparelho();
    expect(aoVoltar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('com dados')).toBeInTheDocument();
    expect(window.history.state?.camadaVoltar).toBeDefined();

    await voltarDoAparelho();
    expect(aoVoltar).toHaveBeenCalledTimes(2);
  });

  it('no StrictMode (efeitos montados duas vezes) empilha uma entrada só', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    render(
      <StrictMode>
        <Camada nome="estrita" aoVoltar={() => {}} />
      </StrictMode>,
    );
    await esperarHistorico();
    expect(push).toHaveBeenCalledTimes(1);
    push.mockRestore();
  });
});
