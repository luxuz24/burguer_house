import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import { FechamentoManualService } from './fechamento_manual.service.js';
import { EstornarFechamentoService } from './estornar_fechamento.service.js';
import {
  ListarFechamentosManuaisService,
  ListarFechamentosError,
} from './listar_fechamentos_manuais.service.js';

async function limparBanco() {
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

describe('ListarFechamentosManuaisService', () => {
  const fechamentoService = new FechamentoManualService();
  const estornoService = new EstornarFechamentoService();
  const listagemService = new ListarFechamentosManuaisService();

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect().catch(() => {});
  });

  it('usa data de hoje em America/Campo_Grande quando omitida, aceita data futura (vazia) e rejeita data inválida com 400', async () => {
    vi.useFakeTimers();
    try {
      // 2026-04-05 às 22:30 MS = 2026-04-06T02:30:00Z
      vi.setSystemTime(new Date('2026-04-06T02:30:00.000Z'));

      const hoje = await listagemService.listar({});
      expect(hoje).toEqual({ data: '2026-04-05', total: 0, fechamentos: [] });

      const futura = await listagemService.listar({ data: '  2026-04-10  ' });
      expect(futura).toEqual({ data: '2026-04-10', total: 0, fechamentos: [] });

      await expect(listagemService.listar({ data: '2026-02-31' })).rejects.toBeInstanceOf(
        ListarFechamentosError,
      );
      await expect(listagemService.listar({ data: '   ' })).rejects.toMatchObject({
        name: 'ListarFechamentosError',
        status: 400,
        message: 'Data inválida; use o formato AAAA-MM-DD',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('lista apenas MANUAL do ocorridoEm no dia (mais novo primeiro), mostra estorno, ignora WEBHOOK e separa fechamento de ontem lançado hoje', async () => {
    const uBruna = await prisma.usuario.create({
      data: { nome: 'Bruna', email: 'bruna.list@teste.com', senha: 'hash' },
    });
    const uCarlos = await prisma.usuario.create({
      data: { nome: 'Carlos Eduardo', email: 'carlos.list@teste.com', senha: 'hash' },
    });

    const pao = await prisma.insumo.create({
      data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 100 },
    });
    const baconHouse = await prisma.produto.create({
      data: {
        nome: 'BACON HOUSE',
        fichasTecnicas: { create: [{ insumoId: pao.id, quantidade: 1 }] },
      },
    });
    const refri = await prisma.produto.create({
      data: {
        nome: 'Coca Cola Zero 350ml',
        fichasTecnicas: { create: [{ insumoId: pao.id, quantidade: 1 }] },
      },
    });

    // Venda de ontém (2026-11-12) lançada hoje — deve aparecer só na listagem de 2026-11-12
    const ontem = await fechamentoService.confirmar({
      chaveIdempotencia: 'list-ontem-01',
      data: '2026-11-12',
      itens: [{ produtoId: baconHouse.id, quantidade: 1 }],
      usuarioId: uBruna.id,
    });

    // Primeiro fechamento de 2026-11-13 (será estornado por Carlos)
    const primeiroDia13 = await fechamentoService.confirmar({
      chaveIdempotencia: 'list-dia13-01',
      data: '2026-11-13',
      itens: [{ produtoId: refri.id, quantidade: 6 }],
      usuarioId: uBruna.id,
    });
    const estorno = await estornoService.executar({
      vendaId: primeiroDia13.vendaId,
      motivo: 'Lancei errado',
      usuarioId: uCarlos.id,
    });

    // Segundo fechamento de 2026-11-13 (mais novo)
    const segundoDia13 = await fechamentoService.confirmar({
      chaveIdempotencia: 'list-dia13-02',
      data: '2026-11-13',
      observacao: 'Sábado cheio',
      itens: [{ produtoId: baconHouse.id, quantidade: 2 }],
      usuarioId: uCarlos.id,
    });

    // WEBHOOK com ocorridoEm no mesmo dia 2026-11-13 NÃO pode aparecer
    await prisma.venda.create({
      data: {
        externalId: 'hook:list-dia13',
        origem: 'WEBHOOK',
        ocorridoEm: new Date('2026-11-13T16:00:00.000Z'),
        processado: true,
        payloadOriginal: { info: { id: 'hook:list-dia13', check: 1, items: [] } },
      },
    });

    // Vendas MANUAL exatamente fora das bordas do dia 2026-11-13 em MS (04:00Z..03:59:59.999Z+1) NÃO podem aparecer
    await prisma.venda.create({
      data: {
        externalId: 'manual:borda-antes',
        origem: 'MANUAL',
        ocorridoEm: new Date('2026-11-13T03:59:59.999Z'), // 2026-11-12 23:59:59.999 MS
        processado: true,
        payloadOriginal: { info: { id: 'manual:borda-antes', check: 1, items: [] } },
      },
    });
    await prisma.venda.create({
      data: {
        externalId: 'manual:borda-depois',
        origem: 'MANUAL',
        ocorridoEm: new Date('2026-11-14T04:00:00.000Z'), // 2026-11-14 00:00:00.000 MS
        processado: true,
        payloadOriginal: { info: { id: 'manual:borda-depois', check: 1, items: [] } },
      },
    });

    const lista13 = await listagemService.listar({ data: '2026-11-13' });
    expect(lista13.data).toBe('2026-11-13');
    expect(lista13.total).toBe(2);
    expect(lista13.fechamentos).toEqual([
      {
        id: segundoDia13.vendaId,
        externalId: 'manual:list-dia13-02',
        criadoEm: expect.any(String),
        ocorridoEm: '2026-11-13T16:00:00.000Z',
        observacao: 'Sábado cheio',
        itens: [{ nome: 'BACON HOUSE', quantidade: 2 }],
        usuario: { id: uCarlos.id, nome: 'Carlos Eduardo' },
        estornada: false,
        estorno: null,
      },
      {
        id: primeiroDia13.vendaId,
        externalId: 'manual:list-dia13-01',
        criadoEm: expect.any(String),
        ocorridoEm: '2026-11-13T16:00:00.000Z',
        observacao: null,
        itens: [{ nome: 'Coca Cola Zero 350ml', quantidade: 6 }],
        usuario: { id: uBruna.id, nome: 'Bruna' },
        estornada: true,
        estorno: {
          em: estorno.estorno.em,
          motivo: 'Lancei errado',
          usuario: { id: uCarlos.id, nome: 'Carlos Eduardo' },
        },
      },
    ]);

    // Garante que _fechamento / consumos não vazam na resposta
    for (const f of lista13.fechamentos) {
      expect('_fechamento' in f).toBe(false);
      expect('consumos' in f).toBe(false);
      expect('payloadOriginal' in f).toBe(false);
    }

    // Fechamento de ontem (e borda de 23:59:59.999 MS do dia 12) aparecem só na listagem de ontem
    const lista12 = await listagemService.listar({ data: '2026-11-12' });
    expect(lista12.total).toBe(2);
    expect(lista12.fechamentos.map((f) => f.externalId)).toContain('manual:borda-antes');
    expect(lista12.fechamentos.map((f) => f.id)).toContain(ontem.vendaId);
  });

  it('devolve usuario null se o usuário foi apagado e executa número constante de consultas (sem N+1)', async () => {
    const user1 = await prisma.usuario.create({
      data: { nome: 'Apagado Autor', email: 'apagado1@teste.com', senha: 'hash' },
    });
    const user2 = await prisma.usuario.create({
      data: { nome: 'Ativo Estornador', email: 'ativo2@teste.com', senha: 'hash' },
    });
    const pao = await prisma.insumo.create({
      data: { nome: 'Pão N+1', unidade: 'Unidade', estoqueAtual: 500 },
    });
    const prod = await prisma.produto.create({
      data: {
        nome: 'Burger N+1',
        fichasTecnicas: { create: [{ insumoId: pao.id, quantidade: 1 }] },
      },
    });

    const fechada = await fechamentoService.confirmar({
      chaveIdempotencia: 'list-user-del-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 1 }],
      usuarioId: user1.id,
    });
    await estornoService.executar({
      vendaId: fechada.vendaId,
      motivo: 'Estorno de autor apagado',
      usuarioId: user1.id,
    });
    // Apaga o usuário (registradoPorId vira null via SetNull; _estorno.usuarioId fica órfão)
    await prisma.usuario.delete({ where: { id: user1.id } });

    const listaComUserApagado = await listagemService.listar({ data: '2026-11-13' });
    expect(listaComUserApagado.total).toBe(1);
    expect(listaComUserApagado.fechamentos[0]!.usuario).toBeNull();
    expect(listaComUserApagado.fechamentos[0]!.estorno!.usuario).toBeNull();

    // Mede consultas com 0, 1 e 6 fechamentos e payload legado malformado sem quebrar
    await prisma.venda.create({
      data: {
        externalId: 'manual:payload-legado-str',
        origem: 'MANUAL',
        ocorridoEm: new Date('2026-11-15T16:00:00.000Z'),
        processado: true,
        payloadOriginal: 'payload-invalido',
      },
    });
    const listaPayloadInvalido = await listagemService.listar({ data: '2026-11-15' });
    expect(listaPayloadInvalido.fechamentos[0]).toMatchObject({
      itens: [],
      observacao: null,
      estornada: false,
      estorno: null,
    });

    const spyVenda = vi.spyOn(prisma.venda, 'findMany');
    const spyUsuario = vi.spyOn(prisma.usuario, 'findMany');

    try {
      await listagemService.listar({ data: '2026-11-20' });
      expect(spyVenda).toHaveBeenCalledTimes(1);
      expect(spyUsuario).not.toHaveBeenCalled();

      await fechamentoService.confirmar({
        chaveIdempotencia: 'list-n1-base-01',
        data: '2026-11-14',
        observacao: '   ',
        itens: [{ produtoId: prod.id, quantidade: 1 }],
        usuarioId: user2.id,
      });

      spyVenda.mockClear();
      spyUsuario.mockClear();
      const um = await listagemService.listar({ data: '2026-11-14' });
      expect(um.total).toBe(1);
      expect(um.fechamentos[0]!.observacao).toBeNull();
      const queriesCom1 = spyVenda.mock.calls.length + spyUsuario.mock.calls.length;

      for (let i = 2; i <= 6; i++) {
        await fechamentoService.confirmar({
          chaveIdempotencia: `list-n1-multi-0${i}`,
          data: '2026-11-14',
          itens: [{ produtoId: prod.id, quantidade: 1 }],
          usuarioId: user2.id,
        });
      }

      spyVenda.mockClear();
      spyUsuario.mockClear();
      const seis = await listagemService.listar({ data: '2026-11-14' });
      expect(seis.total).toBe(6);
      const queriesCom6 = spyVenda.mock.calls.length + spyUsuario.mock.calls.length;

      expect(queriesCom1).toBe(2);
      expect(queriesCom6).toBe(2);
    } finally {
      spyVenda.mockRestore();
      spyUsuario.mockRestore();
    }
  });
});
