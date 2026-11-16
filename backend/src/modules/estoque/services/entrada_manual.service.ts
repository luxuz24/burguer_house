import { prisma } from '../../../infra/database/prisma.js';

export interface ItemEntradaManualInput {
  insumoId: string;
  quantidade: number;
  custoUnitario?: number | undefined;
}

export interface RegistrarEntradaManualInput {
  chaveIdempotencia: string;
  observacao?: string | undefined;
  itens: ItemEntradaManualInput[];
  usuarioId: string | null;
}

export interface ItemEntradaManualResultado {
  insumoId: string;
  nome: string;
  unidade: string;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  custoUnitario: number | null;
}

export interface RegistrarEntradaManualResultado {
  reaproveitado: boolean;
  chaveIdempotencia: string;
  itens: ItemEntradaManualResultado[];
  avisos: string[];
}

export interface ListarMovimentacoesFiltro {
  insumoId?: string | undefined;
  limite: number;
  offset: number;
}

export class EntradaManualError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'EntradaManualError';
  }
}

function normalizarObservacao(observacao?: string | null): string | null {
  const texto = observacao?.trim();
  return texto ? texto : null;
}

function montarAvisoCusto(nome: string, custoAtual: number, novoCusto?: number): string | null {
  if (!novoCusto || novoCusto < 0 || custoAtual <= 0) {
    return null;
  }
  if (novoCusto > custoAtual * 10 || novoCusto * 10 < custoAtual) {
    return `${nome}: o novo custo (${novoCusto}) é mais de 10× diferente do atual (${custoAtual}). Confira a unidade (R$ por unidade de medida).`;
  }
  return null;
}

type MovimentacaoComInsumo = {
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

export class EntradaManualService {
  constructor(private readonly db = prisma) {}

  private async buscarMovimentacoesPorChave(
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

  private resolverReplay(
    input: RegistrarEntradaManualInput,
    obsNormalizada: string | null,
    existentes: MovimentacaoComInsumo[],
  ): RegistrarEntradaManualResultado {
    const obsExistente = existentes[0]?.observacao ?? null;
    if (existentes.length !== input.itens.length || obsExistente !== obsNormalizada) {
      throw new EntradaManualError(
        'Já existe uma entrada manual registrada com esta chave de idempotência e conteúdo diferente',
        409,
      );
    }

    const porInsumo = new Map(existentes.map((m) => [m.insumoId, m]));
    const itensResultado: ItemEntradaManualResultado[] = [];

    for (const item of input.itens) {
      const mov = porInsumo.get(item.insumoId);
      const custoInput = item.custoUnitario ?? null;
      if (!mov || mov.quantidade !== item.quantidade || (mov.custoUnitario ?? null) !== custoInput) {
        throw new EntradaManualError(
          'Já existe uma entrada manual registrada com esta chave de idempotência e conteúdo diferente',
          409,
        );
      }
      itensResultado.push({
        insumoId: mov.insumo.id,
        nome: mov.insumo.nome,
        unidade: mov.insumo.unidade,
        quantidade: mov.quantidade,
        saldoAnterior: mov.saldoAnterior,
        saldoPosterior: mov.saldoPosterior,
        custoUnitario: mov.custoUnitario,
      });
    }

    return {
      reaproveitado: true,
      chaveIdempotencia: input.chaveIdempotencia,
      itens: itensResultado,
      avisos: [],
    };
  }

  async registrarEntradaManual(
    input: RegistrarEntradaManualInput,
  ): Promise<RegistrarEntradaManualResultado> {
    if (input.itens.length === 0) {
      throw new EntradaManualError('Informe ao menos um item para entrada manual', 400);
    }

    const idsVistos = new Set<string>();
    for (const item of input.itens) {
      if (idsVistos.has(item.insumoId)) {
        throw new EntradaManualError('Não é permitido repetir o mesmo insumo na mesma requisição', 400);
      }
      idsVistos.add(item.insumoId);
    }

    const obsNormalizada = normalizarObservacao(input.observacao);

    try {
      return await this.db.$transaction(
        async (tx) => {
          const existentes = await this.buscarMovimentacoesPorChave(tx, input.chaveIdempotencia);
          if (existentes.length > 0) {
            return this.resolverReplay(input, obsNormalizada, existentes);
          }

          const ids = input.itens.map((it) => it.insumoId);
          const insumosEncontrados = await tx.insumo.findMany({
            where: { id: { in: ids } },
          });
          const mapaInsumos = new Map(insumosEncontrados.map((ins) => [ins.id, ins]));

          const faltando = ids.filter((id) => !mapaInsumos.has(id));
          if (faltando.length > 0) {
            throw new EntradaManualError(
              `Insumo(s) não encontrado(s): ${faltando.join(', ')}`,
              404,
            );
          }

          // Ordenação canônica por insumoId reduz risco de deadlock em lotes concorrentes sobre os mesmos insumos.
          const itensOrdenados = [...input.itens].sort((a, b) => a.insumoId.localeCompare(b.insumoId));
          const resultadosPorInsumo = new Map<string, ItemEntradaManualResultado>();
          const avisosPorInsumo = new Map<string, string>();
          const movimentacoesData = [];

          for (const item of itensOrdenados) {
            const insumoAtual = mapaInsumos.get(item.insumoId)!;
            const aviso = montarAvisoCusto(
              insumoAtual.nome,
              insumoAtual.custoUnitario,
              item.custoUnitario,
            );
            if (aviso) {
              avisosPorInsumo.set(item.insumoId, aviso);
            }

            // Cópia exata da regra de entrada_estoque.service.ts (linhas 108-111):
            // só sobrescreve o custoUnitario do insumo quando informado e estritamente maior que zero.
            const novoCusto = item.custoUnitario;
            const atualizado = await tx.insumo.update({
              where: { id: item.insumoId },
              data: {
                estoqueAtual: { increment: item.quantidade },
                ...(novoCusto && novoCusto > 0 ? { custoUnitario: novoCusto } : {}),
              },
            });

            const saldoPosterior = atualizado.estoqueAtual;
            const saldoAnterior = Number((saldoPosterior - item.quantidade).toFixed(6));
            const custoMov = item.custoUnitario ?? null;

            movimentacoesData.push({
              insumoId: item.insumoId,
              usuarioId: input.usuarioId,
              tipo: 'ENTRADA_MANUAL' as const,
              quantidade: item.quantidade,
              saldoAnterior,
              saldoPosterior,
              custoUnitario: custoMov,
              observacao: obsNormalizada,
              chaveIdempotencia: `${input.chaveIdempotencia}:${item.insumoId}`,
            });

            resultadosPorInsumo.set(item.insumoId, {
              insumoId: atualizado.id,
              nome: atualizado.nome,
              unidade: atualizado.unidade,
              quantidade: item.quantidade,
              saldoAnterior,
              saldoPosterior,
              custoUnitario: custoMov,
            });
          }

          await tx.movimentacaoEstoque.createMany({ data: movimentacoesData });

          const itens = input.itens.map((it) => resultadosPorInsumo.get(it.insumoId)!);
          const avisos = input.itens
            .map((it) => avisosPorInsumo.get(it.insumoId))
            .filter((msg): msg is string => msg !== undefined);

          return {
            reaproveitado: false,
            chaveIdempotencia: input.chaveIdempotencia,
            itens,
            avisos,
          };
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        const existentes = await this.buscarMovimentacoesPorChave(this.db, input.chaveIdempotencia);
        if (existentes.length > 0) {
          return this.resolverReplay(input, obsNormalizada, existentes);
        }
      }
      throw error;
    }
  }

  async listarMovimentacoes(filtro: ListarMovimentacoesFiltro) {
    const where = filtro.insumoId ? { insumoId: filtro.insumoId } : {};

    const [total, linhas] = await Promise.all([
      this.db.movimentacaoEstoque.count({ where }),
      this.db.movimentacaoEstoque.findMany({
        where,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: filtro.limite,
        skip: filtro.offset,
        include: {
          insumo: { select: { id: true, nome: true, unidade: true } },
          usuario: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return {
      total,
      limite: filtro.limite,
      offset: filtro.offset,
      movimentacoes: linhas.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        quantidade: m.quantidade,
        saldoAnterior: m.saldoAnterior,
        saldoPosterior: m.saldoPosterior,
        custoUnitario: m.custoUnitario,
        observacao: m.observacao,
        criadoEm: m.criadoEm,
        insumo: m.insumo,
        usuario: m.usuario,
      })),
    };
  }
}
