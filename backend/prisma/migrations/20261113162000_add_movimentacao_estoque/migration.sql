-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA_MANUAL', 'AJUSTE');

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "saldoAnterior" DOUBLE PRECISION NOT NULL,
    "saldoPosterior" DOUBLE PRECISION NOT NULL,
    "custoUnitario" DOUBLE PRECISION,
    "observacao" TEXT,
    "chaveIdempotencia" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movimentacoes_estoque_chaveIdempotencia_key" ON "movimentacoes_estoque"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_insumoId_criadoEm_idx" ON "movimentacoes_estoque"("insumoId", "criadoEm");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_criadoEm_idx" ON "movimentacoes_estoque"("criadoEm");

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
