import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import {
  INSUMOS_CATALOGO,
  PRODUTOS_CATALOGO,
  RECEITAS_CATALOGO,
} from './catalogo_burguer_house.js';

export interface ResultadoCatalogo {
  insumosCriados: number;
  insumosExistentes: number;
  receitasCriadas: number;
  produtosCriados: number;
  produtosExistentes: number;
}

/**
 * Cadastra o catálogo real da Burguer House (insumos, receitas internas e cardápio com fichas técnicas)
 * sem apagar nem alterar nada que já exista:
 * - Insumo novo entra com estoque e estoque mínimo ZERADOS: a loja faz a primeira contagem no app.
 * - Insumo ou produto que já existe com o mesmo nome (sem diferenciar maiúsculas) fica como está,
 *   inclusive estoque, custo e ficha técnica editados pela loja.
 * - A receita de um item da casa só é criada se ele ainda não tiver nenhuma.
 * Pode rodar quantas vezes quiser (ex.: em produção, depois de um deploy) e é tudo ou nada.
 */
export async function semearCatalogo(prisma: PrismaClient): Promise<ResultadoCatalogo> {
  return prisma.$transaction(
    async (tx) => {
      const resultado: ResultadoCatalogo = {
        insumosCriados: 0,
        insumosExistentes: 0,
        receitasCriadas: 0,
        produtosCriados: 0,
        produtosExistentes: 0,
      };

      const idDoInsumo = new Map<string, string>();
      for (const insumo of INSUMOS_CATALOGO) {
        const existente = await buscarInsumo(tx, insumo.nome);
        if (existente) {
          idDoInsumo.set(insumo.nome, existente.id);
          resultado.insumosExistentes++;
          continue;
        }
        const criado = await tx.insumo.create({
          data: { ...insumo, estoqueAtual: 0, estoqueMinimo: 0 },
        });
        idDoInsumo.set(insumo.nome, criado.id);
        resultado.insumosCriados++;
      }

      const id = (nome: string) => {
        const encontrado = idDoInsumo.get(nome);
        if (!encontrado) throw new Error(`Insumo "${nome}" não está no catálogo`);
        return encontrado;
      };

      for (const receita of RECEITAS_CATALOGO) {
        const beneficiadoId = id(receita.beneficiado);
        if ((await tx.subFichaTecnica.count({ where: { insumoBeneficiadoId: beneficiadoId } })) > 0) continue;
        await tx.subFichaTecnica.createMany({
          data: receita.ingredientes.map((ing) => ({
            insumoBeneficiadoId: beneficiadoId,
            insumoBrutoId: id(ing.insumo),
            // A sub-ficha guarda o bruto usado para 1 unidade do beneficiado (lote de referência = 1).
            quantidadeNecessaria: Number((ing.quantidade / receita.rendimento).toFixed(6)),
          })),
        });
        resultado.receitasCriadas++;
      }

      for (const produto of PRODUTOS_CATALOGO) {
        const existente = await tx.produto.findFirst({
          where: { nome: { equals: produto.nome, mode: 'insensitive' } },
          select: { id: true },
        });
        if (existente) {
          resultado.produtosExistentes++;
          continue;
        }
        await tx.produto.create({
          data: {
            nome: produto.nome,
            fichasTecnicas: {
              create: produto.ficha.map((item) => ({ insumoId: id(item.insumo), quantidade: item.quantidade })),
            },
          },
        });
        resultado.produtosCriados++;
      }

      return resultado;
    },
    { timeout: 60_000 },
  );
}

function buscarInsumo(tx: Prisma.TransactionClient, nome: string) {
  return tx.insumo.findFirst({
    where: { nome: { equals: nome, mode: 'insensitive' } },
    select: { id: true },
  });
}
