import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';

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
    expect(screen.getByText('1206 pedidos')).toBeInTheDocument();
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
    expect(screen.getByText('Nenhum insumo abaixo do mínimo.')).toBeInTheDocument();
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

  it('usa só tokens de design', () => {
    esperarSemCoresLiterais('src/pages/Dashboard.tsx');
  });
});
