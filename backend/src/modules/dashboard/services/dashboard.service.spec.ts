import { describe, it, expect } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import type { DashboardRepository } from '../repositories/dashboard.repository.js';

describe('DashboardService', () => {
  it('deve calcular corretamente as datas do período', () => {
    const service = new DashboardService({} as any);

    const hoje = service.calcularDatasPeriodo({ periodo: 'hoje' });
    expect(hoje.tipo).toBe('hoje');
    expect(hoje.dataInicio.getHours()).toBe(0);
    expect(hoje.dataFim.getHours()).toBe(23);

    const semana = service.calcularDatasPeriodo({ periodo: 'semana' });
    expect(semana.tipo).toBe('semana');
    expect(semana.dataFim.getTime()).toBeGreaterThan(semana.dataInicio.getTime());

    const mes = service.calcularDatasPeriodo({ periodo: 'mes' });
    expect(mes.tipo).toBe('mes');
    expect(mes.dataInicio.getDate()).toBe(1);

    const personalizado = service.calcularDatasPeriodo({
      dataInicio: '2026-09-01T00:00:00.000Z',
      dataFim: '2026-09-30T23:59:59.999Z',
    });
    expect(personalizado.tipo).toBe('personalizado');
    expect(personalizado.dataInicio.toISOString()).toBe('2026-09-01T00:00:00.000Z');
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
});
