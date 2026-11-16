import { z } from 'zod';
import type { CategoriaInsumo } from '../../../../generated/prisma/client.js';
import { prisma } from '../../../infra/database/prisma.js';
import {
  criarDataLoja,
  obterPartesDataLoja,
  parsearDiaLoja,
} from '../../../shared/datas.js';
import { DashboardRepository } from '../../dashboard/repositories/dashboard.repository.js';
import { insumoEmAlertaDeEstoque } from '../../dashboard/services/dashboard.service.js';
import { AnotaAIAdapter } from '../../vendas/services/anotaai.adapter.js';
import { expandirItens, normalizarNomeProduto } from '../../vendas/services/extrair_itens.js';

export interface SaidaDiaInput {
  data?: string | undefined;
}

export interface SaidaDiaItem {
  nome: string;
  quantidade: number;
}

export interface SaidaDiaInsumo {
  insumoId: string;
  nome: string;
  unidade: string;
  categoria: CategoriaInsumo;
  quantidadeSaiu: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  emAlerta: boolean;
}

export interface ResultadoSaidaDia {
  data: string;
  pedidos: number;
  itens: SaidaDiaItem[];
  insumos: SaidaDiaInsumo[];
}

export class SaidaDiaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'SaidaDiaError';
  }
}

const ORDEM_CATEGORIA: Record<CategoriaInsumo, number> = { INGREDIENTE: 0, EMBALAGEM: 1, BEBIDA: 2 };

// Snapshot gravado pelo fechamento manual: o que realmente foi abatido do estoque.
const snapshotSchema = z.object({
  _fechamento: z.object({
    consumos: z.array(z.object({ insumoId: z.string().min(1), quantidade: z.number().finite().positive() })),
  }),
});

function arredondar(valor: number): number {
  return Number(valor.toFixed(4));
}

function diaPadraoOntem(): string {
  const hoje = obterPartesDataLoja(new Date());
  // Meio-dia menos 24h cai sempre no dia anterior, sem depender de horário de verão ou virada do UTC.
  const meioDiaHoje = criarDataLoja(hoje.ano, hoje.mes, hoje.dia, 12, 0, 0, 0);
  const ontem = obterPartesDataLoja(new Date(meioDiaHoje.getTime() - 24 * 60 * 60 * 1000));
  return `${ontem.ano}-${String(ontem.mes).padStart(2, '0')}-${String(ontem.dia).padStart(2, '0')}`;
}

export class SaidaDiaService {
  private readonly adapter = new AnotaAIAdapter();

  constructor(
    private readonly db = prisma,
    private readonly repository = new DashboardRepository(),
  ) {}

  async obter(input: SaidaDiaInput): Promise<ResultadoSaidaDia> {
    const dataStr = input.data !== undefined ? input.data.trim() : diaPadraoOntem();
    const inicio = parsearDiaLoja(dataStr, 'inicio');
    if (!inicio) {
      throw new SaidaDiaError('Data inválida; use o formato AAAA-MM-DD', 400);
    }
    const fim = parsearDiaLoja(dataStr, 'fim')!;

    // Já exclui fechamentos manuais estornados e filtra pelo ocorridoEm do dia da loja.
    const [vendas, produtos] = await Promise.all([
      this.repository.buscarVendasProcessadasPorPeriodo(inicio, fim),
      this.repository.buscarProdutosComFichas(),
    ]);

    const produtoPorNome = new Map<string, (typeof produtos)[number]>();
    const nomesComColisao = new Set<string>();
    for (const p of produtos) {
      const chave = normalizarNomeProduto(p.nome);
      if (!chave) continue;
      if (produtoPorNome.has(chave)) nomesComColisao.add(chave);
      else produtoPorNome.set(chave, p);
    }

    const itensVendidos = new Map<string, SaidaDiaItem>();
    const saiuPorInsumo = new Map<string, number>();
    let pedidos = 0;

    for (const venda of vendas) {
      if ((venda.payloadOriginal as { _estorno?: unknown } | null)?._estorno != null) continue;

      const parse = this.adapter.parsear(venda.payloadOriginal);
      if (parse.destino !== 'abater' || parse.itens.length === 0) continue;
      pedidos += 1;

      const manual = venda.origem === 'MANUAL';
      if (manual) {
        const snapshot = snapshotSchema.safeParse(venda.payloadOriginal);
        if (snapshot.success) {
          for (const c of snapshot.data._fechamento.consumos) {
            saiuPorInsumo.set(c.insumoId, (saiuPorInsumo.get(c.insumoId) ?? 0) + c.quantidade);
          }
        }
      }

      for (const { nome, quantidade: qtd } of expandirItens(parse.itens)) {
        const chave = normalizarNomeProduto(nome) || nome.trim().toLowerCase();
        const produto = !nomesComColisao.has(chave) ? produtoPorNome.get(chave) : undefined;
        const existente = itensVendidos.get(chave);
        if (existente) {
          existente.quantidade += qtd;
        } else {
          itensVendidos.set(chave, { nome: produto?.nome ?? nome.trim(), quantidade: qtd });
        }

        // Webhook: pela ficha técnica, como a consolidação. Manual: já somado pelo snapshot acima.
        if (manual || nomesComColisao.has(chave) || !produto) continue;
        for (const ficha of produto.fichasTecnicas) {
          const fatorPerda = Math.max(0, ficha.insumo.fatorPerda || 0);
          const consumo = ficha.quantidade * (1 + fatorPerda) * qtd;
          saiuPorInsumo.set(ficha.insumoId, (saiuPorInsumo.get(ficha.insumoId) ?? 0) + consumo);
        }
      }
    }

    const insumosEnvolvidos = await this.db.insumo.findMany({
      where: { id: { in: [...saiuPorInsumo.keys()] } },
    });

    const insumos: SaidaDiaInsumo[] = insumosEnvolvidos
      .map((i) => ({
        insumoId: i.id,
        nome: i.nome,
        unidade: i.unidade,
        categoria: i.categoria,
        quantidadeSaiu: arredondar(saiuPorInsumo.get(i.id) ?? 0),
        estoqueAtual: i.estoqueAtual,
        estoqueMinimo: i.estoqueMinimo,
        emAlerta: insumoEmAlertaDeEstoque(i),
      }))
      .sort(
        (a, b) =>
          ORDEM_CATEGORIA[a.categoria] - ORDEM_CATEGORIA[b.categoria] ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      );

    const itens = [...itensVendidos.values()]
      .map((i) => ({ nome: i.nome, quantidade: arredondar(i.quantidade) }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));

    return { data: dataStr, pedidos, itens, insumos };
  }
}
