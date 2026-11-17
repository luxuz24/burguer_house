/**
 * Chave de idempotência (UUID v4, 36 caracteres) para entradas e fechamentos: reenviar a mesma chave não repete a baixa.
 * `crypto.randomUUID` só existe em contexto seguro (HTTPS/localhost); no celular por http://IP cai para
 * `getRandomValues` e, por último, para Math.random (a chave só precisa ser única, não secreta).
 */
export function gerarChaveIdempotencia(): string {
  const c = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
