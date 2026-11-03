/**
 * Normaliza o nome do produto para buscas e comparações resilientes a variações
 * como acentuação, maiúsculas/minúsculas e pontuações (ex.: "X-Bacon" -> "x bacon").
 */
export function normalizarNomeProduto(nome: string): string {
  if (!nome || typeof nome !== 'string') return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
