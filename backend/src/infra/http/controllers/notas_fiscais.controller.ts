import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { XmlParserService } from '../../../modules/notas_fiscais/services/xml_parser.service.js';
import { EntradaEstoqueService } from '../../../modules/notas_fiscais/services/entrada_estoque.service.js';
import { QrcodeParserService } from '../../../modules/notas_fiscais/services/qrcode_parser.service.js';

const parseXmlSchema = z.object({
  xml: z.string().min(1, 'O conteúdo XML da nota é obrigatório'),
});

const parseQrcodeSchema = z.object({
  urlOuChave: z.string().min(1, 'A URL ou Chave do QR Code é obrigatória'),
});

const confirmarEntradaSchema = z.object({
  chaveAcesso: z.string().optional(),
  numero: z.string().optional(),
  serie: z.string().optional(),
  fornecedorNome: z.string().optional(),
  fornecedorCnpj: z.string().optional(),
  valorTotal: z.number().optional(),
  dataEmissao: z.string().optional(),
  itens: z.array(
    z.object({
      insumoId: z.string().uuid('ID de insumo inválido'),
      quantidade: z.number().positive('A quantidade deve ser maior que zero'),
      valorUnitario: z.number().optional(),
      descricaoOriginal: z.string().optional(),
      unidadeOriginal: z.string().optional(),
      quantidadeOriginal: z.number().optional(),
      valorTotal: z.number().optional(),
    })
  ).min(1, 'Selecione ao menos um item para confirmar a entrada no estoque'),
});

export class NotasFiscaisController {
  async listar(request: FastifyRequest, reply: FastifyReply) {
    try {
      const service = new EntradaEstoqueService();
      const notas = await service.listarNotasFiscais();
      return reply.send(notas);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        message: 'Erro ao listar notas fiscais',
      });
    }
  }

  async parseXml(request: FastifyRequest, reply: FastifyReply) {
    const parsed = parseXmlSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Dados inválidos',
        issues: parsed.error.issues,
      });
    }

    try {
      const service = new XmlParserService();
      const resultado = await service.parse(parsed.data.xml);
      return reply.send(resultado);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({
        message: error.message || 'Erro ao processar o arquivo XML da nota fiscal',
      });
    }
  }

  async parseQrcode(request: FastifyRequest, reply: FastifyReply) {
    const parsed = parseQrcodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Dados inválidos para leitura do QR Code',
        issues: parsed.error.issues,
      });
    }

    try {
      const service = new QrcodeParserService();
      const resultado = await service.processarQrCode(parsed.data.urlOuChave);
      return reply.send(resultado);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({
        message: error.message || 'Erro ao processar QR Code da NFC-e',
      });
    }
  }

  async confirmar(request: FastifyRequest, reply: FastifyReply) {
    const parsed = confirmarEntradaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Dados de confirmação inválidos',
        issues: parsed.error.issues,
      });
    }

    try {
      const service = new EntradaEstoqueService();
      const resultado = await service.confirmarEntrada(parsed.data);
      return reply.send(resultado);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({
        message: error.message || 'Erro ao confirmar entrada de estoque da nota fiscal',
      });
    }
  }
}
