import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FechamentoDia from './FechamentoDia';
import axios from 'axios';
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
    routes: { get: { '/produtos': produtos, ...rotasListaVazia() }, post: { '/vendas/fechamento-manual/simulacao': postFn as never } },
  });
  return { postFn, onVoltar };
}

interface CorpoConfirmacao {
  chaveIdempotencia: string;
  data: string;
  itens: Array<{ produtoId: string; quantidade: number }>;
}

const listaVazia = { data: '', total: 0, fechamentos: [] };
/** Rotas da lista do dia para as datas usadas nos testes (a rota inclui a data na URL). */
const rotasListaVazia = () => ({
  [`/vendas/fechamentos-manuais?data=${dataHojeNaLoja()}`]: listaVazia,
  '/vendas/fechamentos-manuais?data=2026-01-02': listaVazia,
  '/vendas/fechamentos-manuais?data=2026-11-13': listaVazia,
});

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

    const regiaoImpacto = await screen.findByRole('region', { name: 'Impacto no estoque' });
    const titulos = within(regiaoImpacto).getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
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
      routes: { get: { '/produtos': produtos, ...rotasListaVazia() }, post: { '/vendas/fechamento-manual/simulacao': postFn as never } },
    });
    await screen.findByText('X-Bacon House');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Um ou mais produtos informados não foram encontrados');
  });

  it('falha ao carregar produtos mostra a mensagem e "Tentar novamente" recarrega', async () => {
    let chamadas = 0;
    renderComProviders(<FechamentoDia onVoltar={vi.fn()} />, {
      routes: { get: { ...rotasListaVazia(), '/produtos': () => { chamadas += 1; if (chamadas === 1) throw criarErroAxios(500, { message: 'Banco fora do ar' }); return produtos; } } },
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
        routes: { get: { '/produtos': produtos, ...rotasListaVazia() }, post: { '/vendas/fechamento-manual/simulacao': postFn as never } },
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
          get: { '/produtos': produtos, ...rotasListaVazia() },
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

  describe('confirmação e estorno (tarefa 13)', () => {
    const simulacaoOk = { ...simulacao, temNegativo: false, podeConfirmar: true, produtosSemFicha: [], consumos: simulacao.consumos.map((c) => ({ ...c, ficariaNegativo: false, estoqueProjetado: c.estoqueAtual - c.consumo })) };
    const confirmacao = (extra: Record<string, unknown> = {}) => ({
      reaproveitado: false, vendaId: 'venda-1', externalId: 'manual:x', chaveIdempotencia: 'x', data: '2026-11-13', ocorridoEm: '2026-11-13T16:00:00.000Z',
      itens: [{ produtoId: 'p1', nome: 'X-Bacon House', quantidade: 2 }],
      consumos: [{ insumoId: 'i2', nome: 'Pão Brioche', unidade: 'Unidade', quantidade: 2 }],
      insumosComEstoqueNegativo: [],
      ...extra,
    });
    const estornoResp = { vendaId: 'venda-1', estornada: true, estorno: { usuarioId: 'u', em: '2026-11-13T19:00:00.000Z', motivo: 'Erro' }, devolucoes: [{ insumoId: 'i2', nome: 'Pão Brioche', unidade: 'Unidade', quantidade: 2, estoqueAtual: 50 }] };

    function abrirConfirmacao(opcoes: { sim?: unknown; conf?: (corpo: CorpoConfirmacao, n: number) => unknown; estorno?: unknown } = {}) {
      const corpos: CorpoConfirmacao[] = [];
      const estornos: Array<{ motivo: string }> = [];
      const onVoltar = vi.fn();
      renderComProviders(<FechamentoDia onVoltar={onVoltar} />, {
        routes: {
          get: { '/produtos': produtos, ...rotasListaVazia() },
          post: {
            '/vendas/fechamento-manual/simulacao': (() => opcoes.sim ?? simulacaoOk) as never,
            '/vendas/fechamento-manual': ((_u: string, corpo: unknown) => { corpos.push(corpo as CorpoConfirmacao); const r = opcoes.conf ? opcoes.conf(corpo as CorpoConfirmacao, corpos.length) : confirmacao(); if (r instanceof Error) throw r; return r; }) as never,
            '/vendas/venda-1/estornar': ((_u: string, corpo: unknown) => { estornos.push(corpo as { motivo: string }); const r = opcoes.estorno ?? estornoResp; if (r instanceof Error) throw r; return r; }) as never,
          },
        },
      });
      return { corpos, estornos, onVoltar };
    }

    const simular = async (cliques = 2) => {
      await screen.findByText('X-Bacon House');
      for (let i = 0; i < cliques; i++) fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
      await screen.findByRole('region', { name: 'Impacto no estoque' });
    };
    const aceitarDialogo = async (nome = 'Dar baixa') => fireEvent.click(await screen.findByRole('button', { name: nome }));

    it('"Confirmar baixa" só habilita com simulação atual e podeConfirmar; obsoleto ou sem ficha desabilita', async () => {
      abrirConfirmacao();
      await simular();
      const botao = screen.getByRole('button', { name: 'Confirmar baixa' });
      expect(botao).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      expect(botao).toBeDisabled();
    });

    it('com podeConfirmar: false (produto sem ficha) não existe baixa possível', async () => {
      abrirConfirmacao({ sim: simulacao });
      await simular();
      expect(screen.getByRole('button', { name: 'Confirmar baixa' })).toBeDisabled();
    });

    it('pede confirmação com o resumo e o aviso de negativo; recusar não envia', async () => {
      const { corpos } = abrirConfirmacao({ sim: { ...simulacaoOk, temNegativo: true } });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      const hoje = dataHojeNaLoja().split('-');
      expect(await screen.findByText(`Dar baixa de 2 itens do dia ${hoje[2]}/${hoje[1]}? O estoque será reduzido. Atenção: algum insumo ficará negativo.`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await act(async () => {});
      expect(corpos).toHaveLength(0);
    });

    it('envia chaveIdempotencia (8..100), data e só os itens > 0; duplo clique faz uma chamada; 201 mostra o sucesso', async () => {
      const { corpos } = abrirConfirmacao({ conf: () => confirmacao({ insumosComEstoqueNegativo: [{ id: 'i1', nome: 'Carne de Hambúrguer', estoqueAtual: -36 }] }) });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      const botaoDialogo = await screen.findByRole('button', { name: 'Dar baixa' });
      fireEvent.click(botaoDialogo);
      fireEvent.click(botaoDialogo);
      expect(await screen.findByRole('heading', { level: 1, name: 'Baixa registrada' })).toBeInTheDocument();
      expect(corpos).toHaveLength(1);
      expect(corpos[0].chaveIdempotencia.length).toBeGreaterThanOrEqual(8);
      expect(corpos[0].chaveIdempotencia.length).toBeLessThanOrEqual(100);
      expect(corpos[0]).toMatchObject({ data: dataHojeNaLoja(), itens: [{ produtoId: 'p1', quantidade: 2 }] });
      expect(screen.getByText(/Carne de Hambúrguer/)).toBeInTheDocument();
      expect(screen.getByText('Ficaram negativos')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
      expect(screen.queryByText('Este fechamento já tinha sido registrado.')).not.toBeInTheDocument();
    });

    it('200 com reaproveitado mostra a nota neutra; "Concluir" volta', async () => {
      const { onVoltar } = abrirConfirmacao({ conf: () => confirmacao({ reaproveitado: true }) });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      expect(await screen.findByText('Este fechamento já tinha sido registrado.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
      expect(onVoltar).toHaveBeenCalledTimes(1);
    });

    it('falha de rede mantém a tela e reenvia a MESMA chave; mudar uma quantidade gera chave NOVA', async () => {
      const { corpos } = abrirConfirmacao({ conf: (_c, n) => (n <= 2 ? new axios.AxiosError('Network Error', 'ERR_NETWORK') : confirmacao()) });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar. Toque em Tentar novamente: nada será baixado em dobro.');
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      await aceitarDialogo();
      await waitFor(() => expect(corpos).toHaveLength(2));
      expect(corpos[1].chaveIdempotencia).toBe(corpos[0].chaveIdempotencia);

      // muda quantidade -> nova simulação -> nova chave
      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar baixa' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      await screen.findByRole('heading', { level: 1, name: 'Baixa registrada' });
      expect(corpos).toHaveLength(3);
      expect(corpos[2].chaveIdempotencia).not.toBe(corpos[0].chaveIdempotencia);
      expect(corpos[2].itens).toEqual([{ produtoId: 'p1', quantidade: 3 }]);
    });

    it('422 mostra produtos sem ficha / não encontrados e mantém a edição', async () => {
      abrirConfirmacao({ conf: () => criarErroAxios(422, { message: 'Não é possível confirmar', produtosSemFicha: [{ produtoId: 'p4', nome: 'X-Tudo' }], produtosNaoEncontrados: ['id-fantasma'] }) });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      const alerta = await screen.findByText(/Sem ficha técnica: X-Tudo/);
      expect(alerta.textContent).toContain('Não encontrados: id-fantasma');
      expect(screen.getByRole('button', { name: 'Aumentar X-Bacon House' })).toBeInTheDocument();
    });

    it('409 explica que a tentativa foi usada com outro conteúdo, manda conferir a lista do dia e troca a chave', async () => {
      const { corpos } = abrirConfirmacao({ conf: (_c, n) => (n === 1 ? criarErroAxios(409, { message: 'conteúdo diferente' }) : confirmacao()) });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      expect(await screen.findByRole('alert')).toHaveTextContent('Esta tentativa já foi usada com outro conteúdo.');
      expect(screen.getByRole('alert')).toHaveTextContent('Confira a lista do dia');
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      await screen.findByRole('heading', { level: 1, name: 'Baixa registrada' });
      expect(corpos[1].chaveIdempotencia).not.toBe(corpos[0].chaveIdempotencia);
    });

    it('Desfazer abre o Sheet, estorna com motivo e mostra devoluções e o selo Estornado', async () => {
      const { estornos } = abrirConfirmacao();
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      await screen.findByRole('heading', { level: 1, name: 'Baixa registrada' });
      fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
      fireEvent.change(await screen.findByLabelText('Motivo do estorno'), { target: { value: 'Lancei o dia errado' } });
      fireEvent.click(screen.getByRole('button', { name: 'Estornar fechamento' }));
      await aceitarDialogo('Estornar');
      expect(await screen.findByRole('heading', { level: 1, name: 'Fechamento estornado' })).toBeInTheDocument();
      expect(estornos).toEqual([{ motivo: 'Lancei o dia errado' }]);
      expect(screen.getByText('Estornado')).toBeInTheDocument();
      expect(screen.getByText(/devolvido/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    });

    it('estorno com 409 (já estornado) atualiza a tela para Estornado', async () => {
      abrirConfirmacao({ estorno: criarErroAxios(409, { message: 'Este fechamento manual já foi estornado' }) });
      await simular();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      await aceitarDialogo();
      await screen.findByRole('heading', { level: 1, name: 'Baixa registrada' });
      fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
      fireEvent.change(await screen.findByLabelText('Motivo do estorno'), { target: { value: 'Teste' } });
      fireEvent.click(screen.getByRole('button', { name: 'Estornar fechamento' }));
      await aceitarDialogo('Estornar');
      expect(await screen.findByText('Estornado')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    });
  });

  describe('lançamentos do dia (tarefa 14)', () => {
    const ativo = {
      id: 'v1', externalId: 'manual:a', criadoEm: '2026-11-13T22:41:00.000Z', ocorridoEm: '2026-11-13T16:00:00.000Z',
      observacao: 'Turno noite',
      itens: [{ nome: 'BACON HOUSE', quantidade: 2 }, { nome: 'Coca Cola Zero 350ml', quantidade: 6 }],
      usuario: { id: 'u1', nome: 'Carlos Eduardo' }, estornada: false, estorno: null,
    };
    const estornado = {
      id: 'v2', externalId: 'manual:b', criadoEm: '2026-11-13T21:10:00.000Z', ocorridoEm: '2026-11-13T16:00:00.000Z',
      observacao: null, itens: [{ nome: 'X-Tudo', quantidade: 1 }], usuario: null, estornada: true,
      estorno: { em: '2026-11-13T21:30:00.000Z', motivo: 'Lancei errado', usuario: { id: 'u1', nome: 'Carlos Eduardo' } },
    };
    const lista = (...fechamentos: unknown[]) => ({ data: '2026-11-13', total: fechamentos.length, fechamentos });
    const URL_13 = '/vendas/fechamentos-manuais?data=2026-11-13';

    function abrirComLista(get: Record<string, unknown>, post: Record<string, unknown> = {}) {
      renderComProviders(<FechamentoDia onVoltar={vi.fn()} />, {
        routes: { get: { '/produtos': produtos, ...rotasListaVazia(), ...get } as never, post: post as never },
      });
    }
    const irParaDia13 = async () => {
      await screen.findByText('X-Bacon House');
      fireEvent.change(screen.getByLabelText('Dia das vendas'), { target: { value: '2026-11-13' } });
    };

    it('lista os lançamentos com horário, autor, itens, observação e estado; o estornado tem selo, motivo e sem "Desfazer"', async () => {
      abrirComLista({ [URL_13]: lista(ativo, estornado) });
      await irParaDia13();
      const regiao = await screen.findByRole('region', { name: 'Lançamentos do dia' });
      expect(within(regiao).getByText(/18:41/)).toBeInTheDocument();
      expect(within(regiao).getByText('· Carlos Eduardo')).toBeInTheDocument();
      expect(within(regiao).getByText('2× BACON HOUSE · 6× Coca Cola Zero 350ml')).toBeInTheDocument();
      expect(within(regiao).getByText('Turno noite')).toBeInTheDocument();
      expect(within(regiao).getByText('Estornado')).toBeInTheDocument();
      expect(within(regiao).getByText(/Lancei errado/)).toBeInTheDocument();
      expect(within(regiao).getByText(/13\/11, 17:30/)).toBeInTheDocument();
      expect(within(regiao).getByText(/Usuário removido/)).toBeInTheDocument();
      expect(within(regiao).getAllByRole('button', { name: /Desfazer/ })).toHaveLength(1);
    });

    it('trocar a data busca a lista da nova data; vazio e erro de carga aparecem como descrito', async () => {
      let tentativas = 0;
      abrirComLista({
        [URL_13]: () => { tentativas += 1; if (tentativas === 1) throw criarErroAxios(500, { message: 'Banco fora do ar' }); return lista(ativo); },
      });
      expect(await screen.findByText('Nenhum fechamento lançado neste dia.')).toBeInTheDocument();
      await irParaDia13();
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('Banco fora do ar');
      fireEvent.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
      expect(await screen.findByText('Turno noite')).toBeInTheDocument();
      expect(tentativas).toBe(2);
    });

    it('avisa que o dia já tem fechamento enquanto houver um ativo e some quando todos estão estornados', async () => {
      abrirComLista({ [URL_13]: lista(ativo, estornado), '/vendas/fechamentos-manuais?data=2026-01-02': lista(estornado) });
      await irParaDia13();
      expect(await screen.findByText('Este dia já tem 1 fechamento (8 itens). Lançar outro soma ao anterior.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Dia das vendas'), { target: { value: '2026-01-02' } });
      await screen.findByText(/Lancei errado/);
      expect(screen.queryByText(/Este dia já tem/)).not.toBeInTheDocument();
    });

    it('"Desfazer" abre o Sheet de estorno e, ao concluir, a lista recarrega mostrando "Estornado"', async () => {
      let estornou = false;
      abrirComLista(
        { [URL_13]: () => lista(estornou ? { ...ativo, estornada: true, estorno: { em: '2026-11-13T23:00:00.000Z', motivo: 'Erro de digitação', usuario: { id: 'u1', nome: 'Carlos Eduardo' } } } : ativo) },
        {
          '/vendas/v1/estornar': (() => {
            estornou = true;
            return { vendaId: 'v1', estornada: true, estorno: { usuarioId: 'u1', em: '2026-11-13T23:00:00.000Z', motivo: 'Erro de digitação' }, devolucoes: [] };
          }) as never,
        },
      );
      await irParaDia13();
      const regiao = await screen.findByRole('region', { name: 'Lançamentos do dia' });
      fireEvent.click(await within(regiao).findByRole('button', { name: /Desfazer/ }));
      fireEvent.change(await screen.findByLabelText('Motivo do estorno'), { target: { value: 'Erro de digitação' } });
      fireEvent.click(screen.getByRole('button', { name: 'Estornar fechamento' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }));
      expect(await within(regiao).findByText('Estornado')).toBeInTheDocument();
      expect(within(regiao).queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Este dia já tem/)).not.toBeInTheDocument();
    });

    it('depois de confirmar uma baixa, o novo lançamento aparece na lista sem sair da tela', async () => {
      const hojeUrl = `/vendas/fechamentos-manuais?data=${dataHojeNaLoja()}`;
      let confirmou = false;
      abrirComLista(
        { [hojeUrl]: () => (confirmou ? { ...lista(ativo), data: dataHojeNaLoja() } : listaVazia) },
        {
          '/vendas/fechamento-manual/simulacao': { data: dataHojeNaLoja(), itens: [], consumos: [], produtosSemFicha: [], temNegativo: false, podeConfirmar: true } as never,
          '/vendas/fechamento-manual': (() => {
            confirmou = true;
            return { reaproveitado: false, vendaId: 'v1', externalId: 'manual:a', chaveIdempotencia: 'x', data: dataHojeNaLoja(), ocorridoEm: '', itens: [{ produtoId: 'p1', nome: 'X-Bacon House', quantidade: 1 }], consumos: [], insumosComEstoqueNegativo: [] };
          }) as never,
        },
      );
      expect(await screen.findByText('Nenhum fechamento lançado neste dia.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar X-Bacon House' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ver impacto no estoque' }));
      await screen.findByRole('region', { name: 'Impacto no estoque' });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Dar baixa' }));
      await screen.findByRole('heading', { level: 1, name: 'Baixa registrada' });
      const regiao = await screen.findByRole('region', { name: 'Lançamentos do dia' });
      expect(await within(regiao).findByText('Turno noite')).toBeInTheDocument();
    });
  });
});
