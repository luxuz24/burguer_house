/**
 * Acesso ao localStorage que nunca lança.
 *
 * Em aba anônima de alguns navegadores, com cookies/dados de site bloqueados ou com a cota cheia,
 * qualquer chamada ao localStorage lança (SecurityError/QuotaExceededError). Sem proteção isso
 * derrubava o app no primeiro render. Quando o navegador recusa, o valor fica numa cópia em memória
 * e vale até a aba fechar.
 */
const emMemoria = new Map<string, string>();

export function lerArmazenado(chave: string): string | null {
  try {
    const valor = localStorage.getItem(chave);
    if (valor !== null) return valor;
  } catch {
    // armazenamento indisponível: cai na cópia em memória
  }
  return emMemoria.get(chave) ?? null;
}

export function gravarArmazenado(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor);
    emMemoria.delete(chave);
  } catch {
    emMemoria.set(chave, valor);
    // Cota cheia com um valor antigo gravado: remove para a leitura não devolver o valor velho
    try {
      localStorage.removeItem(chave);
    } catch {
      // armazenamento bloqueado: nada a remover
    }
  }
}

export function removerArmazenado(chave: string): void {
  emMemoria.delete(chave);
  try {
    localStorage.removeItem(chave);
  } catch {
    // armazenamento bloqueado: a cópia em memória já foi removida
  }
}

/** Só para testes: esquece a cópia em memória entre um teste e outro. */
export function limparArmazenamentoEmMemoria(): void {
  emMemoria.clear();
}
