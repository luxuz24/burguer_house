# Plano Mestre de Endurecimento e Prontidão para Produção — Burguer House

Este documento consolida o plano completo de revisão técnica, endurecimento defensivo e preparação para produção de todo o sistema **Burguer House**.

---

## 🎯 Tese Central

> **"O payload real do Anota AI afeta exclusivamente a borda de ingestão (webhook $\rightarrow$ venda $\rightarrow$ consolidação $\rightarrow$ baixa de estoque). Todo o restante do sistema (notas fiscais, perdas, preparo interno, cadastros e dashboard) deve ser blindado e homologado para produção antes do payload real chegar."**

Quando o payload real chegar no período de testes da Anota AI, o esforço deve se limitar a:
1. Salvar o JSON real como fixture em `fixtures/anotaai/*.json`.
2. Ajustar um único arquivo: o **`AnotaAIAdapter`**.
3. Rodar a ferramenta de **replay offline** e constatar 100% de sucesso nos testes, sem necessidade de reescrever lógica interna de estoque ou abrir novos ciclos de revisão estrutural.

---

## ⚠️ Diagnóstico Crítico: Falhas Silenciosas no Fluxo de Vendas Atual

Na inspeção de `consolidacao.service.ts` e `estado_pedido.ts`, foram identificadas vulnerabilidades que causam **falhas silenciosas**:

### Problemas Mapeados:
1. **Produto não encontrado descarta a baixa para sempre:** A venda é marcada como `processado: true` logo no início da transação. Se um item tiver nome não cadastrado, ele entra em `produtosNaoEncontrados`, mas a venda é considerada concluída e o estoque **nunca é corrigido**.
2. **Matching frágil por string:** A busca compara `item.nome.trim().toLowerCase()`. Qualquer variação de acentuação, espaço ou pontuação ("X-Bacon" vs. "X Bacon", "Coca-Cola" vs. "Coca Cola") causa descarte silencioso do item.
3. **Venda sem itens é consumida:** Se o payload real usar outro campo para a lista de itens, todas as vendas são marcadas como processadas sem dar baixa de nenhum insumo.
4. **Ausência de `check` assume 'abater':** Se o payload não trouxer o campo `check` (ou vier em propriedade diferente), o código assume `abater`, correndo o risco de abater pedidos cancelados ou rejeitados.
5. **Reenvios sem ID duplicam vendas:** Se o webhook não contiver um identificador mapeado em `extrairIdExterno`, cada reenvio da Anota AI gera um novo registro de venda.

> **Regra de Ouro da Produção:** Na dúvida, a venda **permanece pendente** com alerta visível no painel e motivo registrado (`STATUS_DESCONHECIDO`, `ITEM_NAO_MAPEADO`). Nenhuma venda é consumida no escuro.

---

## 📊 Matriz de Risco do Código (Backend & Frontend)

| Módulo / Arquivo | Linhas | Classificação | Nível de Risco | Motivo do Risco |
| :--- | :---: | :---: | :---: | :--- |
| **Vendas & Webhook** (`consolidacao`, `webhook`, `extrair_*`) | ~650 | Escrita / Estoque | 🔴 **CRÍTICO** | Ingestão externa, concorrência batch, falhas silenciosas de matching |
| **Notas Fiscais** (`xml_parser`, `qrcode_parser`, `safe_fetch`, `entrada_estoque`) | ~850 | Escrita / Estoque | 🔴 **CRÍTICO** | Parser XML externo complexo, download via rede (risco SSRF), cálculo de conversão de unidades e custos |
| **Preparo Interno & Perdas** (`producao.service`, `perdas.service`) | ~400 | Escrita / Estoque | 🟡 **ALTO** | Baixa e entrada simultâneas em transação atômica, estoque negativo |
| **Auth & Sessão** (`auth.service`, `auth.guard`, `usuarios.repo`) | ~450 | Segurança | 🟢 **BLINDADO** | Validado e coberto em 4 PRs (#36, #37, #38, #39) com 100% de testes |
| **Cadastros** (`insumos`, `produtos`, `fichas_tecnicas`) | ~600 | CRUD / Regra | 🟡 **MÉDIO** | Integridade referencial, deleção em cascata, fator de perda |
| **Dashboard & Relatórios** (`dashboard.service`) | ~370 | Leitura | 🟢 **BAIXO** | Agregações SQL e performance em leitura |
| **Frontend - Contextos & Modais** | ~1.200 | Interface / Estado | 🟡 **MÉDIO** | Interceptors assíncronos, formulários de baixa e importação |

---

## 🗺️ Roadmap de Execução (Fases 0 a 5)

### Fase 0: Linha de Base e Métricas de Prontidão
- [x] Testes unitários e de integração verdes (Backend: 288/288, Frontend: 4/4).
- [ ] Configuração do **Stryker** para rodar nos demais módulos de serviço (`vendas`, `notas_fiscais`, `preparo_interno`).
- [ ] Definição do **Critério de Pronto (DoD)**:
  - 100% dos testes passando.
  - Zero tolerância a erros no TypeScript (`tsc --noEmit`).
  - Testes de concorrência e transação com banco de testes real.
  - Mutação (Stryker) acima de 85% nos serviços de escrita.

### Fase 1: Arquitetura Defensiva de Vendas (Prioridade Máxima)
1. **Unificação no `AnotaAIAdapter` (`anotaai.adapter.ts`):**
   - Substituir os três extratores esparsos por um adaptador com saída tipada estrita.
2. **Eliminação de Descartes Silenciosos:**
   - Se um produto não for encontrado ou uma venda não trouxer itens válidos:
     - A venda **permanece com `processado: false`**.
     - É preenchido `motivoPendencia` (ex.: `'PRODUTO_NAO_ENCONTRADO: X-Tudo'`).
     - Alerta exposto no retorno da consolidação e na API para o operador resolver no cardápio.
3. **Mapeamento por Código Externo (`Produto.codigoExterno`):**
   - Suporte a ligar o item pelo ID único do Anota AI, mantendo o nome normalizado como fallback tolerante a acentos e pontuação.
4. **Ferramenta de Replay Offline (`scripts/replay-vendas.ts`):**
   - Script para simular a consolidação sobre os payloads salvos em `Venda.payloadOriginal` em modo dry-run, imprimindo o espelho do que seria descontado do estoque físico.
5. **Suíte de Fixtures de Contrato (`fixtures/anotaai/*.json`):**
   - Testes cobrindo: pedido aceito, pedido cancelado após aceite, reenvio com ID duplicado, pedido com modificadores (sub-itens) e payload malformado.

### Fase 2: Endurecimento dos Módulos Independentes
Um PR focado por módulo, seguindo a metodologia `module-hardening`:
1. **`notas_fiscais`:**
   - Revisão defensiva do `xml_parser.ts` (463 linhas).
   - Validação estrita de URLs de QR Code (`safe_fetch.ts`) e proteção robusta contra SSRF e DNS rebinding.
   - Idempotência rigorosa de entrada de estoque baseada na chave de acesso de 44 dígitos.
2. **`preparo_interno` + `perdas`:**
   - Validação atômica de transação com rollback garantido em falhas de estoque insuficiente.
   - Integridade de auditoria dos registros de perdas com custo unitário real.
3. **`insumos`, `produtos`, `fichas_tecnicas`:**
   - Garantia de unicidade de nomes (case-insensitive e sem acentos).
   - Tratamento de exclusão e integridade referencial com fichas multi-nível.
4. **`dashboard`:**
   - Otimização de agregações SQL diretas e consistência numérica entre relatórios diários e mensais.

### Fase 3: Transversais e Governança Técnica
- **Precisão Numérica de Estoque:** Avaliar transição de `Float` para `Decimal` nos saldos de insumos para evitar deriva cumulativa de ponto flutuante.
- **RBAC Ativo:** Aplicação do middleware `exigirRole(Role.ADMIN)` nas rotas sensíveis.
- **Higiene HTTP e Resiliência:** `bodyLimit` explícito no Fastify, encerramento gracioso do processo.

### Fase 4: Preparação de Infraestrutura e Prontidão de Produção
- Configuração de banco Neon e deploy no Koyeb com `TRUST_PROXY=1`.
- Configuração do workflow de aquecimento agendado (`cron.yml`) às 17:50 para mitigar cold starts.
- Alertas automatizados para webhooks com status 500 ou pendências persistentes de consolidação.
- Runbook operacional de contingência documentado.

### Fase 5: Integração Real da Anota AI (Quando o Payload Chegar)
1. Ativação do webhook no ambiente de homologação (modo sombra: grava o payload bruto sem consolidar).
2. Exportação de payloads reais para a pasta de fixtures.
3. Execução do replay offline contra o `AnotaAIAdapter`.
4. Validação do reconciliamento físico do estoque durante os primeiros 7 dias de operação assistida.
