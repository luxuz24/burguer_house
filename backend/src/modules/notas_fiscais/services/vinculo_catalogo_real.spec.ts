import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import { XmlParserService } from './xml_parser.service.js';
import { semearCatalogo } from '../../../../prisma/semear_catalogo.js';

// Caso real encontrado montando o manual de uso (18/11/2026): com o catálogo da loja, o XML de exemplo
// ligava "PAO BRIOCHE HAMBURGUER" (60 UN) à Carne de Hambúrguer (+60 g de carne e custo de R$ 1,80/g).

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const xmlExemplo = readFileSync(resolve(raiz, 'docs/exemplo_nfe.xml'), 'utf8');

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

describe('vínculo dos itens do XML de exemplo com o catálogo real da loja', () => {
  const service = new XmlParserService();

  beforeAll(async () => {
    await limparBanco();
    await semearCatalogo(prisma);
    // Como no uso real: a contagem inicial atualiza o pão. No Postgres a linha atualizada muda de lugar e
    // a consulta de insumos (sem ORDER BY) passa a trazer a Carne antes do Pão. Antes da correção, o empate
    // em 95% era decidido por essa ordem: num banco recém-semeado o pão vencia por sorte.
    await prisma.insumo.updateMany({ where: { nome: 'Pão Brioche' }, data: { estoqueAtual: 120 } });
  });

  afterAll(async () => {
    await limparBanco();
  });

  it('liga bacon, óleo e pão aos insumos certos, com a conversão de unidade certa', async () => {
    const nota = await service.parse(xmlExemplo);
    const porDescricao = Object.fromEntries(nota.itens.map((i) => [i.descricao, i]));

    expect(porDescricao['BACON FATIADO EXTRA DEFUMADO']).toMatchObject({
      sugestaoInsumoNome: 'Bacon fatiado',
      fatorConversaoSugerido: 1000,
      conversaoIncerta: false,
    });
    expect(porDescricao['OLEO DE SOJA REFINADO']).toMatchObject({
      sugestaoInsumoNome: 'Óleo de soja',
      fatorConversaoSugerido: 1000,
      conversaoIncerta: false,
    });
    expect(porDescricao['PAO BRIOCHE HAMBURGUER']).toMatchObject({
      sugestaoInsumoNome: 'Pão Brioche',
      sugestaoUnidadeInsumo: 'Unidade',
      fatorConversaoSugerido: 1,
      quantidadeConvertidaSugerida: 60,
      conversaoIncerta: false,
    });
  });

  it('se a loja já confirmou uma vez o vínculo errado (pão → carne), a próxima nota volta a sugerir o pão', async () => {
    const carne = await prisma.insumo.findFirstOrThrow({ where: { nome: 'Carne de Hambúrguer' } });
    await prisma.notaFiscal.create({
      data: {
        chaveAcesso: '35261012345678000199550010000099991234567890',
        fornecedorNome: 'DISTRIBUIDORA E FRIGORIFICO MS LTDA',
        fornecedorCnpj: '12345678000199',
        valorTotal: 108,
        dataEmissao: new Date('2026-10-14T13:00:00Z'),
        itens: {
          create: {
            descricaoOriginal: 'PAO BRIOCHE HAMBURGUER',
            unidadeOriginal: 'UN',
            quantidadeOriginal: 60,
            valorUnitario: 1.8,
            valorTotal: 108,
            quantidadeConvertida: 60,
            insumoId: carne.id,
          },
        },
      },
    });

    const nota = await service.parse(xmlExemplo);
    const pao = nota.itens.find((i) => i.descricao === 'PAO BRIOCHE HAMBURGUER')!;
    expect(pao.sugestaoInsumoNome).toBe('Pão Brioche');
    expect(pao.motivoMatch).not.toBe('HISTORICO');
    expect(pao.outrasSugestoes?.[0]?.insumoNome).toBe('Carne de Hambúrguer');
    // Bacon e óleo continuam reconhecidos normalmente.
    expect(nota.itens.find((i) => i.descricao === 'BACON FATIADO EXTRA DEFUMADO')?.sugestaoInsumoNome).toBe('Bacon fatiado');
  });

  it('a mesma regra vale quando o histórico é consultado direto no banco (sem pré-carregar)', async () => {
    const insumos = await prisma.insumo.findMany({ select: { id: true, nome: true, unidade: true } });
    const bacon = insumos.find((i) => i.nome === 'Bacon fatiado')!;
    const carne = insumos.find((i) => i.nome === 'Carne de Hambúrguer')!;
    // Nota própria deste teste (não depende da ordem dos testes): o pão ligado errado à carne e um bacon certo.
    await prisma.notaFiscal.create({
      data: {
        chaveAcesso: '35261012345678000199550010000077771234567890',
        fornecedorNome: 'DISTRIBUIDORA E FRIGORIFICO MS LTDA',
        fornecedorCnpj: '12345678000199',
        valorTotal: 188,
        dataEmissao: new Date('2026-10-14T13:00:00Z'),
        itens: {
          create: [
            { descricaoOriginal: 'PAO BRIOCHE HAMBURGUER', unidadeOriginal: 'UN', quantidadeOriginal: 60, valorUnitario: 1.8, valorTotal: 108, insumoId: carne.id },
            { descricaoOriginal: 'BACON MANTA KG', unidadeOriginal: 'KG', quantidadeOriginal: 2, valorUnitario: 40, valorTotal: 80, insumoId: bacon.id },
          ],
        },
      },
    });

    // Histórico incompatível (pão → carne, nota em UN): sugere o pão e lista a carne.
    const pao = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', insumos, undefined, 'UN');
    expect(pao.insumoNome).toBe('Pão Brioche');
    expect(pao.outrasSugestoes[0]?.insumoNome).toBe('Carne de Hambúrguer');

    // Histórico compatível (KG → Gramas): vale com 100%.
    const baconManta = await service.encontrarMelhorMatch('bacon manta kg', insumos, undefined, 'KG');
    expect(baconManta).toEqual({ insumoId: bacon.id, insumoNome: 'Bacon fatiado', unidade: 'Gramas', confianca: 100, motivo: 'HISTORICO', outrasSugestoes: [] });
  });
});
