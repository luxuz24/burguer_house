import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  FichasTecnicasRepository,
  ProdutoNaoEncontradoError,
  InsumoNaoEncontradoError,
  ItemFichaJaExisteError,
} from '../../../modules/fichas_tecnicas/repositories/fichas_tecnicas.repository.js';

const criarFichaSchema = z.object({
  produtoId: z.string().uuid('ID de produto inválido'),
  insumoId: z.string().uuid('ID de insumo inválido'),
  quantidade: z.number().positive('A quantidade deve ser maior que zero'),
});
const atualizarFichaSchema = z.object({
  quantidade: z.number().positive('A quantidade deve ser maior que zero'),
});
const produtoParamSchema = z.object({ produtoId: z.string().uuid('ID de produto inválido') });
const idParamSchema = z.object({ id: z.string().uuid('ID inválido') });

export class FichasTecnicasController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const data = criarFichaSchema.parse(request.body);
    try {
      const ficha = await new FichasTecnicasRepository().criar(data);
      return reply.status(201).send(ficha);
    } catch (err) {
      if (err instanceof ProdutoNaoEncontradoError || err instanceof InsumoNaoEncontradoError) {
        return reply.status(404).send({ message: err.message });
      }
      if (err instanceof ItemFichaJaExisteError) {
        return reply.status(409).send({ message: err.message });
      }
      throw err;
    }
  }

  async atualizar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const data = atualizarFichaSchema.parse(request.body);
    const ficha = await new FichasTecnicasRepository().atualizar(id, data);
    return reply.send(ficha);
  }

  async listarPorProduto(request: FastifyRequest, reply: FastifyReply) {
    const { produtoId } = produtoParamSchema.parse(request.params);
    try {
      const itens = await new FichasTecnicasRepository().listarPorProduto(produtoId);
      return reply.send(itens);
    } catch (err) {
      if (err instanceof ProdutoNaoEncontradoError) {
        return reply.status(404).send({ message: err.message });
      }
      throw err;
    }
  }

  async deletar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await new FichasTecnicasRepository().deletar(id);
    return reply.status(204).send();
  }
}
