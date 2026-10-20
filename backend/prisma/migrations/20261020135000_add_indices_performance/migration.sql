-- CreateIndex
CREATE INDEX "vendas_processado_criadoEm_idx" ON "vendas"("processado", "criadoEm");

-- CreateIndex
CREATE INDEX "perdas_criadoEm_idx" ON "perdas"("criadoEm");

-- CreateIndex
CREATE INDEX "perdas_insumoId_idx" ON "perdas"("insumoId");

-- CreateIndex
CREATE INDEX "notas_fiscais_dataEmissao_idx" ON "notas_fiscais"("dataEmissao");

-- CreateIndex
CREATE INDEX "itens_nota_fiscal_notaFiscalId_idx" ON "itens_nota_fiscal"("notaFiscalId");

-- CreateIndex
CREATE INDEX "itens_nota_fiscal_insumoId_idx" ON "itens_nota_fiscal"("insumoId");

-- CreateIndex
CREATE INDEX "itens_nota_fiscal_descricaoOriginal_criadoEm_idx" ON "itens_nota_fiscal"("descricaoOriginal", "criadoEm");
