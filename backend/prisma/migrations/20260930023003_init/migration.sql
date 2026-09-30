-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "fatorPerda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estoqueAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estoqueMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichas_tecnicas" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fichas_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "payloadOriginal" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fichas_tecnicas_produtoId_insumoId_key" ON "fichas_tecnicas"("produtoId", "insumoId");

-- AddForeignKey
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
