import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/infra/database/prisma.js';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function limparBancoTeste() {
  await prisma.movimentacaoEstoque.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.itemNotaFiscal.deleteMany().catch(() => {});
  await prisma.notaFiscal.deleteMany().catch(() => {});
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
  await prisma.usuario.deleteMany().catch(() => {});
}

describe('Fase 2 Schema — 2.1 CategoriaInsumo', () => {
  beforeEach(async () => {
    await limparBancoTeste();
  });

  afterAll(async () => {
    await limparBancoTeste();
    await prisma.$disconnect().catch(() => {});
  });

  it('usa INGREDIENTE como categoria padrão e aceita EMBALAGEM e BEBIDA', async () => {
    const padrao = await prisma.insumo.create({
      data: { nome: 'Cebola Teste', unidade: 'Gramas' },
    });
    expect(padrao.categoria).toBe('INGREDIENTE');

    const embalagem = await prisma.insumo.create({
      data: { nome: 'Saco Teste', unidade: 'Unidade', categoria: 'EMBALAGEM' },
    });
    expect(embalagem.categoria).toBe('EMBALAGEM');

    const bebida = await prisma.insumo.create({
      data: { nome: 'Coca Teste', unidade: 'Unidade', categoria: 'BEBIDA' },
    });
    expect(bebida.categoria).toBe('BEBIDA');
  });

  it('rejeita valor desconhecido no enum CategoriaInsumo', async () => {
    await expect(
      prisma.insumo.create({
        data: { nome: 'Invalido', unidade: 'Unidade', categoria: 'SOBREMESA' } as any,
      }),
    ).rejects.toThrow();
  });
});

describe('Fase 2 Schema — 2.2 Venda (origem, ocorridoEm, registradoPorId)', () => {
  beforeEach(async () => {
    await limparBancoTeste();
  });

  afterAll(async () => {
    await limparBancoTeste();
    await prisma.$disconnect().catch(() => {});
  });

  it('usa WEBHOOK e ocorridoEm padrão, aceita registradoPorId nulo e vira nulo se usuário for apagado', async () => {
    const vendaWebhook = await prisma.venda.create({
      data: { externalId: 'v-wh-1', payloadOriginal: { check: 1 } },
    });
    expect(vendaWebhook.origem).toBe('WEBHOOK');
    expect(vendaWebhook.ocorridoEm).toBeInstanceOf(Date);
    expect(vendaWebhook.registradoPorId).toBeNull();

    const usuario = await prisma.usuario.create({
      data: {
        nome: 'Gerente Manual',
        email: 'manual@fase2.test',
        senha: 'hash',
        role: 'GERENTE',
      },
    });

    const dataPassada = new Date('2026-11-10T22:00:00.000Z');
    const vendaManual = await prisma.venda.create({
      data: {
        externalId: 'manual-chave-1',
        payloadOriginal: { check: 1, info: { items: [] } },
        origem: 'MANUAL',
        registradoPorId: usuario.id,
        ocorridoEm: dataPassada,
      },
    });
    expect(vendaManual.origem).toBe('MANUAL');
    expect(vendaManual.registradoPorId).toBe(usuario.id);
    expect(vendaManual.ocorridoEm).toEqual(dataPassada);

    await prisma.usuario.delete({ where: { id: usuario.id } });

    const vendaAposDelete = await prisma.venda.findUniqueOrThrow({ where: { id: vendaManual.id } });
    expect(vendaAposDelete.registradoPorId).toBeNull();
  });

  it('rejeita origem desconhecida no enum OrigemVenda', async () => {
    await expect(
      prisma.venda.create({
        data: { externalId: 'v-err', payloadOriginal: {}, origem: 'IFOOD' } as any,
      }),
    ).rejects.toThrow();
  });
});

describe('Fase 2 Schema — 2.3 MovimentacaoEstoque', () => {
  beforeEach(async () => {
    await limparBancoTeste();
  });

  afterAll(async () => {
    await limparBancoTeste();
    await prisma.$disconnect().catch(() => {});
  });

  it('registra ENTRADA_MANUAL e AJUSTE com sinal, rejeita chaveIdempotencia duplicada, bloqueia delete do insumo (Restrict) e preserva movimentação ao apagar usuário (SetNull)', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Carne Mov', unidade: 'Gramas', estoqueAtual: 1000 },
    });
    const usuario = await prisma.usuario.create({
      data: {
        nome: 'Operador Mov',
        email: 'mov@fase2.test',
        senha: 'hash',
        role: 'OPERADOR',
      },
    });

    const entrada = await prisma.movimentacaoEstoque.create({
      data: {
        insumoId: insumo.id,
        tipo: 'ENTRADA_MANUAL',
        quantidade: 500,
        saldoAnterior: 1000,
        saldoPosterior: 1500,
        custoUnitario: 0.032,
        observacao: 'Compra sem nota',
        chaveIdempotencia: 'chave-mov-1',
        usuarioId: usuario.id,
      },
    });
    expect(entrada.id).toBeTruthy();
    expect(entrada.tipo).toBe('ENTRADA_MANUAL');
    expect(entrada.criadoEm).toBeInstanceOf(Date);

    // chaveIdempotencia duplicada deve ser rejeitada
    await expect(
      prisma.movimentacaoEstoque.create({
        data: {
          insumoId: insumo.id,
          tipo: 'ENTRADA_MANUAL',
          quantidade: 100,
          saldoAnterior: 1500,
          saldoPosterior: 1600,
          chaveIdempotencia: 'chave-mov-1',
        },
      }),
    ).rejects.toThrow();

    // AJUSTE pode ter quantidade negativa
    const ajuste = await prisma.movimentacaoEstoque.create({
      data: {
        insumoId: insumo.id,
        tipo: 'AJUSTE',
        quantidade: -200,
        saldoAnterior: 1500,
        saldoPosterior: 1300,
        observacao: 'Inventário físico',
      },
    });
    expect(ajuste.quantidade).toBe(-200);

    // Apagar insumo com movimentação deve ser bloqueado (Restrict)
    await expect(prisma.insumo.delete({ where: { id: insumo.id } })).rejects.toThrow();

    // Apagar usuário mantém a movimentação com usuarioId nulo (SetNull)
    await prisma.usuario.delete({ where: { id: usuario.id } });
    const entradaAposDeleteUsuario = await prisma.movimentacaoEstoque.findUniqueOrThrow({
      where: { id: entrada.id },
    });
    expect(entradaAposDeleteUsuario.usuarioId).toBeNull();
  });
});

const BEBIDAS_ESPERADAS = [
  'Coca Cola Zero 350ml',
  'Coca Cola Original 350ml',
  'Coca Cola 600mL',
  'Coca Cola Zero 600ml',
  'agua com gás',
  'agua sem gás',
  'heineken long neck',
  'coca litro',
] as const;

const EMBALAGENS_ESPERADAS = [
  'Papel Acoplado',
  'Embalagem de molho (potinho)',
  'Palito de madeira',
  'Embalagem de Batata',
  'Saco Kraft Delivery',
] as const;

describe('Fase 2 — Seed classificado e produtos de bebidas', () => {
  beforeEach(async () => {
    await limparBancoTeste();
  });

  afterAll(async () => {
    await limparBancoTeste();
    await prisma.$disconnect().catch(() => {});
  });

  it('classifica os 49 insumos, tolera MovimentacaoEstoque na limpeza e cria 8 produtos de bebidas', async () => {
    const testUrl = process.env.DATABASE_URL_TEST;
    expect(testUrl).toBeTruthy();
    expect(testUrl).toMatch(/_test/);

    const insumoPrevio = await prisma.insumo.create({
      data: { nome: 'Insumo Com Mov', unidade: 'Unidade', estoqueAtual: 10 },
    });
    await prisma.movimentacaoEstoque.create({
      data: {
        insumoId: insumoPrevio.id,
        tipo: 'ENTRADA_MANUAL',
        quantidade: 5,
        saldoAnterior: 5,
        saldoPosterior: 10,
      },
    });

    execFileSync('./node_modules/.bin/tsx', ['prisma/seed.ts'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });

    const porCategoria = await prisma.insumo.groupBy({
      by: ['categoria'],
      _count: { _all: true },
    });
    const contagem = Object.fromEntries(porCategoria.map((r) => [r.categoria, r._count._all]));

    expect(contagem).toEqual({
      BEBIDA: 8,
      EMBALAGEM: 5,
      INGREDIENTE: 36,
    });

    for (const nomeEmb of EMBALAGENS_ESPERADAS) {
      const ins = await prisma.insumo.findFirstOrThrow({ where: { nome: nomeEmb } });
      expect(ins.categoria).toBe('EMBALAGEM');
    }

    for (const nomeBebida of BEBIDAS_ESPERADAS) {
      const ins = await prisma.insumo.findFirstOrThrow({ where: { nome: nomeBebida } });
      expect(ins.categoria).toBe('BEBIDA');

      const prod = await prisma.produto.findFirst({
        where: { nome: nomeBebida },
        include: { fichasTecnicas: true },
      });
      expect(prod, `Produto de bebida ausente: ${nomeBebida}`).not.toBeNull();
      expect(prod!.fichasTecnicas).toHaveLength(1);
      expect(prod!.fichasTecnicas[0]!.insumoId).toBe(ins.id);
      expect(prod!.fichasTecnicas[0]!.quantidade).toBe(1);
    }

    const totalProdutos = await prisma.produto.count();
    expect(totalProdutos).toBe(15);
  });
});
