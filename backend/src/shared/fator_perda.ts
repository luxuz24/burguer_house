/**
 * Normaliza o fator de perda de um insumo para que valores negativos, nulos
 * ou não finitos nunca reduzam o consumo teórico calculado.
 */
export function fatorPerdaSeguro(valor: number | null | undefined): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return 0;
  }
  return valor;
}
