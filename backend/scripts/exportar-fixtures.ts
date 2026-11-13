/**
 * Exporta payloads gravados na tabela `vendas` como fixtures JSON anonimizadas,
 * removendo todos os dados pessoais (PII: nome de cliente, telefone, endereço, CPF, e-mail).
 *
 * Uso:
 *   npm --prefix backend run exportar:fixtures
 *   npx tsx scripts/exportar-fixtures.ts [--limite=100] [--saida=src/modules/vendas/fixtures/anotaai/exportadas]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/infra/database/prisma.js';
import { anonimizarPayloadVenda } from '../src/modules/vendas/services/anonimizar_payload.js';

function sanitizarNomeArquivo(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'sem-id';
}

async function exportarFixtures() {
  const args = process.argv.slice(2);
  const limiteArg = args.find((a) => a.startsWith('--limite='));
  const saidaArg = args.find((a) => a.startsWith('--saida='));

  const limite = limiteArg ? Number.parseInt(limiteArg.split('=')[1] ?? '100', 10) : 100;
  const dirSaida = resolve(
    process.cwd(),
    saidaArg ? saidaArg.slice('--saida='.length) : 'src/modules/vendas/fixtures/anotaai/exportadas',
  );

  const vendas = await prisma.venda.findMany({
    take: Number.isFinite(limite) && limite > 0 ? limite : 100,
    orderBy: { criadoEm: 'desc' },
  });

  if (vendas.length === 0) {
    console.log('Nenhuma venda encontrada para exportar.');
    await prisma.$disconnect();
    return;
  }

  mkdirSync(dirSaida, { recursive: true });

  vendas.forEach((venda, idx) => {
    const anonimizado = anonimizarPayloadVenda(venda.payloadOriginal);
    const prefixo = String(idx + 1).padStart(3, '0');
    const sufixo = sanitizarNomeArquivo(venda.externalId ?? venda.id);
    const caminho = resolve(dirSaida, `${prefixo}_${sufixo}.json`);
    writeFileSync(caminho, `${JSON.stringify(anonimizado, null, 2)}\n`, 'utf-8');
  });

  console.log(`Exportadas ${vendas.length} fixtures anonimizadas em: ${dirSaida}`);
  await prisma.$disconnect();
}

exportarFixtures().catch((err) => {
  console.error('Erro ao exportar fixtures:', err);
  process.exit(1);
});
