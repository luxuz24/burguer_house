import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EstornoFechamentoSheet from './EstornoFechamentoSheet';
import { renderComProviders, criarErroAxios } from '../test/render';

const estornoOk = {
  vendaId: 'venda-1', estornada: true,
  estorno: { usuarioId: 'u1', em: '2026-11-13T19:00:00.000Z', motivo: 'Lancei o dia errado' },
  devolucoes: [{ insumoId: 'i1', nome: 'Carne de Hambúrguer', unidade: 'Gramas', quantidade: 336, estoqueAtual: 436 }],
};

function abrir(post: unknown = estornoOk) {
  const postFn = vi.fn((...a: unknown[]) => { void a; return typeof post === 'function' ? (post as () => unknown)() : (post as never); });
  const props = { onFechar: vi.fn(), onEstornado: vi.fn(), onJaEstornado: vi.fn() };
  renderComProviders(<EstornoFechamentoSheet aberto vendaId="venda-1" {...props} />, {
    routes: { post: { '/vendas/venda-1/estornar': postFn as never } },
  });
  return { postFn, ...props };
}

const confirmarDialogo = async () => fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }));

describe('components/EstornoFechamentoSheet (tarefa 13)', () => {
  it('motivo vazio ou só espaços não envia e mostra o contador 0/500', () => {
    const { postFn } = abrir();
    const botao = screen.getByRole('button', { name: 'Estornar fechamento' });
    expect(botao).toBeDisabled();
    expect(screen.getByText('0/500')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: '   ' } });
    expect(botao).toBeDisabled();
    expect(postFn).not.toHaveBeenCalled();
  });

  it('limita o motivo a 500 caracteres', () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: 'a'.repeat(700) } });
    expect((screen.getByLabelText('Motivo do estorno') as HTMLTextAreaElement).value).toHaveLength(500);
    expect(screen.getByText('500/500')).toBeInTheDocument();
  });

  it('com motivo pede confirmação, envia o motivo sem espaços nas pontas, e um segundo toque não envia de novo', async () => {
    const { postFn, onEstornado, onFechar } = abrir();
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: '  Lancei o dia errado  ' } });
    const botao = screen.getByRole('button', { name: 'Estornar fechamento' });
    fireEvent.click(botao);
    expect(postFn).not.toHaveBeenCalled();
    await confirmarDialogo();
    fireEvent.click(botao);
    await waitFor(() => expect(onEstornado).toHaveBeenCalledTimes(1));
    expect(postFn).toHaveBeenCalledTimes(1);
    expect(postFn.mock.calls[0][1]).toEqual({ motivo: 'Lancei o dia errado' });
    expect(onEstornado.mock.calls[0][0]).toMatchObject({ estornada: true });
    expect(onFechar).toHaveBeenCalled();
  });

  it('recusar a confirmação não envia nada', async () => {
    const { postFn } = abrir();
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: 'Teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Estornar fechamento' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(postFn).not.toHaveBeenCalled();
  });

  it('409 (já estornado) avisa o pai e fecha; outros erros mostram a mensagem do backend e mantêm o Sheet', async () => {
    const um = abrir(() => { throw criarErroAxios(409, { message: 'Este fechamento manual já foi estornado' }); });
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: 'Teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Estornar fechamento' }));
    await confirmarDialogo();
    await waitFor(() => expect(um.onJaEstornado).toHaveBeenCalledTimes(1));
    expect(um.onEstornado).not.toHaveBeenCalled();
  });

  it('erro 422/400 aparece com a mensagem do backend dentro do Sheet', async () => {
    const { onEstornado, onJaEstornado } = abrir(() => { throw criarErroAxios(422, { message: 'Fechamento sem snapshot válido para estorno' }); });
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: 'Teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Estornar fechamento' }));
    await confirmarDialogo();
    expect(await screen.findByRole('alert')).toHaveTextContent('Fechamento sem snapshot válido para estorno');
    expect(onEstornado).not.toHaveBeenCalled();
    expect(onJaEstornado).not.toHaveBeenCalled();
  });
});
