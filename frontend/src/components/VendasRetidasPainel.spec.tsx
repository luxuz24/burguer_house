import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import VendasRetidasPainel from './VendasRetidasPainel';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import type { VendasRetidasResposta } from '../lib/vendasRetidas';

const respostaRetidas: VendasRetidasResposta = {
  retidas: [
    {
      id: 'v-1',
      externalId: 'ped-101',
      criadoEm: '2026-11-13T15:30:00.000Z',
      check: 1,
      motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'X-Tudo' }],
    },
    {
      id: 'v-2',
      externalId: 'ped-102',
      criadoEm: '2026-11-13T16:15:00.000Z',
      check: 1,
      motivos: [{ tipo: 'PRODUTO_SEM_FICHA', detalhe: 'Batata M' }],
    },
  ],
  resumoPorProduto: [
    { produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 2 },
    { produto: 'Batata M', tipo: 'PRODUTO_SEM_FICHA', vendas: 1 },
    { produto: 'X-Bacon', tipo: 'COLISAO_NOME', vendas: 1 },
  ],
  aguardandoEstado: 3,
  totalRetidas: 2,
  totalPendentesAnalisadas: 10,
  totalPendentes: 10,
  limite: 200,
  offset: 0,
  temMais: false,
};

describe('components/VendasRetidasPainel', () => {
  it('exibe indicador, resumoPorProduto com alvos >= 44px e ações por tipo de motivo quando totalRetidas > 0', () => {
    const onCorrigir = vi.fn();
    renderComProviders(
      <VendasRetidasPainel dados={respostaRetidas} onCorrigirItem={onCorrigir} />,
    );

    expect(screen.getByText('2 vendas retidas')).toBeInTheDocument();
    expect(screen.getByText('X-Tudo')).toBeInTheDocument();
    expect(screen.getByText(/2 vendas · Produto fora do catálogo/)).toBeInTheDocument();
    expect(screen.getByText(/1 venda · Produto sem ficha técnica/)).toBeInTheDocument();
    expect(screen.getByText(/1 venda · Colisão de nome no cardápio/)).toBeInTheDocument();

    const btnCriar = screen.getByRole('button', { name: /Criar produto X-Tudo/i });
    const btnFicha = screen.getByRole('button', { name: /Montar ficha de Batata M/i });
    const btnColisao = screen.getByRole('button', { name: /Revisar X-Bacon/i });

    expect(btnCriar.className).toContain('min-h-[44px]');
    expect(btnFicha.className).toContain('min-h-[44px]');
    expect(btnColisao.className).toContain('min-h-[44px]');

    fireEvent.click(btnCriar);
    expect(onCorrigir).toHaveBeenCalledWith({ produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO' });
  });

  it('oculta completamente o alerta quando totalRetidas === 0 (mesmo com aguardandoEstado > 0)', () => {
    const { container } = renderComProviders(
      <VendasRetidasPainel
        dados={{
          ...respostaRetidas,
          retidas: [],
          resumoPorProduto: [],
          totalRetidas: 0,
          aguardandoEstado: 4,
        }}
        onCorrigirItem={vi.fn()}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('exibe aguardandoEstado separado das vendas com erro e mostra a lista detalhada com externalId, data e motivos', () => {
    renderComProviders(
      <VendasRetidasPainel dados={respostaRetidas} onCorrigirItem={vi.fn()} />,
    );

    // Contagem separada e explícita de aguardandoEstado
    expect(screen.getByText(/3 pedidos aguardando confirmação de status/i)).toBeInTheDocument();

    // Abre detalhes individuais
    const btnDetalhes = screen.getByRole('button', { name: /Ver detalhes/i });
    expect(btnDetalhes.className).toContain('min-h-[44px]');
    fireEvent.click(btnDetalhes);

    expect(screen.getByText(/ped-101/)).toBeInTheDocument();
    expect(screen.getByText(/ped-102/)).toBeInTheDocument();
    // America/Campo_Grande (-04:00): 2026-11-13T15:30:00Z -> 13/11, 11:30
    expect(screen.getByText(/13\/11, 11:30/)).toBeInTheDocument();
  });

  it('não exibe botão enganoso de produto para ITEM_INVALIDO ou SEM_ITENS', () => {
    renderComProviders(
      <VendasRetidasPainel
        dados={{
          ...respostaRetidas,
          resumoPorProduto: [{ produto: '(sem nome)', tipo: 'ITEM_INVALIDO', vendas: 1 }],
          totalRetidas: 1,
          aguardandoEstado: 0,
        }}
        onCorrigirItem={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 venda · Item inválido no pedido/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Criar produto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Montar ficha/i })).not.toBeInTheDocument();
  });

  it('usa apenas tokens de design (sem cores literais)', () => {
    esperarSemCoresLiterais('src/components/VendasRetidasPainel.tsx');
  });
});
