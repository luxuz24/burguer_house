import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from '../src/infra/http/app.js';
import { prisma } from '../src/infra/database/prisma.js';
import { obterPartesDataLoja } from '../src/shared/datas.js';

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

function diaLojaComOffset(diasAtras: number): string {
  const ref = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
  const { ano, mes, dia } = obterPartesDataLoja(ref);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

describe('Fase 3 — Teste de ponta a ponta (um dia completo)', () => {
  let auth: Record<string, string>;
  const usuarioId = 'user-fase3-e2e';

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    await limparBancoTeste();
    const testUrl = process.env.DATABASE_URL_TEST;
    if (!testUrl || !testUrl.includes('_test')) {
      throw new Error('DATABASE_URL_TEST deve apontar para o banco _test.');
    }

    execFileSync('./node_modules/.bin/tsx', ['prisma/seed.ts'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });

    await prisma.usuario.upsert({
      where: { id: usuarioId },
      update: { ativo: true, tokenVersion: 0, nome: 'Gerente Fase 3' },
      create: {
        id: usuarioId,
        nome: 'Gerente Fase 3',
        email: 'fase3.e2e@teste.com',
        senha: 'hash',
        role: 'GERENTE',
        ativo: true,
        tokenVersion: 0,
      },
    });
    const token = app.jwt.sign({
      sub: usuarioId,
      email: 'fase3.e2e@teste.com',
      role: 'GERENTE',
      tv: 0,
    });
    auth = { authorization: `Bearer ${token}` };
    vi.stubEnv('CRON_SECRET', 'cron-secret-fase3-e2e');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await limparBancoTeste();
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('executa o ciclo completo do dia (entrada, simulação, confirmação, replay, estoque negativo, alteração de ficha + estorno, listagem, dashboard, consolidação, conservação e concorrência)', async () => {
    const dataHoje = diaLojaComOffset(0);
    const dataTresDiasAtras = diaLojaComOffset(3);

    // Fotografia inicial independente do código de produção
    const insumosIniciais = await prisma.insumo.findMany();
    const estoqueInicial = new Map<string, number>();
    const nomePorId = new Map<string, string>();
    const idPorNome = new Map<string, string>();
    for (const ins of insumosIniciais) {
      estoqueInicial.set(ins.id, ins.estoqueAtual);
      nomePorId.set(ins.id, ins.nome);
      idPorNome.set(ins.nome, ins.id);
    }

    // Ledger independente para conservação:
    // finalEsperado(id) = inicial(id) + entradas(id) - consumosAtivos(id)
    const entradas = new Map<string, number>();
    const consumosAtivos = new Map<string, number>();
    const somarMapa = (mapa: Map<string, number>, id: string, delta: number) => {
      mapa.set(id, Number(((mapa.get(id) ?? 0) + delta).toFixed(4)));
    };

    const cocaZeroId = idPorNome.get('Coca Cola Zero 350ml')!;
    const sacoKraftId = idPorNome.get('Saco Kraft Delivery')!;
    const carneId = idPorNome.get('Carne de Hambúrguer')!;
    const aguaComGasId = idPorNome.get('agua com gás')!;

    const prodBacon = await prisma.produto.findFirstOrThrow({
      where: { nome: 'BACON HOUSE' },
      include: { fichasTecnicas: { include: { insumo: true } } },
    });
    const prodCocaZero = await prisma.produto.findFirstOrThrow({
      where: { nome: 'Coca Cola Zero 350ml' },
    });
    const prodAguaComGas = await prisma.produto.findFirstOrThrow({
      where: { nome: 'agua com gás' },
    });

    // Ficha inicial de BACON HOUSE (copiada como mapa independente antes de qualquer alteração)
    const fichaBaconInicial = prodBacon.fichasTecnicas.map((f) => ({
      insumoId: f.insumoId,
      quantidade: f.quantidade,
      fatorPerda: Math.max(0, f.insumo.fatorPerda),
    }));

    // 1. Entrada manual em lote: +24 Coca Cola Zero 350ml, +500 Saco Kraft, +2000 g Carne com custo
    const entradaRes = await app.inject({
      method: 'POST',
      url: '/api/estoque/entradas-manuais',
      headers: auth,
      payload: {
        chaveIdempotencia: 'fase3-entrada-01',
        observacao: 'Compra atacadão manhã',
        itens: [
          { insumoId: cocaZeroId, quantidade: 24, custoUnitario: 3.1 },
          { insumoId: sacoKraftId, quantidade: 500 },
          { insumoId: carneId, quantidade: 2000, custoUnitario: 0.035 },
        ],
      },
    });
    expect(entradaRes.statusCode).toBe(201);
    somarMapa(entradas, cocaZeroId, 24);
    somarMapa(entradas, sacoKraftId, 500);
    somarMapa(entradas, carneId, 2000);

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: cocaZeroId } })).estoqueAtual).toBe(124);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: sacoKraftId } })).estoqueAtual).toBe(800);
    const carneAposEntrada = await prisma.insumo.findUniqueOrThrow({ where: { id: carneId } });
    expect(carneAposEntrada.estoqueAtual).toBe(7000);
    expect(carneAposEntrada.custoUnitario).toBe(0.035);

    // Conferência de filtro por categoria (tarefa 21)
    const bebCat = await app.inject({ method: 'GET', url: '/api/insumos?categoria=BEBIDA', headers: auth });
    expect(bebCat.statusCode).toBe(200);
    expect(bebCat.json().some((i: { id: string }) => i.id === cocaZeroId)).toBe(true);
    const embCat = await app.inject({ method: 'GET', url: '/api/insumos?categoria=EMBALAGEM', headers: auth });
    expect(embCat.statusCode).toBe(200);
    expect(embCat.json().some((i: { id: string }) => i.id === sacoKraftId)).toBe(true);

    // 2. Simulação do fechamento de 3 BACON HOUSE + 6 Coca Cola Zero 350ml
    const simRes = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual/simulacao',
      headers: auth,
      payload: {
        data: dataHoje,
        itens: [
          { produtoId: prodBacon.id, quantidade: 3 },
          { produtoId: prodCocaZero.id, quantidade: 6 },
        ],
      },
    });
    expect(simRes.statusCode).toBe(200);
    const simBody = simRes.json();
    expect(simBody.podeConfirmar).toBe(true);
    expect(simBody.temNegativo).toBe(false);

    const projetadoPorInsumo = new Map<string, number>();
    for (const c of simBody.consumos as Array<{ insumoId: string; estoqueProjetado: number }>) {
      projetadoPorInsumo.set(c.insumoId, c.estoqueProjetado);
    }

    // 3. Confirmação do fechamento 1: saldos reais batem com estoqueProjetado da simulação
    const payloadFech1 = {
      chaveIdempotencia: 'fase3-fech-01',
      data: dataHoje,
      observacao: 'Fechamento 1',
      itens: [
        { produtoId: prodBacon.id, quantidade: 3 },
        { produtoId: prodCocaZero.id, quantidade: 6 },
      ],
    };
    const conf1Res = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: payloadFech1,
    });
    expect(conf1Res.statusCode).toBe(201);
    const conf1Body = conf1Res.json();
    expect(conf1Body.reaproveitado).toBe(false);
    expect(conf1Body.insumosComEstoqueNegativo).toEqual([]);

    for (const [insId, projetado] of projetadoPorInsumo.entries()) {
      const atual = (await prisma.insumo.findUniqueOrThrow({ where: { id: insId } })).estoqueAtual;
      expect(atual).toBe(projetado);
    }

    // Registra no ledger independente o consumo do fechamento 1
    for (const f of fichaBaconInicial) {
      somarMapa(consumosAtivos, f.insumoId, f.quantidade * (1 + f.fatorPerda) * 3);
    }
    somarMapa(consumosAtivos, cocaZeroId, 6);

    // 4. Replay da mesma chave: nada muda e reaproveitado: true
    const saldosAntesReplay = new Map(
      (await prisma.insumo.findMany()).map((i) => [i.id, i.estoqueAtual]),
    );
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: payloadFech1,
    });
    expect(replayRes.statusCode).toBe(200);
    expect(replayRes.json().reaproveitado).toBe(true);
    for (const ins of await prisma.insumo.findMany()) {
      expect(ins.estoqueAtual).toBe(saldosAntesReplay.get(ins.id));
    }

    // 5. Segundo fechamento (outra chave) deixando agua com gás negativo (50 - 60 = -10)
    const conf2Res = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: {
        chaveIdempotencia: 'fase3-fech-02',
        data: dataHoje,
        observacao: 'Fechamento 2',
        itens: [{ produtoId: prodAguaComGas.id, quantidade: 60 }],
      },
    });
    expect(conf2Res.statusCode).toBe(201);
    expect(conf2Res.json().insumosComEstoqueNegativo).toEqual([
      { id: aguaComGasId, nome: 'agua com gás', estoqueAtual: -10 },
    ]);
    somarMapa(consumosAtivos, aguaComGasId, 60);

    const dashAlertaRes = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo?periodo=hoje',
      headers: auth,
    });
    expect(dashAlertaRes.statusCode).toBe(200);
    expect(dashAlertaRes.json().estoqueAlerta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: aguaComGasId,
          categoria: 'BEBIDA',
          estoqueAtual: -10,
          status: 'CRITICO',
        }),
      ]),
    );

    // 6. Altera a ficha técnica do BACON HOUSE (Carne 160 -> 320g) e estorna o fechamento 1:
    // deve devolver EXATAMENTE 3*160 = 480g (snapshot), não 3*320 = 960g!
    const fichaCarneBacon = prodBacon.fichasTecnicas.find((f) => f.insumoId === carneId)!;
    await prisma.fichaTecnica.update({
      where: { id: fichaCarneBacon.id },
      data: { quantidade: 320 },
    });

    const estornoRes = await app.inject({
      method: 'POST',
      url: `/api/vendas/${conf1Body.vendaId}/estornar`,
      headers: auth,
      payload: { motivo: 'Lançado duplicado no turno' },
    });
    expect(estornoRes.statusCode).toBe(200);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carneId } })).estoqueAtual).toBe(7000);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: cocaZeroId } })).estoqueAtual).toBe(124);

    // Remove o fechamento 1 estornado do ledger de consumos ativos
    for (const f of fichaBaconInicial) {
      somarMapa(consumosAtivos, f.insumoId, -(f.quantidade * (1 + f.fatorPerda) * 3));
    }
    somarMapa(consumosAtivos, cocaZeroId, -6);

    // 7. Listagem do dia: dois fechamentos, o primeiro (estornado) marcado estornada: true
    const listagemRes = await app.inject({
      method: 'GET',
      url: `/api/vendas/fechamentos-manuais?data=${dataHoje}`,
      headers: auth,
    });
    expect(listagemRes.statusCode).toBe(200);
    const listagemBody = listagemRes.json();
    expect(listagemBody.total).toBe(2);
    expect(listagemBody.fechamentos[0]).toMatchObject({
      id: conf2Res.json().vendaId,
      estornada: false,
      estorno: null,
    });
    expect(listagemBody.fechamentos[1]).toMatchObject({
      id: conf1Body.vendaId,
      estornada: true,
      estorno: { motivo: 'Lançado duplicado no turno' },
    });

    // 8. Fechamento retroativo de 3 dias atrás (1 BACON HOUSE com ficha nova de 320g Carne)
    const confRetroRes = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: {
        chaveIdempotencia: 'fase3-fech-retro-3d',
        data: dataTresDiasAtras,
        itens: [{ produtoId: prodBacon.id, quantidade: 1 }],
      },
    });
    expect(confRetroRes.statusCode).toBe(201);
    for (const f of fichaBaconInicial) {
      const qtdFichaAtual = f.insumoId === carneId ? 320 : f.quantidade;
      somarMapa(consumosAtivos, f.insumoId, qtdFichaAtual * (1 + f.fatorPerda) * 1);
    }

    // Dashboard de hoje: estornado (fechamento 1) e retroativo (3 dias atrás) NÃO entram hoje; só fechamento 2 (agua com gás)
    const dashHojeRes = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo?periodo=hoje',
      headers: auth,
    });
    expect(dashHojeRes.statusCode).toBe(200);
    const dashHoje = dashHojeRes.json();
    expect(dashHoje.kpis.totalVendasQtd).toBe(1);
    expect(dashHoje.kpis.vendasManuaisQtd).toBe(1);
    expect(dashHoje.kpis.vendasManuaisValor).toBe(0);
    expect(dashHoje.itensMaisVendidos).toEqual([
      { produtoNome: 'agua com gás', quantidadeVendida: 60, valorEstimadoTotal: 0 },
    ]);
    expect(dashHoje.consumoInsumos).toEqual([
      expect.objectContaining({ insumoId: aguaComGasId, nome: 'agua com gás', quantidadeConsumida: 60 }),
    ]);

    // Dashboard de 3 dias atrás: aparece apenas o fechamento retroativo (1 BACON HOUSE)
    const dashRetroRes = await app.inject({
      method: 'GET',
      url: `/api/dashboard/resumo?dataInicio=${dataTresDiasAtras}&dataFim=${dataTresDiasAtras}`,
      headers: auth,
    });
    expect(dashRetroRes.statusCode).toBe(200);
    const dashRetro = dashRetroRes.json();
    expect(dashRetro.kpis.totalVendasQtd).toBe(1);
    expect(dashRetro.kpis.vendasManuaisQtd).toBe(1);
    expect(dashRetro.itensMaisVendidos).toEqual([
      { produtoNome: 'BACON HOUSE', quantidadeVendida: 1, valorEstimadoTotal: 0 },
    ]);
    expect(dashRetro.consumoInsumos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ insumoId: carneId, nome: 'Carne de Hambúrguer', quantidadeConsumida: 320 }),
      ]),
    );

    // 9. Consolidação automática roda no meio e não altera nada das vendas manuais
    const consolidarRes = await app.inject({
      method: 'POST',
      url: '/api/vendas/consolidar',
      headers: { 'x-cron-secret': 'cron-secret-fase3-e2e' },
    });
    expect(consolidarRes.statusCode).toBe(200);
    expect(consolidarRes.json().consolidadas).toBe(0);

    // 10. Conservação antes da concorrência para TODOS os 49 insumos:
    // final = inicial + entradas - consumosAtivos (calculado independentemente no teste)
    for (const ins of await prisma.insumo.findMany()) {
      const esperado = Number(
        (
          (estoqueInicial.get(ins.id) ?? 0) +
          (entradas.get(ins.id) ?? 0) -
          (consumosAtivos.get(ins.id) ?? 0)
        ).toFixed(4),
      );
      expect(ins.estoqueAtual, `Conservação pré-concorrência falhou para ${ins.nome}`).toBe(esperado);
    }

    // 11. Concorrência: dois fechamentos e uma entrada manual simultâneos no mesmo insumo (Carne)
    const carneAntesConc = (await prisma.insumo.findUniqueOrThrow({ where: { id: carneId } })).estoqueAtual;
    expect(carneAntesConc).toBe(7000 - 320); // 6680

    const [concEntrada, concFechA, concFechB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'fase3-conc-entrada-01',
          itens: [{ insumoId: carneId, quantidade: 50 }],
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'fase3-conc-fech-A',
          data: dataHoje,
          itens: [{ produtoId: prodBacon.id, quantidade: 1 }],
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'fase3-conc-fech-B',
          data: dataHoje,
          itens: [{ produtoId: prodBacon.id, quantidade: 1 }],
        },
      }),
    ]);

    expect(concEntrada.statusCode).toBe(201);
    expect(concFechA.statusCode).toBe(201);
    expect(concFechB.statusCode).toBe(201);

    somarMapa(entradas, carneId, 50);
    for (let k = 0; k < 2; k++) {
      for (const f of fichaBaconInicial) {
        const qtdFichaAtual = f.insumoId === carneId ? 320 : f.quantidade;
        somarMapa(consumosAtivos, f.insumoId, qtdFichaAtual * (1 + f.fatorPerda) * 1);
      }
    }

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carneId } })).estoqueAtual).toBe(
      carneAntesConc + 50 - 320 - 320,
    );

    // Conservação final para TODOS os 49 insumos após todas as operações concorrentes
    for (const ins of await prisma.insumo.findMany()) {
      const esperado = Number(
        (
          (estoqueInicial.get(ins.id) ?? 0) +
          (entradas.get(ins.id) ?? 0) -
          (consumosAtivos.get(ins.id) ?? 0)
        ).toFixed(4),
      );
      expect(ins.estoqueAtual, `Conservação final falhou para ${ins.nome}`).toBe(esperado);
    }
  });
});
