import { describe, it, expect } from 'vitest';
import { VendasRetidasService, type VendasRetidasFonte } from './vendas_retidas.service.js';

describe('VendasRetidasService', () => {
  it('agrega todos os motivos de retenção, exclui canceladas/elegíveis e separa aguardandoEstado', async () => {
    const agora = new Date('2026-11-13T12:00:00Z');
    const mockFonte: VendasRetidasFonte = {
      contarNaoProcessadas: async () => 9,
      buscarProdutosComFichas: async () => [
        {
          id: 'p-ok',
          nome: 'X-Burger',
          fichasTecnicas: [
            {
              insumoId: 'ins-1',
              quantidade: 1,
              insumo: { id: 'ins-1', nome: 'Pão', unidade: 'Unidade', fatorPerda: 0, estoqueAtual: 50 },
            },
          ],
        },
        { id: 'p-sem-ficha', nome: 'Água Mineral', fichasTecnicas: [] },
        { id: 'p-col-1', nome: 'X-Bacon', fichasTecnicas: [] },
        { id: 'p-col-2', nome: 'X Bacon', fichasTecnicas: [] },
      ],
      buscarNaoProcessadas: async () => [
        // 1. Pronta para abater (não é retida)
        {
          id: 'v-ok',
          externalId: 'ok-1',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: { id: 'ok-1', check: 1, info: { items: [{ name: 'X-Burger', quantity: 1 }] } },
        },
        // 2. Cancelada (não é retida)
        {
          id: 'v-canc',
          externalId: 'canc-1',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: { id: 'canc-1', check: 4, info: { items: [{ name: 'Qualquer', quantity: 1 }] } },
        },
        // 3. Aguardando estado (conta em aguardandoEstado, não entra na lista)
        {
          id: 'v-ag',
          externalId: 'ag-1',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: { id: 'ag-1', check: 0, info: { items: [{ name: 'Qualquer', quantity: 1 }] } },
        },
        // 4. Produto não encontrado ("X-Tudo" aparece 2x nesta + 1x na próxima = 2 vendas)
        {
          id: 'v-missing-1',
          externalId: 'm-1',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: {
            id: 'm-1',
            check: 1,
            info: {
              items: [
                { name: 'X-Tudo', quantity: 1 },
                { name: 'X-Tudo', quantity: 1 },
              ],
            },
          },
        },
        // 5. Produto não encontrado + sem ficha
        {
          id: 'v-missing-2',
          externalId: 'm-2',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: {
            id: 'm-2',
            check: 1,
            info: {
              items: [
                { name: 'X-Tudo', quantity: 1 },
                { name: 'Água Mineral', quantity: 2 },
              ],
            },
          },
        },
        // 6. Colisão de nomes
        {
          id: 'v-col',
          externalId: 'col-1',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: { id: 'col-1', check: 2, info: { items: [{ name: 'X-Bacon', quantity: 1 }] } },
        },
        // 7. Item inválido
        {
          id: 'v-inv',
          externalId: 'inv-1',
          criadoEm: agora,
          atualizadoEm: agora,
          payloadOriginal: { id: 'inv-1', check: 1, info: { items: [{ name: 'X-Burger', quantity: 0 }] } },
        },
      ],
    };

    const res = await new VendasRetidasService(mockFonte).listar({ limite: 7, offset: 0 });

    expect(res.aguardandoEstado).toBe(1);
    expect(res.totalRetidas).toBe(4);
    expect(res.totalPendentesAnalisadas).toBe(7);
    expect(res.totalPendentes).toBe(9);
    expect(res.temMais).toBe(true);
    expect(res.retidas.map((r) => r.id)).toEqual(['v-missing-1', 'v-missing-2', 'v-col', 'v-inv']);
    expect(res.retidas[3].motivos).toEqual([
      { tipo: 'ITEM_INVALIDO', detalhe: 'Item sem quantidade válida ou menor/igual a zero' },
      { tipo: 'SEM_ITENS', detalhe: 'Pedido sem itens válidos no payload' },
    ]);
    expect(res.resumoPorProduto).toEqual([
      { produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 2 },
      { produto: 'Água Mineral', tipo: 'PRODUTO_SEM_FICHA', vendas: 1 },
      { produto: 'X-Bacon', tipo: 'COLISAO_NOME', vendas: 1 },
    ]);
  });
});
