/**
 * Replay offline e simulação (dry-run) da consolidação de vendas.
 *
 * Lê as vendas da tabela `Venda` sem alterar nada no banco de dados e exibe:
 * - O destino de cada venda (abater / ignorar / aguardar / pendente por mapeamento);
 * - Itens e modificadores (subItems) identificados;
 * - Produtos não encontrados no catálogo;
 * - Balanço dos insumos que seriam abatidos e projeção do estoque final.
 *
 * Uso:
 *   npx tsx scripts/replay-vendas.ts [--todas] [--limite=100]
 */
// @ts-nocheck


import { prisma } from '../src/infra/database/prisma.js';
import { AnotaAIAdapter, normalizarNomeProduto } from '../src/modules/vendas/services/anotaai.adapter.js';

interface EstatisticasReplay {
  totalVendas: number;
  abater: number;
  ignorar: number;
  aguardar: number;
  semItens: number;
  pendentesNaoMapeadas: number;
  produtosNaoEncontrados: Set<string>;
  descontosPorInsumo: Map<string, { nome: string; unidade: string; estoqueAtual: number; desconto: number }>;
}

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

  const adapter = new AnotaAIAdapter();

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
  const produtoPorNome = new Map(produtos.map((p) => [normalizarNomeProduto(p.nome), p]));

  const insumos = await prisma.insumo.findMany();
  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));

  const stats: EstatisticasReplay = {
    totalVendas: vendas.length,
    abater: 0,
    ignorar: 0,
    aguardar: 0,
    semItens: 0,
    pendentesNaoMapeadas: 0,
    produtosNaoEncontrados: new Set<string>(),
    descontosPorInsumo: new Map(),
  };

  for (const venda of vendas) {
    const parse = adapter.parsear(venda.payloadOriginal);

    if (parse.destino === 'ignorar') {
      stats.ignorar++;
      continue;
    }

    if (parse.destino === 'aguardar') {
      stats.aguardar++;
      continue;
    }

    // destino: 'abater'
    if (parse.itens.length === 0) {
      stats.semItens++;
      continue;
    }

    // Flatten de itens + subItens
    const expandir = (lista: typeof parse.itens, mult = 1): Array<{ nome: string; quantidade: number }> => {
      const res: Array<{ nome: string; quantidade: number }> = [];
      for (const item of lista) {
        const qtd = item.quantidade * mult;
        res.push({ nome: item.nome, quantidade: qtd });
        if (item.subItens && item.subItens.length > 0) {
          res.push(...expandir(item.subItens, qtd));
        }
      }
      return res;
    };

    const itensExpandidos = expandir(parse.itens);
    let todosMapeados = true;
    const itensComProduto: Array<{ produto: (typeof produtos)[number]; quantidade: number }> = [];

    for (const item of itensExpandidos) {
      const chave = normalizarNomeProduto(item.nome);
      const prod = produtoPorNome.get(chave);
      if (!prod) {
        todosMapeados = false;
        stats.produtosNaoEncontrados.add(item.nome);
      } else {
        itensComProduto.push({ produto: prod, quantidade: item.quantidade });
      }
    }

    if (!todosMapeados) {
      stats.pendentesNaoMapeadas++;
      continue;
    }

    stats.abater++;
    for (const { produto, quantidade } of itensComProduto) {
      for (const ficha of produto.fichasTecnicas) {
        const insumo = insumoPorId.get(ficha.insumoId);
        if (!insumo) continue;
        const fatorPerda = Math.max(0, insumo.fatorPerda || 0);
        const desconto = ficha.quantidade * (1 + fatorPerda) * quantidade;

        const atual = stats.descontosPorInsumo.get(insumo.id) ?? {
          nome: insumo.nome,
          unidade: insumo.unidade,
          estoqueAtual: insumo.estoqueAtual,
          desconto: 0,
        };
        atual.desconto += desconto;
        stats.descontosPorInsumo.set(insumo.id, atual);
      }
    }
  }

  console.log('\n📊 [RESULTADO DO PROCESSAMENTO]');
  console.log(`   Total de vendas analisadas: ${stats.totalVendas}`);
  console.log(`   Prontas para abater estoque: ${stats.abater}`);
  console.log(`   Canceladas/negadas (ignorar): ${stats.ignorar}`);
  console.log(`   Aguardando confirmação/estado: ${stats.aguardar}`);
  console.log(`   Sem itens válidos: ${stats.semItens}`);
  console.log(`   Pendentes por produtos não cadastrados: ${stats.pendentesNaoMapeadas}`);

  if (stats.produtosNaoEncontrados.size > 0) {
    console.log('\n⚠️  [PRODUTOS NÃO ENCONTRADOS NO CATÁLOGO]');
    for (const nome of stats.produtosNaoEncontrados) {
      console.log(`   ❌ "${nome}" (chave normalizada: "${normalizarNomeProduto(nome)}")`);
    }
    console.log('   -> Cadastre estes produtos ou ajuste o nome para viabilizar a baixa.');
  } else {
    console.log('\n✅ Todos os itens de vendas válidas estão mapeados no catálogo!');
  }

  if (stats.descontosPorInsumo.size > 0) {
    console.log('\n📦 [PROJEÇÃO DE DEDUÇÃO DE ESTOQUE]');
    console.log('   Insumo                  | Saldo Atual | Baixa Simulada | Saldo Projetado');
    console.log('   ' + '-'.repeat(66));
    for (const [, info] of stats.descontosPorInsumo) {
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
