import { z } from 'zod';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { prisma } from '../../../infra/database/prisma.js';

export interface EstornarFechamentoInput {
  vendaId: string;
  motivo: string;
  usuarioId: string | null;
}

export interface DevolucaoEstornoItem {
  insumoId: string;
  nome: string;
  unidade: string;
  quantidade: number;
  estoqueAtual: number;
}

export interface EstornoRegistro {
  usuarioId: string | null;
  em: string;
  motivo: string;
}

export interface ResultadoEstornoFechamento {
  vendaId: string;
  estornada: true;
  estorno: EstornoRegistro;
  devolucoes: DevolucaoEstornoItem[];
}

export class EstornoFechamentoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'EstornoFechamentoError';
  }
}

interface ConsumoSnapshot {
  insumoId: string;
  quantidade: number;
}

const MSG_SNAPSHOT_INVALIDO = 'Fechamento manual sem snapshot de consumos válido para estorno';

const snapshotEstornoSchema = z.object({
  _fechamento: z.object({
    consumos: z
      .array(
        z.object({
          insumoId: z.string().min(1),
          quantidade: z.number().finite().positive(),
        }),
      )
      .min(1),
  }),
});

function extrairConsumosSnapshot(payload: unknown): ConsumoSnapshot[] {
  const parsed = snapshotEstornoSchema.safeParse(payload);
  if (!parsed.success) {
    throw new EstornoFechamentoError(MSG_SNAPSHOT_INVALIDO, 422);
  }

  const porInsumo = new Map<string, number>();
  for (const item of parsed.data._fechamento.consumos) {
    porInsumo.set(
      item.insumoId,
      Number(((porInsumo.get(item.insumoId) ?? 0) + item.quantidade).toFixed(4)),
    );
  }

  return Array.from(porInsumo.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([insumoId, quantidade]) => ({ insumoId, quantidade }));
}

export class EstornarFechamentoService {
  constructor(private readonly db = prisma) {}

  async executar(input: EstornarFechamentoInput): Promise<ResultadoEstornoFechamento> {
    const motivoNormalizado = input.motivo.trim();
    if (!motivoNormalizado) {
      throw new EstornoFechamentoError('Informe o motivo do estorno', 400);
    }

    return this.db.$transaction(
      async (tx) => {
        // Lock pessimista na linha garante que chamadas concorrentes ao mesmo estorno sejam serializadas.
        const rows = await tx.$queryRaw<
          Array<{ id: string; origem: string; payloadOriginal: unknown }>
        >`
          SELECT id, origem::text AS origem, "payloadOriginal"
          FROM vendas
          WHERE id = ${input.vendaId}
          FOR UPDATE
        `;

        const venda = rows[0];
        if (!venda) {
          throw new EstornoFechamentoError('Venda não encontrada', 404);
        }

        if (venda.origem !== 'MANUAL') {
          throw new EstornoFechamentoError('Só é possível estornar fechamentos manuais', 400);
        }

        const payload = venda.payloadOriginal;
        if ((payload as { _estorno?: unknown } | null)?._estorno != null) {
          throw new EstornoFechamentoError('Este fechamento manual já foi estornado', 409);
        }

        const consumos = extrairConsumosSnapshot(payload);
        const insumoIds = consumos.map((c) => c.insumoId);
        const insumosExistentes = await tx.insumo.findMany({
          where: { id: { in: insumoIds } },
          select: { id: true },
        });
        if (insumosExistentes.length !== insumoIds.length) {
          throw new EstornoFechamentoError(
            'Não é possível estornar: um ou mais insumos do fechamento não existem mais',
            422,
          );
        }

        const devolucoes: DevolucaoEstornoItem[] = [];
        for (const item of consumos) {
          const atualizado = await tx.insumo.update({
            where: { id: item.insumoId },
            data: { estoqueAtual: { increment: item.quantidade } },
          });
          devolucoes.push({
            insumoId: atualizado.id,
            nome: atualizado.nome,
            unidade: atualizado.unidade,
            quantidade: item.quantidade,
            estoqueAtual: atualizado.estoqueAtual,
          });
        }

        const estorno: EstornoRegistro = {
          usuarioId: input.usuarioId,
          em: new Date().toISOString(),
          motivo: motivoNormalizado,
        };

        const novoPayload: Prisma.InputJsonObject = {
          ...(payload as Prisma.JsonObject),
          _estorno: {
            usuarioId: estorno.usuarioId,
            em: estorno.em,
            motivo: estorno.motivo,
          },
        };

        await tx.venda.update({
          where: { id: venda.id },
          data: {
            payloadOriginal: novoPayload,
          },
        });

        return {
          vendaId: venda.id,
          estornada: true,
          estorno,
          devolucoes,
        };
      },
      { timeout: 20000 },
    );
  }
}
