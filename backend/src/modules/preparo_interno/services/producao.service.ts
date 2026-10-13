import { prisma } from '../../../infra/database/prisma.js';

export class ProducaoError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
  }
}

/**
 * A sub-ficha é definida por LOTE DE REFERÊNCIA: `quantidadeNecessaria` é a
 * quantidade de insumo bruto usada para produzir 1 unidade de medida do
 * beneficiado (ex.: g de óleo por g de maionese). Produzir X multiplica por X.
 */
export class ProducaoService {
  constructor(private readonly db = prisma) {}

  async produzir(insumoBeneficiadoId: string, quantidade: number) {
    return this.db.$transaction(async (tx) => {
      const beneficiado = await tx.insumo.findUnique({ where: { id: insumoBeneficiadoId } });
      if (!beneficiado) throw new ProducaoError('Insumo beneficiado não encontrado', 404);
      if (!beneficiado.produzidoInternamente) {
        throw new ProducaoError('Insumo não é marcado como produzido internamente');
      }

      const ingredientes = await tx.subFichaTecnica.findMany({
        where: { insumoBeneficiadoId },
        include: { insumoBruto: true },
      });
      if (ingredientes.length === 0) {
        throw new ProducaoError('Insumo beneficiado não possui sub-ficha técnica');
      }

      const consumos = ingredientes.map((ing) => ({
        insumoBrutoId: ing.insumoBrutoId,
        nome: ing.insumoBruto.nome,
        estoqueAtual: ing.insumoBruto.estoqueAtual,
        consumo: ing.quantidadeNecessaria * (1 + ing.insumoBruto.fatorPerda) * quantidade,
      }));

      const faltando = consumos.filter((c) => c.estoqueAtual < c.consumo);
      if (faltando.length > 0) {
        throw new ProducaoError(
          `Estoque insuficiente: ${faltando.map((f) => f.nome).join(', ')}`,
          409,
        );
      }

      for (const c of consumos) {
        await tx.insumo.update({
          where: { id: c.insumoBrutoId },
          data: { estoqueAtual: { decrement: c.consumo } },
        });
      }

      const atualizado = await tx.insumo.update({
        where: { id: insumoBeneficiadoId },
        data: { estoqueAtual: { increment: quantidade } },
      });

      const validadeEm = beneficiado.validadeDias
        ? new Date(Date.now() + beneficiado.validadeDias * 86_400_000)
        : null;

      return {
        insumo: atualizado,
        quantidadeProduzida: quantidade,
        validadeEm,
        consumos: consumos.map(({ insumoBrutoId, nome, consumo }) => ({ insumoBrutoId, nome, consumo })),
      };
    });
  }
}
