-- AlterTable
ALTER TABLE "vendas" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vendas_externalId_key" ON "vendas"("externalId");
