// backend/prisma/seed.ts
// Seed de PRODUÇÃO (e do banco de desenvolvimento): `npx prisma db seed`.
// Cadastra o catálogo real da Burguer House com estoque zerado e o administrador inicial.
// Não apaga nada e pode rodar de novo: o que já existe (inclusive estoque lançado pela loja) fica como está.
// Dados fictícios para apresentação ficam em outro banco: `npm run seed:demo` (prisma/seed_demo.ts).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import { semearCatalogo } from './semear_catalogo.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  console.log('Cadastrando o catálogo da Burguer House (insumos, receitas e cardápio)...');
  const catalogo = await semearCatalogo(prisma);
  console.log(
    `Insumos: ${catalogo.insumosCriados} criados, ${catalogo.insumosExistentes} já existiam. ` +
      `Receitas: ${catalogo.receitasCriadas} criadas. ` +
      `Produtos: ${catalogo.produtosCriados} criados, ${catalogo.produtosExistentes} já existiam.`,
  );

  console.log('Conferindo o usuário administrador inicial...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!adminPassword && process.env.NODE_ENV === 'production') {
    throw new Error('SEED_ADMIN_PASSWORD é obrigatória em ambiente de produção para criar a conta administrativa.');
  }

  const senhaAdmin = adminPassword || 'admin123';
  if (!adminPassword) {
    console.warn('AVISO DE SEGURANÇA: SEED_ADMIN_PASSWORD não configurada; utilizando senha padrão de desenvolvimento.');
  }

  await prisma.usuario.upsert({
    where: { email: 'gerente@burguerhouse.com.br' },
    update: {},
    create: {
      nome: 'Carlos Eduardo',
      email: 'gerente@burguerhouse.com.br',
      senha: bcrypt.hashSync(senhaAdmin, 10),
      telefone: '(67) 99876-5432',
      role: Role.ADMIN,
      ativo: true,
    },
  });

  console.log('Seed concluído. O estoque começa zerado: faça a primeira contagem pelo app (Estoque > Contagem).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
