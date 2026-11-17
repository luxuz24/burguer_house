import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FechamentoDia from './FechamentoDia';
import { renderComProviders, criarErroAxios } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { dataHojeNaLoja } from '../lib/formatar';

const produtos = [
  { id: 'p1', nome: 'X-Bacon House', criadoEm: '', atualizadoEm: '' },
  { id: 'p2', nome: 'Coca Cola Zero 350ml', criadoEm: '', atualizadoEm: '' },
  { id: 'p3', nome: 'PRODUÇÃO: Maionese da Casa', criadoEm: '', atualizadoEm: '' },
  { id: 'p4', nome: 'X-Tudo', criadoEm: '', atualizadoEm: '' },
];

const simulacao = {
  data: '2026-11-13',
  itens: [{ produtoId: 'p1', nome: 'X-Bacon House', quantidade: 2 }],
  consumos: [
    { insumoId: 'i1', nome: 'Carne de Hambúrguer', unidade: 'Gramas', categoria: 'INGREDIENTE', consumo: 336, estoqueAtual: 100, estoqueProjetado: -236, ficariaNegativo: true },
    { insumoId: 'i2', nome: 'Pão Brioche', unidade: 'Unidade', categoria: 'INGREDIENTE', consumo: 2, estoqueAtual: 50, estoqueProjetado: 48, ficariaNegativo: false },
    { insumoId: 'i3', nome: 'Saco Kraft', unidade: 'Unidade', categoria: 'EMBALAGEM', consumo: 2, estoqueAtual: 200, estoqueProjetado: 198, ficariaNegativo: false },
    { insumoId: 'i4', nome: 'Coca Cola Zero 350ml', unidade: 'Unidade', categoria: 'BEBIDA', consumo: 1, estoqueAtual: 10, estoqueProjetado: 9, ficariaNegativo: false },
  ],
  produtosSemFicha: [{ produtoId: 'p4', nome: 'X-Tudo' }],
  temNegativo: true,
  podeConfirmar: false,
};

function abrir(post: unknown = simulacao, onVoltar = vi.fn()) {
  const postFn = vi.fn((...args: unknown[]) => {
    void args;
    return post as never;
  });
  renderComProviders(<FechamentoDia onVoltar={onVoltar} />, {
    routes: { get: { '/produtos': produtos }, post: { '/vendas/fechamento-manual/simulacao': postFn as never } },
  });
  return { postFn, onVoltar };
}

const qtd = (nome: string) => screen.getByLabelText(`Quantidade de ${nome}`) as HTMLInputElement;

describe('pages/FechamentoDia (tarefa 12: tela e simulação)', () => {
  it('lista os produtos vendáveis (sem PRODUÇÃO:), busca ignorando acento e volta pelo botão Voltar', async () => {
    const { onVoltar } = abrir();
    expect(await screen.findByText('X-Bacon House')).toBeInTheDocument();
    expect(screen.queryByText(/Maionese da Casa/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'COCÁ' } });
    expect(screen.getByText('Coca Cola Zero 350ml')).toBeInTheDocument();
    expect(screen.queryByText('X-Bacon House')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it('+ e − mudam a quantidade, digitar respeita 0..500 e mostra o resumo no rodapé', async () => {
    abrir();
    await screen.findByText('X-Bacon House');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    expect(qtd('X-Bacon House').value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir X-Bacon House' }));
    expect(qtd('X-Bacon House').value).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir X-Bacon House' }));
    expect(qtd('X-Bacon House').value).toBe('');

    fireEvent.change(qtd('X-Bacon House'), { target: { value: '999' } });
    expect(qtd('X-Bacon House').value).toBe('500');
    fireEvent.change(qtd('Coca Cola Zero 350ml'), { target: { value: '3x' } });
    expect(qtd('Coca Cola Zero 350ml').value).toBe('3');
    expect(screen.getByText('2 produtos · 503 unidades')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    expect(qtd('X-Bacon House').value).toBe('500');
  });

  it('"Ver impacto" fica desabilitado sem itens; com itens envia só os de quantidade > 0 e a data', async () => {
    const { postFn } = abrir();
    await screen.findByText('X-Bacon House');
    const botao = screen.getByRole('button', { name: 'Ver impacto no estoque' });
    expect(botao).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    expect(botao).toBeEnabled();
    fireEvent.click(botao);
    await screen.findByText('Ficariam negativos');
    expect(postFn).toHaveBeenCalledTimes(1);
    expect(postFn.mock.calls[0][1]).toEqual({ data: dataHojeNaLoja(), itens: [{ produtoId: 'p1', quantidade: 2 }] });
  });

  it('data futura não é aceita: mostra aviso e mantém a simulação desabilitada', async () => {
    abrir();
    await screen.findByText('X-Bacon House');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    const campo = screen.getByLabelText('Dia das vendas') as HTMLInputElement;
    expect(campo.max).toBe(dataHojeNaLoja());
    expect(campo.value).toBe(dataHojeNaLoja());
    fireEvent.change(campo, { target: { value: '2999-01-01' } });
    expect(screen.getByText('A data não pode ser futura.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver impacto no estoque' })).toBeDisabled();
    fireEvent.change(campo, { target: { value: dataHojeNaLoja() } });
    expect(screen.getByRole('button', { name: 'Ver impacto no estoque' })).toBeEnabled();
  });

  it('mostra o impacto: negativos primeiro com texto, resto por categoria, estoque atual → projetado e produtos sem ficha', async () => {
    abrir();
    await screen.findByText('X-Bacon House');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));

    const titulos = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    expect(titulos).toEqual(['Ficariam negativos', 'Ingredientes', 'Embalagens', 'Bebidas']);
    expect(screen.getByText('ficaria negativo')).toBeInTheDocument();
    expect(screen.getByText('Carne de Hambúrguer')).toBeInTheDocument();
    expect(screen.getByText(/100 Gramas → -236 Gramas/)).toBeInTheDocument();
    expect(screen.getByText(/consumo 336 Gramas/)).toBeInTheDocument();
    expect(screen.getByText(/50 Unidade → 48 Unidade/)).toBeInTheDocument();
    expect(screen.getByText(/Estes produtos não têm ficha técnica e impedem a baixa: X-Tudo\./)).toBeInTheDocument();
    expect(screen.queryByText('Atualize o impacto')).not.toBeInTheDocument();
  });

  it('mudar quantidade ou data depois da simulação marca o impacto como obsoleto; simular de novo limpa o aviso', async () => {
    abrir();
    await screen.findByText('X-Bacon House');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
    await screen.findByText('Ficariam negativos');

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    expect(screen.getByText('Atualize o impacto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
    await waitFor(() => expect(screen.queryByText('Atualize o impacto')).not.toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Dia das vendas'), { target: { value: '2026-01-02' } });
    expect(screen.getByText('Atualize o impacto')).toBeInTheDocument();
  });

  it('erro 422 da simulação aparece com a mensagem do backend; falha ao carregar produtos oferece "Tentar novamente"', async () => {
    const postFn = vi.fn(() => { throw criarErroAxios(422, { message: 'Um ou mais produtos informados não foram encontrados' }); });
    renderComProviders(<FechamentoDia onVoltar={vi.fn()} />, {
      routes: { get: { '/produtos': produtos }, post: { '/vendas/fechamento-manual/simulacao': postFn as never } },
    });
    await screen.findByText('X-Bacon House');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Um ou mais produtos informados não foram encontrados');
  });

  it('falha ao carregar produtos mostra a mensagem e "Tentar novamente" recarrega', async () => {
    let chamadas = 0;
    renderComProviders(<FechamentoDia onVoltar={vi.fn()} />, {
      routes: { get: { '/produtos': () => { chamadas += 1; if (chamadas === 1) throw criarErroAxios(500, { message: 'Banco fora do ar' }); return produtos; } } },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Banco fora do ar');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('X-Bacon House')).toBeInTheDocument();
  });

  it('não usa cores literais nem dark: em FechamentoDia.tsx (tokens de design)', () => {
    esperarSemCoresLiterais('src/pages/FechamentoDia.tsx');
  });

  describe('uso após a simulação (revisão do PR)', () => {
    it('rola até o impacto e move o foco para ele quando o resultado chega, e não de novo ao editar', async () => {
      const rolar = vi.fn();
      Object.defineProperty(Element.prototype, 'scrollIntoView', { value: rolar, configurable: true, writable: true });
      try {
        abrir();
        await screen.findByText('X-Bacon House');
        fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
        expect(rolar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
        const secao = await screen.findByRole('region', { name: 'Impacto no estoque' });
        await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
        expect(secao).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
        expect(rolar).toHaveBeenCalledTimes(1);
      } finally {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
      }
    });

    it('o erro da simulação some assim que a pessoa muda a quantidade ou a data', async () => {
      const postFn = vi.fn(() => { throw criarErroAxios(422, { message: 'Produto sem ficha técnica' }); });
      renderComProviders(<FechamentoDia onVoltar={vi.fn()} />, {
        routes: { get: { '/produtos': produtos }, post: { '/vendas/fechamento-manual/simulacao': postFn as never } },
      });
      await screen.findByText('X-Bacon House');
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Produto sem ficha técnica');
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Dia das vendas'), { target: { value: '2026-01-02' } });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('trava o clique duplo (uma só chamada) e, se a quantidade mudar durante a espera, o resultado chega como obsoleto', async () => {
      let chamadas = 0;
      let liberar: (v: unknown) => void = () => {};
      renderComProviders(<FechamentoDia onVoltar={vi.fn()} />, {
        routes: {
          get: { '/produtos': produtos },
          post: { '/vendas/fechamento-manual/simulacao': (() => { chamadas += 1; return new Promise((r) => { liberar = r; }); }) as never },
        },
      });
      await screen.findByText('X-Bacon House');
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      const botao = screen.getByRole('button', { name: 'Ver impacto no estoque' });
      fireEvent.click(botao);
      fireEvent.click(botao);
      expect(screen.getByRole('button', { name: 'Calculando…' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar Coca Cola Zero 350ml' }));
      await act(async () => { liberar(simulacao); });
      await screen.findByText('Ficariam negativos');
      expect(chamadas).toBe(1);
      expect(screen.getByText('Atualize o impacto')).toBeInTheDocument();
    });

    it('avisa quantos produtos com quantidade estão fora da busca e ainda os envia na simulação', async () => {
      const { postFn } = abrir();
      await screen.findByText('X-Bacon House');
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      expect(screen.queryByText(/fora da busca/)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'coca' } });
      expect(screen.getByText('1 produto com quantidade fora da busca')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar Coca Cola Zero 350ml' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
      await screen.findByText('Ficariam negativos');
      expect(postFn.mock.calls[0][1]).toEqual({
        data: dataHojeNaLoja(),
        itens: [{ produtoId: 'p1', quantidade: 1 }, { produtoId: 'p2', quantidade: 1 }],
      });
      fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: '' } });
      expect(screen.queryByText(/fora da busca/)).not.toBeInTheDocument();
    });
  });
});
