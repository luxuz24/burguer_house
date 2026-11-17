import axios from 'axios';
import { mensagemDeErro } from './api';
import {
  MENSAGEM_ERRO_MILHAR,
  PADRAO_MILHAR,
  converterQuantidadeParaBase,
  parsearQuantidadeEntrada,
  siglaUnidadeBase,
  unidadeAlternativa,
  type InsumoParaEntrada,
  type ModoUnidade,
} from './entradaManual';
import { formatarQuantidade } from './formatar';

export const SUGESTOES_MOTIVO_CONTAGEM = [
  'Contagem inicial',
  'Contagem semanal',
  'Contagem mensal',
] as const;

export const MAX_ITENS_CONTAGEM = 200;

export interface EntradaContagemInsumo {
  texto: string;
  modoUnidade: ModoUnidade;
}

export interface ResultadoParseSaldoContado {
  estado: 'vazio' | 'valido' | 'milhar' | 'negativo' | 'invalido';
  valor: number | null;
  erro?: string;
}

export interface ItemPayloadContagem {
  insumoId: string;
  saldoContado: number;
}

export interface ItemResumoConfirmacaoContagem {
  insumoId: string;
  nome: string;
  unidade: string;
  saldoAnterior: number;
  saldoContado: number;
  diferenca: number;
}

export interface ItemResultadoContagem {
  insumoId: string;
  nome: string;
  unidade: string;
  saldoAnterior: number;
  saldoContado: number;
  diferenca: number;
}

export interface RegistrarAjusteEstoqueResultado {
  reaproveitado: boolean;
  chaveIdempotencia: string;
  itens: ItemResultadoContagem[];
}

export interface PreviaItemContagem {
  preenchido: boolean;
  valido: boolean;
  erro?: string;
  saldoContadoBase: number | null;
  textoEquivalencia: string | null;
  diferenca: number | null;
  textoDiferenca: string | null;
  sinalDiferenca: 'positivo' | 'negativo' | 'neutro' | null;
}

export type ErroEnvioContagem =
  | { tipo: 'proibido'; mensagem: string }
  | { tipo: 'nao_encontrado'; mensagem: string }
  | { tipo: 'conflito'; mensagem: string }
  | { tipo: 'rede'; mensagem: string }
  | { tipo: 'validacao'; mensagem: string };

/**
 * Interpreta o saldo contado digitado em pt-BR (>= 0).
 * Reaproveita PADRAO_MILHAR e parsearQuantidadeEntrada (que exige > 0) e trata o zero sem alterar a entrada manual.
 */
export function parsearSaldoContado(texto: string): ResultadoParseSaldoContado {
  const limpo = texto.trim();
  if (!limpo) {
    return { estado: 'vazio', valor: null };
  }
  if (PADRAO_MILHAR.test(limpo)) {
    return { estado: 'milhar', valor: null, erro: MENSAGEM_ERRO_MILHAR };
  }

  const positivo = parsearQuantidadeEntrada(limpo);
  if (positivo !== null) {
    return { estado: 'valido', valor: positivo };
  }

  const normalizado = limpo.replace(',', '.');
  if (/^0+(?:\.0+)?$/.test(normalizado)) {
    return { estado: 'valido', valor: 0 };
  }
  if (normalizado.startsWith('-')) {
    return {
      estado: 'negativo',
      valor: null,
      erro: 'O saldo contado não pode ser negativo.',
    };
  }
  return { estado: 'invalido', valor: null, erro: 'Valor inválido' };
}

/** Formata a diferença com sinal (+, − ou "sem diferença") e classe semântica. */
export function formatarDiferencaContagem(
  diferenca: number,
  sigla: string,
): { texto: string; sinal: 'positivo' | 'negativo' | 'neutro' } {
  const valor = Object.is(diferenca, -0) ? 0 : diferenca;
  if (valor > 0) {
    return {
      texto: `+${formatarQuantidade(Math.abs(valor), sigla)}`,
      sinal: 'positivo',
    };
  }
  if (valor < 0) {
    return {
      texto: `−${formatarQuantidade(Math.abs(valor), sigla)}`,
      sinal: 'negativo',
    };
  }
  return {
    texto: 'sem diferença',
    sinal: 'neutro',
  };
}

/** Calcula conversão para a unidade base do insumo e diferença prevista em relação ao saldo em tela. */
export function calcularPreviaItemContagem(
  insumo: Pick<InsumoParaEntrada, 'estoqueAtual' | 'unidade'>,
  contadoTexto: string,
  modoUnidade: ModoUnidade,
): PreviaItemContagem {
  const parsed = parsearSaldoContado(contadoTexto);
  if (parsed.estado === 'vazio') {
    return {
      preenchido: false,
      valido: true,
      saldoContadoBase: null,
      textoEquivalencia: null,
      diferenca: null,
      textoDiferenca: null,
      sinalDiferenca: null,
    };
  }
  if (parsed.estado !== 'valido' || parsed.valor === null) {
    return {
      preenchido: true,
      valido: false,
      erro: parsed.erro ?? 'Valor inválido',
      saldoContadoBase: null,
      textoEquivalencia: null,
      diferenca: null,
      textoDiferenca: null,
      sinalDiferenca: null,
    };
  }

  const { quantidadeBase, textoEquivalencia } = converterQuantidadeParaBase(
    parsed.valor,
    insumo.unidade,
    modoUnidade,
  );
  const diferencaBruta = Number((quantidadeBase - insumo.estoqueAtual).toFixed(6));
  const diferenca = Object.is(diferencaBruta, -0) ? 0 : diferencaBruta;
  const sigla = siglaUnidadeBase(insumo.unidade);
  const difFormatada = formatarDiferencaContagem(diferenca, sigla);

  return {
    preenchido: true,
    valido: true,
    saldoContadoBase: quantidadeBase,
    textoEquivalencia,
    diferenca,
    textoDiferenca: difFormatada.texto,
    sinalDiferenca: difFormatada.sinal,
  };
}

/** Valida motivo (3..500), itens contados (1..200, ignorando vazios) e monta o payload de envio. */
export function validarContagemEstoque(
  insumos: ReadonlyArray<Pick<InsumoParaEntrada, 'id' | 'nome' | 'unidade' | 'estoqueAtual'>>,
  entradasPorInsumo: Record<string, EntradaContagemInsumo | undefined>,
  motivo: string,
): {
  valido: boolean;
  erros: { geral?: string; motivo?: string; porInsumo: Record<string, string> };
  itensPayload: ItemPayloadContagem[];
  itensResumo: ItemResumoConfirmacaoContagem[];
} {
  const erros: { geral?: string; motivo?: string; porInsumo: Record<string, string> } = {
    porInsumo: {},
  };
  const itensPayload: ItemPayloadContagem[] = [];
  const itensResumo: ItemResumoConfirmacaoContagem[] = [];

  const motivoLimpo = motivo.trim();
  if (motivoLimpo.length < 3) {
    erros.motivo = 'Informe o motivo com pelo menos 3 caracteres.';
  } else if (motivoLimpo.length > 500) {
    erros.motivo = 'O motivo deve ter no máximo 500 caracteres.';
  }

  for (const insumo of insumos) {
    const entrada = entradasPorInsumo[insumo.id];
    const texto = entrada?.texto ?? '';
    const modo = entrada?.modoUnidade ?? 'BASE';
    const previa = calcularPreviaItemContagem(insumo, texto, modo);
    if (!previa.preenchido) continue;

    if (!previa.valido || previa.saldoContadoBase === null || previa.diferenca === null) {
      erros.porInsumo[insumo.id] = previa.erro ?? 'Valor inválido';
      continue;
    }

    itensPayload.push({
      insumoId: insumo.id,
      saldoContado: previa.saldoContadoBase,
    });
    itensResumo.push({
      insumoId: insumo.id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      saldoAnterior: insumo.estoqueAtual,
      saldoContado: previa.saldoContadoBase,
      diferenca: previa.diferenca,
    });
  }

  const temErroInsumo = Object.keys(erros.porInsumo).length > 0;
  if (itensPayload.length === 0 && !temErroInsumo) {
    erros.geral = 'Preencha o saldo contado de pelo menos um insumo.';
  } else if (itensPayload.length > MAX_ITENS_CONTAGEM) {
    erros.geral = `Máximo de ${MAX_ITENS_CONTAGEM} itens por contagem.`;
  }

  const valido =
    !erros.geral &&
    !erros.motivo &&
    !temErroInsumo &&
    itensPayload.length > 0;

  return { valido, erros, itensPayload, itensResumo };
}

/** Chave determinística do conteúdo da contagem: alterar qualquer saldo contado ou motivo gera nova chave. */
export function chaveConteudoContagem(
  motivo: string,
  itensPayload: ReadonlyArray<ItemPayloadContagem>,
): string {
  return JSON.stringify({ motivo: motivo.trim(), itens: itensPayload });
}

/** Texto do diálogo de confirmação listando itens com diferença, contagem sem diferença e recalculo do servidor. */
export function textoConfirmacaoContagem(
  itensResumo: ReadonlyArray<ItemResumoConfirmacaoContagem>,
): string {
  const comDiferenca = itensResumo.filter((item) => item.diferenca !== 0);
  const semDiferenca = itensResumo.length - comDiferenca.length;

  const linhas: string[] = comDiferenca.map((item) => {
    const sigla = siglaUnidadeBase(item.unidade);
    const dif = formatarDiferencaContagem(item.diferenca, sigla);
    return `${item.nome}: ${formatarQuantidade(item.saldoAnterior, sigla)} → ${formatarQuantidade(item.saldoContado, sigla)} (${dif.texto})`;
  });

  if (semDiferenca > 0) {
    linhas.push(
      `${semDiferenca} ${semDiferenca === 1 ? 'item sem diferença' : 'itens sem diferença'}.`,
    );
  }

  linhas.push('O servidor recalcula a diferença com o saldo do momento do envio.');
  return linhas.join('\n');
}

/** Classifica erros HTTP de POST /estoque/ajustes preservando detalhes úteis ao operador. */
export function classificarErroContagem(
  error: unknown,
  insumosSelecionados: ReadonlyArray<{ id: string; nome: string }>,
): ErroEnvioContagem {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response || (status !== undefined && status >= 500)) {
      return {
        tipo: 'rede',
        mensagem:
          'Falha de conexão com o servidor. Toque em Registrar contagem novamente: a mesma chave será usada e nada será gravado em dobro.',
      };
    }
    if (status === 403) {
      return {
        tipo: 'proibido',
        mensagem: 'Só gerente ou administrador pode registrar contagem.',
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
      mensagem: mensagemDeErro(error, 'Não foi possível registrar a contagem.'),
    };
  }
  return {
    tipo: 'validacao',
    mensagem: mensagemDeErro(error, 'Não foi possível registrar a contagem.'),
  };
}

export { unidadeAlternativa, siglaUnidadeBase };
