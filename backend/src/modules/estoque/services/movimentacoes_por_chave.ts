import { prisma } from '../../../infra/database/prisma.js';

export type MovimentacaoComInsumo = {
  insumoId: string;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  custoUnitario: number | null;
  observacao: string | null;
  chaveIdempotencia: string | null;
  insumo: { id: string; nome: string; unidade: string };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Movimentações gravadas por um lançamento em lote (`chaveIdempotencia` por linha = `<chave>:<insumoId>`).
 * Usado no replay idempotente da entrada manual e do ajuste por contagem.
 */
export async function buscarMovimentacoesPorChave(
  dbClient: Pick<typeof prisma, 'movimentacaoEstoque'>,
  chaveIdempotencia: string,
): Promise<MovimentacaoComInsumo[]> {
  const prefixo = `${chaveIdempotencia}:`;
  const candidatas = await dbClient.movimentacaoEstoque.findMany({
    where: { chaveIdempotencia: { startsWith: prefixo } },
    include: { insumo: { select: { id: true, nome: true, unidade: true } } },
  });
  // Evita colisão de prefixo (ex.: chave contendo ":" ou sufixo não-UUID): exige UUID exato após "<chave>:"
  return candidatas.filter(
    (m) => m.chaveIdempotencia !== null && UUID_REGEX.test(m.chaveIdempotencia.slice(prefixo.length)),
  );
}
