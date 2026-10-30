/**
 * Replay offline e simulação (dry-run) da consolidação de vendas.
 *
 * Lê as vendas da tabela `Venda` sem alterar nada no banco de dados e exibe:
 * - O destino de cada venda (abater / ignorar / aguardar / pendente por mapeamento);
 * - Itens e modificadores (subItems) identificados;
 * - Produtos não encontrados ou sem ficha técnica no catálogo;
 * - Colisões de nomes no catálogo;
 * - Balanço dos insumos que seriam abatidos e projeção do estoque final.
 *
 * Uso:
 *   npx tsx scripts/replay-vendas.ts [--todas] [--limite=100]
 */

import { prisma } from '../src/infra/database/prisma.js';
import { planejarConsolidacao } from '../src/modules/vendas/services/planejar_consolidacao.js';
import { normalizarNomeProduto } from '../src/modules/vendas/services/anotaai.adapter.js';

async function executarReplay() {
  const args = process.argv.slice(2);
  const incluirProcessadas = args.includes('--todas');
  const limiteArg = args.find((a) => a.startsWith('--limite='));
  const limite = limiteArg ? Number.parseInt(limiteArg.split('=')[1] ?? '100', 10) : 100;

  console.log('='.repeat(70));
  console.log(`🔍 [REPLAY VENDAS] Iniciando simulação dry-run`);
  console.log(`   Modo: ${incluirProcessadas ? 'Todas as vendas (incluindo já processadas)' : 'Apenas vendas pendentes (processado = false)'}`);
  console.log(`   Limite: ${limite}`);
  console.log('='.repeat(70));

  const onde = incluirProcessadas ? {} : { processado: false };
  const vendas = await prisma.venda.findMany({
    where: onde,
    take: limite,
    orderBy: { criadoEm: 'desc' },
  });

  if (vendas.length === 0) {
    console.log('\nNenhuma venda encontrada para o filtro especificado.\n');
    await prisma.$disconnect();
    return;
  }

  const produtos = await prisma.produto.findMany({
    include: { fichasTecnicas: { include: { insumo: true } } },
  });

  // Utiliza a exata mesma função pura determinística da consolidação real
  const plano = planejarConsolidacao(vendas, produtos);

  console.log('\n📊 [RESULTADO DO PROCESSAMENTO]');
  console.log(`   Total de vendas analisadas: ${vendas.length}`);
  console.log(`   Prontas para abater estoque: ${plano.vendasAAbater.length}`);
  console.log(`   Canceladas/negadas (ignorar): ${plano.vendasAIgnorar.length}`);
  console.log(`   Aguardando confirmação de estado: ${plano.vendasAguardando.length}`);
  console.log(`   Sem itens válidos: ${plano.vendasSemItens.length}`);
  console.log(`   Com itens ilegíveis/inválidos: ${plano.vendasComItensInvalidos.length}`);
  console.log(`   Total de vendas pendentes por inconsistência: ${plano.vendasPendentesNaoMapeadas}`);

  if (plano.itensInvalidos.length > 0) {
    console.log('\n⚠️  [ITENS INVÁLIDOS ENCONTRADOS NAS VENDAS]');
    for (const inv of plano.itensInvalidos) {
      console.log(`   ❌ Venda ${inv.vendaId}: ${inv.motivo} (bruto: ${JSON.stringify(inv.itemBruto)})`);
    }
  }

  if (plano.produtosNaoEncontrados.length > 0) {
    console.log('\n⚠️  [PRODUTOS NÃO ENCONTRADOS NO CATÁLOGO]');
    for (const nome of plano.produtosNaoEncontrados) {
      console.log(`   ❌ "${nome}" (chave normalizada: "${normalizarNomeProduto(nome)}")`);
    }
    console.log('   -> Cadastre estes produtos no painel para viabilizar a baixa.');
  }

  if (plano.produtosSemFicha.length > 0) {
    console.log('\n⚠️  [PRODUTOS CADASTRADOS SEM FICHA TÉCNICA]');
    for (const nome of plano.produtosSemFicha) {
      console.log(`   ⚠️  "${nome}" não possui ficha técnica vinculada.`);
    }
    console.log('   -> Adicione os insumos da receita para que o estoque seja baixado.');
  }

  if (plano.produtosComColisaoNome.length > 0) {
    console.log('\n⚠️  [COLISÃO DE NOMES NO CATÁLOGO]');
    for (const nome of plano.produtosComColisaoNome) {
      console.log(`   ⚠️  "${nome}" possui duplicidade de nome canônico no catálogo.`);
    }
    console.log('   -> Renomeie produtos duplicados para evitar ambiguidades.');
  }

  if (plano.descontosPorInsumo.size > 0) {
    console.log('\n📦 [PROJEÇÃO DE DEDUÇÃO DE ESTOQUE]');
    console.log('   Insumo                  | Saldo Atual | Baixa Simulada | Saldo Projetado');
    console.log('   ' + '-'.repeat(66));
    for (const [, info] of plano.descontosPorInsumo) {
      const projetado = Number((info.estoqueAtual - info.desconto).toFixed(4));
      const alerta = projetado < 0 ? ' 🔴 (NEGATIVO)' : '';
      const nomeFormatado = info.nome.padEnd(23, ' ');
      const saldoStr = `${info.estoqueAtual} ${info.unidade}`.padStart(11, ' ');
      const baixaStr = `${Number(info.desconto.toFixed(4))} ${info.unidade}`.padStart(14, ' ');
      const projStr = `${projetado} ${info.unidade}${alerta}`.padStart(15, ' ');
      console.log(`   ${nomeFormatado} | ${saldoStr} | ${baixaStr} | ${projStr}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Simulação concluída com sucesso (banco intacto, nenhuma alteração salva).');
  console.log('='.repeat(70) + '\n');

  await prisma.$disconnect();
}

executarReplay().catch((err) => {
  console.error('Erro na execução do replay:', err);
  process.exit(1);
});
