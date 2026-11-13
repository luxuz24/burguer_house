#!/usr/bin/env node
/**
 * Valida a resposta JSON de POST /api/vendas/consolidar, escreve resumo em
 * GITHUB_STEP_SUMMARY (quando definido) e falha (exit 1) se houver vendas
 * retidas ou resposta fora do contrato.
 *
 * Uso: node backend/scripts/checar-consolidacao.mjs <caminho-resposta.json>
 */
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CAMPOS_NUMERICOS_OPCIONAIS = [
  'insumosAfetados',
  'vendasSemItens',
  'vendasComItensInvalidos',
  'canceladasIgnoradas',
  'vendasAguardando',
  'vendasPendentesNaoMapeadas',
];

const CAMPOS_ARRAY_OPCIONAIS = [
  'produtosNaoEncontrados',
  'produtosSemFicha',
  'produtosComColisaoNome',
  'insumosComEstoqueNegativo',
];

function isNumeroNaoNegativo(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
}

/**
 * Analisa e valida a string JSON da resposta de consolidação.
 * @param {string} conteudoBruto
 */
export function avaliarRespostaConsolidacao(conteudoBruto) {
  let dados;
  try {
    dados = JSON.parse(conteudoBruto);
  } catch {
    return {
      ok: false,
      motivo: 'JSON_INVALIDO',
      resumo: montarResumoInvalido('O corpo retornado pela API não é um JSON válido.'),
    };
  }

  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return {
      ok: false,
      motivo: 'CONTRATO_INVALIDO',
      resumo: montarResumoInvalido('Resposta inválida: esperado objeto JSON.'),
    };
  }

  if (!isNumeroNaoNegativo(dados.consolidadas)) {
    return {
      ok: false,
      motivo: 'CONTRATO_INVALIDO',
      resumo: montarResumoInvalido(
        'Resposta inválida: campo obrigatório "consolidadas" ausente ou negativo.',
      ),
    };
  }

  for (const campo of CAMPOS_NUMERICOS_OPCIONAIS) {
    if (dados[campo] !== undefined && !isNumeroNaoNegativo(dados[campo])) {
      return {
        ok: false,
        motivo: 'CONTRATO_INVALIDO',
        resumo: montarResumoInvalido(
          `Resposta inválida: campo "${campo}" deve ser número não negativo.`,
        ),
      };
    }
  }

  for (const campo of CAMPOS_ARRAY_OPCIONAIS) {
    if (dados[campo] !== undefined && !Array.isArray(dados[campo])) {
      return {
        ok: false,
        motivo: 'CONTRATO_INVALIDO',
        resumo: montarResumoInvalido(`Resposta inválida: campo "${campo}" deve ser array.`),
      };
    }
  }

  const vendasPendentesNaoMapeadas = dados.vendasPendentesNaoMapeadas ?? 0;
  const vendasComItensInvalidos = dados.vendasComItensInvalidos ?? 0;
  const vendasSemItens = dados.vendasSemItens ?? 0;
  const totalRetidas = vendasPendentesNaoMapeadas + vendasComItensInvalidos + vendasSemItens;
  const temRetidas = totalRetidas > 0;

  const resumo = montarResumoValido({
    consolidadas: dados.consolidadas,
    insumosAfetados: dados.insumosAfetados ?? 0,
    vendasAguardando: dados.vendasAguardando ?? 0,
    canceladasIgnoradas: dados.canceladasIgnoradas ?? 0,
    vendasPendentesNaoMapeadas,
    vendasComItensInvalidos,
    vendasSemItens,
    totalRetidas,
    produtosNaoEncontrados: dados.produtosNaoEncontrados ?? [],
    produtosSemFicha: dados.produtosSemFicha ?? [],
    produtosComColisaoNome: dados.produtosComColisaoNome ?? [],
    insumosComEstoqueNegativo: dados.insumosComEstoqueNegativo ?? [],
    mensagem: typeof dados.mensagem === 'string' ? dados.mensagem : undefined,
    temRetidas,
  });

  return {
    ok: !temRetidas,
    motivo: temRetidas ? 'VENDAS_RETIDAS' : 'OK',
    resumo,
  };
}

function montarResumoInvalido(detalhe) {
  return [
    '## Consolidação de vendas — RESPOSTA INVÁLIDA',
    '',
    `> **Erro:** ${detalhe}`,
    '',
    'Verifique os logs da API e consulte `GET /api/vendas/retidas`.',
  ].join('\n');
}

function montarResumoValido(info) {
  const titulo = info.temRetidas
    ? '## Consolidação de vendas — ALERTA: vendas retidas'
    : '## Consolidação de vendas — OK';

  const linhas = [titulo, ''];

  if (info.mensagem) {
    linhas.push(`_${info.mensagem}_`, '');
  }

  linhas.push(
    '| Métrica | Quantidade |',
    '|---|---:|',
    `| Consolidadas | ${info.consolidadas} |`,
    `| Retidas (total) | ${info.totalRetidas} |`,
    `| — Não mapeadas / sem ficha / colisão | ${info.vendasPendentesNaoMapeadas} |`,
    `| — Itens inválidos | ${info.vendasComItensInvalidos} |`,
    `| — Sem itens | ${info.vendasSemItens} |`,
    `| Aguardando confirmação | ${info.vendasAguardando} |`,
    `| Canceladas ignoradas | ${info.canceladasIgnoradas} |`,
    `| Insumos afetados | ${info.insumosAfetados} |`,
  );

  if (info.produtosNaoEncontrados.length > 0) {
    linhas.push('', '### Produtos não encontrados', ...info.produtosNaoEncontrados.map((p) => `- ${p}`));
  }

  if (info.produtosSemFicha.length > 0) {
    linhas.push('', '### Produtos sem ficha técnica', ...info.produtosSemFicha.map((p) => `- ${p}`));
  }

  if (info.produtosComColisaoNome.length > 0) {
    linhas.push('', '### Produtos com colisão de nome', ...info.produtosComColisaoNome.map((p) => `- ${p}`));
  }

  if (info.insumosComEstoqueNegativo.length > 0) {
    linhas.push(
      '',
      '### Insumos com estoque negativo após baixa',
      ...info.insumosComEstoqueNegativo.map(
        (i) => `- ${i.nome ?? i.id}: estoqueAtual=${i.estoqueAtual}`,
      ),
    );
  }

  if (info.temRetidas) {
    linhas.push(
      '',
      '### Ação necessária',
      'Há vendas retidas (`processado = false`) que não deram baixa no estoque.',
      '1. Consulte `GET /api/vendas/retidas` para ver o motivo exato de cada venda.',
      '2. Ajuste o cadastro do produto e/ou a ficha técnica no painel administrativo.',
      '3. Execute novamente a consolidação após corrigir o cadastro.',
    );
  }

  return linhas.join('\n');
}

function escreverSummary(texto) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${texto}\n`, 'utf-8');
  }
}

function main() {
  const caminhoArquivo = process.argv[2];
  if (!caminhoArquivo) {
    const resumo = montarResumoInvalido('Caminho do arquivo de resposta não informado.');
    escreverSummary(resumo);
    console.error(resumo);
    process.exit(1);
  }

  let conteudo;
  try {
    conteudo = readFileSync(caminhoArquivo, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resumo = montarResumoInvalido(`Não foi possível ler "${caminhoArquivo}": ${msg}`);
    escreverSummary(resumo);
    console.error(resumo);
    process.exit(1);
  }

  const resultado = avaliarRespostaConsolidacao(conteudo);
  escreverSummary(resultado.resumo);

  if (!resultado.ok) {
    console.error(resultado.resumo);
    process.exit(1);
  }

  console.log(resultado.resumo);
}

const ehExecucaoDireta =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (ehExecucaoDireta) {
  main();
}
