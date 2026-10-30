-- Preenche perdas existentes que estão com custo 0 com o custo histórico atual do insumo correspondente
UPDATE "perdas"
SET "custoUnitario" = "insumos"."custoUnitario"
FROM "insumos"
WHERE "perdas"."insumoId" = "insumos"."id"
  AND "perdas"."custoUnitario" = 0
  AND "insumos"."custoUnitario" > 0;
