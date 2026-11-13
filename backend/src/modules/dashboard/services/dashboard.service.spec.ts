import { describe, it, expect, vi } from 'vitest';
import { DashboardService, PeriodoInvalidoError } from './dashboard.service.js';
import type { DashboardRepository } from '../repositories/dashboard.repository.js';
import { obterPartesDataLoja } from '../../../shared/datas.js';

describe('DashboardService', () => {
  it('deve calcular corretamente as datas do período no fuso de MS', () => {
    const service = new DashboardService({} as any);

    const hoje = service.calcularDatasPeriodo({ periodo: 'hoje' });
    expect(hoje.tipo).toBe('hoje');
    expect(obterPartesDataLoja(hoje.dataInicio).hora).toBe(0);
    expect(obterPartesDataLoja(hoje.dataFim).hora).toBe(23);

    const semana = service.calcularDatasPeriodo({ periodo: 'semana' });
    expect(semana.tipo).toBe('semana');
    expect(semana.dataFim.getTime()).toBeGreaterThan(semana.dataInicio.getTime());

    const mes = service.calcularDatasPeriodo({ periodo: 'mes' });
    expect(mes.tipo).toBe('mes');
    expect(obterPartesDataLoja(mes.dataInicio).dia).toBe(1);

    const personalizado = service.calcularDatasPeriodo({
      dataInicio: '2026-09-01T00:00:00.000Z',
      dataFim: '2026-09-30T23:59:59.999Z',
    });
    expect(personalizado.tipo).toBe('personalizado');
    expect(personalizado.dataInicio.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('converte datas yyyy-mm-dd do período personalizado para os limites do dia civil no fuso de MS', () => {
    const service = new DashboardService({} as any);

    const personalizado = service.calcularDatasPeriodo({
      dataInicio: '2026-10-30',
      dataFim: '2026-10-30',
    });

    expect(personalizado.tipo).toBe('personalizado');
    // Cobre o dia 30/10 inteiro em Campo Grande (00:00 a 23:59:59 MS = 04:00Z a 03:59:59Z)
    expect(personalizado.dataInicio.toISOString()).toBe('2026-10-30T04:00:00.000Z');
    expect(personalizado.dataFim.toISOString()).toBe('2026-10-31T03:59:59.999Z');
  });

  it('calcula datas do período no fuso de MS mesmo em servidor rodando em UTC (21h em Campo Grande)', () => {
    const service = new DashboardService({} as any);

    // Às 21:00 de 30/10 em Campo Grande, o relógio UTC já marca 01:00 de 31/10
    const momentoPicoNoturno = new Date('2026-10-31T01:00:00.000Z');

    const hoje = service.calcularDatasPeriodo({ periodo: 'hoje' }, momentoPicoNoturno);
    expect(hoje.tipo).toBe('hoje');
    // Deve ser dia 30/10, e NÃO 31/10
    expect(hoje.dataInicio.toISOString()).toBe('2026-10-30T04:00:00.000Z');
    expect(hoje.dataFim.toISOString()).toBe('2026-10-31T03:59:59.999Z');

    const semana = service.calcularDatasPeriodo({ periodo: 'semana' }, momentoPicoNoturno);
    expect(semana.tipo).toBe('semana');
    expect(semana.dataInicio.toISOString()).toBe('2026-10-24T04:00:00.000Z');
    expect(semana.dataFim.toISOString()).toBe('2026-10-31T03:59:59.999Z');

    const mes = service.calcularDatasPeriodo({ periodo: 'mes' }, momentoPicoNoturno);
    expect(mes.tipo).toBe('mes');
    // Mês corrente é outubro (início em 01/10 04:00Z e fim no fim de hoje 30/10)
    expect(mes.dataInicio.toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(mes.dataFim.toISOString()).toBe('2026-10-31T03:59:59.999Z');
  });

  it('deve rejeitar filtros personalizados inválidos, invertidos ou maiores que 366 dias', () => {
    const service = new DashboardService({} as any);

    expect(() => service.calcularDatasPeriodo({ dataInicio: '2026-09-01' })).toThrow(PeriodoInvalidoError);
    expect(() => service.calcularDatasPeriodo({ dataInicio: 'invalida', dataFim: '2026-09-30' })).toThrow(
      PeriodoInvalidoError,
    );
    expect(() =>
      service.calcularDatasPeriodo({
        dataInicio: '2026-10-10T00:00:00.000Z',
        dataFim: '2026-10-01T00:00:00.000Z',
      }),
    ).toThrow(PeriodoInvalidoError);
    expect(() =>
      service.calcularDatasPeriodo({
        dataInicio: '2024-01-01T00:00:00.000Z',
        dataFim: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(PeriodoInvalidoError);
  });

  it('rejeita datas inexistentes ou com transbordo no filtro personalizado (2026-02-31, 2026-13-01)', () => {
    const service = new DashboardService({} as any);

    expect(() =>
      service.calcularDatasPeriodo({ dataInicio: '2026-02-31', dataFim: '2026-02-31' }),
    ).toThrow(PeriodoInvalidoError);

    expect(() =>
      service.calcularDatasPeriodo({ dataInicio: '  2026-02-31  ', dataFim: '2026-03-01' }),
    ).toThrow(PeriodoInvalidoError);

    expect(() =>
      service.calcularDatasPeriodo({ dataInicio: '2026-13-01', dataFim: '2026-13-01' }),
    ).toThrow(PeriodoInvalidoError);

    expect(() =>
      service.calcularDatasPeriodo({ dataInicio: '2026-04-31', dataFim: '2026-04-31' }),
    ).toThrow(PeriodoInvalidoError);
  });

  it('aceita datas YYYY-MM-DD com espacos nas pontas e aplica fuso da loja', () => {
    const service = new DashboardService({} as any);
    const res = service.calcularDatasPeriodo({
      dataInicio: '  2026-10-01  ',
      dataFim: '  2026-10-05  ',
    });

    expect(res.dataInicio.toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(res.dataFim.toISOString()).toBe('2026-10-06T03:59:59.999Z');
  });

  it('deve consolidar metricas, perdas, vendas, compras e alertas com mock do repository', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [
        {
          id: 'p1',
          insumoId: 'ins1',
          quantidade: 10,
          motivo: 'VENCIMENTO' as const,
          criadoEm: new Date(),
          insumo: { id: 'ins1', nome: 'Pão Brioche', unidade: 'Unidade', custoUnitario: 2.5 },
        },
        {
          id: 'p2',
          insumoId: 'ins2',
          quantidade: 500,
          motivo: 'ERRO_PREPARO' as const,
          criadoEm: new Date(),
          insumo: { id: 'ins2', nome: 'Carne Hambúrguer', unidade: 'Gramas', custoUnitario: 0.05 },
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [
        {
          id: 'v1',
          processado: true,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          payloadOriginal: {
            check: 1,
            items: [
              { name: 'X-Burger', quantity: 3, price: 30.0 },
              { name: 'X-Bacon', quantity: 2, price: 35.0 },
            ],
          },
        },
      ],
      buscarNotasFiscaisPorPeriodo: async () => [
        {
          id: 'nf1',
          chaveAcesso: '123',
          numero: '10',
          serie: '1',
          fornecedorNome: 'Distribuidora Carnes Sul',
          fornecedorCnpj: '11111111000100',
          valorTotal: 500.0,
          dataEmissao: new Date(),
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
        {
          id: 'nf2',
          chaveAcesso: '124',
          numero: '11',
          serie: '1',
          fornecedorNome: 'Panificadora Central',
          fornecedorCnpj: '22222222000100',
          valorTotal: 200.0,
          dataEmissao: new Date(),
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
      ],
      buscarInsumos: async () => [
        { id: 'ins1', nome: 'Pão Brioche', unidade: 'Unidade', estoqueAtual: 20, estoqueMinimo: 50, custoUnitario: 2.5 },
        { id: 'ins2', nome: 'Carne Hambúrguer', unidade: 'Gramas', estoqueAtual: 1000, estoqueMinimo: 800, custoUnitario: 0.05 },
        { id: 'ins3', nome: 'Queijo Cheddar', unidade: 'Fatias', estoqueAtual: 10, estoqueMinimo: 30, custoUnitario: 0.8 },
      ],
      buscarProdutosComFichas: async () => [
        {
          id: 'prod1',
          nome: 'X-Burger',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [
            {
              id: 'ft1',
              produtoId: 'prod1',
              insumoId: 'ins1',
              quantidade: 1,
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins1', nome: 'Pão Brioche', unidade: 'Unidade', fatorPerda: 0, custoUnitario: 2.5 },
            },
            {
              id: 'ft2',
              produtoId: 'prod1',
              insumoId: 'ins2',
              quantidade: 150,
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins2', nome: 'Carne Hambúrguer', unidade: 'Gramas', fatorPerda: 0.1, custoUnitario: 0.05 },
            },
          ],
        },
      ],
    };

    const service = new DashboardService(mockRepo as DashboardRepository);
    const resumo = await service.obterResumo({ periodo: 'mes' });

    // KPIs
    expect(resumo.kpis.totalVendasQtd).toBe(1);
    expect(resumo.kpis.totalVendasValor).toBe(160.0); // (3 * 30) + (2 * 35) = 90 + 70 = 160
    expect(resumo.kpis.totalComprasValor).toBe(700.0); // 500 + 200
    expect(resumo.kpis.totalComprasQtd).toBe(2);
    expect(resumo.kpis.totalPerdasValor).toBe(50.0); // (10 * 2.5 = 25) + (500 * 0.05 = 25) = 50
    expect(resumo.kpis.totalPerdasQtd).toBe(2);
    expect(resumo.kpis.insumosEmAlertaQtd).toBe(2); // ins1 (20 <= 50) e ins3 (10 <= 30)

    // Perdas por motivo
    const vencimento = resumo.perdasPorMotivo.find((m) => m.motivo === 'VENCIMENTO');
    expect(vencimento?.valorTotal).toBe(25.0);
    expect(vencimento?.percentual).toBe(50.0);

    // Compras por Fornecedor
    expect(resumo.comprasPorFornecedor.length).toBe(2);
    expect(resumo.comprasPorFornecedor[0].fornecedorNome).toBe('Distribuidora Carnes Sul');
    expect(resumo.comprasPorFornecedor[0].valorTotal).toBe(500.0);
    expect(resumo.comprasPorFornecedor[0].percentual).toBeCloseTo(71.4, 1);

    // Itens mais vendidos
    expect(resumo.itensMaisVendidos.length).toBe(2);
    expect(resumo.itensMaisVendidos[0].produtoNome).toBe('X-Burger');
    expect(resumo.itensMaisVendidos[0].quantidadeVendida).toBe(3);

    // Consumo de insumos
    const pãoConsumido = resumo.consumoInsumos.find((i) => i.nome === 'Pão Brioche');
    expect(pãoConsumido?.quantidadeConsumida).toBe(3); // 1 un * 3 lanches

    // Estoque em alerta (ins1 e ins3 são CRITICO, ins2 é ALERTA pois 1000 <= 800 * 1.25)
    expect(resumo.estoqueAlerta.length).toBe(3);
    const criticos = resumo.estoqueAlerta.filter((i) => i.status === 'CRITICO');
    expect(criticos.length).toBe(2);
    expect(criticos.map((i) => i.id)).toContain('ins1');
    expect(criticos.map((i) => i.id)).toContain('ins3');
  });

  it('não conta pedidos cancelados/negados nas vendas, mais vendidos e consumo', async () => {
    const venda = (id: string, check: number, quantity: number) => ({
      id,
      criadoEm: new Date(),
      payloadOriginal: { id, check, items: [{ name: 'X-Burger', quantity, price: 30 }] },
    });
    const mockRepo = {
      buscarPerdasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [],
      buscarVendasProcessadasPorPeriodo: async () => [venda('v1', 3, 2), venda('v2', 4, 5), venda('v3', 5, 7)],
    } as unknown as DashboardRepository;

    const resumo = await new DashboardService(mockRepo).obterResumo({ periodo: 'mes' });

    expect(resumo.kpis.totalVendasValor).toBe(60); // só os 2 do pedido finalizado
    expect(resumo.itensMaisVendidos).toEqual([{ produtoNome: 'X-Burger', quantidadeVendida: 2, valorEstimadoTotal: 60 }]);
  });

  it('calcula valor de perdas usando custoUnitario histórico gravado na perda', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [
        {
          id: 'p1',
          insumoId: 'ins1',
          quantidade: 10,
          motivo: 'VENCIMENTO' as const,
          custoUnitario: 3.0, // Custo gravado no registro histórico
          criadoEm: new Date(),
          insumo: { id: 'ins1', nome: 'Bacon', unidade: 'Gramas', custoUnitario: 6.0 }, // Custo atual dobrou por NF nova
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

    // 10 * 3.0 = 30 (não 60 do custo atual do insumo)
    expect(resumo.kpis.totalPerdasValor).toBe(30);
    expect(resumo.perdasPorMotivo.find((m) => m.motivo === 'VENCIMENTO')?.valorTotal).toBe(30);
  });

  it('calcula valor de perdas usando custoUnitario histórico gravado na perda sem fallback quando custo é 0', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [
        {
          id: 'p1',
          insumoId: 'ins1',
          quantidade: 500,
          motivo: 'ESTRAGADO' as const,
          custoUnitario: 0, // Molho novo sem custo na data da perda
          criadoEm: new Date(),
          insumo: { id: 'ins1', nome: 'Molho Novo', unidade: 'Mililitros', custoUnitario: 0.05 }, // Chegou primeira NF com preço depois
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

    // 500 * 0 = 0 (NÃO 25 do custo novo da NF)
    expect(resumo.kpis.totalPerdasValor).toBe(0);
    expect(resumo.perdasPorMotivo.find((m) => m.motivo === 'ESTRAGADO')?.valorTotal).toBe(0);
  });

  it('não conta vendas com destino "aguardar" (check 0, -2 ou sem check) no faturamento, mais vendidos ou consumo (VEN-F)', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [
        {
          id: 'prod1',
          nome: 'X-Burger',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [
            {
              id: 'ft1',
              produtoId: 'prod1',
              insumoId: 'ins1',
              quantidade: 1,
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins1', nome: 'Pão', unidade: 'Unidade', fatorPerda: 0, custoUnitario: 2 },
            },
          ],
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [
        // Venda 1: Aceita/Confirmada (check 1) -> DEVE ENTRAR
        {
          id: 'v1',
          criadoEm: new Date(),
          payloadOriginal: {
            check: 1,
            items: [{ name: 'X-Burger', quantity: 2, price: 30 }],
          },
        },
        // Venda 2: Em análise / pendente (check 0) -> NÃO DEVE ENTRAR
        {
          id: 'v2',
          criadoEm: new Date(),
          payloadOriginal: {
            check: 0,
            items: [{ name: 'X-Burger', quantity: 5, price: 30 }],
          },
        },
        // Venda 3: Agendada (check -2) -> NÃO DEVE ENTRAR
        {
          id: 'v3',
          criadoEm: new Date(),
          payloadOriginal: {
            check: -2,
            items: [{ name: 'X-Burger', quantity: 3, price: 30 }],
          },
        },
        // Venda 4: Payload sem campo check (destino fail-safe: aguardar) -> NÃO DEVE ENTRAR
        {
          id: 'v4',
          criadoEm: new Date(),
          payloadOriginal: {
            items: [{ name: 'X-Burger', quantity: 4, price: 30 }],
          },
        },
      ],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

    // Apenas a Venda 1 (2 * 30 = 60) é contabilizada
    expect(resumo.kpis.totalVendasQtd).toBe(1);
    expect(resumo.kpis.totalVendasValor).toBe(60);
    expect(resumo.itensMaisVendidos).toEqual([
      { produtoNome: 'X-Burger', quantidadeVendida: 2, valorEstimadoTotal: 60 },
    ]);
    expect(resumo.consumoInsumos).toEqual([
      { insumoId: 'ins1', nome: 'Pão', unidade: 'Unidade', quantidadeConsumida: 2, valorEstimado: 4 },
    ]);
  });

  it('expande adicionais (subItems) recursivamente somando receita e abatendo insumos pelas fichas técnicas (VEN-F)', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [
        {
          id: 'prod1',
          nome: 'X-Bacon',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [
            {
              id: 'ft1',
              produtoId: 'prod1',
              insumoId: 'ins_pao',
              quantidade: 1,
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins_pao', nome: 'Pão', unidade: 'Unidade', fatorPerda: 0, custoUnitario: 2 },
            },
            {
              id: 'ft2',
              produtoId: 'prod1',
              insumoId: 'ins_bacon',
              quantidade: 50,
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins_bacon', nome: 'Bacon', unidade: 'Gramas', fatorPerda: 0, custoUnitario: 0.05 },
            },
          ],
        },
        {
          id: 'prod_adicional',
          nome: 'Bacon Extra',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [
            {
              id: 'ft3',
              produtoId: 'prod_adicional',
              insumoId: 'ins_bacon',
              quantidade: 30, // 30g de bacon no adicional
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins_bacon', nome: 'Bacon', unidade: 'Gramas', fatorPerda: 0, custoUnitario: 0.05 },
            },
          ],
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [
        {
          id: 'v_adicional',
          criadoEm: new Date(),
          payloadOriginal: {
            check: 2, // Aceito
            items: [
              {
                name: 'X-Bacon',
                quantity: 2, // 2 lanches
                price: 35,
                subItems: [
                  {
                    name: 'Bacon Extra',
                    quantity: 1, // 1 por lanche = 2 adicionais no total
                    price: 6,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

    // Faturamento: (2 * 35) + (2 * 6) = 70 + 12 = 82
    expect(resumo.kpis.totalVendasValor).toBe(82);
    expect(resumo.kpis.totalVendasQtd).toBe(1);

    // Itens mais vendidos incluem o adicional expandido
    expect(resumo.itensMaisVendidos).toEqual([
      { produtoNome: 'X-Bacon', quantidadeVendida: 2, valorEstimadoTotal: 70 },
      { produtoNome: 'Bacon Extra', quantidadeVendida: 2, valorEstimadoTotal: 12 },
    ]);

    // Consumo de insumos:
    // Pão: 2 lanches * 1 un = 2 un (custo: 2 * 2 = R$ 4)
    // Bacon: (2 lanches * 50g) + (2 adicionais * 30g) = 100g + 60g = 160g (custo: 160 * 0.05 = R$ 8)
    const pao = resumo.consumoInsumos.find((i) => i.insumoId === 'ins_pao');
    const bacon = resumo.consumoInsumos.find((i) => i.insumoId === 'ins_bacon');

    expect(pao?.quantidadeConsumida).toBe(2);
    expect(pao?.valorEstimado).toBe(4);
    expect(bacon?.quantidadeConsumida).toBe(160);
    expect(bacon?.valorEstimado).toBe(8);
  });

  it('normaliza nomes de produtos com acentos e hífens e ignora produtos com colisão de nome', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [
        {
          id: 'prod1',
          nome: 'X-Burger Especial', // No catálogo está com hífen
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [
            {
              id: 'ft1',
              produtoId: 'prod1',
              insumoId: 'ins1',
              quantidade: 1,
              criadoEm: new Date(),
              atualizadoEm: new Date(),
              insumo: { id: 'ins1', nome: 'Carne', unidade: 'Unidade', fatorPerda: 0, custoUnitario: 5 },
            },
          ],
        },
        {
          id: 'prod_colisao_1',
          nome: 'Hambúrguer Artesanal',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [],
        },
        {
          id: 'prod_colisao_2',
          nome: 'Hamburguer Artesanal', // Colisão canônica com o de cima!
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [],
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [
        {
          id: 'v1',
          criadoEm: new Date(),
          payloadOriginal: {
            check: 1,
            items: [
              // No pedido veio sem hífen e em minúsculas: "x burger especial"
              { name: '  x burger especial  ', quantity: 2, price: 20 },
              // Produto com colisão canônica
              { name: 'Hamburguer Artesanal', quantity: 1, price: 25 },
            ],
          },
        },
      ],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

    // Faturamento total: (2 * 20) + (1 * 25) = 65
    expect(resumo.kpis.totalVendasValor).toBe(65);

    // Consumo: apenas X-Burger Especial abate insumo (2 * 1 = 2)
    // O Hamburguer Artesanal com colisão é ignorado no consumo por ambiguidade
    expect(resumo.consumoInsumos.length).toBe(1);
    expect(resumo.consumoInsumos[0].insumoId).toBe('ins1');
    expect(resumo.consumoInsumos[0].quantidadeConsumida).toBe(2);
  });

  it('unifica o mesmo produto no ranking de mais vendidos sob o nome canônico mesmo com grafias diferentes', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [
        {
          id: 'prod1',
          nome: 'X-Bacon', // Nome canônico cadastrado no cardápio
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [],
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [
        {
          id: 'v1',
          criadoEm: new Date(),
          payloadOriginal: {
            check: 1,
            items: [
              // Grafia 1: com espaço
              { name: 'X Bacon', quantity: 2, price: 25 },
              // Grafia 2: com hífen
              { name: 'X-Bacon', quantity: 1, price: 25 },
            ],
          },
        },
      ],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

    // Não divide em 2 itens no ranking: unifica na entrada canônica do produto
    expect(resumo.itensMaisVendidos).toEqual([
      { produtoNome: 'X-Bacon', quantidadeVendida: 3, valorEstimadoTotal: 75 },
    ]);
  });

  it('mantém item só de emojis no ranking de mais vendidos sem abater estoque', async () => {
    const mockRepo: Partial<DashboardRepository> = {
      buscarPerdasPorPeriodo: async () => [],
      buscarNotasFiscaisPorPeriodo: async () => [],
      buscarInsumos: async () => [],
      buscarProdutosComFichas: async () => [
        {
          id: 'prod1',
          nome: 'X-Burger',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          fichasTecnicas: [],
        },
      ],
      buscarVendasProcessadasPorPeriodo: async () => [
        {
          id: 'v1',
          criadoEm: new Date(),
          payloadOriginal: {
            check: 1,
            items: [
              { name: '🥤', quantity: 5, price: 6 },
              { name: 'X-Burger', quantity: 1, price: 30 },
            ],
          },
        },
      ],
    };

    const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });
    expect(resumo.kpis.totalVendasValor).toBe(60);
    expect(resumo.itensMaisVendidos).toEqual([
      { produtoNome: '🥤', quantidadeVendida: 5, valorEstimadoTotal: 30 },
      { produtoNome: 'X-Burger', quantidadeVendida: 1, valorEstimadoTotal: 30 },
    ]);
  });

  it('inclui diasRestantesValidade e vencido em estoqueAlerta quando insumo beneficiado vence em <= 2 dias ou já venceu (0 dias já é vencido)', async () => {
    vi.useFakeTimers();
    try {
      const agora = new Date('2026-11-13T12:00:00Z');
      vi.setSystemTime(agora);

      const umDia = 86_400_000;
      const mockRepo: Partial<DashboardRepository> = {
        buscarPerdasPorPeriodo: async () => [],
        buscarNotasFiscaisPorPeriodo: async () => [],
        buscarProdutosComFichas: async () => [],
        buscarVendasProcessadasPorPeriodo: async () => [],
        buscarInsumos: async () => [
          {
            id: 'ins-vence-1d',
            nome: 'Molho Casa',
            unidade: 'Gramas',
            estoqueAtual: 500,
            estoqueMinimo: 100,
            produzidoInternamente: true,
            validadeDias: 3,
            atualizadoEm: new Date(agora.getTime() - 2 * umDia),
          },
          {
            id: 'ins-vence-0d',
            nome: 'Maionese Verde',
            unidade: 'Gramas',
            estoqueAtual: 500,
            estoqueMinimo: 100,
            produzidoInternamente: true,
            validadeDias: 3,
            atualizadoEm: new Date(agora.getTime() - 3 * umDia),
          },
          {
            id: 'ins-longe',
            nome: 'Molho Cheddar',
            unidade: 'Gramas',
            estoqueAtual: 500,
            estoqueMinimo: 100,
            produzidoInternamente: true,
            validadeDias: 5,
            atualizadoEm: new Date(agora.getTime() - 1 * umDia),
          },
        ],
      };

      const resumo = await new DashboardService(mockRepo as any).obterResumo({ periodo: 'mes' });

      expect(resumo.estoqueAlerta).toEqual([
        {
          id: 'ins-vence-0d',
          nome: 'Maionese Verde',
          unidade: 'Gramas',
          estoqueAtual: 500,
          estoqueMinimo: 100,
          status: 'CRITICO',
          percentualEstoque: 500,
          diasRestantesValidade: 0,
          vencido: true,
        },
        {
          id: 'ins-vence-1d',
          nome: 'Molho Casa',
          unidade: 'Gramas',
          estoqueAtual: 500,
          estoqueMinimo: 100,
          status: 'ALERTA',
          percentualEstoque: 500,
          diasRestantesValidade: 1,
          vencido: false,
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
