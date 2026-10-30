import type { FastifyReply, FastifyRequest } from 'fastify';

interface Opcoes {
  max: number;
  janelaMs: number;
  /** Chave de contagem; padrão: IP. Ex.: id do usuário autenticado (precisa rodar depois da autenticação). */
  chave?: (request: FastifyRequest) => string;
}

/**
 * Limitador de requisições por IP em memória (janela fixa), sem dependências.
 * Suficiente para uma única instância (plano gratuito); o contador zera se o processo reiniciar/hibernar.
 * Atrás de proxy (Koyeb etc.) defina TRUST_PROXY=true para que request.ip seja o IP real do cliente.
 */
export function criarRateLimit({ max, janelaMs, chave = (request) => request.ip }: Opcoes) {
  const janelas = new Map<string, { inicio: number; contagem: number }>();

  return async function rateLimit(request: FastifyRequest, reply: FastifyReply) {
    const agora = Date.now();

    if (janelas.size > 10_000) {
      for (const [chave, j] of janelas) if (agora - j.inicio >= janelaMs) janelas.delete(chave);
    }

    const id = chave(request);
    const atual = janelas.get(id);
    if (!atual || agora - atual.inicio >= janelaMs) {
      janelas.set(id, { inicio: agora, contagem: 1 });
      return;
    }

    atual.contagem += 1;
    if (atual.contagem > max) {
      const retryAfter = Math.ceil((atual.inicio + janelaMs - agora) / 1000);
      return reply
        .status(429)
        .header('Retry-After', String(retryAfter))
        .send({ message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
  };
}
