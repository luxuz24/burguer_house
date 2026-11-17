import axios from 'axios';
import { mensagemDeErro } from './api';
import type { CategoriaInsumo } from './categoriaInsumo';
import { formatarMoeda, formatarQuantidade } from './formatar';
import { parsearFator } from './notaFiscal';
import { normalizarUnidade, sugerirConversao } from './unidades';

export type ModoUnidade = 'BASE' | 'ALTERNATIVA';

export interface InsumoParaEntrada {
  id: string;
  nome: string;
  unidade: string;
  categoria?: string | null;
  estoqueAtual: number;
  custoUnitario?: number;
}

export interface LinhaEntradaManual {
  id: string;
  insumoId: string;
  quantidadeTexto: string;
  custoTexto: string;
  modoUnidade: ModoUnidade;
  buscaInsumo: string;
  filtroCategoria: 'TODOS' | CategoriaInsumo;
}

export interface ItemPayloadEntradaManual {
  insumoId: string;
  quantidade: number;
  custoUnitario?: number;
}

export interface ItemResultadoEntradaManual {
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
  itens: ItemResultadoEntradaManual[];
  avisos: string[];
}

export interface ErrosLinhaEntrada {
  insumoId?: string;
  quantidade?: string;
  custo?: string;
}

export interface ErrosValidacaoEntrada {
  geral?: string;
  observacao?: string;
  porLinha: Record<string, ErrosLinhaEntrada>;
}

const formatadorDecimalCusto = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function formatarDecimalCusto(valor: number): string {
  return formatadorDecimalCusto.format(valor);
}

/**
 * Retorna a unidade alternativa (kg para Gramas, L para Mililitros), ou null quando não há conversão direta.
 */
export function unidadeAlternativa(unidadeInsumo: string): {
  siglaBase: string;
  siglaAlt: string;
  canonicaAlt: 'KG' | 'L';
} | null {
  const canonica = normalizarUnidade(unidadeInsumo);
  if (canonica === 'G') {
    return { siglaBase: 'g', siglaAlt: 'kg', canonicaAlt: 'KG' };
  }
  if (canonica === 'ML') {
    return { siglaBase: 'ml', siglaAlt: 'L', canonicaAlt: 'L' };
  }
  return null;
}

/** Sigla curta para exibição ao lado do campo de quantidade. */
export function siglaUnidadeBase(unidadeInsumo: string): string {
  const canonica = normalizarUnidade(unidadeInsumo);
  if (canonica === 'G') return 'g';
  if (canonica === 'ML') return 'ml';
  if (canonica === 'UN') return 'un';
  if (canonica === 'KG') return 'kg';
  if (canonica === 'L') return 'L';
  return unidadeInsumo;
}

/** Números digitados com ponto separador de milhar (ex.: "5.000", "1.500", "10.000", "1.234,56"). */
export const PADRAO_MILHAR = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/;

export const MENSAGEM_ERRO_MILHAR =
  'Para 5 mil, digite 5000 (use vírgula só para decimais)';

/** Reaproveita o parse pt-BR de lib/notaFiscal.ts para quantidade (> 0), recusando padrão de milhar. */
export function parsearQuantidadeEntrada(texto: string): number | null {
  const limpo = texto.trim();
  if (!limpo || PADRAO_MILHAR.test(limpo)) {
    return null;
  }
  return parsearFator(limpo);
}

/**
 * Parseia o custo unitário opcional (aceita vazio, 0 ou decimal pt-BR positivo; rejeita negativo, milhar ou inválido).
 */
export function parsearCustoEntrada(texto: string): {
  valido: boolean;
  valor: number | undefined;
  motivo?: 'negativo' | 'invalido';
} {
  const limpo = texto.trim();
  if (!limpo) {
    return { valido: true, valor: undefined };
  }
  if (PADRAO_MILHAR.test(limpo)) {
    return { valido: false, valor: undefined, motivo: 'invalido' };
  }
  const positivo = parsearFator(limpo);
  if (positivo !== null) {
    return { valido: true, valor: positivo };
  }
  const normalizado = limpo.replace(',', '.');
  const numero = Number(normalizado);
  if (Number.isFinite(numero) && numero === 0) {
    return { valido: true, valor: 0 };
  }
  if (Number.isFinite(numero) && numero < 0) {
    return { valido: false, valor: undefined, motivo: 'negativo' };
  }
  return { valido: false, valor: undefined, motivo: 'invalido' };
}

/** Converte a quantidade digitada para a unidade cadastrada do insumo usando lib/unidades.ts. */
export function converterQuantidadeParaBase(
  quantidadeDigitada: number,
  unidadeInsumo: string,
  modo: ModoUnidade,
): { quantidadeBase: number; fator: number; textoEquivalencia: string | null } {
  const alt = modo === 'ALTERNATIVA' ? unidadeAlternativa(unidadeInsumo) : null;
  if (alt) {
    const { fator, quantidadeConvertida } = sugerirConversao(
      alt.canonicaAlt,
      unidadeInsumo,
      quantidadeDigitada,
    );
    const quantidadeBase = Number(quantidadeConvertida.toFixed(4));
    const textoQtd = String(quantidadeBase).replace('.', ',');
    return {
      quantidadeBase,
      fator,
      textoEquivalencia: `equivale a ${textoQtd} ${alt.siglaBase}`,
    };
  }
  return {
    quantidadeBase: Number(quantidadeDigitada.toFixed(4)),
    fator: 1,
    textoEquivalencia: null,
  };
}

/** Converte o custo digitado para R$ por unidade do insumo e gera o texto explicativo de conversão. */
export function converterCustoParaBase(
  custoDigitado: number | undefined,
  unidadeInsumo: string,
  modo: ModoUnidade,
): { custoBase: number | undefined; textoConversaoCusto: string | null } {
  if (custoDigitado === undefined) {
    return { custoBase: undefined, textoConversaoCusto: null };
  }

  const alt = unidadeAlternativa(unidadeInsumo);
  if (!alt) {
    return {
      custoBase: Number(custoDigitado.toFixed(6)),
      textoConversaoCusto: null,
    };
  }

  const { fator } = sugerirConversao(alt.canonicaAlt, unidadeInsumo, 1);

  if (modo === 'ALTERNATIVA') {
    const custoBase = Number((custoDigitado / fator).toFixed(6));
    const textoConversaoCusto =
      custoDigitado > 0
        ? `${formatarMoeda(custoDigitado).replace(/\u00a0/g, ' ')}/${alt.siglaAlt} = R$ ${formatarDecimalCusto(custoBase)}/${alt.siglaBase}`
        : null;
    return { custoBase, textoConversaoCusto };
  }

  const custoBase = Number(custoDigitado.toFixed(6));
  const custoAlt = custoBase * fator;
  const textoConversaoCusto =
    custoDigitado > 0
      ? `${formatarMoeda(custoAlt).replace(/\u00a0/g, ' ')}/${alt.siglaAlt} = R$ ${formatarDecimalCusto(custoBase)}/${alt.siglaBase}`
      : null;
  return { custoBase, textoConversaoCusto };
}

/** Valida observação e linhas e monta o array `itens` pronto para envio à API. */
export function validarLinhasEntrada(
  linhas: ReadonlyArray<LinhaEntradaManual>,
  mapaInsumos: ReadonlyMap<string, Pick<InsumoParaEntrada, 'id' | 'unidade'>>,
  observacao: string,
): {
  valido: boolean;
  erros: ErrosValidacaoEntrada;
  itensPayload: ItemPayloadEntradaManual[];
} {
  const erros: ErrosValidacaoEntrada = { porLinha: {} };
  const itensPayload: ItemPayloadEntradaManual[] = [];
  const observacaoLimpa = observacao.trim();

  if (observacaoLimpa.length > 500) {
    erros.observacao = 'A observação deve ter no máximo 500 caracteres.';
  }

  if (linhas.length === 0) {
    erros.geral = 'Adicione pelo menos um item para registrar a entrada.';
  } else if (linhas.length > 100) {
    erros.geral = 'Máximo de 100 itens por lançamento.';
  }

  const idsVistos = new Set<string>();

  for (const linha of linhas) {
    const erroLinha: ErrosLinhaEntrada = {};
    const insumo = linha.insumoId ? mapaInsumos.get(linha.insumoId) : undefined;

    if (!insumo) {
      erroLinha.insumoId = 'Selecione um insumo.';
    } else if (idsVistos.has(insumo.id)) {
      erroLinha.insumoId = 'Este insumo já foi incluído na entrada.';
    } else {
      idsVistos.add(insumo.id);
    }

    const qtdLimpa = linha.quantidadeTexto.trim();
    const qtdDigitada = parsearQuantidadeEntrada(qtdLimpa);
    if (PADRAO_MILHAR.test(qtdLimpa)) {
      erroLinha.quantidade = MENSAGEM_ERRO_MILHAR;
    } else if (qtdDigitada === null) {
      erroLinha.quantidade = 'Informe uma quantidade maior que zero.';
    }

    const custoParsed = parsearCustoEntrada(linha.custoTexto);
    if (!custoParsed.valido) {
      erroLinha.custo =
        custoParsed.motivo === 'negativo'
          ? 'O custo unitário não pode ser negativo.'
          : 'Valor inválido';
    }

    if (erroLinha.insumoId || erroLinha.quantidade || erroLinha.custo) {
      erros.porLinha[linha.id] = erroLinha;
      continue;
    }

    if (insumo && qtdDigitada !== null) {
      const { quantidadeBase } = converterQuantidadeParaBase(
        qtdDigitada,
        insumo.unidade,
        linha.modoUnidade,
      );
      const { custoBase } = converterCustoParaBase(
        custoParsed.valor,
        insumo.unidade,
        linha.modoUnidade,
      );

      itensPayload.push({
        insumoId: insumo.id,
        quantidade: quantidadeBase,
        ...(custoBase !== undefined ? { custoUnitario: custoBase } : {}),
      });
    }
  }

  const valido =
    !erros.geral &&
    !erros.observacao &&
    Object.keys(erros.porLinha).length === 0 &&
    itensPayload.length > 0;

  return { valido, erros, itensPayload };
}

/** Chave determinística do conteúdo da entrada: alterar qualquer campo gera uma nova chave de idempotência. */
export function chaveConteudoEntrada(
  observacao: string,
  itens: ReadonlyArray<ItemPayloadEntradaManual>,
): string {
  return JSON.stringify({ observacao: observacao.trim(), itens });
}

export interface ItemResumoConfirmacao {
  nome: string;
  quantidade: number;
  unidade: string;
}

export function textoConfirmacaoEntrada(
  itensOuQtd: number | ReadonlyArray<ItemResumoConfirmacao>,
): string {
  if (typeof itensOuQtd === 'number') {
    return `Dar entrada de ${itensOuQtd} ${itensOuQtd === 1 ? 'item' : 'itens'}? O estoque será aumentado.`;
  }
  const qtdItens = itensOuQtd.length;
  const cabecalho = `Dar entrada de ${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}? O estoque será aumentado.`;
  if (qtdItens === 0) {
    return cabecalho;
  }
  const detalhes = itensOuQtd.map(
    (item) =>
      `${item.nome}: +${formatarQuantidade(item.quantidade, siglaUnidadeBase(item.unidade))}`,
  );
  return `${cabecalho}\n${detalhes.join('\n')}`;
}

export type ErroEnvioEntrada =
  | { tipo: 'nao_encontrado'; mensagem: string }
  | { tipo: 'conflito'; mensagem: string }
  | { tipo: 'rede'; mensagem: string }
  | { tipo: 'validacao'; mensagem: string };

/** Classifica respostas 404, 409, 400 e falhas de rede/5xx preservando detalhes úteis ao operador. */
export function classificarErroEntrada(
  error: unknown,
  insumosSelecionados: ReadonlyArray<{ id: string; nome: string }>,
): ErroEnvioEntrada {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response || (status !== undefined && status >= 500)) {
      return {
        tipo: 'rede',
        mensagem:
          'Falha de conexão com o servidor. Toque em Dar entrada novamente: a mesma chave será usada e nada será somado em dobro.',
      };
    }
    if (status === 409) {
      return {
        tipo: 'conflito',
        mensagem:
          'Esta chave de tentativa já foi usada com conteúdo diferente. Uma nova chave foi preparada; confira o estoque antes de enviar novamente.',
      };
    }
    if (status === 404) {
      const msgBackend = mensagemDeErro(error, 'Insumo não encontrado.');
      const encontrados = insumosSelecionados.filter(
        (ins) =>
          msgBackend.includes(ins.id) ||
          msgBackend.toLowerCase().includes(ins.nome.toLowerCase()),
      );
      const nomes = (encontrados.length > 0 ? encontrados : insumosSelecionados)
        .map((ins) => ins.nome)
        .join(', ');
      return {
        tipo: 'nao_encontrado',
        mensagem: nomes
          ? `Insumo não encontrado (pode ter sido apagado): ${nomes}. (${msgBackend})`
          : msgBackend,
      };
    }
    return {
      tipo: 'validacao',
      mensagem: mensagemDeErro(error, 'Não foi possível registrar a entrada manual.'),
    };
  }
  return {
    tipo: 'validacao',
    mensagem: mensagemDeErro(error, 'Não foi possível registrar a entrada manual.'),
  };
}
