import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import ImportarNotaFiscal from './ImportarNotaFiscal';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

const insumos = [{ id: 'i1', nome: 'Pão brioche', unidade: 'Unidades', estoqueAtual: 10, estoqueMinimo: 40, custoUnitario: 1.8, fatorPerda: 0 }];
const nota = {
  chaveAcesso: '5'.repeat(44), numero: '48211', serie: '1', dataEmissao: '2026-11-08T12:00:00Z',
  fornecedor: { nome: 'Atacadão Campo Grande', cnpjCpf: '00000000000100' }, valorTotal: 216,
  itens: [{
    itemNumero: 1, codigo: 'A1', descricao: 'PAO BRIOCHE C/ GERGELIM 12UN', unidadeOriginal: 'CX', quantidadeOriginal: 10,
    valorUnitario: 21.6, valorTotal: 216, sugestaoInsumoId: 'i1', sugestaoInsumoNome: 'Pão brioche', sugestaoUnidadeInsumo: 'Unidades',
    fatorConversaoSugerido: 12, quantidadeConvertidaSugerida: 120, confiancaMatch: 95, motivoMatch: 'EXATO',
  }],
};

function abrir() {
  const onVoltar = vi.fn();
  renderComProviders(<ImportarNotaFiscal onVoltar={onVoltar} />, {
    routes: {
      get: { '/insumos': insumos },
      post: {
        '/notas-fiscais/parser-qrcode': nota,
        '/notas-fiscais/confirmar': { totalItensProcessados: 1, insumosAtualizados: [{ id: 'i1', nome: 'Pão brioche', adicionado: 120 }] },
      },
    },
  });
  return onVoltar;
}

describe('pages/ImportarNotaFiscal - fluxo em 3 passos (telas.html#nf1..nf3)', () => {
  it('começa no passo 1 (Ler)', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Entrada por nota fiscal' })).toBeInTheDocument();
    expect(screen.getByText('1. Ler').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('chave consultada leva ao passo 2 (Revisar) e confirmar leva ao 3 (Pronto) com o Smash', async () => {
    const onVoltar = abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.change(screen.getByPlaceholderText(/44 dígitos/), { target: { value: nota.chaveAcesso } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); });
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
    expect(screen.getByText('2. Revisar').closest('li')).toHaveAttribute('aria-current', 'step');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar Entrada no Estoque/ })); });
    expect(await screen.findByRole('heading', { name: 'Estoque atualizado' })).toBeInTheDocument();
    expect(screen.getByText('3. Pronto').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('img', { name: /Smash/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it('usa só tokens de design', () => {
    esperarSemCoresLiterais('src/pages/ImportarNotaFiscal.tsx');
  });
});
