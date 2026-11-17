# 18 — Conferência visual e de uso real da Fase 4

- **Tipo:** test (verificação manual com evidência) · **Fase:** 4 · **Estado:** PENDENTE (por último)
- **Origem:** A conferência da [tarefa 06](realizadas/06-conferencia-visual-f4-f5-f6.md) foi **devolvida na revisão** por evidência errada (capturas "claro" em tema escuro, tela errada, banco vazio, checklist reescrito). Esta repete o método, corrigido.
- **Depende de:** frontend [09](09-vendas-retidas-tela.md), [10](10-estoque-abas-por-categoria.md) a [17](realizadas/17-relatorios-vendas-manuais.md) e backend [28](../backend/28-teste-ponta-a-ponta-fase3.md) concluídos
- **Branch sugerida:** `test/frontend-conferencia-fase4` (só o relatório e as evidências; correção vira tarefa nova)
- **Pasta de evidências:** `docs/tarefas/frontend/realizadas/evidencias-18/` (criar ao concluir)

## Contexto
A Fase 4 muda o jeito de operar a loja: o estoque passa a ser lançado à mão (entrada sem nota) e baixado por fechamento manual. Erro aqui vira estoque errado de verdade. Testes automáticos não pegam tela escura no lugar da clara, número fora de lugar nem fluxo confuso no celular.

## Problema
Na tarefa 06, a revisão encontrou: PNGs rotulados "claro" com fundo escuro; "período personalizado" que mostrava outra tela; Início e Relatórios com banco vazio (a tela não provava o que a tabela dizia); armazenamento bloqueado sem prova; itens da tarefa trocados por um checklist mais fácil; e um erro real (`415` no logout) classificado como "esperado". Nada disso pode se repetir.

## Regras da conferência (obrigatórias)
1. **Dados reais, não banco vazio.** Montar o cenário por script no scratchpad (sem alterar `seed.ts`): insumos das 3 categorias com alguns em alerta, um negativo, produtos com e sem ficha, perdas com **custo por unidade de medida** (R$/g, nunca R$/kg), vendas e fechamentos manuais (um estornado), entradas manuais com histórico, uma venda retida. Nunca no banco `_test`.
2. **Tema provado por medição.** Forçar o tema pela tela de Configurações e conferir `document.documentElement`; **medir a cor de fundo de cada PNG** e registrar na tabela (claro ≈ `#fff9f3`, escuro ≈ `#0f0f11`). PNG cujo fundo não bate com o rótulo é refeito.
3. **Tabela original, item por item**: ✅, ❌ ou **NÃO VERIFICADO** (com o motivo), cada um com captura. Nada some da tabela. Cada ❌ vira **uma tarefa nova** (`NN-slug.md`) — não corrigir no PR de conferência.
4. **Console por tela** registrado (`console.md`), dizendo se houve erro. Erro inesperado (como status `4xx/5xx` numa ação normal) é investigado, não classificado como "esperado" sem causa.
5. **Celular real em `http://IP` e `https://IP`** (a chave de idempotência e a câmera dependem de contexto seguro).
6. Larguras 375×812 e 1280×800, tema claro e escuro.

## O que conferir (cada linha: ✅/❌/NÃO VERIFICADO + captura)
| Tela | Pontos |
|---|---|
| Estoque (abas) | 4 abas sem rolagem horizontal; selo de alerta por aba; busca só da aba; estado vazio; troca de categoria move o item |
| Cadastro de insumo | rádio de categoria vem da aba; Beneficiado/Validade somem em embalagem e bebida; erro `400` mantém o Sheet |
| Entrada manual | várias linhas; vírgula decimal; alternar kg/g e custo R$/kg → R$/g mostrado; insumo repetido bloqueado; `avisos` de custo suspeito; resultado "10 → 34"; duplo toque faz uma chamada; reenvio após falha usa a mesma chave |
| Histórico de movimentações | 20 mais recentes, "Carregar mais", usuário removido, fuso da loja |
| Fechamento do dia: formulário | atalho no Início; data sem futuro; +/− e digitação; limites 0–500; busca |
| Fechamento: impacto | negativo em destaque (cor **e** texto); produto sem ficha bloqueia; impacto vira obsoleto ao editar |
| Fechamento: confirmação | diálogo com resumo; duplo toque; falha de rede e reenvio; replay com mensagem neutra; sucesso com negativos |
| Fechamento: estorno e lista | motivo obrigatório; saldos voltam **exatamente**; lista do dia com autor, selo "Estornado" e aviso de "já existe fechamento" |
| Relatórios e Início | linha "lançados no fechamento do dia"; totais batem com o backend |
| Vendas retidas (tarefa 09) | alerta, resumo por produto, atalho para corrigir |
| Regressão geral | Login, logout/novo login limpo, Perfil/Configurações, nota fiscal (passos 1 a 3), armazenamento bloqueado |

## Critério de pronto
- [ ] Tabela completa (nenhum item removido), com captura por item e a **medição de fundo** de cada PNG numa tabela anexa.
- [ ] `console.md` das telas visitadas; qualquer status inesperado investigado.
- [ ] Conferência de ponta a ponta feita **no celular real**, em HTTP e HTTPS.
- [ ] Um fechamento real: estoque antes → baixa → estorno → estoque depois, valores anotados e iguais.
- [ ] Tarefas novas criadas para cada ❌; linha marcada `FEITA (#PR)` e arquivo movido para `realizadas/`.

## Fora do escopo
Corrigir os defeitos encontrados (uma tarefa por defeito), testes de carga.
