import { describe, it, expect } from 'vitest';
import {
  mesclarPaginasRetidas,
  normalizarRespostaRetidas,
  rotuloAcaoRetida,
  rotuloMotivoRetida,
  textoAcaoAcessivelRetida,
  textoAguardandoEstado,
  textoTotalRetidas,
  textoVendasContagem,
} from './vendasRetidas';

describe('lib/vendasRetidas', () => {
  it('mapeia todos os tipos de motivo e ações acionáveis', () => {
    expect(rotuloMotivoRetida('PRODUTO_NAO_ENCONTRADO')).toBe('Produto fora do catálogo');
    expect(rotuloMotivoRetida('PRODUTO_SEM_FICHA')).toBe('Produto sem ficha técnica');
    expect(rotuloMotivoRetida('COLISAO_NOME')).toBe('Colisão de nome no cardápio');
    expect(rotuloMotivoRetida('ITEM_INVALIDO')).toBe('Item inválido no pedido');
    expect(rotuloMotivoRetida('SEM_ITENS')).toBe('Pedido sem itens');
    expect(rotuloMotivoRetida('OUTRO')).toBe('OUTRO');

    expect(rotuloAcaoRetida('PRODUTO_NAO_ENCONTRADO')).toBe('Criar produto');
    expect(rotuloAcaoRetida('PRODUTO_SEM_FICHA')).toBe('Montar ficha');
    expect(rotuloAcaoRetida('COLISAO_NOME')).toBe('Revisar produtos');
    expect(rotuloAcaoRetida('ITEM_INVALIDO')).toBeNull();
    expect(rotuloAcaoRetida('SEM_ITENS')).toBeNull();

    expect(textoAcaoAcessivelRetida('PRODUTO_NAO_ENCONTRADO', 'X-Tudo')).toBe('Criar produto X-Tudo');
    expect(textoAcaoAcessivelRetida('PRODUTO_SEM_FICHA', 'Batata M')).toBe('Montar ficha de Batata M');
    expect(textoAcaoAcessivelRetida('COLISAO_NOME', 'X-Bacon')).toBe('Revisar X-Bacon no cardápio');
    expect(textoAcaoAcessivelRetida('SEM_ITENS', '')).toBeNull();
  });

  it('formata singular e plural em pt-BR', () => {
    expect(textoVendasContagem(1)).toBe('1 venda');
    expect(textoVendasContagem(7)).toBe('7 vendas');
    expect(textoTotalRetidas(1)).toBe('1 venda retida');
    expect(textoTotalRetidas(2)).toBe('2 vendas retidas');
    expect(textoAguardandoEstado(1)).toBe('1 pedido aguardando confirmação de status');
    expect(textoAguardandoEstado(3)).toBe('3 pedidos aguardando confirmação de status');
  });

  it('normaliza payload defensivamente e rejeita objetos sem totalRetidas', () => {
    expect(normalizarRespostaRetidas(null)).toBeNull();
    expect(normalizarRespostaRetidas([])).toBeNull();
    expect(normalizarRespostaRetidas({})).toBeNull();
    expect(normalizarRespostaRetidas({ totalRetidas: 0 })).toEqual({
      retidas: [],
      resumoPorProduto: [],
      aguardandoEstado: 0,
      totalRetidas: 0,
      totalPendentesAnalisadas: 0,
      totalPendentes: 0,
      limite: 200,
      offset: 0,
      temMais: false,
    });

    const comMotivosAusentes = normalizarRespostaRetidas({
      totalRetidas: 1,
      retidas: [{ id: 'v1', externalId: null, criadoEm: '2026-11-16T12:00:00Z', check: 1 }],
    });
    expect(comMotivosAusentes?.retidas[0]?.motivos).toEqual([]);
  });

  it('mescla páginas preservando e somando resumoPorProduto por (produto, tipo)', () => {
    const p1 = {
      retidas: [{ id: 'v1', externalId: 'p1', criadoEm: '2026-11-16T12:00:00Z', check: 1, motivos: [] }],
      resumoPorProduto: [
        { produto: 'Lanche A', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 },
        { produto: 'Lanche Comum', tipo: 'PRODUTO_SEM_FICHA', vendas: 2 },
      ],
      aguardandoEstado: 3,
      totalRetidas: 1,
      totalPendentesAnalisadas: 200,
      totalPendentes: 300,
      limite: 200,
      offset: 0,
      temMais: true,
    };
    const p2 = {
      retidas: [{ id: 'v2', externalId: 'p2', criadoEm: '2026-11-16T13:00:00Z', check: 1, motivos: [] }],
      resumoPorProduto: [
        { produto: 'Lanche B', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 },
        { produto: 'Lanche Comum', tipo: 'PRODUTO_SEM_FICHA', vendas: 3 },
      ],
      aguardandoEstado: 1,
      totalRetidas: 1,
      totalPendentesAnalisadas: 100,
      totalPendentes: 300,
      limite: 200,
      offset: 200,
      temMais: false,
    };

    const mesclada = mesclarPaginasRetidas(p1, p2);
    expect(mesclada.totalRetidas).toBe(2);
    expect(mesclada.aguardandoEstado).toBe(4);
    expect(mesclada.totalPendentesAnalisadas).toBe(300);
    expect(mesclada.temMais).toBe(false);
    expect(mesclada.retidas.map((r) => r.id)).toEqual(['v1', 'v2']);
    expect(mesclada.resumoPorProduto).toEqual([
      { produto: 'Lanche A', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 },
      { produto: 'Lanche Comum', tipo: 'PRODUTO_SEM_FICHA', vendas: 5 },
      { produto: 'Lanche B', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 },
    ]);
  });
});
