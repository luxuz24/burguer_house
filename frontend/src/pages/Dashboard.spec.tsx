import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import Dashboard from './Dashboard';
import { renderComProviders, criarErroAxios } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';
import { hojeNaLoja, inicioDoMesNaLoja } from './periodoPersonalizado';

const resumo = {
  periodo: { tipo: 'mes', dataInicio: '2026-11-01', dataFim: '2026-11-30' },
  kpis: { totalVendasValor: 31920, totalVendasQtd: 1206, totalComprasValor: 14380, totalComprasQtd: 23, totalPerdasValor: 412, totalPerdasQtd: 18, insumosEmAlertaQtd: 4 },
  perdasPorMotivo: [
    { motivo: 'VENCIMENTO', label: 'Vencimento', valorTotal: 210, quantidadeTotal: 9, totalOcorrencias: 9, percentual: 51 },
    { motivo: 'ERRO_PREPARO', label: 'Erro de preparo', valorTotal: 128, quantidadeTotal: 6, totalOcorrencias: 6, percentual: 31 },
  ],
  consumoInsumos: [{ insumoId: 'i1', nome: 'Blend bovino', unidade: 'Unidades', quantidadeConsumida: 1206, valorEstimado: 7839 }],
  itensMaisVendidos: [{ produtoNome: 'X-Bacon', quantidadeVendida: 412, valorEstimadoTotal: 12360 }],
  estoqueAlerta: [{ id: 'a1', nome: 'Pão brioche', unidade: 'Unidades', estoqueAtual: 12, estoqueMinimo: 40, status: 'CRITICO', percentualEstoque: 30 }],
  comprasPorFornecedor: [{ fornecedorNome: 'Distribuidora Carnes Sul', fornecedorCnpj: '1', valorTotal: 7900, totalNotas: 6, percentual: 55 }],
};

describe('pages/Dashboard - Relatórios do esboço (telas.html#relatorios)', () => {
  it('mostra os 4 KPIs, com perdas como % das compras', async () => {
    renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': resumo } } });
    expect(await screen.findByText(/R\$\s*31\.920,00/)).toBeInTheDocument();
    expect(screen.getByText('1.206 pedidos')).toBeInTheDocument();
    // 412 / 14.380 = 2,86% → 2,9%
    expect(screen.getByText('2,9% das compras')).toBeInTheDocument();
    expect(screen.getByText('insumos')).toBeInTheDocument();
  });

  it('as seções respondem às perguntas com os dados do backend', async () => {
    renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': resumo } } });
    expect(await screen.findByText('Onde o dinheiro está indo embora?')).toBeInTheDocument();
    expect(screen.getByText('Distribuidora Carnes Sul')).toBeInTheDocument();
    expect(screen.getByText('30% do mínimo')).toBeInTheDocument();
    expect(screen.getByText('X-Bacon')).toBeInTheDocument();
  });

  it('trocar o período busca de novo com o período escolhido', async () => {
    renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': resumo } } });
    await screen.findByText('Onde o dinheiro está indo embora?');
    fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/dashboard/resumo', { params: { periodo: 'hoje' } }),
    );
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
  });

  it('período vazio mostra mensagens em vez de seções em branco', async () => {
    const vazio = { ...resumo, perdasPorMotivo: [], comprasPorFornecedor: [], estoqueAlerta: [], itensMaisVendidos: [], consumoInsumos: [] };
    renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': vazio } } });
    expect(await screen.findByText('Nenhuma perda no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum insumo abaixo do mínimo ou vencido.')).toBeInTheDocument();
  });

  it('erro na carga mostra o Smash e "Tentar novamente"', async () => {
    renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': { status: 503, data: { message: 'Servidor acordando' } } } } });
    expect(await screen.findByText('Não consegui carregar os relatórios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('"O que está para faltar?" mostra o prazo de quem vence, e não "% do mínimo"', async () => {
    const estoqueAlerta = [
      ...resumo.estoqueAlerta,
      { id: 'v1', nome: 'Queijo cheddar', unidade: 'Gramas', estoqueAtual: 4000, estoqueMinimo: 1000, status: 'ALERTA', percentualEstoque: 400, diasRestantesValidade: 2, vencido: false },
      { id: 'v2', nome: 'Molho da casa', unidade: 'Mililitros', estoqueAtual: 900, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: 180, diasRestantesValidade: -1, vencido: true },
    ];
    renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': { ...resumo, estoqueAlerta } } } });
    expect(await screen.findByText('Vence em 2 dias')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('30% do mínimo')).toBeInTheDocument();
    expect(screen.queryByText('400% do mínimo')).not.toBeInTheDocument();
  });

  describe('endurecimento F4', () => {
    const motivosZerados = ['VENCIMENTO', 'ERRO_PREPARO', 'ESTRAGADO', 'OUTRO'].map((motivo) => ({
      motivo, label: motivo, valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0, percentual: 0,
    }));
    const abrir = (dados: unknown) => renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': dados } } });

    /** Promessa controlada pelo teste, para segurar uma resposta e soltar na ordem que o cenário pede. */
    function adiada<T>() {
      let resolver!: (v: T) => void;
      let rejeitar!: (e: unknown) => void;
      const promessa = new Promise<T>((res, rej) => { resolver = res; rejeitar = rej; });
      return { promessa, resolver, rejeitar };
    }

    it('#D8 o backend manda os 4 motivos zerados quando não há perda: mostra o estado vazio', async () => {
      abrir({ ...resumo, perdasPorMotivo: motivosZerados });
      expect(await screen.findByText('Nenhuma perda no período.')).toBeInTheDocument();
    });

    it('#D8 só os motivos com perda aparecem (os zerados não ganham barra)', async () => {
      const perdas = motivosZerados.map((m) => (m.motivo === 'ESTRAGADO' ? { ...m, label: 'Estragado', valorTotal: 74, totalOcorrencias: 3 } : m));
      abrir({ ...resumo, perdasPorMotivo: perdas });
      expect(await screen.findByText('Estragado')).toBeInTheDocument();
      expect(screen.queryByText('VENCIMENTO')).not.toBeInTheDocument();
      expect(screen.queryByText('OUTRO')).not.toBeInTheDocument();
    });

    it('#D8 motivo com ocorrência mas valor R$ 0 (insumo sem custo) continua listado', async () => {
      const perdas = motivosZerados.map((m) => (m.motivo === 'OUTRO' ? { ...m, label: 'Outro', totalOcorrencias: 2 } : m));
      abrir({ ...resumo, perdasPorMotivo: perdas });
      expect(await screen.findByText('Outro')).toBeInTheDocument();
      expect(screen.queryByText('Nenhuma perda no período.')).not.toBeInTheDocument();
    });

    it('#D5 contagens em pt-BR e no singular', async () => {
      abrir({ ...resumo, kpis: { ...resumo.kpis, totalVendasQtd: 1, totalComprasQtd: 1, totalComprasValor: 0, totalPerdasQtd: 1, insumosEmAlertaQtd: 1 } });
      expect(await screen.findByText('1 pedido')).toBeInTheDocument();
      expect(screen.getByText('1 nota')).toBeInTheDocument();
      expect(screen.getByText('1 registro')).toBeInTheDocument();
      expect(screen.getByText('insumo')).toBeInTheDocument();
    });

    it('#D5/#D7 milhar em pt-BR nos KPIs e nos mais vendidos', async () => {
      abrir({
        ...resumo,
        kpis: { ...resumo.kpis, totalComprasQtd: 1500, insumosEmAlertaQtd: 1200 },
        itensMaisVendidos: [{ produtoNome: 'X-Bacon', quantidadeVendida: 1500, valorEstimadoTotal: 1 }],
      });
      expect(await screen.findByText('1.206 pedidos')).toBeInTheDocument();
      expect(screen.getByText('1.500 notas')).toBeInTheDocument();
      expect(screen.getByText('1.200')).toBeInTheDocument();
      expect(screen.getByText('1.500 un')).toBeInTheDocument();
    });

    it('#D12 vencido entra nos 6 visíveis mesmo vindo depois de 6 itens de estoque baixo', async () => {
      const baixos = Array.from({ length: 6 }, (_, i) => ({
        id: `e${i}`, nome: `Insumo ${i}`, unidade: 'Unidades', estoqueAtual: i, estoqueMinimo: 10, status: 'CRITICO', percentualEstoque: i * 10,
      }));
      const vencido = { id: 'v', nome: 'Molho da casa', unidade: 'Mililitros', estoqueAtual: 900, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: 180, diasRestantesValidade: -1, vencido: true };
      abrir({ ...resumo, estoqueAlerta: [...baixos, vencido] });
      expect(await screen.findByText('Molho da casa')).toBeInTheDocument();
      expect(screen.getByText('Vencido')).toBeInTheDocument();
      expect(screen.queryByText('Insumo 5')).not.toBeInTheDocument();
    });

    it('#I4 em Relatórios: dias <= 0 sem a flag é "Vencido"; null não vira "Vence hoje"', async () => {
      abrir({
        ...resumo,
        estoqueAlerta: [
          { id: 'a', nome: 'Maionese', unidade: 'Gramas', estoqueAtual: 300, estoqueMinimo: 100, status: 'CRITICO', percentualEstoque: 300, diasRestantesValidade: 0 },
          { id: 'b', nome: 'Pão', unidade: 'Unidades', estoqueAtual: 5, estoqueMinimo: 40, status: 'CRITICO', percentualEstoque: 12.5, diasRestantesValidade: null, vencido: null },
        ],
      });
      expect(await screen.findByText('Vencido')).toBeInTheDocument();
      expect(screen.getByText('12,5% do mínimo')).toBeInTheDocument();
      expect(screen.queryByText('Vence hoje')).not.toBeInTheDocument();
    });

    it('#D11 sem alertas: o texto vazio cobre também validade', async () => {
      abrir({ ...resumo, estoqueAlerta: [] });
      expect(await screen.findByText('Nenhum insumo abaixo do mínimo ou vencido.')).toBeInTheDocument();
    });

    it('#D14 estoque zerado ou negativo não vira "100% do mínimo" (mínimo 0 → percentual 100 no backend)', async () => {
      abrir({
        ...resumo,
        estoqueAlerta: [
          { id: 'z', nome: 'Guardanapo', unidade: 'Unidades', estoqueAtual: 0, estoqueMinimo: 0, status: 'CRITICO', percentualEstoque: 100 },
          { id: 'n', nome: 'Bacon', unidade: 'Gramas', estoqueAtual: -200, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: -40 },
        ],
      });
      expect(await screen.findByText('Guardanapo')).toBeInTheDocument();
      expect(screen.getAllByText('Sem estoque')).toHaveLength(2);
      expect(screen.queryByText('100% do mínimo')).not.toBeInTheDocument();
      expect(screen.queryByText('-40% do mínimo')).not.toBeInTheDocument();
    });

    it('#D15 abas de período com alvo de 44px', async () => {
      abrir(resumo);
      await screen.findByText('Onde o dinheiro está indo embora?');
      for (const nome of ['Hoje', '7 dias', 'Mês']) {
        expect(screen.getByRole('tab', { name: nome }).className).toContain('min-h-[44px]');
      }
    });

    it('#D17 carregamento anunciado a leitores de tela', async () => {
      abrir(resumo);
      expect(screen.getByText('Juntando os números do período…').closest('[role="status"]')).not.toBeNull();
      await screen.findByText('Onde o dinheiro está indo embora?');
    });

    it('#D3 resposta 200 sem os dados (ex.: index.html do proxy) mostra erro com mensagem, não em branco', async () => {
      abrir('<!doctype html>');
      expect(await screen.findByText('Não consegui carregar os relatórios')).toBeInTheDocument();
      expect(screen.getByText('Não foi possível carregar os relatórios.')).toBeInTheDocument();
    });

    it('erro 400 do backend mostra a mensagem dele', async () => {
      abrir({ status: 400, data: { message: 'O intervalo máximo permitido para consulta no dashboard é de 366 dias' } });
      expect(await screen.findByText('O intervalo máximo permitido para consulta no dashboard é de 366 dias')).toBeInTheDocument();
    });

    it('#D1 "Tentar novamente" do aviso de recarga não dispara duas buscas em duplo clique', async () => {
      abrir(resumo);
      await screen.findByText('Onde o dinheiro está indo embora?');
      const get = vi.mocked(api.get);
      get.mockRejectedValueOnce(criarErroAxios(503, { message: 'Servidor acordando' }));
      fireEvent.click(screen.getByRole('button', { name: 'Atualizar relatórios' }));
      expect(await screen.findByText('Servidor acordando')).toBeInTheDocument();

      const pendente = adiada<{ data: unknown }>();
      get.mockClear();
      get.mockImplementation(() => pendente.promessa as never);
      const tentar = screen.getByRole('button', { name: 'Tentar novamente' });
      fireEvent.click(tentar);
      fireEvent.click(tentar);
      expect(get).toHaveBeenCalledTimes(1);
      await act(async () => pendente.resolver({ data: resumo }));
      await waitFor(() => expect(screen.queryByText('Servidor acordando')).not.toBeInTheDocument());
    });

    it('#D2 troca rápida de período: resposta atrasada do período anterior não sobrescreve o atual', async () => {
      abrir(resumo);
      await screen.findByText('Onde o dinheiro está indo embora?');
      const get = vi.mocked(api.get);
      const hoje = adiada<{ data: unknown }>();
      const semana = adiada<{ data: unknown }>();
      get.mockImplementation(((_url: string, config?: { params?: { periodo?: string } }) =>
        config?.params?.periodo === 'hoje' ? hoje.promessa : semana.promessa) as never);

      fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
      fireEvent.click(screen.getByRole('tab', { name: '7 dias' }));
      await act(async () => semana.resolver({ data: { ...resumo, kpis: { ...resumo.kpis, totalVendasQtd: 77 } } }));
      expect(await screen.findByText('77 pedidos')).toBeInTheDocument();
      await act(async () => hoje.resolver({ data: { ...resumo, kpis: { ...resumo.kpis, totalVendasQtd: 11 } } }));
      expect(screen.getByText('77 pedidos')).toBeInTheDocument();
      expect(screen.queryByText('11 pedidos')).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '7 dias' })).toHaveAttribute('aria-selected', 'true');
    });

    it('desmontar com a busca pendente não gera erro nem aviso', async () => {
      const erroConsole = vi.spyOn(console, 'error');
      const pendente = adiada<{ data: unknown }>();
      const { unmount } = abrir(resumo);
      vi.mocked(api.get).mockImplementation(() => pendente.promessa as never);
      await screen.findByText('Onde o dinheiro está indo embora?');
      fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
      unmount();
      await act(async () => pendente.resolver({ data: resumo }));
      expect(erroConsole).not.toHaveBeenCalled();
    });
  });

  describe('período personalizado (ícone de calendário do esboço)', () => {
    const abrir = (dados: unknown = resumo) => renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': dados } } });

    async function preencher(inicio: string, fim: string, esperarCarga = true) {
      if (esperarCarga) await screen.findByText('Onde o dinheiro está indo embora?');
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      fireEvent.change(screen.getByLabelText('De'), { target: { value: inicio } });
      fireEvent.change(screen.getByLabelText('Até'), { target: { value: fim } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    }

    it('aplica o intervalo e busca com dataInicio/dataFim (sem periodo), como em docs/api.md', async () => {
      abrir();
      await preencher('2026-10-01', '2026-10-31');
      await waitFor(() =>
        expect(api.get).toHaveBeenLastCalledWith('/dashboard/resumo', { params: { dataInicio: '2026-10-01', dataFim: '2026-10-31' } }),
      );
      expect(screen.getByRole('tab', { name: 'Período personalizado' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Mês' })).toHaveAttribute('aria-selected', 'false');
      expect(await screen.findByText(/01\/10\/2026 a 31\/10\/2026/)).toBeInTheDocument();
    });

    it('início depois do fim: avisa e não chama o backend', async () => {
      abrir();
      await screen.findByText('Onde o dinheiro está indo embora?');
      const chamadas = vi.mocked(api.get).mock.calls.length;
      await preencher('2026-11-10', '2026-11-01');
      expect(screen.getByRole('alert')).toHaveTextContent('A data de início não pode ser depois da data de fim.');
      expect(vi.mocked(api.get).mock.calls.length).toBe(chamadas);
    });

    it('mais de 366 dias: avisa e não chama o backend; 366 dias passa', async () => {
      abrir();
      await screen.findByText('Onde o dinheiro está indo embora?');
      const chamadas = vi.mocked(api.get).mock.calls.length;
      await preencher('2026-01-01', '2027-01-02');
      expect(screen.getByRole('alert')).toHaveTextContent('O período pode ter no máximo 366 dias.');
      expect(vi.mocked(api.get).mock.calls.length).toBe(chamadas);

      fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2027-01-01' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
      await waitFor(() =>
        expect(api.get).toHaveBeenLastCalledWith('/dashboard/resumo', { params: { dataInicio: '2026-01-01', dataFim: '2027-01-01' } }),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('data apagada: pede as duas datas', async () => {
      abrir();
      await preencher('', '2026-11-01');
      expect(screen.getByRole('alert')).toHaveTextContent('Informe as duas datas.');
    });

    it('400 do backend no período personalizado mostra a mensagem dele', async () => {
      abrir();
      await screen.findByText('Onde o dinheiro está indo embora?');
      vi.mocked(api.get).mockRejectedValueOnce(criarErroAxios(400, { message: 'Datas de filtro personalizado inválidas' }));
      await preencher('2026-10-01', '2026-10-31');
      expect(await screen.findByText('Datas de filtro personalizado inválidas')).toBeInTheDocument();
    });

    it('Cancelar fecha sem trocar o período; voltar para "Hoje" depois do personalizado busca hoje', async () => {
      abrir();
      await screen.findByText('Onde o dinheiro está indo embora?');
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Mês' })).toHaveAttribute('aria-selected', 'true');

      await preencher('2026-10-01', '2026-10-31');
      await screen.findByText(/01\/10\/2026 a 31\/10\/2026/);
      fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
      await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/dashboard/resumo', { params: { periodo: 'hoje' } }));
      expect(screen.queryByText(/01\/10\/2026 a 31\/10\/2026/)).not.toBeInTheDocument();
    });

    it('corrida: resposta atrasada de "Hoje" não sobrescreve o período personalizado escolhido depois', async () => {
      abrir();
      await screen.findByText('Onde o dinheiro está indo embora?');
      const get = vi.mocked(api.get);
      let soltarHoje!: (v: unknown) => void;
      const hoje = new Promise((res) => { soltarHoje = res; });
      get.mockImplementation(((_url: string, config?: { params?: Record<string, string> }) =>
        config?.params?.periodo === 'hoje'
          ? hoje
          : Promise.resolve({ data: { ...resumo, kpis: { ...resumo.kpis, totalVendasQtd: 31 } } })) as never);
      fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
      await preencher('2026-10-01', '2026-10-31', false);
      expect(await screen.findByText('31 pedidos')).toBeInTheDocument();
      await act(async () => soltarHoje({ data: { ...resumo, kpis: { ...resumo.kpis, totalVendasQtd: 5 } } }));
      expect(screen.getByText('31 pedidos')).toBeInTheDocument();
      expect(screen.queryByText('5 pedidos')).not.toBeInTheDocument();
    });

    it('campos de data e botões com alvo de 44px', async () => {
      abrir();
      await screen.findByText('Onde o dinheiro está indo embora?');
      const tab = screen.getByRole('tab', { name: 'Período personalizado' });
      expect(tab.className).toContain('min-h-[44px]');
      expect(tab.className).toContain('min-w-[44px]');
      fireEvent.click(tab);
      for (const el of [screen.getByLabelText('De'), screen.getByLabelText('Até'), screen.getByRole('button', { name: 'Aplicar' })]) {
        expect(el.className).toContain('min-h-[44px]');
      }
    });
  });

  describe('cenários da matriz (mutação)', () => {
    const abrir = (dados: unknown = resumo) => renderComProviders(<Dashboard />, { routes: { get: { '/dashboard/resumo': dados } } });
    const carregado = () => screen.findByText('Onde o dinheiro está indo embora?');
    /** Elemento da barra na linha cujo rótulo contém o texto. */
    const barra = (texto: string) =>
      (screen.getByText(texto).closest('.py-1') as HTMLElement).querySelector('[style]') as HTMLElement;

    it('barras proporcionais ao maior valor; mínimo de 3% para valor pequeno; nada para zero', async () => {
      abrir({
        ...resumo,
        perdasPorMotivo: [
          { motivo: 'VENCIMENTO', label: 'Vencimento', valorTotal: 200, quantidadeTotal: 1, totalOcorrencias: 1, percentual: 0 },
          { motivo: 'ERRO_PREPARO', label: 'Erro de preparo', valorTotal: 100, quantidadeTotal: 1, totalOcorrencias: 1, percentual: 0 },
          { motivo: 'ESTRAGADO', label: 'Estragado', valorTotal: 1, quantidadeTotal: 1, totalOcorrencias: 1, percentual: 0 },
          { motivo: 'OUTRO', label: 'Outro', valorTotal: 0, quantidadeTotal: 1, totalOcorrencias: 2, percentual: 0 },
        ],
        comprasPorFornecedor: [
          { fornecedorNome: 'F1', fornecedorCnpj: '1', valorTotal: 400, totalNotas: 1, percentual: 0 },
          { fornecedorNome: 'F2', fornecedorCnpj: '2', valorTotal: 100, totalNotas: 1, percentual: 0 },
        ],
        itensMaisVendidos: [
          { produtoNome: 'V1', quantidadeVendida: 10, valorEstimadoTotal: 0 },
          { produtoNome: 'V2', quantidadeVendida: 5, valorEstimadoTotal: 0 },
        ],
        consumoInsumos: [
          { insumoId: 'c1', nome: 'Barato', unidade: 'Gramas', quantidadeConsumida: 9000, valorEstimado: 50 },
          { insumoId: 'c2', nome: 'Caro', unidade: 'Unidades', quantidadeConsumida: 10, valorEstimado: 200 },
        ],
      });
      await carregado();
      expect(barra('Vencimento').style.width).toBe('100%');
      expect(barra('Erro de preparo').style.width).toBe('50%');
      expect(barra('Estragado').style.width).toBe('3%');
      expect(barra('Outro').style.width).toBe('0%');
      expect(barra('F1').style.width).toBe('100%');
      expect(barra('F2').style.width).toBe('25%');
      expect(barra('V1').style.width).toBe('100%');
      expect(barra('V2').style.width).toBe('50%');
      expect(barra('Caro').style.width).toBe('100%');
      expect(barra('Barato').style.width).toBe('25%');
      // consumo ordenado por custo (o backend manda por quantidade)
      const nomes = screen.getAllByText(/^(Barato|Caro)/).map((el) => el.textContent?.trim().split(' ')[0]);
      expect(nomes).toEqual(['Caro', 'Barato']);
      expect(screen.getByText(/· 9\.000 Gramas/)).toBeInTheDocument();
    });

    it('cor da barra por motivo; motivo desconhecido usa a neutra', async () => {
      abrir({
        ...resumo,
        perdasPorMotivo: [
          { motivo: 'ERRO_PREPARO', label: 'Erro de preparo', valorTotal: 10, quantidadeTotal: 1, totalOcorrencias: 1, percentual: 0 },
          { motivo: 'NOVO', label: 'Motivo novo', valorTotal: 5, quantidadeTotal: 1, totalOcorrencias: 1, percentual: 0 },
        ],
      });
      await carregado();
      expect(barra('Erro de preparo').className).toContain('bg-primary');
      expect(barra('Motivo novo').className).toContain('bg-muted');
    });

    it('motivo com valor mas sem ocorrência contada também aparece', async () => {
      abrir({
        ...resumo,
        perdasPorMotivo: [{ motivo: 'OUTRO', label: 'Outro', valorTotal: 9, quantidadeTotal: 1, totalOcorrencias: 0, percentual: 0 }],
      });
      expect(await screen.findByText('Outro')).toBeInTheDocument();
    });

    it('subtítulo da seção é um parágrafo próprio; seção sem subtítulo não ganha parágrafo vazio', async () => {
      abrir();
      await carregado();
      expect(screen.getByText('Perdas por motivo').tagName).toBe('P');
      expect(screen.getByText('O que está para faltar?').nextElementSibling?.tagName).not.toBe('P');
    });

    it('cortes: 5 fornecedores, 5 mais vendidos (numerados), 5 de consumo', async () => {
      const seis = Array.from({ length: 6 }, (_, i) => i);
      abrir({
        ...resumo,
        comprasPorFornecedor: seis.map((i) => ({ fornecedorNome: `Forn ${i}`, fornecedorCnpj: `${i}`, valorTotal: 100 - i, totalNotas: 1, percentual: 0 })),
        itensMaisVendidos: seis.map((i) => ({ produtoNome: `Prod ${i}`, quantidadeVendida: 100 - i, valorEstimadoTotal: 0 })),
        consumoInsumos: seis.map((i) => ({ insumoId: `c${i}`, nome: `Cons ${i}`, unidade: 'Gramas', quantidadeConsumida: 1, valorEstimado: 100 - i })),
      });
      await carregado();
      expect(screen.getByText('Forn 4')).toBeInTheDocument();
      expect(screen.queryByText('Forn 5')).not.toBeInTheDocument();
      expect(screen.getByText(/Prod 4/)).toBeInTheDocument();
      expect(screen.queryByText(/Prod 5/)).not.toBeInTheDocument();
      expect(screen.getByText(/Cons 4/)).toBeInTheDocument();
      expect(screen.queryByText(/Cons 5/)).not.toBeInTheDocument();
      expect(screen.getByText(/Prod 0/).textContent).toMatch(/^1/);
      expect(screen.getByText(/Prod 4/).textContent).toMatch(/^5/);
    });

    it('fornecedores sem CNPJ não colidem (chave pelo nome)', async () => {
      abrir({
        ...resumo,
        comprasPorFornecedor: [
          { fornecedorNome: 'Feira A', fornecedorCnpj: '', valorTotal: 10, totalNotas: 1, percentual: 0 },
          { fornecedorNome: 'Feira B', fornecedorCnpj: '', valorTotal: 5, totalNotas: 1, percentual: 0 },
        ],
      });
      await carregado();
      expect(screen.getByText('Feira A')).toBeInTheDocument();
      expect(screen.getByText('Feira B')).toBeInTheDocument();
    });

    it('estados vazios de cada seção', async () => {
      abrir({ ...resumo, comprasPorFornecedor: [], itensMaisVendidos: [], consumoInsumos: [] });
      await carregado();
      expect(screen.getByText('Nenhuma nota fiscal no período.')).toBeInTheDocument();
      expect(screen.getByText('Nenhuma venda no período.')).toBeInTheDocument();
      expect(screen.getByText('Sem consumo calculado no período.')).toBeInTheDocument();
    });

    it('com dados, as seções não mostram os textos de vazio', async () => {
      abrir();
      await carregado();
      for (const t of ['Nenhuma perda no período.', 'Nenhuma nota fiscal no período.', 'Nenhuma venda no período.', 'Sem consumo calculado no período.']) {
        expect(screen.queryByText(t)).not.toBeInTheDocument();
      }
      expect(screen.getByText(/Blend bovino/)).toBeInTheDocument();
    });

    it('cor do chip: vencendo em destaque de marca, vencido e estoque em perigo', async () => {
      abrir({
        ...resumo,
        estoqueAlerta: [
          { id: 'v', nome: 'Cheddar', unidade: 'g', estoqueAtual: 1, estoqueMinimo: 1, status: 'ALERTA', percentualEstoque: 100, diasRestantesValidade: 2, vencido: false },
          { id: 'x', nome: 'Molho', unidade: 'ml', estoqueAtual: 1, estoqueMinimo: 1, status: 'CRITICO', percentualEstoque: 100, diasRestantesValidade: -1, vencido: true },
          { id: 'e', nome: 'Pão', unidade: 'un', estoqueAtual: 1, estoqueMinimo: 10, status: 'CRITICO', percentualEstoque: 10 },
        ],
      });
      expect((await screen.findByText('Vence em 2 dias')).className).toContain('text-brand');
      expect(screen.getByText('Vencido').className).toContain('text-danger');
      expect(screen.getByText('10% do mínimo').className).toContain('text-danger');
    });

    it('200 com kpis que não é objeto é erro de carga', async () => {
      abrir({ ...resumo, kpis: 'x' });
      expect(await screen.findByText('Não foi possível carregar os relatórios.')).toBeInTheDocument();
    });

    it('200 com corpo null é erro de carga', async () => {
      abrir(null);
      expect(await screen.findByText('Não foi possível carregar os relatórios.')).toBeInTheDocument();
    });

    it('200 sem kpis é erro de carga', async () => {
      abrir({ ...resumo, kpis: undefined });
      expect(await screen.findByText('Não foi possível carregar os relatórios.')).toBeInTheDocument();
    });

    it('"Tentar novamente" do erro de carga refaz a busca', async () => {
      let tentativas = 0;
      abrir(() => (++tentativas === 1 ? { status: 503, data: { message: 'Servidor acordando' } } : resumo));
      fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
      expect(await screen.findByText('Onde o dinheiro está indo embora?')).toBeInTheDocument();
    });

    it('botão Atualizar fica desabilitado durante a carga inicial e gira durante a recarga', async () => {
      abrir();
      const botao = screen.getByRole('button', { name: 'Atualizar relatórios' });
      expect(botao).toBeDisabled();
      await carregado();
      expect(botao).not.toBeDisabled();
      let soltar!: (v: unknown) => void;
      vi.mocked(api.get).mockImplementationOnce(() => new Promise((res) => { soltar = res; }) as never);
      fireEvent.click(botao);
      expect(botao).toBeDisabled();
      expect(botao.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
      await act(async () => soltar({ data: resumo }));
      expect(botao).not.toBeDisabled();
    });

    it('aba selecionada em destaque; demais apagadas; personalizado começa desmarcado', async () => {
      abrir();
      await carregado();
      expect(screen.getByRole('tab', { name: 'Mês' }).className).toContain('bg-card');
      expect(screen.getByRole('tab', { name: 'Hoje' }).className).toContain('text-muted');
      const personalizado = screen.getByRole('tab', { name: 'Período personalizado' });
      expect(personalizado).toHaveAttribute('aria-selected', 'false');
      expect(personalizado).toHaveAttribute('aria-expanded', 'false');
      expect(personalizado.className).toContain('text-muted');
    });

    it('período personalizado: datas iniciais (dia 1 do mês até hoje) e min/max cruzados', async () => {
      abrir();
      await carregado();
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      const de = screen.getByLabelText('De') as HTMLInputElement;
      const ate = screen.getByLabelText('Até') as HTMLInputElement;
      expect(de.value).toBe(inicioDoMesNaLoja());
      expect(ate.value).toBe(hojeNaLoja());
      expect(de).toHaveAttribute('max', hojeNaLoja());
      expect(ate).toHaveAttribute('min', inicioDoMesNaLoja());
      fireEvent.change(de, { target: { value: '' } });
      expect(ate).not.toHaveAttribute('min');
      fireEvent.change(ate, { target: { value: '' } });
      expect(de).not.toHaveAttribute('max');
    });

    it('período personalizado: trocar de intervalo busca de novo; resumo some enquanto edita', async () => {
      abrir();
      await carregado();
      const aplicar = async (de: string, ate: string) => {
        fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
        fireEvent.change(screen.getByLabelText('De'), { target: { value: de } });
        fireEvent.change(screen.getByLabelText('Até'), { target: { value: ate } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
        await carregado();
      };
      await aplicar('2026-09-01', '2026-09-30');
      await aplicar('2026-10-01', '2026-10-31');
      expect(api.get).toHaveBeenLastCalledWith('/dashboard/resumo', { params: { dataInicio: '2026-10-01', dataFim: '2026-10-31' } });
      expect(screen.getByRole('tab', { name: 'Período personalizado' }).className).toContain('bg-card');
      expect(screen.getByRole('tab', { name: 'Mês' }).className).toContain('text-muted');
      expect(screen.getByText(/01\/10\/2026 a 31\/10\/2026/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      expect(screen.queryByText(/01\/10\/2026 a 31\/10\/2026/)).not.toBeInTheDocument();
    });

    it('títulos dos 4 KPIs', async () => {
      abrir();
      await carregado();
      for (const titulo of ['Vendas', 'Compras', 'Perdas', 'Em alerta']) {
        expect(screen.getByText(titulo, { selector: 'p' })).toBeInTheDocument();
      }
      expect(screen.getByText('Compras', { selector: 'p' }).nextElementSibling).toHaveTextContent(/R\$\s*14\.380,00/);
    });

    it('fora do personalizado não aparece resumo de intervalo', async () => {
      abrir();
      await carregado();
      expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^\s*a\s*$/)).not.toBeInTheDocument();
    });

    it('aplicar não submete o formulário de verdade (sem navegação)', async () => {
      abrir();
      await carregado();
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      const form = screen.getByLabelText('De').closest('form') as HTMLFormElement;
      const evento = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(evento);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('aviso de validação some ao cancelar ou ao escolher outra aba', async () => {
      abrir();
      await carregado();
      const invalidar = () => {
        fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-10' } });
        fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-01' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
        expect(screen.getByRole('alert')).toBeInTheDocument();
      };
      invalidar();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));

      invalidar();
      fireEvent.click(screen.getByRole('tab', { name: '7 dias' }));
      await carregado();
      fireEvent.click(screen.getByRole('tab', { name: 'Período personalizado' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('usa só tokens de design', () => {
    esperarSemCoresLiterais('src/pages/Dashboard.tsx');
  });
});
