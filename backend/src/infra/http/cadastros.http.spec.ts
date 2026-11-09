import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

let auth: { authorization: string };

async function limparBanco() {
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

describe('Cadastros HTTP API: Insumos, Produtos e Fichas Técnicas', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'user-cadastros' },
      update: { ativo: true, tokenVersion: 0 },
      create: {
        id: 'user-cadastros',
        nome: 'Gerente Cadastros',
        email: 'cadastros@burguerhouse.test',
        senha: 'hash',
        role: 'ADMIN',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({
        sub: 'user-cadastros',
        email: 'cadastros@burguerhouse.test',
        role: 'ADMIN',
        tv: 0,
      })}`,
    };
  });

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.usuario.deleteMany({ where: { id: 'user-cadastros' } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('Insumos API (/api/insumos)', () => {
    it('deve criar insumo com sucesso (201) e aplicar defaults para campos opcionais', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: {
          nome: 'Pão de Brioche',
          unidade: 'Unidade',
        },
      });

      expect(res.statusCode).toBe(201);
      const insumo = res.json();
      expect(insumo.id).toBeTypeOf('string');
      expect(insumo.nome).toBe('Pão de Brioche');
      expect(insumo.unidade).toBe('Unidade');
      expect(insumo.estoqueAtual).toBe(0);
      expect(insumo.estoqueMinimo).toBe(0);
      expect(insumo.fatorPerda).toBe(0);
      expect(insumo.custoUnitario).toBe(0);
    });

    it('deve rejeitar criacao de insumo com campos invalidos (400)', async () => {
      const semNome = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: { unidade: 'Gramas' },
      });
      expect(semNome.statusCode).toBe(400);

      const nomeEspacos = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: { nome: '   ', unidade: 'Gramas' },
      });
      expect(nomeEspacos.statusCode).toBe(400);

      const perdaNegativa = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: { nome: 'Carne', unidade: 'Gramas', fatorPerda: -0.1 },
      });
      expect(perdaNegativa.statusCode).toBe(400);

      const perdaMaiorQueUm = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: { nome: 'Carne', unidade: 'Gramas', fatorPerda: 1.5 },
      });
      expect(perdaMaiorQueUm.statusCode).toBe(400);

      const estoqueNegativo = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: { nome: 'Carne', unidade: 'Gramas', estoqueAtual: -10 },
      });
      expect(estoqueNegativo.statusCode).toBe(400);

      const custoNegativo = await app.inject({
        method: 'POST',
        url: '/api/insumos',
        headers: auth,
        payload: { nome: 'Carne', unidade: 'Gramas', custoUnitario: -1 },
      });
      expect(custoNegativo.statusCode).toBe(400);
    });

    it('deve listar insumos cadastrados em ordem alfabetica (200)', async () => {
      await prisma.insumo.create({ data: { nome: 'Queijo Cheddar', unidade: 'Gramas', estoqueAtual: 10, estoqueMinimo: 5 } });
      await prisma.insumo.create({ data: { nome: 'Alface', unidade: 'Gramas', estoqueAtual: 20, estoqueMinimo: 5 } });

      const res = await app.inject({ method: 'GET', url: '/api/insumos', headers: auth });
      expect(res.statusCode).toBe(200);
      const lista = res.json();
      expect(lista.length).toBe(2);
      expect(lista[0].nome).toBe('Alface');
      expect(lista[1].nome).toBe('Queijo Cheddar');
    });

    it('deve buscar insumo por id (200) ou retornar 404 se inexistente', async () => {
      const criado = await prisma.insumo.create({
        data: { nome: 'Cebola Crispy', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 20, custoUnitario: 0.08 },
      });

      const res = await app.inject({ method: 'GET', url: `/api/insumos/${criado.id}`, headers: auth });
      expect(res.statusCode).toBe(200);
      expect(res.json().nome).toBe('Cebola Crispy');
      expect(res.json().custoUnitario).toBe(0.08);

      const inexistente = await app.inject({
        method: 'GET',
        url: '/api/insumos/00000000-0000-0000-0000-000000000000',
        headers: auth,
      });
      expect(inexistente.statusCode).toBe(404);

      const idInvalido = await app.inject({
        method: 'GET',
        url: '/api/insumos/nao-e-uuid',
        headers: auth,
      });
      expect(idInvalido.statusCode).toBe(400);
    });

    it('deve listar insumos em alerta de estoque minimo (200)', async () => {
      await prisma.insumo.create({ data: { nome: 'Pao Brioche', unidade: 'Unidade', estoqueAtual: 5, estoqueMinimo: 10 } });
      await prisma.insumo.create({ data: { nome: 'Carne Bovina', unidade: 'Gramas', estoqueAtual: 500, estoqueMinimo: 100 } });

      const res = await app.inject({ method: 'GET', url: '/api/insumos/alertas', headers: auth });
      expect(res.statusCode).toBe(200);
      const alertas = res.json();
      expect(alertas.length).toBe(1);
      expect(alertas[0].nome).toBe('Pao Brioche');
    });

    it('deve atualizar insumo parcialmente ignorando estoqueAtual no body (200)', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Tomate', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 10, fatorPerda: 0.05 },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/insumos/${insumo.id}`,
        headers: auth,
        payload: { estoqueAtual: 80, custoUnitario: 0.02, estoqueMinimo: 15 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().custoUnitario).toBe(0.02);
      expect(res.json().estoqueMinimo).toBe(15);
      expect(res.json().nome).toBe('Tomate'); // mantido
      // O estoqueAtual DEVE ser mantido intacto (ignorado no update para não sobrescrever saldo)
      expect(res.json().estoqueAtual).toBe(50);

      const doBanco = await prisma.insumo.findUnique({ where: { id: insumo.id } });
      expect(doBanco?.estoqueAtual).toBe(50);
    });

    it('deve responder 409 ao tentar alterar unidade de insumo vinculado a fichas ou movimentacoes', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Pao Australiano', unidade: 'Unidades', estoqueAtual: 50, estoqueMinimo: 10 },
      });
      const produto = await prisma.produto.create({ data: { nome: 'Australiano Burger' } });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 1 } });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/insumos/${insumo.id}`,
        headers: auth,
        payload: { unidade: 'Gramas' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain('Não é possível alterar a unidade');
    });

    it('deve rejeitar atualizacao sem campos no body com 400', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Bacon', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 10 },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/insumos/${insumo.id}`,
        headers: auth,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve deletar insumo sem vinculos (204) ou retornar 404 se inexistente', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Pepino Picles', unidade: 'Gramas', estoqueAtual: 10, estoqueMinimo: 2 },
      });

      const res = await app.inject({ method: 'DELETE', url: `/api/insumos/${insumo.id}`, headers: auth });
      expect(res.statusCode).toBe(204);

      const resInexistente = await app.inject({
        method: 'DELETE',
        url: '/api/insumos/00000000-0000-0000-0000-000000000000',
        headers: auth,
      });
      expect(resInexistente.statusCode).toBe(404);
    });

    it('deve responder 409 ao tentar deletar insumo vinculado a ficha tecnica', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Hamburguer 160g', unidade: 'Unidade', estoqueAtual: 20, estoqueMinimo: 5 },
      });
      const produto = await prisma.produto.create({ data: { nome: 'X-Burger' } });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 1 } });

      const res = await app.inject({ method: 'DELETE', url: `/api/insumos/${insumo.id}`, headers: auth });
      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain('existem registros vinculados');
    });
  });

  describe('Produtos API (/api/produtos)', () => {
    it('deve criar produto com sucesso (201) e rejeitar nome vazio (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/produtos',
        headers: auth,
        payload: { nome: 'X-Monster Burger' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().nome).toBe('X-Monster Burger');

      const vazio = await app.inject({
        method: 'POST',
        url: '/api/produtos',
        headers: auth,
        payload: { nome: '   ' },
      });
      expect(vazio.statusCode).toBe(400);
    });

    it('deve responder 409 com produtoConflito ao criar produto com nome colidente ("X Bacon" vs "X-Bacon")', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/produtos',
        headers: auth,
        payload: { nome: 'X-Bacon' },
      });

      const colidente = await app.inject({
        method: 'POST',
        url: '/api/produtos',
        headers: auth,
        payload: { nome: 'X Bacon' },
      });

      expect(colidente.statusCode).toBe(409);
      expect(colidente.json().message).toContain('Já existe um produto com nome equivalente cadastrado: "X-Bacon"');
      expect(colidente.json().produtoConflito).toBeDefined();
      expect(colidente.json().produtoConflito.nome).toBe('X-Bacon');
    });

    it('deve listar produtos em ordem alfabetica (200)', async () => {
      await prisma.produto.create({ data: { nome: 'Smash Salada' } });
      await prisma.produto.create({ data: { nome: 'Bacon Burger' } });

      const res = await app.inject({ method: 'GET', url: '/api/produtos', headers: auth });
      expect(res.statusCode).toBe(200);
      const lista = res.json();
      expect(lista.length).toBe(2);
      expect(lista[0].nome).toBe('Bacon Burger');
      expect(lista[1].nome).toBe('Smash Salada');
    });

    it('deve buscar produto por id com fichas tecnicas ordenadas pelo nome do insumo (200) ou 404', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Salada Especial' } });
      const queijo = await prisma.insumo.create({
        data: { nome: 'Queijo Cheddar', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10 },
      });
      const alface = await prisma.insumo.create({
        data: { nome: 'Alface Americana', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 5 },
      });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: queijo.id, quantidade: 30 } });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: alface.id, quantidade: 20 } });

      const res = await app.inject({ method: 'GET', url: `/api/produtos/${produto.id}`, headers: auth });
      expect(res.statusCode).toBe(200);
      const dados = res.json();
      expect(dados.nome).toBe('X-Salada Especial');
      expect(dados.fichasTecnicas.length).toBe(2);
      expect(dados.fichasTecnicas[0].insumo.nome).toBe('Alface Americana');
      expect(dados.fichasTecnicas[1].insumo.nome).toBe('Queijo Cheddar');

      const inexistente = await app.inject({
        method: 'GET',
        url: '/api/produtos/00000000-0000-0000-0000-000000000000',
        headers: auth,
      });
      expect(inexistente.statusCode).toBe(404);
    });

    it('deve atualizar nome do produto (200) ou retornar 404 se inexistente', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Original' } });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/produtos/${produto.id}`,
        headers: auth,
        payload: { nome: 'X-Atualizado' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().nome).toBe('X-Atualizado');

      const inexistente = await app.inject({
        method: 'PUT',
        url: '/api/produtos/00000000-0000-0000-0000-000000000000',
        headers: auth,
        payload: { nome: 'Inexistente' },
      });
      expect(inexistente.statusCode).toBe(404);

      const inexistenteColidente = await app.inject({
        method: 'PUT',
        url: '/api/produtos/00000000-0000-0000-0000-000000000000',
        headers: auth,
        payload: { nome: 'X-Original' },
      });
      expect(inexistenteColidente.statusCode).toBe(404);
    });

    it('deve responder 409 ao atualizar produto para nome colidente de outro produto existente', async () => {
      await prisma.produto.create({ data: { nome: 'X-Bacon' } });
      const outro = await prisma.produto.create({ data: { nome: 'X-Salada' } });

      const colidente = await app.inject({
        method: 'PUT',
        url: `/api/produtos/${outro.id}`,
        headers: auth,
        payload: { nome: 'X Bacon' },
      });

      expect(colidente.statusCode).toBe(409);
      expect(colidente.json().message).toContain('Já existe um produto com nome equivalente cadastrado: "X-Bacon"');
      expect(colidente.json().produtoConflito.nome).toBe('X-Bacon');
    });

    it('deve deletar produto em cascata com suas fichas tecnicas (204)', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Remover' } });
      const insumo = await prisma.insumo.create({
        data: { nome: 'Molho Verde', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10 },
      });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 20 } });

      const res = await app.inject({ method: 'DELETE', url: `/api/produtos/${produto.id}`, headers: auth });
      expect(res.statusCode).toBe(204);

      expect(await prisma.produto.findUnique({ where: { id: produto.id } })).toBeNull();
      expect(await prisma.fichaTecnica.count({ where: { produtoId: produto.id } })).toBe(0);
      expect(await prisma.insumo.findUnique({ where: { id: insumo.id } })).not.toBeNull();
    });
  });

  describe('Fichas Técnicas API (/api/fichas-tecnicas)', () => {
    it('deve vincular insumo a produto (201) retornando objeto completo com insumo', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Bacon Cheddar' } });
      const insumo = await prisma.insumo.create({
        data: { nome: 'Bacon Tiras', unidade: 'Gramas', estoqueAtual: 200, estoqueMinimo: 20 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: {
          produtoId: produto.id,
          insumoId: insumo.id,
          quantidade: 40,
        },
      });

      expect(res.statusCode).toBe(201);
      const ficha = res.json();
      expect(ficha.id).toBeTypeOf('string');
      expect(ficha.quantidade).toBe(40);
      expect(ficha.insumo).toBeDefined();
      expect(ficha.insumo.nome).toBe('Bacon Tiras');
    });

    it('deve responder 404 ao vincular quando o produto nao existe', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Queijo', unidade: 'Unidade', estoqueAtual: 10, estoqueMinimo: 1 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: {
          produtoId: '00000000-0000-0000-0000-000000000000',
          insumoId: insumo.id,
          quantidade: 1,
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe('Produto não encontrado');
    });

    it('deve responder 404 ao vincular quando o insumo nao existe', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Queijo' } });

      const res = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: {
          produtoId: produto.id,
          insumoId: '00000000-0000-0000-0000-000000000000',
          quantidade: 1,
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe('Insumo não encontrado');
    });

    it('deve responder 409 ao vincular o mesmo insumo duas vezes no mesmo produto', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Duplo' } });
      const insumo = await prisma.insumo.create({
        data: { nome: 'Carne', unidade: 'Gramas', estoqueAtual: 300, estoqueMinimo: 30 },
      });

      const primeiro = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: { produtoId: produto.id, insumoId: insumo.id, quantidade: 160 },
      });
      expect(primeiro.statusCode).toBe(201);

      const duplicado = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: { produtoId: produto.id, insumoId: insumo.id, quantidade: 160 },
      });
      expect(duplicado.statusCode).toBe(409);
      expect(duplicado.json().message).toContain('já está cadastrado na ficha técnica');
    });

    it('deve rejeitar quantidade <= 0 na ficha tecnica com 400', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Zero' } });
      const insumo = await prisma.insumo.create({
        data: { nome: 'Pao', unidade: 'Unidade', estoqueAtual: 10, estoqueMinimo: 1 },
      });

      const zero = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: { produtoId: produto.id, insumoId: insumo.id, quantidade: 0 },
      });
      expect(zero.statusCode).toBe(400);

      const negativo = await app.inject({
        method: 'POST',
        url: '/api/fichas-tecnicas',
        headers: auth,
        payload: { produtoId: produto.id, insumoId: insumo.id, quantidade: -5 },
      });
      expect(negativo.statusCode).toBe(400);
    });

    it('deve listar fichas tecnicas por produto (200) ou 404 se produto nao existe', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'X-Master' } });
      const insumo1 = await prisma.insumo.create({
        data: { nome: 'Rúcula', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 5 },
      });
      const insumo2 = await prisma.insumo.create({
        data: { nome: 'Molho Chimi', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 5 },
      });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: insumo1.id, quantidade: 10 } });
      await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: insumo2.id, quantidade: 15 } });

      const res = await app.inject({
        method: 'GET',
        url: `/api/fichas-tecnicas/produto/${produto.id}`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      const itens = res.json();
      expect(itens.length).toBe(2);
      expect(itens[0].insumo.nome).toBe('Molho Chimi');
      expect(itens[1].insumo.nome).toBe('Rúcula');

      const inexistente = await app.inject({
        method: 'GET',
        url: '/api/fichas-tecnicas/produto/00000000-0000-0000-0000-000000000000',
        headers: auth,
      });
      expect(inexistente.statusCode).toBe(404);
    });

    it('deve atualizar quantidade da ficha tecnica (200)', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'Smash' } });
      const insumo = await prisma.insumo.create({
        data: { nome: 'Queijo', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 5 },
      });
      const ficha = await prisma.fichaTecnica.create({
        data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 20 },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/fichas-tecnicas/${ficha.id}`,
        headers: auth,
        payload: { quantidade: 35 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().quantidade).toBe(35);
      expect(res.json().insumo.nome).toBe('Queijo');

      const inexistente = await app.inject({
        method: 'PUT',
        url: '/api/fichas-tecnicas/00000000-0000-0000-0000-000000000000',
        headers: auth,
        payload: { quantidade: 35 },
      });
      expect(inexistente.statusCode).toBe(404);
    });

    it('deve deletar ficha tecnica (204) ou 404 se inexistente', async () => {
      const produto = await prisma.produto.create({ data: { nome: 'Smash 2' } });
      const insumo = await prisma.insumo.create({
        data: { nome: 'Queijo 2', unidade: 'Gramas', estoqueAtual: 50, estoqueMinimo: 5 },
      });
      const ficha = await prisma.fichaTecnica.create({
        data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 20 },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/fichas-tecnicas/${ficha.id}`,
        headers: auth,
      });
      expect(res.statusCode).toBe(204);

      const inexistente = await app.inject({
        method: 'DELETE',
        url: '/api/fichas-tecnicas/00000000-0000-0000-0000-000000000000',
        headers: auth,
      });
      expect(inexistente.statusCode).toBe(404);
    });
  });
});
