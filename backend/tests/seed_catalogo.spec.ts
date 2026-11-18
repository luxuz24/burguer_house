import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/infra/database/prisma.js';
import {
  INSUMOS_CATALOGO,
  PRODUTOS_CATALOGO,
  RECEITAS_CATALOGO,
} from '../prisma/catalogo_burguer_house.js';
import { semearCatalogo } from '../prisma/semear_catalogo.js';

async function limparBanco() {
  await prisma.movimentacaoEstoque.deleteMany();
  await prisma.fichaTecnica.deleteMany();
  await prisma.subFichaTecnica.deleteMany();
  await prisma.perda.deleteMany();
  await prisma.itemNotaFiscal.deleteMany();
  await prisma.notaFiscal.deleteMany();
  await prisma.venda.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.insumo.deleteMany();
}

const custoDoInsumo = new Map(INSUMOS_CATALOGO.map((i) => [i.nome, i.custoUnitario]));
const custo = (itens: { insumo: string; quantidade: number }[]) =>
  itens.reduce((soma, item) => soma + item.quantidade * custoDoInsumo.get(item.insumo)!, 0);

describe('Catálogo real da Burguer House (dados da planilha de precificação)', () => {
  it('tem os 49 insumos, as 4 receitas preenchidas e os 22 itens do cardápio, sem nomes repetidos', () => {
    expect(INSUMOS_CATALOGO).toHaveLength(49);
    expect(RECEITAS_CATALOGO).toHaveLength(4);
    expect(PRODUTOS_CATALOGO).toHaveLength(22);
    const nomes = (lista: { nome: string }[]) => new Set(lista.map((i) => i.nome.toLowerCase())).size;
    expect(nomes(INSUMOS_CATALOGO)).toBe(49);
    expect(nomes(PRODUTOS_CATALOGO)).toBe(22);
    expect(INSUMOS_CATALOGO.filter((i) => i.produzidoInternamente)).toHaveLength(5);
  });

  it('toda ficha e toda receita usam só insumos do catálogo, sem repetir insumo e com quantidade positiva', () => {
    for (const { nome, itens } of [
      ...PRODUTOS_CATALOGO.map((p) => ({ nome: p.nome, itens: p.ficha })),
      ...RECEITAS_CATALOGO.map((r) => ({ nome: r.beneficiado, itens: r.ingredientes })),
    ]) {
      for (const item of itens) {
        expect(custoDoInsumo.has(item.insumo), `${nome}: ${item.insumo}`).toBe(true);
        expect(item.quantidade, `${nome}: ${item.insumo}`).toBeGreaterThan(0);
      }
      expect(new Set(itens.map((i) => i.insumo)).size, nome).toBe(itens.length);
    }
  });

  it('o custo de cada produto e de cada receita bate com o calculado pela própria planilha', () => {
    for (const produto of PRODUTOS_CATALOGO) {
      if (produto.custoPlanilha === null) continue;
      expect(custo(produto.ficha), produto.nome).toBeCloseTo(produto.custoPlanilha, 2);
    }
    for (const receita of RECEITAS_CATALOGO) {
      expect(custo(receita.ingredientes), receita.beneficiado).toBeCloseTo(receita.custoPlanilha, 2);
    }
  });

  it('só o CHICKEN HOUSE está sem ficha técnica (a planilha não tem a dele)', () => {
    expect(PRODUTOS_CATALOGO.filter((p) => p.ficha.length === 0).map((p) => p.nome)).toEqual(['CHICKEN HOUSE']);
  });
});

describe('semearCatalogo (seed de produção)', () => {
  beforeEach(limparBanco);
  afterAll(async () => {
    await limparBanco();
  });

  it('em banco vazio cadastra tudo com estoque e estoque mínimo zerados', async () => {
    const r = await semearCatalogo(prisma);
    expect(r).toEqual({ insumosCriados: 49, insumosExistentes: 0, receitasCriadas: 4, produtosCriados: 22, produtosExistentes: 0 });

    const insumos = await prisma.insumo.findMany();
    expect(insumos).toHaveLength(49);
    expect(insumos.every((i) => i.estoqueAtual === 0 && i.estoqueMinimo === 0)).toBe(true);
    expect(await prisma.produto.count()).toBe(22);
    expect(await prisma.fichaTecnica.count()).toBe(
      PRODUTOS_CATALOGO.reduce((soma, p) => soma + p.ficha.length, 0),
    );

    const bacon = await prisma.produto.findFirstOrThrow({
      where: { nome: 'BACON HOUSE' },
      include: { fichasTecnicas: { include: { insumo: true } } },
    });
    const maionese = bacon.fichasTecnicas.find((f) => f.insumo.nome === 'Maionese da Casa - Beneficiado');
    expect(maionese?.quantidade).toBe(80); // 40 g no lanche + 40 g no potinho, como na planilha
  });

  it('grava a receita por 1 unidade do item da casa (ex.: óleo da maionese = 967 ml / 1.558 g)', async () => {
    await semearCatalogo(prisma);
    const oleo = await prisma.subFichaTecnica.findFirstOrThrow({
      where: { insumoBeneficiado: { nome: 'Maionese da Casa - Beneficiado' }, insumoBruto: { nome: 'Óleo de soja' } },
    });
    expect(oleo.quantidadeNecessaria).toBeCloseTo(967 / 1558, 6);
    expect(await prisma.subFichaTecnica.count({ where: { insumoBeneficiado: { nome: 'Carne seca com requeijão - Beneficiado' } } })).toBe(0);
  });

  it('rodar de novo não duplica nem mexe no que a loja já lançou ou editou', async () => {
    await semearCatalogo(prisma);
    const pao = await prisma.insumo.findFirstOrThrow({ where: { nome: 'Pão Brioche' } });
    await prisma.insumo.update({ where: { id: pao.id }, data: { estoqueAtual: 37, estoqueMinimo: 20, custoUnitario: 2.5 } });
    const salada = await prisma.produto.findFirstOrThrow({ where: { nome: 'HOUSE SALADA' } });
    await prisma.fichaTecnica.deleteMany({ where: { produtoId: salada.id, insumo: { nome: 'Tomate' } } });
    const maionese = await prisma.insumo.findFirstOrThrow({ where: { nome: 'Maionese da Casa - Beneficiado' } });
    await prisma.subFichaTecnica.deleteMany({ where: { insumoBeneficiadoId: maionese.id, insumoBruto: { nome: 'Hortelã' } } });

    const r = await semearCatalogo(prisma);

    expect(r).toEqual({ insumosCriados: 0, insumosExistentes: 49, receitasCriadas: 0, produtosCriados: 0, produtosExistentes: 22 });
    expect(await prisma.insumo.count()).toBe(49);
    expect(await prisma.produto.count()).toBe(22);
    expect(await prisma.insumo.findUniqueOrThrow({ where: { id: pao.id } })).toMatchObject({
      estoqueAtual: 37,
      estoqueMinimo: 20,
      custoUnitario: 2.5,
    });
    expect(await prisma.fichaTecnica.count({ where: { produtoId: salada.id, insumo: { nome: 'Tomate' } } })).toBe(0);
    expect(await prisma.subFichaTecnica.count({ where: { insumoBeneficiadoId: maionese.id, insumoBruto: { nome: 'Hortelã' } } })).toBe(0);
  });

  it('não apaga cadastro da loja e reconhece nome igual com outra caixa (não cria "BACON HOUSE" se já há "Bacon House")', async () => {
    await prisma.insumo.create({ data: { nome: 'Insumo criado pela loja', unidade: 'Unidade', estoqueAtual: 5 } });
    await prisma.insumo.create({ data: { nome: 'pão brioche', unidade: 'Unidade', estoqueAtual: 12 } });
    await prisma.produto.create({ data: { nome: 'Bacon House' } });

    const r = await semearCatalogo(prisma);

    expect(r.insumosExistentes).toBe(1);
    expect(r.produtosExistentes).toBe(1);
    expect(await prisma.insumo.count()).toBe(50);
    expect(await prisma.insumo.count({ where: { nome: { equals: 'Pão Brioche', mode: 'insensitive' } } })).toBe(1);
    expect(await prisma.produto.count({ where: { nome: { equals: 'BACON HOUSE', mode: 'insensitive' } } })).toBe(1);
    expect(await prisma.insumo.findFirstOrThrow({ where: { nome: 'Insumo criado pela loja' } })).toMatchObject({ estoqueAtual: 5 });
  });
});
