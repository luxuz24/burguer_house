-- CreateEnum
CREATE TYPE "OrigemVenda" AS ENUM ('WEBHOOK', 'MANUAL');

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "origem" "OrigemVenda" NOT NULL DEFAULT 'WEBHOOK',
ADD COLUMN     "registradoPorId" TEXT;

-- Backfill ocorridoEm com o instante original de criação para vendas históricas
UPDATE "vendas" SET "ocorridoEm" = "criadoEm";

-- CreateIndex
CREATE INDEX "vendas_ocorridoEm_idx" ON "vendas"("ocorridoEm");

-- CreateIndex
CREATE INDEX "vendas_origem_ocorridoEm_idx" ON "vendas"("origem", "ocorridoEm");

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
