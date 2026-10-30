/**
 * Interpreta TRUST_PROXY para o Fastify.
 *  - número (ex.: "1"): quantidade de proxies confiáveis à frente da API; request.ip vem do X-Forwarded-For
 *    contando a partir da direita, então o cliente não consegue forjar o IP (recomendado).
 *  - "true": confia em todo o X-Forwarded-For (o primeiro valor é controlado pelo cliente: dá para burlar o rate limit).
 *  - ausente/outro valor: não confia em proxy (usa o IP da conexão).
 */
export type TrustProxy = boolean | ((address: string, hop: number) => boolean);

export function resolverTrustProxy(valor: string | undefined): TrustProxy {
  const v = (valor ?? '').trim();
  // Equivale ao modo numérico do proxy-addr: confia nos N saltos mais próximos (hop 0 = conexão direta).
  if (/^\d+$/.test(v)) {
    const confiaveis = Number(v);
    return (_address, hop) => hop < confiaveis;
  }
  return v === 'true';
}
