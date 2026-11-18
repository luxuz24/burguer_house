// backend/prisma/seed_demo.ts
// Banco de DEMONSTRAÇÃO (apresentação para a banca): `npm run seed:demo`, com DATABASE_URL apontando
// para um banco com "demo" no nome (ex.: burguer_house_demo). Veja docs/DEMO_BANCA.md.
//
// APAGA o banco e gera: o catálogo real da loja, 3 usuários (ADMIN, GERENTE e OPERADOR) e cerca de
// 30 dias de movimento FICTÍCIO feito pelos mesmos serviços que o app usa (contagem inicial, compras
// por nota, produção dos itens da casa, fechamento do dia e perdas), mais 2 vendas retidas do webhook.
// O dia de hoje fica sem fechamento, para ser feito ao vivo na apresentação.
// Os números são sorteados com semente fixa: rodar de novo no mesmo dia gera o mesmo resultado.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { MotivoPerda, PrismaClient, Role } from '../generated/prisma/client.js';
import { AjusteEstoqueService } from '../src/modules/estoque/services/ajuste_estoque.service.js';
import { EntradaEstoqueService } from '../src/modules/notas_fiscais/services/entrada_estoque.service.js';
import { PerdasRepository } from '../src/modules/perdas/repositories/perdas.repository.js';
import { ProducaoService } from '../src/modules/preparo_interno/services/producao.service.js';
import { FechamentoManualService } from '../src/modules/vendas/services/fechamento_manual.service.js';
import { criarDataLoja, obterPartesDataLoja } from '../src/shared/datas.js';
import { exigirBancoDeDemonstracao } from './banco_demo.js';
import { INSUMOS_CATALOGO, PRODUTOS_CATALOGO, RECEITAS_CATALOGO } from './catalogo_burguer_house.js';
import { semearCatalogo } from './semear_catalogo.js';

const DIAS_DE_HISTORICO = 30;
const SENHA_DEMO = process.env.SEED_DEMO_SENHA?.trim() || 'demo1234';

// Venda média de um dia aberto (quarta a domingo). CHICKEN HOUSE fica de fora: não tem ficha técnica.
const VENDA_MEDIA: Record<string, number> = {
  'BACON HOUSE': 9,
  'HOUSE DUPLO': 5,
  'SELADINHO HOUSE': 4,
  'HOUSE CARAMELIZADO': 4,
  'MUSSARELA HOUSE': 4,
  'RÚCULA HOUSE': 3,
  'HOUSE PANTENEIRO': 3,
  'CHICKEN SUPREME': 4,
  'HOUSE SALADA': 3,
  'BATATA CHIPS CROCANTE': 6,
  'BATATA CRINKLE': 5,
  'COCA COLA 350ML': 8,
  'COCA COLA ZERO 350ML': 4,
  'COCA COLA 600ML': 3,
  'COCA COLA ZERO 600ML': 2,
  'ÁGUA COM GÁS': 2,
  'ÁGUA SEM GÁS': 3,
  'HEINEKEN LONG NECK': 3,
  'COCA COLA LITRO': 2,
  'MAIONESE HOUSE': 5,
  'BARBECUE HOUSE': 3,
};
// Movimento por dia da semana (0 = domingo). Segunda e terça a loja fica fechada.
const MOVIMENTO_DO_DIA: Record<number, number> = { 0: 1.1, 3: 0.7, 4: 0.8, 5: 1.2, 6: 1.4 };
const DIAS_DE_COMPRA = new Set([3, 6]); // quarta e sábado
// Ficam fora da última compra para a apresentação mostrar alerta de estoque mínimo.
const FORA_DA_ULTIMA_COMPRA = new Set(['Bacon fatiado', 'Alface Americana', 'heineken long neck']);

const FORNECEDORES = {
  carnes: { nome: 'Frigorífico Pantanal (fictício)', cnpj: '00000000000101' },
  bebidas: { nome: 'Distribuidora de Bebidas MS (fictícia)', cnpj: '00000000000202' },
  geral: { nome: 'Atacado Campo Grande (fictício)', cnpj: '00000000000303' },
};
const CARNES = new Set(['Carne de Hambúrguer', 'Bacon fatiado', 'Frango Empanado']);

/** Gerador pseudoaleatório com semente fixa (mulberry32). */
function sorteador(semente: number) {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dia {
  texto: string; // AAAA-MM-DD no fuso da loja
  ano: number;
  mes: number;
  dia: number;
  semana: number;
  hora: (h: number, m?: number) => Date;
}

function diaDaLoja(diasAtras: number): Dia {
  const hoje = obterPartesDataLoja(new Date());
  const base = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia) - diasAtras * 86_400_000);
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth() + 1;
  const dia = base.getUTCDate();
  return {
    texto: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    ano,
    mes,
    dia,
    semana: base.getUTCDay(),
    hora: (h, m = 0) => criarDataLoja(ano, mes, dia, h, m, 0, 0),
  };
}

function arredondarCompra(quantidade: number, unidade: string, nome: string): number {
  const lote = unidade === 'Gramas' ? 500 : unidade === 'Mililitros' ? 900 : /coca|agua|heineken/i.test(nome) ? 12 : 6;
  return Math.max(lote, Math.ceil(quantidade / lote) * lote);
}

/** Consumo médio por dia aberto: direto das fichas e, para os itens da casa, dos brutos usados na produção. */
function consumoMedioPorDia() {
  const fator = new Map(INSUMOS_CATALOGO.map((i) => [i.nome, 1 + i.fatorPerda]));
  const receitas = new Map(RECEITAS_CATALOGO.map((r) => [r.beneficiado, r]));
  const consumo = new Map<string, number>();
  const somar = (nome: string, qtd: number) => consumo.set(nome, (consumo.get(nome) ?? 0) + qtd);

  for (const produto of PRODUTOS_CATALOGO) {
    const vendas = VENDA_MEDIA[produto.nome] ?? 0;
    for (const item of produto.ficha) {
      const usado = vendas * item.quantidade * (fator.get(item.insumo) ?? 1);
      somar(item.insumo, usado);
      const receita = receitas.get(item.insumo);
      for (const ing of receita?.ingredientes ?? []) {
        somar(ing.insumo, (usado * ing.quantidade * (fator.get(ing.insumo) ?? 1)) / receita!.rendimento);
      }
    }
  }
  return consumo;
}

async function main() {
  const nomeBanco = exigirBancoDeDemonstracao(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const sortear = sorteador(20261118);
  const entre = (min: number, max: number) => min + (max - min) * sortear();

  try {
    console.log(`Banco de demonstração "${nomeBanco}": apagando os dados...`);
    await prisma.movimentacaoEstoque.deleteMany();
    await prisma.fichaTecnica.deleteMany();
    await prisma.subFichaTecnica.deleteMany();
    await prisma.perda.deleteMany();
    await prisma.itemNotaFiscal.deleteMany();
    await prisma.notaFiscal.deleteMany();
    await prisma.venda.deleteMany();
    await prisma.produto.deleteMany();
    await prisma.insumo.deleteMany();
    await prisma.usuario.deleteMany();

    console.log('Cadastrando o catálogo real e os usuários de demonstração...');
    await semearCatalogo(prisma);
    const senha = bcrypt.hashSync(SENHA_DEMO, 10);
    const admin = await prisma.usuario.create({
      data: { nome: 'Administradora (demo)', email: 'admin@demo.burguerhouse.com.br', role: Role.ADMIN, senha, ativo: true },
    });
    await prisma.usuario.createMany({
      data: [
        { nome: 'Gerente (demo)', email: 'gerente@demo.burguerhouse.com.br', role: Role.GERENTE, senha, ativo: true },
        { nome: 'Operador (demo)', email: 'operador@demo.burguerhouse.com.br', role: Role.OPERADOR, senha, ativo: true },
      ],
    });

    const insumos = await prisma.insumo.findMany();
    const insumo = new Map(insumos.map((i) => [i.nome, i]));
    const produtos = new Map((await prisma.produto.findMany()).map((p) => [p.nome, p.id]));
    const consumo = consumoMedioPorDia();
    const beneficiados = new Set(RECEITAS_CATALOGO.map((r) => r.beneficiado));
    const alvo = new Map<string, number>();
    for (const i of insumos) {
      const porDia = consumo.get(i.nome) ?? 0;
      const minimo = porDia > 0 ? Math.ceil(porDia * 1.5) : i.unidade === 'Unidade' ? 6 : 200;
      alvo.set(i.nome, porDia > 0 ? arredondarCompra(porDia * 4.5, i.unidade, i.nome) : minimo * 2);
      await prisma.insumo.update({ where: { id: i.id }, data: { estoqueMinimo: minimo } });
    }

    const ajustes = new AjusteEstoqueService(prisma);
    const entradas = new EntradaEstoqueService(prisma);
    const producao = new ProducaoService(prisma);
    const fechamentos = new FechamentoManualService(prisma);
    const perdas = new PerdasRepository(prisma);

    const inicio = diaDaLoja(DIAS_DE_HISTORICO + 1);
    console.log(`Contagem inicial em ${inicio.texto}...`);
    await ajustes.registrarAjuste({
      chaveIdempotencia: 'demo-contagem-inicial',
      motivo: 'Contagem inicial (dados fictícios de demonstração)',
      usuarioId: admin.id,
      itens: insumos.map((i) => ({ insumoId: i.id, saldoContado: alvo.get(i.nome)! })),
    });
    await prisma.movimentacaoEstoque.updateMany({ data: { criadoEm: inicio.hora(9) } });

    let numeroNota = 0;
    let negativos = 0;
    const ultimoDiaDeCompra = [...Array(DIAS_DE_HISTORICO).keys()]
      .map((d) => diaDaLoja(d + 1))
      .find((d) => DIAS_DE_COMPRA.has(d.semana))?.texto;

    for (let atras = DIAS_DE_HISTORICO; atras >= 1; atras--) {
      const dia = diaDaLoja(atras);
      const movimento = MOVIMENTO_DO_DIA[dia.semana];
      if (movimento === undefined) continue; // segunda e terça: loja fechada

      // Compras da manhã (quarta e sábado): repõe os brutos até o estoque-alvo, uma nota por fornecedor.
      if (DIAS_DE_COMPRA.has(dia.semana)) {
        const atuais = await prisma.insumo.findMany({ where: { produzidoInternamente: false } });
        const porFornecedor = new Map<keyof typeof FORNECEDORES, { insumoId: string; quantidade: number; valorUnitario: number; descricaoOriginal: string }[]>();
        for (const i of atuais) {
          if (dia.texto === ultimoDiaDeCompra && FORA_DA_ULTIMA_COMPRA.has(i.nome)) continue;
          const falta = alvo.get(i.nome)! - i.estoqueAtual;
          if (falta <= alvo.get(i.nome)! * 0.25) continue;
          const fornecedor = CARNES.has(i.nome) ? 'carnes' : i.categoria === 'BEBIDA' ? 'bebidas' : 'geral';
          const custoBase = INSUMOS_CATALOGO.find((c) => c.nome === i.nome)!.custoUnitario;
          const itens = porFornecedor.get(fornecedor) ?? [];
          itens.push({
            insumoId: i.id,
            quantidade: arredondarCompra(falta, i.unidade, i.nome),
            valorUnitario: Number((custoBase * entre(0.96, 1.04)).toFixed(6)),
            descricaoOriginal: i.nome.toUpperCase(),
          });
          porFornecedor.set(fornecedor, itens);
        }
        for (const [chave, itens] of porFornecedor) {
          numeroNota++;
          const chaveAcesso = `50${String(dia.ano).slice(2)}${String(dia.mes).padStart(2, '0')}${FORNECEDORES[chave].cnpj}55001${String(numeroNota).padStart(9, '0')}1${String(numeroNota).padStart(8, '0')}0`;
          const valorTotal = Number(itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0).toFixed(2));
          await entradas.confirmarEntrada({
            chaveAcesso,
            numero: String(numeroNota),
            serie: '1',
            fornecedorNome: FORNECEDORES[chave].nome,
            fornecedorCnpj: FORNECEDORES[chave].cnpj,
            valorTotal,
            dataEmissao: dia.hora(8),
            itens: itens.map((it) => ({
              ...it,
              unidadeOriginal: 'UN',
              quantidadeOriginal: it.quantidade,
              valorTotal: Number((it.quantidade * it.valorUnitario).toFixed(2)),
            })),
          });
          await prisma.notaFiscal.update({ where: { chaveAcesso }, data: { criadoEm: dia.hora(8, 30) } });
        }
      }

      // Produção da casa: repõe quem tem menos de 2,5 dias de uso médio (o pico de um sábado chega perto
      // de 2), produzindo para 4 dias.
      for (const nome of beneficiados) {
        const atual = await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.get(nome)!.id } });
        const porDia = consumo.get(nome) ?? 0;
        if (porDia === 0 || atual.estoqueAtual >= porDia * 2.5) continue;
        const lote = atual.unidade === 'Unidade' ? 1 : 100;
        await producao.produzir(atual.id, Math.ceil((porDia * 4) / lote) * lote);
      }

      // Fechamento do dia.
      const itens = Object.entries(VENDA_MEDIA)
        .map(([nome, media]) => ({ produtoId: produtos.get(nome)!, quantidade: Math.round(media * movimento * entre(0.6, 1.4)) }))
        .filter((it) => it.quantidade > 0);
      const fechamento = await fechamentos.confirmar({
        chaveIdempotencia: `demo-fechamento-${dia.texto}`,
        data: dia.texto,
        observacao: 'Movimento fictício de demonstração',
        itens,
        usuarioId: admin.id,
      });
      negativos += fechamento.insumosComEstoqueNegativo.length;
      for (const neg of fechamento.insumosComEstoqueNegativo) {
        console.warn(`  ${dia.texto}: ${neg.nome} ficou negativo (${neg.estoqueAtual}) no fechamento`);
      }

      // Perdas de vez em quando.
      if (sortear() < 0.3) {
        const [nome, motivo, min, max] = [
          ['Alface Americana', MotivoPerda.ESTRAGADO, 50, 200],
          ['Tomate', MotivoPerda.VENCIMENTO, 100, 300],
          ['Pão Brioche', MotivoPerda.ERRO_PREPARO, 1, 3],
          ['Maionese da Casa - Beneficiado', MotivoPerda.VENCIMENTO, 100, 300],
          ['Carne de Hambúrguer', MotivoPerda.ERRO_PREPARO, 160, 320],
        ][Math.floor(sortear() * 5)] as [string, MotivoPerda, number, number];
        const unidade = insumo.get(nome)!.unidade === 'Unidade';
        const perda = await perdas.registrar({
          insumoId: insumo.get(nome)!.id,
          quantidade: unidade ? Math.round(entre(min, max)) : Math.round(entre(min, max) / 10) * 10,
          motivo,
        });
        await prisma.perda.update({ where: { id: perda.id }, data: { criadoEm: dia.hora(15) } });
      }
    }

    console.log('Vendas retidas do webhook e validade perto do fim...');
    await prisma.venda.createMany({
      data: [
        { externalId: 'demo-pedido-1', payloadOriginal: { id: 'demo-pedido-1', check: 1, items: [{ name: 'X-TUDO ESPECIAL', quantity: 1, price: 39.9 }], total: 39.9 } },
        { externalId: 'demo-pedido-2', payloadOriginal: { id: 'demo-pedido-2', check: 1, items: [{ name: 'CHICKEN HOUSE', quantity: 2, price: 32 }], total: 64 } },
      ],
    });
    // A validade dos itens da casa conta a partir da última atualização: a mussarela empanada vence amanhã.
    await prisma.insumo.update({
      where: { id: insumo.get('Mussarela Empanada - Beneficiado')!.id },
      data: { atualizadoEm: diaDaLoja(2).hora(10) },
    });

    const abaixoDoMinimo = (await prisma.insumo.findMany()).filter((i) => i.estoqueAtual < i.estoqueMinimo);
    console.log(
      `Pronto: ${numeroNota} notas, ${await prisma.venda.count({ where: { origem: 'MANUAL' } })} fechamentos, ` +
        `${await prisma.perda.count()} perdas, ${abaixoDoMinimo.length} insumos abaixo do mínimo ` +
        `(${abaixoDoMinimo.map((i) => i.nome).join(', ') || 'nenhum'}), ${negativos} saldos negativos nos fechamentos.`,
    );
    console.log(`Usuários (senha "${SENHA_DEMO}"): admin@, gerente@ e operador@demo.burguerhouse.com.br`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
