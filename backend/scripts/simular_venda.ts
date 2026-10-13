import { prisma } from '../src/infra/database/prisma.js';

async function simularDiaDeVendas() {
  console.log('🍔 Iniciando Simulação de Vendas e Consolidação de Estoque (Anota AI)...\n');

  // 1. Criar ou obter Insumos de Teste
  let pao = await prisma.insumo.findFirst({ where: { nome: 'Pão de Brioche (Simulado)' } });
  if (!pao) {
    pao = await prisma.insumo.create({
      data: {
        nome: 'Pão de Brioche (Simulado)',
        unidade: 'Unidade',
        estoqueAtual: 50,
        estoqueMinimo: 10,
        fatorPerda: 0
      }
    });
  } else {
    pao = await prisma.insumo.update({
      where: { id: pao.id },
      data: { estoqueAtual: 50 }
    });
  }

  let carne = await prisma.insumo.findFirst({ where: { nome: 'Carne Bovina 150g (Simulado)' } });
  if (!carne) {
    carne = await prisma.insumo.create({
      data: {
        nome: 'Carne Bovina 150g (Simulado)',
        unidade: 'Gramas',
        estoqueAtual: 10000, // 10kg
        estoqueMinimo: 1500,
        fatorPerda: 0.10 // 10% de perda no preparo (grelha)
      }
    });
  } else {
    carne = await prisma.insumo.update({
      where: { id: carne.id },
      data: { estoqueAtual: 10000 }
    });
  }

  let bacon = await prisma.insumo.findFirst({ where: { nome: 'Bacon Fatiado (Simulado)' } });
  if (!bacon) {
    bacon = await prisma.insumo.create({
      data: {
        nome: 'Bacon Fatiado (Simulado)',
        unidade: 'Gramas',
        estoqueAtual: 2000,
        estoqueMinimo: 500,
        fatorPerda: 0.05 // 5% de perda
      }
    });
  } else {
    bacon = await prisma.insumo.update({
      where: { id: bacon.id },
      data: { estoqueAtual: 2000 }
    });
  }

  console.log('📦 Estoque Inicial:');
  console.log(` - ${pao.nome}: ${pao.estoqueAtual} ${pao.unidade}`);
  console.log(` - ${carne.nome}: ${carne.estoqueAtual} ${carne.unidade}`);
  console.log(` - ${bacon.nome}: ${bacon.estoqueAtual} ${bacon.unidade}\n`);

  // 2. Criar ou obter Produto e Ficha Técnica
  let produto = await prisma.produto.findFirst({ where: { nome: 'Smash Bacon Especial' } });
  if (!produto) {
    produto = await prisma.produto.create({
      data: { nome: 'Smash Bacon Especial' }
    });
  }

  // Vincular ficha técnica: 1 pão, 150g de carne, 40g de bacon
  await prisma.fichaTecnica.upsert({
    where: { produtoId_insumoId: { produtoId: produto.id, insumoId: pao.id } },
    update: { quantidade: 1 },
    create: { produtoId: produto.id, insumoId: pao.id, quantidade: 1 }
  });

  await prisma.fichaTecnica.upsert({
    where: { produtoId_insumoId: { produtoId: produto.id, insumoId: carne.id } },
    update: { quantidade: 150 },
    create: { produtoId: produto.id, insumoId: carne.id, quantidade: 150 }
  });

  await prisma.fichaTecnica.upsert({
    where: { produtoId_insumoId: { produtoId: produto.id, insumoId: bacon.id } },
    update: { quantidade: 40 },
    create: { produtoId: produto.id, insumoId: bacon.id, quantidade: 40 }
  });

  console.log(`🍔 Produto cadastrado com ficha técnica: "${produto.nome}"`);
  console.log('   - 1 Pão (0% perda)');
  console.log('   - 150g Carne (10% perda = 165g descontados)');
  console.log('   - 40g Bacon (5% perda = 42g descontados)\n');

  // 3. Simular Webhook da Anota AI (Payload Real de 3 lanches vendidos)
  // 1 pedido com 2 lanches + 1 pedido com 1 lanche
  const payloadPedido1 = {
    id: 'anota-order-001',
    createdAt: new Date().toISOString(),
    customer: { name: 'Cliente Anota 1', phone: '67999990001' },
    items: [
      {
        name: 'Smash Bacon Especial',
        quantity: 2,
        unitPrice: 32.0,
        totalPrice: 64.0
      }
    ],
    total: 64.0
  };

  const payloadPedido2 = {
    id: 'anota-order-002',
    createdAt: new Date().toISOString(),
    customer: { name: 'Cliente Anota 2', phone: '67999990002' },
    items: [
      {
        name: 'Smash Bacon Especial',
        quantity: 1,
        unitPrice: 32.0,
        totalPrice: 32.0
      }
    ],
    total: 32.0
  };

  console.log('📡 Simulando chegada de 2 Webhooks da Anota AI (Total de 3 lanches vendidos)...');
  await prisma.venda.create({ data: { payloadOriginal: payloadPedido1, processado: false } });
  await prisma.venda.create({ data: { payloadOriginal: payloadPedido2, processado: false } });
  console.log('✅ Webhooks gravados na tabela "vendas" como não processados.\n');

  // 4. Executar o Serviço de Consolidação
  console.log('⚙️ Executando rotina noturna de consolidação...');
  const { ConsolidacaoService } = await import('../src/modules/vendas/services/consolidacao.service.js');
  const service = new ConsolidacaoService();
  const resultado = await service.consolidarVendasDoDia();
  console.log('📊 Resultado da consolidação:', resultado);

  // 5. Verificar Estoques Finais
  const paoFinal = await prisma.insumo.findUnique({ where: { id: pao.id } });
  const carneFinal = await prisma.insumo.findUnique({ where: { id: carne.id } });
  const baconFinal = await prisma.insumo.findUnique({ where: { id: bacon.id } });

  console.log('\n📉 Estoque Final Atualizado:');
  console.log(` - ${pao.nome}: ${paoFinal?.estoqueAtual} (Esperado: 47)`);
  console.log(` - ${carne.nome}: ${carneFinal?.estoqueAtual} (Esperado: 10000 - 3*165 = 9505)`);
  console.log(` - ${bacon.nome}: ${baconFinal?.estoqueAtual} (Esperado: 2000 - 3*42 = 1874)`);

  const sucessoPao = paoFinal?.estoqueAtual === 47;
  const sucessoCarne = carneFinal?.estoqueAtual === 9505;
  const sucessoBacon = baconFinal?.estoqueAtual === 1874;

  if (sucessoPao && sucessoCarne && sucessoBacon) {
    console.log('\n🎉 SUCESSO TOTAL! Todos os cálculos e descontos bateram com perfeição!');
  } else {
    console.error('\n❌ Discrepância nos valores calculados.');
  }

  await prisma.$disconnect();
}

simularDiaDeVendas().catch((err) => {
  console.error('Erro na simulação:', err);
  process.exit(1);
});
