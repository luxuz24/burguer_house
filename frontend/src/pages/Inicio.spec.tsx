import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Inicio from './Inicio';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

const kpis = {
  totalVendasValor: 1284.5, totalVendasQtd: 48, totalComprasValor: 612.3, totalComprasQtd: 2,
  totalPerdasValor: 38.4, totalPerdasQtd: 3, insumosEmAlertaQtd: 2,
};
const alertas = [
  { id: 'a1', nome: 'Molho da casa', unidade: 'Mililitros', estoqueAtual: 900, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: 180, vencido: true },
  { id: 'a2', nome: 'Pão brioche', unidade: 'Unidades', estoqueAtual: 12, estoqueMinimo: 40, status: 'ALERTA', percentualEstoque: 30 },
];
const resumo = (estoqueAlerta = alertas) => ({
  kpis, estoqueAlerta, itensMaisVendidos: [{ produtoNome: 'X-Bacon', quantidadeVendida: 18 }, { produtoNome: 'X-Salada', quantidadeVendida: 9 }],
});

function abrir(dados: unknown = resumo(), extra: Partial<Parameters<typeof Inicio>[0]> = {}) {
  const props = { onNavegar: vi.fn(), onAbrirImportarNota: vi.fn(), onAbrirPerfil: vi.fn(), onAbrirConfiguracoes: vi.fn(), ...extra };
  renderComProviders(<Inicio {...props} />, { routes: { get: { '/dashboard/resumo': dados } } });
  return props;
}

describe('pages/Inicio - tela inicial do esboço (telas.html#inicio)', () => {
  it('cumprimenta pelo primeiro nome e abre Perfil e Configurações (o cabeçalho global saiu)', async () => {
    const props = abrir();
    expect(await screen.findByRole('heading', { name: /, Carlos$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    fireEvent.click(screen.getByRole('button', { name: /^Perfil de / }));
    expect(props.onAbrirConfiguracoes).toHaveBeenCalledTimes(1);
    expect(props.onAbrirPerfil).toHaveBeenCalledTimes(1);
  });

  it('o Smash resume os alertas e cada alerta tem a ação certa', async () => {
    const props = abrir();
    expect(await screen.findByText('2 insumos pedem atenção.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar perda' }));
    expect(props.onNavegar).toHaveBeenCalledWith('perdas');
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }));
    expect(props.onAbrirImportarNota).toHaveBeenCalledTimes(1);
  });

  it('insumo vencendo com estoque folgado mostra o prazo e leva ao estoque, não manda comprar', async () => {
    // Formato do backend (dashboard.service.ts): diasRestantesValidade só vem quando a validade é o motivo do alerta
    const vencendo = { id: 'v1', nome: 'Queijo cheddar', unidade: 'Gramas', estoqueAtual: 4000, estoqueMinimo: 1000, status: 'ALERTA', percentualEstoque: 400, diasRestantesValidade: 2, vencido: false };
    const props = abrir(resumo([vencendo] as typeof alertas));
    expect(await screen.findByText('Vence em 2 dias · 4.000 Gramas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comprar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver Queijo cheddar no estoque' }));
    expect(props.onNavegar).toHaveBeenCalledWith('estoque');
    expect(props.onAbrirImportarNota).not.toHaveBeenCalled();
  });

  it('sem alertas mostra que está tudo em dia', async () => {
    abrir(resumo([]));
    expect(await screen.findByText('Tudo em dia. Bom serviço!')).toBeInTheDocument();
    expect(screen.getByText('Nenhum insumo abaixo do mínimo ou vencido.')).toBeInTheDocument();
  });

  it('se o resumo falhar, avisa e oferece tentar de novo (antes ficava vazio, só com console.error)', async () => {
    abrir({ status: 503, data: { message: 'Servidor acordando' } });
    expect(await screen.findByText('Não consegui carregar o resumo de hoje.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('mostra os mais vendidos do dia', async () => {
    abrir();
    expect(await screen.findByText('X-Bacon')).toBeInTheDocument();
    expect(screen.getByText('X-Salada')).toBeInTheDocument();
  });

  it('usa só tokens de design (Inicio e App)', () => {
    esperarSemCoresLiterais('src/pages/Inicio.tsx');
    esperarSemCoresLiterais('src/App.tsx');
  });
});
