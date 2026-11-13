import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { EntradaEstoqueService, NotaDuplicadaError } from './entrada_estoque.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('EntradaEstoqueService', () => {
  const service = new EntradaEstoqueService();

  beforeEach(async () => {
    await prisma.itemNotaFiscal.deleteMany().catch(() => {});
    await prisma.notaFiscal.deleteMany().catch(() => {});
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve confirmar entrada no almoxarifado incrementando o estoque e atualizando o custo unitario', async () => {
    const queijo = await prisma.insumo.create({
      data: {
        nome: 'Queijo Cheddar Entrada',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
        custoUnitario: 0.03,
      },
    });

    const resultado = await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567890',
      numero: '1234',
      serie: '1',
      fornecedorNome: 'Laticínios Brasil LTDA',
      fornecedorCnpj: '12345678000199',
      valorTotal: 100.0,
      itens: [
        {
          insumoId: queijo.id,
          quantidade: 2000, // +2000g
          valorUnitario: 0.05, // Novo custo unitário
          descricaoOriginal: 'QUEIJO CHEDDAR BARRA 2KG',
          unidadeOriginal: 'UN',
          quantidadeOriginal: 1,
          valorTotal: 100.0,
        },
      ],
    });

    expect(resultado.totalItensProcessados).toBe(1);
    expect(resultado.notaFiscalId).toBeDefined();
    expect(resultado.insumosAtualizados[0]?.novoEstoque).toBe(2500);
    expect(resultado.insumosAtualizados[0]?.custoUnitario).toBe(0.05);

    // Verifica no banco se o estoque e o custo unitário foram atualizados
    const queijoDb = await prisma.insumo.findUnique({ where: { id: queijo.id } });
    expect(queijoDb?.estoqueAtual).toBe(2500);
    expect(queijoDb?.custoUnitario).toBe(0.05);

    // Verifica se a NotaFiscal foi persistida
    const notaDb = await prisma.notaFiscal.findUnique({
      where: { chaveAcesso: '35261012345678000199550010000012341234567890' },
      include: { itens: true },
    });
    expect(notaDb).not.toBeNull();
    expect(notaDb?.fornecedorNome).toBe('Laticínios Brasil LTDA');
    expect(notaDb?.itens.length).toBe(1);
    expect(notaDb?.itens[0]?.insumoId).toBe(queijo.id);
    expect(notaDb?.itens[0]?.quantidadeConvertida).toBe(2000);
  });

  it('deve impedir importação duplicada da mesma nota fiscal pela chaveAcesso', async () => {
    const carne = await prisma.insumo.create({
      data: {
        nome: 'Carne Moída Teste',
        unidade: 'Gramas',
        estoqueAtual: 1000,
      },
    });

    const payload = {
      chaveAcesso: '41261099999999000188550010000055551234567890',
      fornecedorNome: 'Frigorífico Central',
      fornecedorCnpj: '99999999000188',
      itens: [
        {
          insumoId: carne.id,
          quantidade: 5000,
          valorUnitario: 0.035,
        },
      ],
    };

    // Primeira importação deve ter sucesso
    await service.confirmarEntrada(payload);

    // Segunda importação com a mesma chave deve ser rejeitada
    await expect(service.confirmarEntrada(payload)).rejects.toThrow(
      'A nota fiscal com chave de acesso 41261099999999000188550010000055551234567890 já foi importada anteriormente'
    );
  });

  it('deve listar notas fiscais importadas ordenadas por data', async () => {
    const pao = await prisma.insumo.create({
      data: {
        nome: 'Pão de Hambúrguer',
        unidade: 'Unidade',
        estoqueAtual: 100,
      },
    });

    await service.confirmarEntrada({
      chaveAcesso: '35261011111111000111550010000011111234567890',
      numero: '101',
      fornecedorNome: 'Panificadora Central',
      fornecedorCnpj: '11111111000111',
      itens: [
        {
          insumoId: pao.id,
          quantidade: 200,
          valorUnitario: 1.5,
          descricaoOriginal: 'PAO HAMBURGUER PCT 50UN',
        },
      ],
    });

    const notas = await service.listarNotasFiscais();
    expect(notas.length).toBeGreaterThanOrEqual(1);
    expect(notas[0]?.chaveAcesso).toBe('35261011111111000111550010000011111234567890');
    expect(notas[0]?.itens[0]?.insumo?.nome).toBe('Pão de Hambúrguer');
  });

  it('deve lançar erro se nenhum item for informado', async () => {
    await expect(
      service.confirmarEntrada({
        itens: [],
      })
    ).rejects.toThrow('Nenhum item informado para entrada de estoque');
  });

  it('deve realizar rollback atômico e não alterar estoque se algum insumo da nota não for encontrado', async () => {
    const queijo = await prisma.insumo.create({
      data: {
        nome: 'Queijo Cheddar Rollback',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
        custoUnitario: 0.03,
      },
    });

    await expect(
      service.confirmarEntrada({
        chaveAcesso: '35261012345678000199550010000012341234567899',
        itens: [
          { insumoId: queijo.id, quantidade: 200 },
          { insumoId: '00000000-0000-0000-0000-000000000000', quantidade: 100 },
        ],
      })
    ).rejects.toThrow('não encontrado no banco de dados');

    const queijoDb = await prisma.insumo.findUnique({ where: { id: queijo.id } });
    expect(queijoDb?.estoqueAtual).toBe(500);
    const notaDb = await prisma.notaFiscal.findUnique({
      where: { chaveAcesso: '35261012345678000199550010000012341234567899' },
    });
    expect(notaDb).toBeNull();
  });

  it('rejeita dataEmissao inválida e grava exatamente a data informada quando válida', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Insumo Data Emissão', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 0, estoqueMinimo: 0 },
    });

    await expect(
      service.confirmarEntrada({
        chaveAcesso: '35261012345678000199550010000012341234567801',
        dataEmissao: '31/02/2026',
        itens: [{ insumoId: insumo.id, quantidade: 100 }],
      }),
    ).rejects.toThrow('Data de emissão inválida');

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).estoqueAtual).toBe(0);

    const dataValida = '2026-11-10T14:30:00-04:00';
    await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567802',
      dataEmissao: dataValida,
      itens: [{ insumoId: insumo.id, quantidade: 100 }],
    });

    const nota = await prisma.notaFiscal.findUniqueOrThrow({
      where: { chaveAcesso: '35261012345678000199550010000012341234567802' },
    });
    expect(nota.dataEmissao.toISOString()).toBe(new Date(dataValida).toISOString());

    await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567803',
      dataEmissao: ' 2026-11-11 ',
      itens: [{ insumoId: insumo.id, quantidade: 50 }],
    });
    const notaDia = await prisma.notaFiscal.findUniqueOrThrow({
      where: { chaveAcesso: '35261012345678000199550010000012341234567803' },
    });
    expect(notaDia.dataEmissao.toISOString()).toBe('2026-11-11T04:00:00.000Z');

    const dataObj = new Date('2026-11-09T10:00:00.000Z');
    await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567804',
      dataEmissao: dataObj,
      itens: [{ insumoId: insumo.id, quantidade: 50 }],
    });
    const notaObj = await prisma.notaFiscal.findUniqueOrThrow({
      where: { chaveAcesso: '35261012345678000199550010000012341234567804' },
    });
    expect(notaObj.dataEmissao.toISOString()).toBe(dataObj.toISOString());

    await expect(
      service.confirmarEntrada({
        chaveAcesso: '35261012345678000199550010000012341234567805',
        dataEmissao: new Date('invalido'),
        itens: [{ insumoId: insumo.id, quantidade: 50 }],
      }),
    ).rejects.toThrow('Data de emissão inválida');
  });

  it('filtra itens inválidos, calcula fallbacks e preserva custoUnitario quando valorUnitario <= 0', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Insumo Fallbacks', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 10, estoqueMinimo: 0, custoUnitario: 0.08 },
    });

    await expect(
      service.confirmarEntrada({
        itens: [{ insumoId: insumo.id, quantidade: 0 }, { insumoId: '', quantidade: 10 }],
      }),
    ).rejects.toThrow('Nenhum insumo válido com quantidade maior que zero foi selecionado');

    // Sem chaveAcesso: não cria NotaFiscal e não sobrescreve custo quando valorUnitario = 0
    const semChave = await service.confirmarEntrada({
      itens: [
        { insumoId: insumo.id, quantidade: 25, valorUnitario: 0 },
        { insumoId: insumo.id, quantidade: 0, valorUnitario: 99 },
      ],
    });
    expect(semChave.notaFiscalId).toBeNull();
    expect(semChave.chaveAcesso).toBeNull();
    expect(semChave.fornecedorNome).toBeNull();
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).custoUnitario).toBe(0.08);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).estoqueAtual).toBe(35);

    // Com chaveAcesso e campos opcionais omitidos / espaços
    await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567806',
      fornecedorNome: '   ',
      itens: [{ insumoId: insumo.id, quantidade: 10, valorUnitario: 0.2 }],
    });
    const nota = await prisma.notaFiscal.findUniqueOrThrow({
      where: { chaveAcesso: '35261012345678000199550010000012341234567806' },
      include: { itens: true },
    });
    expect(nota.numero).toBeNull();
    expect(nota.serie).toBeNull();
    expect(nota.fornecedorNome).toBe('Fornecedor não identificado');
    expect(nota.fornecedorCnpj).toBe('');
    expect(nota.valorTotal).toBeCloseTo(2, 4);
    expect(nota.itens[0]?.descricaoOriginal).toBe('Item faturado');
    expect(nota.itens[0]?.unidadeOriginal).toBe('UN');
    expect(nota.itens[0]?.valorTotal).toBeCloseTo(2, 4);
  });

  it('converte erro P2002 em NotaDuplicadaError em concorrência e lista notas ordenadas desc', async () => {
    const pao = await prisma.insumo.create({
      data: { nome: 'Pão Ordem', unidade: 'Unidade', estoqueAtual: 0 },
    });
    await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567807',
      dataEmissao: '2026-11-01T10:00:00Z',
      itens: [{ insumoId: pao.id, quantidade: 10 }],
    });
    await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567808',
      dataEmissao: '2026-11-05T10:00:00Z',
      itens: [{ insumoId: pao.id, quantidade: 10 }],
    });

    const notas = await service.listarNotasFiscais();
    expect(notas[0]?.chaveAcesso).toBe('35261012345678000199550010000012341234567808');
    expect(notas[1]?.chaveAcesso).toBe('35261012345678000199550010000012341234567807');
    expect(notas[0]?.itens[0]?.insumo).toEqual({ id: pao.id, nome: 'Pão Ordem', unidade: 'Unidade' });

    const fakeDb = {
      $transaction: async () => {
        throw Object.assign(new Error('Unique'), { code: 'P2002' });
      },
    } as unknown as typeof prisma;

    await expect(
      new EntradaEstoqueService(fakeDb).confirmarEntrada({
        chaveAcesso: '35261012345678000199550010000012341234567809',
        itens: [{ insumoId: pao.id, quantidade: 1 }],
      }),
    ).rejects.toMatchObject({ name: 'NotaDuplicadaError' });
  });
});

describe('EntradaEstoqueService (nota sem fornecedor identificado)', () => {
  it('registra a nota mesmo sem CNPJ e barra a reimportação com NotaDuplicadaError', async () => {
    await prisma.itemNotaFiscal.deleteMany().catch(() => {});
    await prisma.notaFiscal.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});

    const insumo = await prisma.insumo.create({
      data: { nome: 'Insumo Sem CNPJ', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 0, estoqueMinimo: 0 },
    });
    const service = new EntradaEstoqueService();
    const entrada = {
      chaveAcesso: '50261012345678000199650010000012341234567890',
      fornecedorNome: 'Fornecedor da NFC-e',
      fornecedorCnpj: '',
      itens: [{ insumoId: insumo.id, quantidade: 100 }],
    };

    const r = await service.confirmarEntrada(entrada);
    expect(r.notaFiscalId).toBeTypeOf('string');

    await expect(service.confirmarEntrada(entrada)).rejects.toThrow(NotaDuplicadaError);
    // estoque não foi duplicado
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).estoqueAtual).toBe(100);

    await prisma.itemNotaFiscal.deleteMany().catch(() => {});
    await prisma.notaFiscal.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });
});
