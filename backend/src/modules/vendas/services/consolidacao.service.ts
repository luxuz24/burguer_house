import { prisma } from '../../../infra/database/prisma.js';
import { VendasRepository } from '../repositories/vendas.repository.js';

export class ConsolidacaoService {
  private vendasRepo: VendasRepository;

  constructor() {
    this.vendasRepo = new VendasRepository();
  }

  async consolidarVendasDoDia() {
    const vendasPendentes = await this.vendasRepo.buscarNaoProcessadas();
    
    if (vendasPendentes.length === 0) {
      return { consolidadas: 0, mensagem: 'Nenhuma venda pendente de processamento.' };
    }

    // Mapa para acumular a quantidade total de cada insumo a ser descontada
    const descontosPorInsumo: Record<string, number> = {};

    // 1. Calcular o desconto de estoque iterando por todas as vendas
    for (const venda of vendasPendentes) {
      const payload: any = venda.payloadOriginal;
      
      // Assumindo um payload simplificado: { items: [{ name: "X-Bacon", quantity: 2 }] }
      // Na prática, depende do JSON exato da Anota AI, mas usaremos um fallback seguro.
      const items = payload?.items || [];

      for (const item of items) {
        if (!item.name || !item.quantity) continue;

        // Tenta achar o produto pelo nome de forma case-insensitive
        const produto = await prisma.produto.findFirst({
          where: {
            nome: {
              equals: item.name,
              mode: 'insensitive'
            }
          },
          include: {
            fichasTecnicas: {
              include: { insumo: true }
            }
          }
        });

        if (produto) {
          for (const ficha of produto.fichasTecnicas) {
            // Fator de perda é aplicado sobre a quantidade da ficha
            const descontoUnitario = ficha.quantidade * (1 + ficha.insumo.fatorPerda);
            const descontoTotal = descontoUnitario * Number(item.quantity);

            descontosPorInsumo[ficha.insumoId] = (descontosPorInsumo[ficha.insumoId] || 0) + descontoTotal;
          }
        } else {
          console.warn(`Produto "${item.name}" não encontrado no banco. Não foi possível abater os insumos.`);
        }
      }
    }

    // 2. Executar a transação para abater os estoques e marcar vendas como processadas
    await prisma.$transaction(async (tx) => {
      // Abater estoques
      for (const [insumoId, quantidadeDesconto] of Object.entries(descontosPorInsumo)) {
        await tx.insumo.update({
          where: { id: insumoId },
          data: {
            estoqueAtual: {
              decrement: quantidadeDesconto
            }
          }
        });
      }

      // Marcar todas as vendas lidas como processadas
      const vendaIds = vendasPendentes.map(v => v.id);
      await tx.venda.updateMany({
        where: { id: { in: vendaIds } },
        data: { processado: true }
      });
    });

    return { 
      consolidadas: vendasPendentes.length, 
      insumosAfetados: Object.keys(descontosPorInsumo).length 
    };
  }
}
