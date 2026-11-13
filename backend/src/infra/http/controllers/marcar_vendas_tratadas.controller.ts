import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MarcarVendasTratadasService } from '../../../modules/vendas/services/marcar_vendas_tratadas.service.js';
import { obterIntervaloDiaLoja, parsearDiaLoja } from '../../../shared/datas.js';

const marcarTratadasBodySchema = z.object({
  ate: z
    .string()
    .trim()
    .refine((valor) => parsearDiaLoja(valor, 'fim') !== null, {
      message: 'Data inválida; use o formato AAAA-MM-DD',
    })
    .refine(
      (valor) => {
        const fimInformado = parsearDiaLoja(valor, 'fim');
        if (!fimInformado) return true;
        const { fim: fimHojeLoja } = obterIntervaloDiaLoja(new Date());
        return fimInformado.getTime() <= fimHojeLoja.getTime();
      },
      { message: 'A data não pode ser futura' },
    ),
  motivo: z.string().trim().min(1, 'Motivo é obrigatório').max(500),
  simulacao: z.boolean().optional().default(false),
});

export class MarcarVendasTratadasController {
  async executar(request: FastifyRequest, reply: FastifyReply) {
    const body = marcarTratadasBodySchema.parse(request.body ?? {});
    const resultado = await new MarcarVendasTratadasService().executar({
      ...body,
      usuarioId: request.user.sub,
    });
    return reply.status(200).send(resultado);
  }
}
