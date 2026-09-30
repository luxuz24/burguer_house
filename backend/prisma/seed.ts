// backend/prisma/seed.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  console.log('############################ Limpando banco de dados... ############################');
  await prisma.fichaTecnica.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.insumo.deleteMany();

  console.log('############################ Inserindo TODOS os 49 insumos da Burguer House... ############################');

  // Array completo de insumos com suas propriedades
  const insumosData = [
    { nome: 'Pão Brioche', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 150, estoqueMinimo: 50 },
    { nome: 'Carne de Hambúrguer', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 5000, estoqueMinimo: 1000 },
    { nome: 'Bacon fatiado', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 3000, estoqueMinimo: 500 },
    { nome: 'Queijo Mussarela Fatia', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 150, estoqueMinimo: 50 },
    { nome: 'Queijo Cheddar Fatia', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 150, estoqueMinimo: 50 },
    { nome: 'Alface Americana', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Tomate', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Rúcula', unidade: 'Gramas', fatorPerda: 0.5, estoqueAtual: 1000, estoqueMinimo: 300 },
    { nome: 'Cebola branca', unidade: 'Gramas', fatorPerda: 0.105, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Molho Barbecue', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 3500, estoqueMinimo: 500 },
    { nome: 'Geleia de Pimenta', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Frango Empanado', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 50, estoqueMinimo: 15 },
    { nome: 'Batata Frita Bem Brasil', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 5000, estoqueMinimo: 1000 },
    { nome: 'Batata Inglesa', unidade: 'Gramas', fatorPerda: 0.03, estoqueAtual: 3000, estoqueMinimo: 500 },
    { nome: 'Cebola Roxa', unidade: 'Gramas', fatorPerda: 0.105, estoqueAtual: 1500, estoqueMinimo: 300 },
    { nome: 'Maionese da Casa - Beneficiado', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1500, estoqueMinimo: 300 },
    { nome: 'Mussarela Empanada - Beneficiado', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 50, estoqueMinimo: 15 },
    { nome: 'Carne seca com requeijão - Beneficiado', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Cebola Caremelizada - Beneficiado', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Sal Fino', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Óleo de soja', unidade: 'Mililitros', fatorPerda: 0.0, estoqueAtual: 5000, estoqueMinimo: 900 },
    { nome: 'Alho desidratado', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 500, estoqueMinimo: 100 },
    { nome: 'Mostarda em pó desidratada', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 500, estoqueMinimo: 50 },
    { nome: 'Manjericão', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 100, estoqueMinimo: 20 },
    { nome: 'Cebolinha', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 200, estoqueMinimo: 50 },
    { nome: 'Salsinha', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 200, estoqueMinimo: 50 },
    { nome: 'Hortelã', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 100, estoqueMinimo: 20 },
    { nome: 'Leite', unidade: 'Mililitros', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Shoyu', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Açúcar', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Panko', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Ovo', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 60, estoqueMinimo: 12 },
    { nome: 'Queijo Mussarela para empanamento', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
    { nome: 'Papel Acoplado', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 500, estoqueMinimo: 100 },
    { nome: 'Coca Cola Zero 350ml', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 100, estoqueMinimo: 24 },
    { nome: 'Coca Cola Original 350ml', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 100, estoqueMinimo: 24 },
    { nome: 'Coca Cola 600mL', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 100, estoqueMinimo: 24 },
    { nome: 'Coca Cola Zero 600ml', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 100, estoqueMinimo: 24 },
    { nome: 'agua com gás', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 50, estoqueMinimo: 12 },
    { nome: 'agua sem gás', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 50, estoqueMinimo: 12 },
    { nome: 'heineken long neck', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 50, estoqueMinimo: 12 },
    { nome: 'coca litro', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 50, estoqueMinimo: 12 },
    { nome: 'Embalagem de molho (potinho)', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 500, estoqueMinimo: 100 },
    { nome: 'Palito de madeira', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 500, estoqueMinimo: 100 },
    { nome: 'Embalagem de Batata', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 500, estoqueMinimo: 100 },
    { nome: 'Margarina', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Saco Kraft Delivery', unidade: 'Unidade', fatorPerda: 0.0, estoqueAtual: 300, estoqueMinimo: 50 },
    { nome: 'Crispy Mandioca - Beneficiado', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 1000, estoqueMinimo: 200 },
    { nome: 'Mandioca', unidade: 'Gramas', fatorPerda: 0.0, estoqueAtual: 2000, estoqueMinimo: 500 },
  ];

  // Inserção em massa e mapeamento para uso nas fichas técnicas
  const insumosDb = await Promise.all(
    insumosData.map(insumo => prisma.insumo.create({ data: insumo }))
  );

  // Helper para buscar ID do insumo pelo nome
  const getInsumoId = (nome: string) => {
    const item = insumosDb.find(i => i.nome === nome);
    if (!item) throw new Error(`Insumo ${nome} não encontrado!`);
    return item.id;
  };

  console.log('############################ Inserindo Fichas Técnicas dos Produtos... ############################');

  // PRODUTO: BACON HOUSE (com embalagens)
  await prisma.produto.create({
    data: {
      nome: 'BACON HOUSE',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Pão Brioche'), quantidade: 1 },
          { insumoId: getInsumoId('Carne de Hambúrguer'), quantidade: 160 },
          { insumoId: getInsumoId('Queijo Cheddar Fatia'), quantidade: 2 },
          { insumoId: getInsumoId('Bacon fatiado'), quantidade: 32 },
          { insumoId: getInsumoId('Maionese da Casa - Beneficiado'), quantidade: 40 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 5 },
          { insumoId: getInsumoId('Margarina'), quantidade: 2 },
          { insumoId: getInsumoId('Saco Kraft Delivery'), quantidade: 0.5 }, // 1 saco para cada 2 lanches
          { insumoId: getInsumoId('Palito de madeira'), quantidade: 1 },
          { insumoId: getInsumoId('Papel Acoplado'), quantidade: 1 },
          { insumoId: getInsumoId('Embalagem de molho (potinho)'), quantidade: 1 },
        ]
      }
    }
  });

  // PRODUTO 2: HOUSE DUPLO
  await prisma.produto.create({
    data: {
      nome: 'HOUSE DUPLO',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Pão Brioche'), quantidade: 1 },
          { insumoId: getInsumoId('Carne de Hambúrguer'), quantidade: 320 }, // 2 carnes
          { insumoId: getInsumoId('Queijo Cheddar Fatia'), quantidade: 4 }, // 4 fatias
          { insumoId: getInsumoId('Molho Barbecue'), quantidade: 30 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 5 },
          { insumoId: getInsumoId('Margarina'), quantidade: 2 },
        ]
      }
    }
  });

  // PRODUTO 3: SELADINHO HOUSE
  await prisma.produto.create({
    data: {
      nome: 'SELADINHO HOUSE',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Pão Brioche'), quantidade: 1 },
          { insumoId: getInsumoId('Carne de Hambúrguer'), quantidade: 160 },
          { insumoId: getInsumoId('Queijo Cheddar Fatia'), quantidade: 2 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 5 },
          { insumoId: getInsumoId('Margarina'), quantidade: 2 },
        ]
      }
    }
  });

  // PRODUTO 4: RÚCULA HOUSE (Utilizando a rúcula e cebola declaradas)
  await prisma.produto.create({
    data: {
      nome: 'RÚCULA HOUSE',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Pão Brioche'), quantidade: 1 },
          { insumoId: getInsumoId('Carne de Hambúrguer'), quantidade: 160 },
          { insumoId: getInsumoId('Queijo Cheddar Fatia'), quantidade: 2 },
          { insumoId: getInsumoId('Rúcula'), quantidade: 30 },
          { insumoId: getInsumoId('Cebola branca'), quantidade: 20 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 5 },
          { insumoId: getInsumoId('Margarina'), quantidade: 2 },
        ]
      }
    }
  });

  // PRODUTO 5: ONION BARBECUE (Utilizando bastante cebola e barbecue)
  await prisma.produto.create({
    data: {
      nome: 'ONION BARBECUE',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Pão Brioche'), quantidade: 1 },
          { insumoId: getInsumoId('Carne de Hambúrguer'), quantidade: 160 },
          { insumoId: getInsumoId('Queijo Cheddar Fatia'), quantidade: 2 },
          { insumoId: getInsumoId('Cebola branca'), quantidade: 50 },
          { insumoId: getInsumoId('Molho Barbecue'), quantidade: 30 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 5 },
          { insumoId: getInsumoId('Margarina'), quantidade: 2 },
        ]
      }
    }
  });

  // PRODUTO 6: MASTER HOUSE (Combinação completa utilizando todos os insumos)
  await prisma.produto.create({
    data: {
      nome: 'MASTER HOUSE',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Pão Brioche'), quantidade: 1 },
          { insumoId: getInsumoId('Carne de Hambúrguer'), quantidade: 200 }, // Hambúrguer maior
          { insumoId: getInsumoId('Queijo Cheddar Fatia'), quantidade: 3 },
          { insumoId: getInsumoId('Bacon fatiado'), quantidade: 32 },
          { insumoId: getInsumoId('Cebola branca'), quantidade: 20 },
          { insumoId: getInsumoId('Rúcula'), quantidade: 15 },
          { insumoId: getInsumoId('Molho Barbecue'), quantidade: 20 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 5 },
          { insumoId: getInsumoId('Margarina'), quantidade: 2 },
        ]
      }
    }
  });
  // PRODUTO: MAIONESE DA CASA (O Beneficiado em si também pode ser tratado como Produto depois na Fase 4)
  await prisma.produto.create({
    data: {
      nome: 'PRODUÇÃO: Maionese da Casa (1,5kg)',
      fichasTecnicas: {
        create: [
          { insumoId: getInsumoId('Óleo de soja'), quantidade: 967 },
          { insumoId: getInsumoId('Leite'), quantidade: 500 },
          { insumoId: getInsumoId('Salsinha'), quantidade: 42 },
          { insumoId: getInsumoId('Cebolinha'), quantidade: 34 },
          { insumoId: getInsumoId('Alho desidratado'), quantidade: 20 },
          { insumoId: getInsumoId('Mostarda em pó desidratada'), quantidade: 14 },
          { insumoId: getInsumoId('Sal Fino'), quantidade: 14 },
          { insumoId: getInsumoId('Manjericão'), quantidade: 4 },
          { insumoId: getInsumoId('Hortelã'), quantidade: 2 },
        ]
      }
    }
  });

  console.log('############################ Seed 100% real da Burguer House finalizado com sucesso! ############################' );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });