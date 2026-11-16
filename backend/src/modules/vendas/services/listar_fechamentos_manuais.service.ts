import { z } from 'zod';
import { prisma } from '../../../infra/database/prisma.js';
import { obterPartesDataLoja, parsearDiaLoja } from '../../../shared/datas.js';

export interface ListarFechamentosInput {
  data?: string | undefined;
}

export interface ItemFechamentoListado {
  nome: string;
  quantidade: number;
}

export interface UsuarioResumo {
  id: string;
  nome: string;
}

export interface EstornoListado {
  em: string;
  motivo: string;
  usuario: UsuarioResumo | null;
}

export interface FechamentoManualListado {
  id: string;
  externalId: string | null;
  criadoEm: string;
  ocorridoEm: string;
  observacao: string | null;
  itens: ItemFechamentoListado[];
  usuario: UsuarioResumo | null;
  estornada: boolean;
  estorno: EstornoListado | null;
}

export interface ResultadoListarFechamentos {
  data: string;
  total: number;
  fechamentos: FechamentoManualListado[];
}

export class ListarFechamentosError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ListarFechamentosError';
  }
}

const payloadListagemSchema = z.object({
  info: z
    .object({
      items: z
        .array(
          z.object({
            name: z.string(),
            quantity: z.number(),
          }),
        )
        .optional(),
    })
    .optional(),
  observacao: z.string().nullable().optional(),
  _estorno: z
    .object({
      usuarioId: z.string().nullable().optional(),
      em: z.string(),
      motivo: z.string(),
    })
    .nullable()
    .optional(),
});

function extrairDadosPayload(payloadOriginal: unknown) {
  const parsed = payloadListagemSchema.safeParse(payloadOriginal);
  if (!parsed.success) {
    return {
      itens: [] as ItemFechamentoListado[],
      observacao: null as string | null,
      estornoRaw: null,
    };
  }

  const dados = parsed.data;
  const obsTrim = dados.observacao?.trim();

  return {
    itens: (dados.info?.items ?? []).map((i) => ({ nome: i.name, quantidade: i.quantity })),
    observacao: obsTrim ? obsTrim : null,
    estornoRaw: dados._estorno ?? null,
  };
}

export class ListarFechamentosManuaisService {
  constructor(private readonly db = prisma) {}

  async listar(input: ListarFechamentosInput): Promise<ResultadoListarFechamentos> {
    const partesHoje = obterPartesDataLoja(new Date());
    const dataStr =
      input.data !== undefined
        ? input.data.trim()
        : `${partesHoje.ano}-${String(partesHoje.mes).padStart(2, '0')}-${String(partesHoje.dia).padStart(2, '0')}`;

    const inicio = parsearDiaLoja(dataStr, 'inicio');
    if (!inicio) {
      throw new ListarFechamentosError('Data inválida; use o formato AAAA-MM-DD', 400);
    }
    const fim = parsearDiaLoja(dataStr, 'fim')!;

    const vendas = await this.db.venda.findMany({
      where: {
        origem: 'MANUAL',
        ocorridoEm: { gte: inicio, lte: fim },
      },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        externalId: true,
        criadoEm: true,
        ocorridoEm: true,
        registradoPorId: true,
        payloadOriginal: true,
      },
    });

    const dadosPorVenda = vendas.map((v) => ({
      venda: v,
      ...extrairDadosPayload(v.payloadOriginal),
    }));

    const usuarioIds = Array.from(
      new Set(
        dadosPorVenda
          .flatMap((d) => [d.venda.registradoPorId, d.estornoRaw?.usuarioId ?? null])
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const usuarios =
      usuarioIds.length > 0
        ? await this.db.usuario.findMany({
            where: { id: { in: usuarioIds } },
            select: { id: true, nome: true },
          })
        : [];
    const mapaUsuarios = new Map(usuarios.map((u) => [u.id, { id: u.id, nome: u.nome }]));

    const fechamentos: FechamentoManualListado[] = dadosPorVenda.map(
      ({ venda, itens, observacao, estornoRaw }) => {
        const usuario = venda.registradoPorId
          ? (mapaUsuarios.get(venda.registradoPorId) ?? null)
          : null;

        const estornoUsuarioId = estornoRaw?.usuarioId;
        const estorno: EstornoListado | null = estornoRaw
          ? {
              em: estornoRaw.em,
              motivo: estornoRaw.motivo,
              usuario: estornoUsuarioId ? (mapaUsuarios.get(estornoUsuarioId) ?? null) : null,
            }
          : null;

        return {
          id: venda.id,
          externalId: venda.externalId,
          criadoEm: venda.criadoEm.toISOString(),
          ocorridoEm: venda.ocorridoEm.toISOString(),
          observacao,
          itens,
          usuario,
          estornada: estorno !== null,
          estorno,
        };
      },
    );

    return {
      data: dataStr,
      total: fechamentos.length,
      fechamentos,
    };
  }
}
