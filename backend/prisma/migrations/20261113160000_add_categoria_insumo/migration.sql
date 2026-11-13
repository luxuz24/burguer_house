-- CreateEnum
CREATE TYPE "CategoriaInsumo" AS ENUM ('INGREDIENTE', 'EMBALAGEM', 'BEBIDA');

-- AlterTable
ALTER TABLE "insumos" ADD COLUMN     "categoria" "CategoriaInsumo" NOT NULL DEFAULT 'INGREDIENTE';

-- Backfill categorias de bebidas (8) e embalagens (5); demais permanecem INGREDIENTE
UPDATE "insumos"
SET "categoria" = 'BEBIDA'
WHERE lower("nome") IN (
  'coca cola zero 350ml',
  'coca cola original 350ml',
  'coca cola 600ml',
  'coca cola zero 600ml',
  'agua com gás',
  'agua sem gás',
  'heineken long neck',
  'coca litro'
);

UPDATE "insumos"
SET "categoria" = 'EMBALAGEM'
WHERE lower("nome") IN (
  'papel acoplado',
  'embalagem de molho (potinho)',
  'palito de madeira',
  'embalagem de batata',
  'saco kraft delivery'
);
