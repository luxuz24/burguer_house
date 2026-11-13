import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebhookController } from './webhook.controller.js';
import { prisma } from '../../database/prisma.js';

describe('WebhookController — log em modo sombra', () => {
  beforeEach(async () => {
    await prisma.venda.deleteMany().catch(() => {});
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await prisma.venda.deleteMany().catch(() => {});
  });

  it('emite log info com externalId, check e totalItens sem vazar dados pessoais do cliente quando ANOTAAI_MODO_SOMBRA=true', async () => {
    vi.stubEnv('ANOTAAI_WEBHOOK_SECRET', 'segredo-webhook-teste');
    vi.stubEnv('ANOTAAI_MODO_SOMBRA', 'true');

    const info = vi.fn();
    const request = {
      headers: { 'x-webhook-secret': 'segredo-webhook-teste' },
      query: {},
      body: {
        id: 'ped-sombra-log-1',
        check: 1,
        customer: { name: 'João Privado', phone: '67999990000', address: 'Rua Secreta 123' },
        info: {
          items: [
            { externalId: 'i1', name: 'Bacon House', quantity: 2, price: 34.9 },
            { externalId: 'i2', name: 'Coca-Cola', quantity: 1, price: 8 },
          ],
        },
      },
      log: { info, warn: vi.fn(), error: vi.fn() },
    } as any;

    const status = vi.fn().mockReturnThis();
    const send = vi.fn().mockReturnThis();
    const reply = { status, send } as any;

    await new WebhookController().receberAnotaAi(request, reply);

    expect(status).toHaveBeenCalledWith(200);
    expect(info).toHaveBeenCalledTimes(1);
    const [payloadLog] = info.mock.calls[0];
    expect(payloadLog).toEqual({
      modoSombra: true,
      externalId: 'ped-sombra-log-1',
      check: 1,
      totalItens: 2,
    });
    const serializado = JSON.stringify(info.mock.calls);
    expect(serializado).not.toContain('João Privado');
    expect(serializado).not.toContain('67999990000');
    expect(serializado).not.toContain('Rua Secreta');
  });
});
