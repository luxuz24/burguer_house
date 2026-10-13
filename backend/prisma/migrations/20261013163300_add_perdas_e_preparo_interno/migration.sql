-- CreateEnum
CREATE TYPE "MotivoPerda" AS ENUM ('VENCIMENTO', 'ERRO_PREPARO', 'ESTRAGADO', 'OUTRO');

-- AlterTable
ALTER TABLE "insumos" ADD COLUMN     "produzidoInternamente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validadeDias" INTEGER;

-- CreateTable
CREATE TABLE "perdas" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "motivo" "MotivoPerda" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perdas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_fichas_tecnicas" (
    "id" TEXT NOT NULL,
    "insumoBeneficiadoId" TEXT NOT NULL,
    "insumoBrutoId" TEXT NOT NULL,
    "quantidadeNecessaria" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_fichas_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sub_fichas_tecnicas_insumoBeneficiadoId_insumoBrutoId_key" ON "sub_fichas_tecnicas"("insumoBeneficiadoId", "insumoBrutoId");

-- AddForeignKey
ALTER TABLE "perdas" ADD CONSTRAINT "perdas_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_fichas_tecnicas" ADD CONSTRAINT "sub_fichas_tecnicas_insumoBeneficiadoId_fkey" FOREIGN KEY ("insumoBeneficiadoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_fichas_tecnicas" ADD CONSTRAINT "sub_fichas_tecnicas_insumoBrutoId_fkey" FOREIGN KEY ("insumoBrutoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
