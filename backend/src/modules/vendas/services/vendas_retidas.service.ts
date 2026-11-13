import { VendasRepository } from '../repositories/vendas.repository.js';
import {
  planejarConsolidacao,
  type MotivoRetencaoItem,
  type MotivoRetencaoTipo,
  type ProdutoComFichas,
} from './planejar_consolidacao.js';

export interface VendaRetidaItem {
  id: string;
  externalId: string | null;
  criadoEm: Date;
  check: number | null;
  motivos: MotivoRetencaoItem[];
}

export interface ResumoProdutoRetido {
  produto: string;
  tipo: MotivoRetencaoTipo;
  vendas: number;
}

export interface ResultadoVendasRetidas {
  retidas: VendaRetidaItem[];
  resumoPorProduto: ResumoProdutoRetido[];
  aguardandoEstado: number;
  totalRetidas: number;
  totalPendentesAnalisadas: number;
  totalPendentes: number;
  limite: number;
  offset: number;
  temMais: boolean;
}

const TIPOS_PRODUTO = new Set<MotivoRetencaoTipo>([
  'PRODUTO_NAO_ENCONTRADO',
  'PRODUTO_SEM_FICHA',
  'COLISAO_NOME',
]);

export interface VendasRetidasFonte {
  buscarNaoProcessadas(opts?: { take?: number; skip?: number }): Promise<
    Array<{
      id: string;
      externalId: string | null;
      criadoEm: Date;
      atualizadoEm: Date;
      payloadOriginal: unknown;
    }>
  >;
  contarNaoProcessadas(): Promise<number>;
  buscarProdutosComFichas(): Promise<ProdutoComFichas[]>;
}

export class VendasRetidasService {
  constructor(private readonly fonte: VendasRetidasFonte = new VendasRepository()) {}

  async listar(opts?: { limite?: number; offset?: number }): Promise<ResultadoVendasRetidas> {
    const limite = opts?.limite ?? 200;
    const offset = opts?.offset ?? 0;

    const [vendas, totalPendentes, produtos] = await Promise.all([
      this.fonte.buscarNaoProcessadas({ take: limite, skip: offset }),
      this.fonte.contarNaoProcessadas(),
      this.fonte.buscarProdutosComFichas(),
    ]);

    const plano = planejarConsolidacao(vendas, produtos);

    const retidas: VendaRetidaItem[] = [];
    const contagemPorProduto = new Map<string, ResumoProdutoRetido>();

    for (const venda of vendas) {
      const motivos = plano.motivosPorVenda.get(venda.id);
      if (!motivos || motivos.length === 0) continue;

      retidas.push({
        id: venda.id,
        externalId: venda.externalId,
        criadoEm: venda.criadoEm,
        check: plano.checksPorVenda.get(venda.id) ?? null,
        motivos,
      });

      for (const motivo of motivos) {
        if (!TIPOS_PRODUTO.has(motivo.tipo)) continue;
        const chave = `${motivo.tipo}::${motivo.detalhe}`;
        const atual = contagemPorProduto.get(chave) ?? {
          produto: motivo.detalhe,
          tipo: motivo.tipo,
          vendas: 0,
        };
        atual.vendas += 1;
        contagemPorProduto.set(chave, atual);
      }
    }

    const resumoPorProduto = [...contagemPorProduto.values()].sort(
      (a, b) => (b.vendas - a.vendas) || a.produto.localeCompare(b.produto, 'pt-BR'),
    );

    return {
      retidas,
      resumoPorProduto,
      aguardandoEstado: plano.vendasAguardando.length,
      totalRetidas: retidas.length,
      totalPendentesAnalisadas: vendas.length,
      totalPendentes,
      limite,
      offset,
      temMais: offset + vendas.length < totalPendentes,
    };
  }
}
