export type CategoriaInsumo = 'INGREDIENTE' | 'EMBALAGEM' | 'BEBIDA';

export type AbaEstoque = 'insumos' | 'embalagens' | 'bebidas' | 'produtos';

export function categoriaDoInsumo(insumo: { categoria?: string | null }): CategoriaInsumo {
  if (insumo.categoria === 'EMBALAGEM' || insumo.categoria === 'BEBIDA') {
    return insumo.categoria;
  }
  return 'INGREDIENTE';
}
