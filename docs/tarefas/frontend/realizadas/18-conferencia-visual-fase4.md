# 18 — Conferência visual e de uso real da Fase 4

- **Tipo:** test (verificação manual com evidência) · **Fase:** 4 · **Estado:** FEITA (#127)
- **Origem:** A conferência da [tarefa 06](06-conferencia-visual-f4-f5-f6.md) foi **devolvida na revisão** por evidência errada (capturas "claro" em tema escuro, tela errada, banco vazio, checklist reescrito). Esta repete o método, corrigido.
- **Depende de:** frontend [09](09-vendas-retidas-tela.md), [10](10-estoque-abas-por-categoria.md) a [17](17-relatorios-vendas-manuais.md), [20](20-saida-em-quantidade-sem-faturamento.md), [21](21-contagem-estoque-tela.md), [22](22-usuarios-tela.md) e backend [28](../../backend/realizadas/28-teste-ponta-a-ponta-fase3.md) concluídos
- **Branch sugerida:** `test/frontend-conferencia-fase4` (só o relatório e as evidências; correção vira tarefa nova)
- **Pasta de evidências:** [`evidencias-18/`](evidencias-18/)

## Contexto
A Fase 4 muda o jeito de operar a loja: o estoque passa a ser lançado à mão (entrada sem nota), contado na prateleira (ajuste por contagem física) e baixado por fechamento manual, além da gestão de usuários pelo admin. Erro aqui vira estoque errado de verdade. Testes automáticos não pegam tela escura no lugar da clara, número fora de lugar nem fluxo confuso no celular.

## Problema
Na tarefa 06, a revisão encontrou: PNGs rotulados "claro" com fundo escuro; "período personalizado" que mostrava outra tela; Início e Relatórios com banco vazio (a tela não provava o que a tabela dizia); armazenamento bloqueado sem prova; itens da tarefa trocados por um checklist mais fácil; e um erro real (`415` no logout) classificado como "esperado". Nada disso pode se repetir.

## Regras da conferência (obrigatórias)
1. **Dados reais, não banco vazio.** Cenário montado via HTTP API (`http://localhost:3000/api`) no banco de desenvolvimento (sem SQL direto, sem tocar no banco `_test`, sem alterar `seed.ts`): insumos das 3 categorias (incluindo alertas e saldo negativo em `Maionese da Casa - Beneficiado`), produtos com e sem ficha técnica (`Milkshake Pistache (Sem Ficha)`), perda com **custo por unidade de medida** (`Carne de Hambúrguer`: `200 g` a `R$ 0,0349/g`), entradas manuais (55 lançamentos em `Palito de madeira` para paginação >50 + entrada manual em `kg→g`), venda retida (`ped-retido-conf18`), fechamento estornado e fechamento ativo, além de usuários `GERENTE` e `OPERADOR`.
2. **Tema provado por medição.** Tema forçado pelo modal **Configurações** (`Claro` / `Escuro`), conferindo `document.documentElement.classList.contains('dark')` e **medindo a cor de fundo por decodificação de pixel RGB/Hex** em cada um dos **70 PNGs** (Claro: canvas `#fff9f3`, fundo externo desktop `#f3f4f6`, Sheet `#ffffff`; Escuro: canvas `#0f0f11`, fundo externo desktop `#030712`, Sheet `#1a1a1d`).
3. **Tabela original, item por item**: ✅, ❌ ou **NÃO VERIFICADO** (com o motivo), cada um com captura. Escopo atualizado com **Contagem de estoque (21)** e **Usuários (22)** sem remover nenhum item da tabela original.
4. **Console e rede registrados** em [`evidencias-18/console.md`](evidencias-18/console.md): `0` exceções `pageerror` e todas as respostas `>= 400` classificadas com causa exata.
5. **Celular real em `http://IP` e `https://IP`**: o ambiente automatizado não tem aparelho físico; a conferência no telefone foi feita **pelo humano em 17/11/2026** (HTTP `:5173` e HTTPS `:5174`) e encontrou **2 ❌**, registrados na tabela e convertidos nas tarefas [23](23-scanner-voltar-mobile.md) e [24](24-entrada-manual-busca-insumo.md).
6. Larguras `375×812` e `1280×800`, tema claro e escuro, com `scrollWidth <= clientWidth` validado em todas as capturas.

---

## O que conferir (tabela completa — 13 áreas)

| Tela | Pontos e resultado item a item | Evidências (PNGs) |
|---|---|---|
| Estoque (abas) | **4 abas sem rolagem horizontal ✅** (`375×812` e `1280×800`, Claro e Escuro, `scrollWidth <= clientWidth`); **selo de alerta por aba ✅** (`Insumos 7`, `Embalagens 1`, `Bebidas 1`); **busca só da aba ✅** (buscar `Sacola` na aba `Insumos` não mistura com `Embalagens`); **estado vazio ✅** (`Nenhum insumo encontrado`); **troca de categoria move o item ✅** (`Sacola Kraft Extra (Conf18)`: `Embalagens` → `Bebidas` com toast `"Movido para Bebidas."` e restauração para `Embalagens`) | [`01a`](evidencias-18/01a_estoque_abas_375_claro.png), [`01b`](evidencias-18/01b_estoque_abas_375_escuro.png), [`01c`](evidencias-18/01c_estoque_abas_1280_claro.png), [`01d`](evidencias-18/01d_estoque_abas_1280_escuro.png), [`01e`](evidencias-18/01e_estoque_busca_aba_375_claro.png), [`01f`](evidencias-18/01f_estoque_estado_vazio_375_claro.png), [`01g`](evidencias-18/01g_estoque_troca_categoria_375_claro.png) |
| Cadastro de insumo | **rádio de categoria vem da aba ✅** (ao abrir `Novo insumo` na aba `Embalagens`, `Embalagem` já vem marcado); **Beneficiado/Validade somem em embalagem e bebida ✅** (e reaparecem ao trocar rádio para `Ingrediente`); **erro `400` mantém o Sheet ✅** (`Mínimo Seguro = -5` exibe erro do servidor e preserva campos preenchidos sem fechar o Sheet) | [`02a`](evidencias-18/02a_cadastro_insumo_embalagem_375_claro.png), [`02b`](evidencias-18/02b_cadastro_insumo_ingrediente_375_claro.png), [`02c`](evidencias-18/02c_cadastro_insumo_erro400_375_claro.png) |
| Entrada manual (15) | **várias linhas ✅** (2 itens no envio); **vírgula decimal ✅** (`1,5`); **alternar kg/g e custo R$/kg → R$/g mostrado ✅** (`equivale a 1500 g` e `R$ 15,00/kg = R$ 0,015/g`); **insumo repetido bloqueado ✅** (`option` desabilitado na linha 2); **`avisos` de custo suspeito ✅** (`Palito de madeira: o novo custo (50) é mais de 10× diferente do atual (0.1)`); **resultado "saldo X → Y" ✅** (`9.500 → 11.000 g` e `561 → 563 un`); **duplo toque faz uma chamada ✅** (apenas 1 `POST` por confirmação); **reenvio após falha usa a mesma chave ✅** (`chavesEntrada`: `2` requisições com idêntica `09c5bed9-c52c-4a15-8bde-7d1ebf2eef68`, aviso `"a mesma chave será usada e nada será somado em dobro"`); **busca de insumo no celular ❌** (humano, 17/11: digitar em `"Buscar insumo por nome..."` só filtra as opções do `<select>` fechado logo abaixo, que continua em `"Selecione um insumo..."` ou no insumo antigo; nada muda na tela — tarefa [24](24-entrada-manual-busca-insumo.md)) | [`03a`](evidencias-18/03a_entrada_manual_form_375_claro.png), [`03b`](evidencias-18/03b_entrada_manual_form_375_escuro.png), [`03c`](evidencias-18/03c_entrada_manual_rede_mesma_chave_375_claro.png), [`03d`](evidencias-18/03d_entrada_manual_resultado_avisos_375_claro.png) |
| Histórico de movimentações (16) | **20 mais recentes ✅** (card `Palito de madeira` abre com as 20 recentes e botão `Ver tudo`); **"Carregar mais" ✅** (`Ver tudo` carrega 50 e `"Carregar mais"` busca o restante até `58 de 58`, claro e escuro); **fuso da loja ✅** (`America/Campo_Grande`, ex.: `17/11, 19:28`); **usuário removido ⚠️ NÃO VERIFICADO via API HTTP** (não existe endpoint `DELETE /api/usuarios/:id` e SQL direto no banco de dev é proibido; exibição de `"Usuário removido"` quando `usuario: null` é coberta no teste `T2` de `HistoricoMovimentacoes.spec.tsx`) | [`04a`](evidencias-18/04a_historico_20_recentes_375_claro.png), [`04b`](evidencias-18/04b_historico_carregar_mais_375_claro.png), [`04c`](evidencias-18/04c_historico_carregar_mais_375_escuro.png) |
| Contagem de estoque (21) | **botão só para ADMIN/GERENTE ✅** (oculto para `OPERADOR`, visível para `GERENTE` e `ADMIN`); **zero aceito ✅** (`Hortelã = 0` exibido em `05d` e `05e` como `0 g`, `saldo 0 → 0 g`, `"1 item sem diferença"`); **`"5.000"` recusado ✅** (`Para 5 mil, digite 5000 (use vírgula só para decimais)`); **`kg→g` ✅** (`Batata Frita Bem Brasil` `5 kg`, `equivale a 5000 g`); **diferença prevista com sinal ✅** (`−6.000 g` em vermelho em `Batata`, `+2 un` em `Pão Brioche`); **confirmação ✅** (aviso `"O servidor recalcula a diferença com o saldo do momento do envio."`); **resultado do servidor ✅** (`Hortelã: 0 → 0 g`, `Pão Brioche: 150,35 → 152,35 un (+2 un)`); **histórico com `"Ajuste"` ✅** (`Pão Brioche` exibe `Ajuste` `+2 un` e `−2 un`) | [`05a`](evidencias-18/05a_contagem_oculta_operador_375_claro.png), [`05b`](evidencias-18/05b_contagem_form_milhar_zero_kg_375_claro.png), [`05c`](evidencias-18/05c_contagem_form_375_escuro.png), [`05d`](evidencias-18/05d_contagem_confirmacao_375_claro.png), [`05e`](evidencias-18/05e_contagem_resultado_375_claro.png), [`05f`](evidencias-18/05f_contagem_historico_ajuste_375_claro.png) |
| Usuários (22) | **item só para ADMIN ✅** (oculto em Configurações para `OPERADOR` e `GERENTE`, visível para `ADMIN`); **criar ✅** (`Thiago Caixa Conf18` criado e listado); **`409` de e-mail repetido mantendo Sheet ✅** (`Já existe um usuário com este e-mail.`); **desativar com confirmação neutra ✅** (`Thiago Caixa Conf18 não vai mais conseguir entrar. As sessões abertas serão encerradas agora.` + toast `Acesso desativado.`); **própria conta protegida ✅** (`Você não pode alterar o seu próprio papel nem desativar a sua conta`); **redefinir senha (`204`) ✅** (`Senha redefinida. Operador Conf18 precisa entrar de novo com a senha nova.`) | [`06a`](evidencias-18/06a_usuarios_oculto_nao_admin_375_claro.png), [`06b`](evidencias-18/06b_usuarios_menu_admin_375_claro.png), [`06c`](evidencias-18/06c_usuarios_lista_375_claro.png), [`06d`](evidencias-18/06d_usuarios_lista_375_escuro.png), [`06e`](evidencias-18/06e_usuarios_409_email_375_claro.png), [`06f`](evidencias-18/06f_usuarios_redefinir_senha_375_claro.png), [`06g`](evidencias-18/06g_usuarios_confirmar_desativar_375_claro.png), [`06h`](evidencias-18/06h_usuarios_propria_conta_375_escuro.png) |
| Fechamento do dia: formulário (12) | **atalho no Início ✅** (`Fechar o dia`); **data sem futuro ✅** (`2099-12-31` exibe `"A data não pode ser futura."` e desabilita simulação); **+/− e digitação ✅**; **limites 0–500 ✅** (`501` é limitado para `500`); **busca ✅** (`Buscar produto`) | [`07a`](evidencias-18/07a_fechamento_form_375_claro.png), [`07b`](evidencias-18/07b_fechamento_form_375_escuro.png), [`07c`](evidencias-18/07c_fechamento_form_1280_claro.png), [`07d`](evidencias-18/07d_fechamento_data_futura_375_claro.png) |
| Fechamento: impacto (12) | **negativo em destaque (cor e texto) ✅** (`Ficariam negativos` + selo vermelho `⚠ ficaria negativo` em `Maionese da Casa - Beneficiado`, claro e escuro); **produto sem ficha bloqueia ✅** (`Milkshake Pistache (Sem Ficha)` exibe `"Estes produtos não têm ficha técnica e impedem a baixa"` e desabilita `Confirmar baixa`); **impacto vira obsoleto ao editar ✅** (aviso `"Atualize o impacto"`, opacidade reduzida e `Confirmar baixa` desabilitado) | [`08a`](evidencias-18/08a_fechamento_impacto_sem_ficha_375_claro.png), [`08b`](evidencias-18/08b_fechamento_impacto_negativo_375_claro.png), [`08c`](evidencias-18/08c_fechamento_impacto_negativo_375_escuro.png), [`08d`](evidencias-18/08d_fechamento_impacto_obsoleto_375_claro.png) |
| Fechamento: confirmação (13) | **diálogo com resumo ✅** (`Confirmar baixa`); **duplo toque ✅** (`useEnvio` envia apenas uma requisição por clique); **falha de rede e reenvio ✅** (aviso `"Não foi possível confirmar. Toque em Tentar novamente: nada será baixado em dobro."` mantendo idempotência); **replay com mensagem neutra ✅** (3 tentativas usando a mesma `chaveIdempotencia` resultando em `200` com banner `"Este fechamento já tinha sido registrado."`); **sucesso com negativos e ativo ✅** (`Ficaram negativos` em `09d` e baixa ativa `2× SELADINHO HOUSE` em `09c`) | [`09a`](evidencias-18/09a_fechamento_dialogo_confirmar_375_claro.png), [`09b`](evidencias-18/09b_fechamento_rede_mesma_chave_375_claro.png), [`09c`](evidencias-18/09c_fechamento_sucesso_ativo_375_claro.png), [`09d`](evidencias-18/09d_fechamento_replay_375_claro.png) |
| Fechamento: estorno e lista (13, 14) | **motivo obrigatório ✅** (`Estornar fechamento` permanece desabilitado enquanto `Motivo do estorno` está vazio); **saldos voltam exatamente ✅** (`11/11` insumos voltaram ao valor exato — ver tabela abaixo); **lista do dia com autor, selo `"Estornado"` e aviso de dia já fechado ✅** (`Este dia já tem 1 fechamento (2 itens). Lançar outro soma ao anterior.`, hora e autor `Carlos Eduardo`, selo `Estornado` + motivo + hora do estorno, claro e escuro) | [`10a`](evidencias-18/10a_fechamento_estorno_motivo_obrigatorio_375_claro.png), [`10b`](evidencias-18/10b_fechamento_estornado_resultado_375_claro.png), [`10c`](evidencias-18/10c_fechamento_lista_dia_375_claro.png), [`10d`](evidencias-18/10d_fechamento_lista_dia_375_escuro.png) |
| Relatórios e Início (17, 20) | **linha `"lançados no fechamento do dia"` ✅** (`1 lançado no fechamento do dia` em Relatórios; `inclui 1 pedido lançado à mão` em Início); **saída em quantidade sem faturamento `R$` ✅** (`Saída de hoje: 2 itens / 1 pedido`); **totais batem com o backend ✅** (`GET /api/dashboard/resumo` e `GET /api/estoque/saida-dia`, detalhado abaixo) | [`11a`](evidencias-18/11a_inicio_375_claro.png), [`11b`](evidencias-18/11b_inicio_375_escuro.png), [`11c`](evidencias-18/11c_inicio_1280_claro.png), [`11d`](evidencias-18/11d_inicio_1280_escuro.png), [`11e`](evidencias-18/11e_relatorios_375_claro.png), [`11f`](evidencias-18/11f_relatorios_375_escuro.png), [`11g`](evidencias-18/11g_relatorios_1280_claro.png), [`11h`](evidencias-18/11h_relatorios_1280_escuro.png) |
| Vendas retidas (09) | **alerta ✅** (`1 venda retida — Baixa de estoque pausada até o cardápio ser ajustado.`); **resumo por produto ✅** (`Hambúrguer Fantasma Conf18 · 1 venda · Produto fora do catálogo`); **atalho para corrigir ✅** (clicar em `Criar produto` navega para `Estoque > Prontos` abrindo o Sheet `Novo produto` pré-preenchido com `Hambúrguer Fantasma Conf18`) | [`12a`](evidencias-18/12a_vendas_retidas_375_claro.png), [`12b`](evidencias-18/12b_vendas_retidas_375_escuro.png), [`12c`](evidencias-18/12c_vendas_retidas_atalho_estoque_375_claro.png) |
| Regressão geral | **Login ✅** (`375×812` e `1280×800`, claro e escuro); **logout/novo login limpo ✅** (`200` sem `415`, próximo login cai direto em `Início` sem modal residual); **Perfil/Configurações ✅**; **nota fiscal (passos 1 a 3) ✅** (upload XML NF-e `514909`, match 99% `Palito de madeira`, passo 3 `Estoque atualizado` `+1 Unidade`); **armazenamento bloqueado ✅** (`window.localStorage` lançando `SecurityError`, login e sessão funcionam em memória); **celular real em `http://IP` e `https://IP` (humano, 17/11) ❌**: o gesto/botão **Voltar do aparelho sai do app** em qualquer subtela (Importar NF-e, Entrada manual, Contagem, Fechar o dia, Usuários) e com a câmera aberta (nenhuma subtela usa `history.pushState`/`popstate`); e **a câmera continua ligada** se for fechada ou se trocar para XML enquanto `scanner.start()` ainda abre (`ImportarNotaFiscal.tsx:178-194`) — tarefa [23](23-scanner-voltar-mobile.md). O humano não relatou outros defeitos nos demais itens da lista abaixo. | [`13a`](evidencias-18/13a_login_375_claro.png), [`13b`](evidencias-18/13b_login_375_escuro.png), [`13c`](evidencias-18/13c_login_1280_claro.png), [`13d`](evidencias-18/13d_login_1280_escuro.png), [`13e`](evidencias-18/13e_logout_novo_login_limpo_375_claro.png), [`13f`](evidencias-18/13f_perfil_375_claro.png), [`13g`](evidencias-18/13g_configuracoes_375_escuro.png), [`13h`](evidencias-18/13h_nfe_passo1_375_claro.png), [`13i`](evidencias-18/13i_nfe_passo2_375_claro.png), [`13j`](evidencias-18/13j_nfe_passo3_375_claro.png), [`13k`](evidencias-18/13k_storage_bloqueado_login_375_claro.png), [`13l`](evidencias-18/13l_storage_bloqueado_inicio_375_claro.png) |

---

## Prova real de fechamento e estorno (saldos anotados)

Fechamento testado: **`1× BACON HOUSE`** no dia `2026-11-17`, com simulação prévia, captura de baixa (incluindo replay `reaproveitado: true`) e estorno imediato pela tela de conclusão (`Desfazer` → motivo obrigatório → `Estornar`). Saldos consultados diretamente via `GET /api/insumos` antes da baixa, logo após a baixa e logo após o estorno:

| Insumo | Unidade | Estoque antes | Após baixa (`1× BACON HOUSE`) | Após estorno | Antes === Depois? |
|---|---|---:|---:|---:|:---:|
| Bacon fatiado | Gramas | `3000` | `2968` (`−32`) | `3000` | ✅ Sim (`3000 === 3000`) |
| Carne de Hambúrguer | Gramas | `4800` | `4640` (`−160`) | `4800` | ✅ Sim (`4800 === 4800`) |
| Embalagem de molho (potinho) | Unidade | `500` | `499` (`−1`) | `500` | ✅ Sim (`500 === 500`) |
| **Maionese da Casa - Beneficiado** *(negativo)* | Gramas | **`-550`** | **`-590`** (`−40`) | **`-550`** | ✅ Sim (`-550 === -550`) |
| Margarina | Gramas | `1000` | `998` (`−2`) | `1000` | ✅ Sim (`1000 === 1000`) |
| Palito de madeira | Unidade | `563` | `562` (`−1`) | `563` | ✅ Sim (`563 === 563`) |
| Papel Acoplado | Unidade | `500` | `499` (`−1`) | `500` | ✅ Sim (`500 === 500`) |
| Pão Brioche | Unidade | `150.35` | `149.35` (`−1`) | `150.35` | ✅ Sim (`150.35 === 150.35`) |
| Queijo Cheddar Fatia | Unidade | `150` | `148` (`−2`) | `150` | ✅ Sim (`150 === 150`) |
| Saco Kraft Delivery | Unidade | `300` | `299.5` (`−0.5`) | `300` | ✅ Sim (`300 === 300`) |
| Sal Fino | Gramas | `1000` | `995` (`−5`) | `1000` | ✅ Sim (`1000 === 1000`) |

> Nota factual sobre [`10b_fechamento_estornado_resultado_375_claro.png`](evidencias-18/10b_fechamento_estornado_resultado_375_claro.png): a recaptura de topo dessa tela foi tirada após o Bloco I ter importado `+1` unidade de `Palito de madeira` via NF-e, por isso o card exibe `Palito de madeira: +1 Unidade · estoque agora 564 Unidade` (`564 → 563 → 564`), mantendo a devolução exata do estorno.

---

## Comparação Início / Relatórios × Backend

Consultas reais no momento da captura (`2026-11-17`):

| Fonte | Campo / Valor no Backend | Texto exibido na UI | Captura |
|---|---|---|---|
| `GET /api/dashboard/resumo?periodo=mes` | `totalVendasQtd: 1`, `vendasManuaisQtd: 1`, `totalVendasValor: 0` | Cartão **Pedidos**: `1` · `pedido` · **`1 lançado no fechamento do dia`** (sem `R$`) | [`11e`](evidencias-18/11e_relatorios_375_claro.png), [`11f`](evidencias-18/11f_relatorios_375_escuro.png) |
| `GET /api/dashboard/resumo?periodo=mes` | `totalComprasValor: 4901.6`, `totalComprasQtd: 2` | Cartão **Compras**: `R$ 4.901,60` · `2 notas` | [`11e`](evidencias-18/11e_relatorios_375_claro.png) |
| `GET /api/dashboard/resumo?periodo=mes` | `totalPerdasValor: 991.3`, `totalPerdasQtd: 3` | Cartão **Perdas**: `R$ 991,30` · `20,2% das compras` | [`11e`](evidencias-18/11e_relatorios_375_claro.png) |
| `GET /api/dashboard/resumo?periodo=mes` | `insumosEmAlertaQtd: 9` | Cartão **Em alerta**: `9` · `insumos` | [`11e`](evidencias-18/11e_relatorios_375_claro.png) |
| `GET /api/dashboard/resumo?periodo=hoje` & `GET /api/estoque/saida-dia?data=2026-11-17` | `pedidos: 1`, `vendasManuaisQtd: 1`, `itens: [{ nome: "SELADINHO HOUSE", quantidade: 2 }]`, `totalPerdasValor: 6.98` | Cartão **Saída de hoje**: `2 itens` · `1 pedido` · `inclui 1 pedido lançado à mão` · Compras `R$ 0,00` (depois `R$ 0,03` em [`13l`](evidencias-18/13l_storage_bloqueado_inicio_375_claro.png) após NF-e do Bloco I) · Perdas `R$ 6,98` | [`11a`](evidencias-18/11a_inicio_375_claro.png), [`11b`](evidencias-18/11b_inicio_375_escuro.png), [`13l`](evidencias-18/13l_storage_bloqueado_inicio_375_claro.png) |

---

## Tabela de medição de cor dos 70 PNGs

Medições feitas por decodificação direta de pixel (buffer descomprimido do arquivo `.png`) combinada com inspeção do DOM (`getComputedStyle` e `scrollWidth <= clientWidth`):

| Arquivo | Tela | Resolução | Tema | Ponto medido | RGB / Hex principal | Superfície 20px / Sheet | Scroll X |
|---|---|---|:---:|---|---|---|:---:|
| [`01a_estoque_abas_375_claro.png`](evidencias-18/01a_estoque_abas_375_claro.png) | Estoque abas (375 Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`01b_estoque_abas_375_escuro.png`](evidencias-18/01b_estoque_abas_375_escuro.png) | Estoque abas (375 Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`01c_estoque_abas_1280_claro.png`](evidencias-18/01c_estoque_abas_1280_claro.png) | Estoque abas (1280 Claro) | 1280×800 | Claro | (640, 8) / borda (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#f3f4f6` | Não |
| [`01d_estoque_abas_1280_escuro.png`](evidencias-18/01d_estoque_abas_1280_escuro.png) | Estoque abas (1280 Escuro) | 1280×800 | Escuro | (640, 8) / borda (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#030712` | Não |
| [`01e_estoque_busca_aba_375_claro.png`](evidencias-18/01e_estoque_busca_aba_375_claro.png) | Estoque busca isolada por aba | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`01f_estoque_estado_vazio_375_claro.png`](evidencias-18/01f_estoque_estado_vazio_375_claro.png) | Estoque estado vazio | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`01g_estoque_troca_categoria_375_claro.png`](evidencias-18/01g_estoque_troca_categoria_375_claro.png) | Estoque troca de categoria move aba | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#ffffff` | Não |
| [`02a_cadastro_insumo_embalagem_375_claro.png`](evidencias-18/02a_cadastro_insumo_embalagem_375_claro.png) | Cadastro insumo na aba Embalagens | 375×812 | Claro | dialog (20, 372) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a09f9e` | Não |
| [`02b_cadastro_insumo_ingrediente_375_claro.png`](evidencias-18/02b_cadastro_insumo_ingrediente_375_claro.png) | Cadastro insumo Ingrediente com Beneficiado/Validade | 375×812 | Claro | dialog (20, 236) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a09f9e` | Não |
| [`02c_cadastro_insumo_erro400_375_claro.png`](evidencias-18/02c_cadastro_insumo_erro400_375_claro.png) | Cadastro insumo erro 400 mantém Sheet (negativo intencional) | 375×812 | Claro | dialog (20, 236) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a09f9e` | Não |
| [`03a_entrada_manual_form_375_claro.png`](evidencias-18/03a_entrada_manual_form_375_claro.png) | Entrada manual formulário completo (375 Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#f6eee5` | Não |
| [`03b_entrada_manual_form_375_escuro.png`](evidencias-18/03b_entrada_manual_form_375_escuro.png) | Entrada manual (375 Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`03c_entrada_manual_rede_mesma_chave_375_claro.png`](evidencias-18/03c_entrada_manual_rede_mesma_chave_375_claro.png) | Entrada manual falha de rede mantém chave (negativo intencional) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#ffffff` | Não |
| [`03d_entrada_manual_resultado_avisos_375_claro.png`](evidencias-18/03d_entrada_manual_resultado_avisos_375_claro.png) | Entrada manual resultado com avisos e saldo | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`04a_historico_20_recentes_375_claro.png`](evidencias-18/04a_historico_20_recentes_375_claro.png) | Histórico 20 mais recentes + Ver tudo | 375×812 | Claro | dialog (20, 81) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #8c8885` | Não |
| [`04b_historico_carregar_mais_375_claro.png`](evidencias-18/04b_historico_carregar_mais_375_claro.png) | Histórico após Carregar mais (Claro) | 375×812 | Claro | dialog (20, 81) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #8c8885` | Não |
| [`04c_historico_carregar_mais_375_escuro.png`](evidencias-18/04c_historico_carregar_mais_375_escuro.png) | Histórico (Escuro) | 375×812 | Escuro | dialog (20, 81) / fundo (20, 20) | rgb(26, 26, 29) (`#1a1a1d`) | `#1a1a1d (Sheet) / #807f7f` | Não |
| [`05a_contagem_oculta_operador_375_claro.png`](evidencias-18/05a_contagem_oculta_operador_375_claro.png) | Contagem oculta para OPERADOR | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`05b_contagem_form_milhar_zero_kg_375_claro.png`](evidencias-18/05b_contagem_form_milhar_zero_kg_375_claro.png) | Contagem 5.000 recusado, 0 aceito, kg->g e diferença prevista | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#ffffff` | Não |
| [`05c_contagem_form_375_escuro.png`](evidencias-18/05c_contagem_form_375_escuro.png) | Contagem formulário (Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`05d_contagem_confirmacao_375_claro.png`](evidencias-18/05d_contagem_confirmacao_375_claro.png) | Contagem diálogo de confirmação | 375×812 | Claro | dialog (20, 427) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a0a09e` | Não |
| [`05e_contagem_resultado_375_claro.png`](evidencias-18/05e_contagem_resultado_375_claro.png) | Contagem resultado do servidor | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`05f_contagem_historico_ajuste_375_claro.png`](evidencias-18/05f_contagem_historico_ajuste_375_claro.png) | Histórico com Ajuste após Contagem | 375×812 | Claro | dialog (20, 81) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a09f9e` | Não |
| [`06a_usuarios_oculto_nao_admin_375_claro.png`](evidencias-18/06a_usuarios_oculto_nao_admin_375_claro.png) | Usuários oculto para não-ADMIN | 375×812 | Claro | dialog (20, 529) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #8c8885` | Não |
| [`06b_usuarios_menu_admin_375_claro.png`](evidencias-18/06b_usuarios_menu_admin_375_claro.png) | Configurações item Usuários visível só para ADMIN | 375×812 | Claro | dialog (20, 405) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #8e8a86` | Não |
| [`06c_usuarios_lista_375_claro.png`](evidencias-18/06c_usuarios_lista_375_claro.png) | Lista Usuários (Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`06d_usuarios_lista_375_escuro.png`](evidencias-18/06d_usuarios_lista_375_escuro.png) | Lista Usuários (Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`06e_usuarios_409_email_375_claro.png`](evidencias-18/06e_usuarios_409_email_375_claro.png) | Usuários erro 409 e-mail repetido (negativo intencional) | 375×812 | Claro | dialog (20, 210) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a19d9a` | Não |
| [`06f_usuarios_redefinir_senha_375_claro.png`](evidencias-18/06f_usuarios_redefinir_senha_375_claro.png) | Usuários redefinir senha (204) | 375×812 | Claro | dialog (20, 81) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a19d9a` | Não |
| [`06g_usuarios_confirmar_desativar_375_claro.png`](evidencias-18/06g_usuarios_confirmar_desativar_375_claro.png) | Usuários diálogo confirmação neutro ao desativar | 375×812 | Claro | dialog (20, 473) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #686664` | Não |
| [`06h_usuarios_propria_conta_375_escuro.png`](evidencias-18/06h_usuarios_propria_conta_375_escuro.png) | Usuários própria conta protegida (Escuro) | 375×812 | Escuro | dialog (20, 217) / fundo (20, 20) | rgb(26, 26, 29) (`#1a1a1d`) | `#1a1a1d (Sheet) / #6b6a6a` | Não |
| [`07a_fechamento_form_375_claro.png`](evidencias-18/07a_fechamento_form_375_claro.png) | Fechamento formulário (375 Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`07b_fechamento_form_375_escuro.png`](evidencias-18/07b_fechamento_form_375_escuro.png) | Fechamento formulário + aviso (Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`07c_fechamento_form_1280_claro.png`](evidencias-18/07c_fechamento_form_1280_claro.png) | Fechamento formulário (1280 Claro) | 1280×800 | Claro | (640, 8) / borda (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#f3f4f6` | Não |
| [`07d_fechamento_data_futura_375_claro.png`](evidencias-18/07d_fechamento_data_futura_375_claro.png) | Fechamento data futura bloqueada | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`08a_fechamento_impacto_sem_ficha_375_claro.png`](evidencias-18/08a_fechamento_impacto_sem_ficha_375_claro.png) | Fechamento impacto bloqueado por produto sem ficha | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`08b_fechamento_impacto_negativo_375_claro.png`](evidencias-18/08b_fechamento_impacto_negativo_375_claro.png) | Fechamento impacto com negativo destacado (Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`08c_fechamento_impacto_negativo_375_escuro.png`](evidencias-18/08c_fechamento_impacto_negativo_375_escuro.png) | Fechamento impacto negativo (Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`08d_fechamento_impacto_obsoleto_375_claro.png`](evidencias-18/08d_fechamento_impacto_obsoleto_375_claro.png) | Fechamento impacto obsoleto ao editar | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`09a_fechamento_dialogo_confirmar_375_claro.png`](evidencias-18/09a_fechamento_dialogo_confirmar_375_claro.png) | Fechamento diálogo confirmação | 375×812 | Claro | dialog (20, 473) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a19d9a` | Não |
| [`09b_fechamento_rede_mesma_chave_375_claro.png`](evidencias-18/09b_fechamento_rede_mesma_chave_375_claro.png) | Fechamento falha de rede preserva mesma chave (negativo intencional) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`09c_fechamento_sucesso_ativo_375_claro.png`](evidencias-18/09c_fechamento_sucesso_ativo_375_claro.png) | Fechamento ativo registrado (2 SELADINHO HOUSE) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`09d_fechamento_replay_375_claro.png`](evidencias-18/09d_fechamento_replay_375_claro.png) | Fechamento replay 200 (reaproveitado: true) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`10a_fechamento_estorno_motivo_obrigatorio_375_claro.png`](evidencias-18/10a_fechamento_estorno_motivo_obrigatorio_375_claro.png) | Estorno exige motivo obrigatório | 375×812 | Claro | dialog (20, 465) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #a19d9a` | Não |
| [`10b_fechamento_estornado_resultado_375_claro.png`](evidencias-18/10b_fechamento_estornado_resultado_375_claro.png) | Fechamento após estorno (devoluções) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`10c_fechamento_lista_dia_375_claro.png`](evidencias-18/10c_fechamento_lista_dia_375_claro.png) | Fechamento aviso dia já fechado + lista do dia (Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`10d_fechamento_lista_dia_375_escuro.png`](evidencias-18/10d_fechamento_lista_dia_375_escuro.png) | Fechamento lançamentos do dia (Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`11a_inicio_375_claro.png`](evidencias-18/11a_inicio_375_claro.png) | Início (375 Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`11b_inicio_375_escuro.png`](evidencias-18/11b_inicio_375_escuro.png) | Início (375 Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`11c_inicio_1280_claro.png`](evidencias-18/11c_inicio_1280_claro.png) | Início (1280 Claro) | 1280×800 | Claro | (640, 8) / borda (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#f3f4f6` | Não |
| [`11d_inicio_1280_escuro.png`](evidencias-18/11d_inicio_1280_escuro.png) | Início (1280 Escuro) | 1280×800 | Escuro | (640, 8) / borda (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#030712` | Não |
| [`11e_relatorios_375_claro.png`](evidencias-18/11e_relatorios_375_claro.png) | Relatórios (375 Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`11f_relatorios_375_escuro.png`](evidencias-18/11f_relatorios_375_escuro.png) | Relatórios (375 Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`11g_relatorios_1280_claro.png`](evidencias-18/11g_relatorios_1280_claro.png) | Relatórios (1280 Claro) | 1280×800 | Claro | (640, 8) / borda (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#f3f4f6` | Não |
| [`11h_relatorios_1280_escuro.png`](evidencias-18/11h_relatorios_1280_escuro.png) | Relatórios (1280 Escuro) | 1280×800 | Escuro | (640, 8) / borda (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#030712` | Não |
| [`12a_vendas_retidas_375_claro.png`](evidencias-18/12a_vendas_retidas_375_claro.png) | Vendas retidas resumo por produto (Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`12b_vendas_retidas_375_escuro.png`](evidencias-18/12b_vendas_retidas_375_escuro.png) | Vendas retidas (Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`12c_vendas_retidas_atalho_estoque_375_claro.png`](evidencias-18/12c_vendas_retidas_atalho_estoque_375_claro.png) | Vendas retidas atalho leva ao Estoque > Prontos (Novo produto) | 375×812 | Claro | dialog (20, 623) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #8c8885` | Não |
| [`13a_login_375_claro.png`](evidencias-18/13a_login_375_claro.png) | Login (375 Claro) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`13b_login_375_escuro.png`](evidencias-18/13b_login_375_escuro.png) | Login (375 Escuro) | 375×812 | Escuro | (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`13c_login_1280_claro.png`](evidencias-18/13c_login_1280_claro.png) | Login (1280 Claro) | 1280×800 | Claro | (640, 8) / borda (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`13d_login_1280_escuro.png`](evidencias-18/13d_login_1280_escuro.png) | Login (1280 Escuro) | 1280×800 | Escuro | (640, 8) / borda (8, 8) | rgb(15, 15, 17) (`#0f0f11`) | `#0f0f11` | Não |
| [`13e_logout_novo_login_limpo_375_claro.png`](evidencias-18/13e_logout_novo_login_limpo_375_claro.png) | Logout + novo login limpo na aba Início | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#948c85` | Não |
| [`13f_perfil_375_claro.png`](evidencias-18/13f_perfil_375_claro.png) | Perfil (375 Claro) | 375×812 | Claro | dialog (20, 191) / fundo (20, 20) | rgb(255, 255, 255) (`#ffffff`) | `#ffffff (Sheet) / #8e8a86` | Não |
| [`13g_configuracoes_375_escuro.png`](evidencias-18/13g_configuracoes_375_escuro.png) | Configurações (375 Escuro) | 375×812 | Escuro | dialog (20, 405) / fundo (20, 20) | rgb(26, 26, 29) (`#1a1a1d`) | `#1a1a1d (Sheet) / #7e7c7b` | Não |
| [`13h_nfe_passo1_375_claro.png`](evidencias-18/13h_nfe_passo1_375_claro.png) | Nota fiscal passo 1 (Ler) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`13i_nfe_passo2_375_claro.png`](evidencias-18/13i_nfe_passo2_375_claro.png) | Nota fiscal passo 2 (Revisar) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`13j_nfe_passo3_375_claro.png`](evidencias-18/13j_nfe_passo3_375_claro.png) | Nota fiscal passo 3 (Pronto) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`13k_storage_bloqueado_login_375_claro.png`](evidencias-18/13k_storage_bloqueado_login_375_claro.png) | Armazenamento bloqueado — Login | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#fff9f3` | Não |
| [`13l_storage_bloqueado_inicio_375_claro.png`](evidencias-18/13l_storage_bloqueado_inicio_375_claro.png) | Armazenamento bloqueado — Início (sessão em memória) | 375×812 | Claro | (8, 8) | rgb(255, 249, 243) (`#fff9f3`) | `#948c85` | Não |

---

## Checklist para conferência humana no celular real (feita em 17/11/2026: 2 ❌ → tarefas 23 e 24)
Como o ambiente automatizado não dispõe de aparelho celular físico conectado na rede local (`http://192.168.100.14:5174` / HTTPS), recomenda-se validar manualmente no telefone:
1. **Contexto não seguro (`http://IP:5174`) e seguro (`https://IP:5174`)**: abrir o app no navegador móvel do celular pelos dois protocolos.
2. **Entrada manual & Contagem de estoque no HTTP**: testar gerar `chaveIdempotencia` no `http://IP` (garante o fallback de `lib/chaveIdempotencia.ts` quando `window.crypto.randomUUID` está indisponível em contexto não seguro).
3. **Teclado virtual e alvos de toque**: digitar valores com vírgula decimal em `Entrada manual`, `Contagem` e `Fechar o dia` verificando rolagem e ausência de zoom indesejado no iOS/Android.
4. **Tema Escuro/Claro e leitura de QR Code (HTTPS)**: alternar tema em `Configurações`, abrir câmera em `Importar NF-e` via `https://IP` e verificar feedback de som/vibração.
5. **Sessão limpa em mobile**: sair pelo `Perfil` e logar novamente verificando redirecionamento direto para `Início`.

---

## Inventário dos dados criados no banco de desenvolvimento (via API HTTP)

Para transparência e eventual limpeza do banco de desenvolvimento, seguem os registros criados exclusivamente via API HTTP nesta conferência:
1. **Insumos (`POST /api/insumos`)**:
   - `Sacola Kraft Extra (Conf18)` (`0375b633-f19d-4508-af1a-2e01dca04992`, `EMBALAGEM`, saldo `20`, mínimo `5`)
   - `Guaraná Lata 350ml (Conf18)` (`07eecf40-1852-4d46-b4c3-88d159c315ab`, `BEBIDA`, saldo `24`, mínimo `4`)
2. **Produto sem ficha (`POST /api/produtos`)**:
   - `Milkshake Pistache (Sem Ficha)` (`b58023ab-f687-41ec-824b-dd472a50967a`)
3. **Perda (`POST /api/perdas`)**:
   - `Carne de Hambúrguer`: `200 g` a `R$ 0,0349/g` (`889efa24-475e-48b6-8e53-fa16918856c9`, `VENCIMENTO`)
4. **Entradas manuais (`POST /api/estoque/entradas-manuais`)**:
   - `55×` entradas de `+1 un` em `Palito de madeira` para atingir >50 movimentações reais
   - Entradas de conferência (`chaveIdempotencia: 09c5bed9-c52c-4a15-8bde-7d1ebf2eef68`): `Batata Frita Bem Brasil` (`+1500 g`) e `Palito de madeira` (`+2 un`, com `custoUnitario` restaurado para o valor anterior ao teste)
5. **Contagens de estoque (`POST /api/estoque/ajustes`)**:
   - `Pão Brioche` ajustado em `+2 un` e logo restaurado para o saldo anterior (`150,35 un`) + `Hortelã` (`0 → 0 g`)
6. **Fechamento manual ativo e estornados (`POST /api/vendas/fechamento-manual` / `/estornar`)**:
   - Ativo no dia `2026-11-17`: `2× SELADINHO HOUSE`
   - Estornados no histórico do dia: `1× BACON HOUSE` (usados na prova de saldos e replay)
7. **NF-e de regressão (`POST /api/notas-fiscais/confirmar`)**:
   - Chave `35261112345678000199550010000001794958514909` (`Palito de madeira` `+1 un`, `R$ 0,03`)
8. **Venda retida (`POST /api/webhooks/anota-ai`)**:
   - `externalId: "ped-retido-conf18"` (`Hambúrguer Fantasma Conf18`, `PRODUTO_NAO_ENCONTRADO`)
9. **Usuários (`POST /api/usuarios`)**:
   - Ativos para conferência de papéis: `Gerente Conf18` (`gerente.conf18@burguerhouse.com.br`, `GERENTE`, id `d221da49-601b-4d87-9e6d-b3ca54e86710`) e `Operador Conf18` (`operador.conf18@burguerhouse.com.br`, `OPERADOR`, id `01846ec1-2458-4fbf-bdce-f6dcbbdb24bc`)
   - Desativados criados durante os testes da tela `Usuários`: `Lucas Teste Conf18` (`temp.conf18.1794957575116@burguerhouse.com.br`), `Mateus Operador Conf18` (`temp.conf18.1794957891734@burguerhouse.com.br`), `Sofia Caixa Conf18` (`temp.conf18.1794958130358@burguerhouse.com.br`) e `Thiago Caixa Conf18` (`temp.conf18.1794958438575@burguerhouse.com.br`)

---

## Resumo de console e rede
Ver detalhes completos em [`evidencias-18/console.md`](evidencias-18/console.md):
- **Exceções de página (`pageerror`):** `0`
- **Respostas HTTP `>= 400`:** apenas `2`, ambas provocadas intencionalmente para validar tratamento de erro na UI (`400 POST /api/insumos` e `409 POST /api/usuarios`)
- **Erros de console:** apenas `5` logs correspondentes aos 2 erros HTTP intencionais acima e às 3 falhas de rede simuladas via Playwright (`net::ERR_FAILED`) para comprovar preservação da mesma `chaveIdempotencia`. Nenhum `415` ou falha em ação normal.

---

## Critério de pronto
- [x] Tabela completa (13 áreas, incluindo Contagem 21 e Usuários 22; nenhum item removido), com captura por item e tabela anexa de medição RGB/Hex dos 70 PNGs.
- [x] `console.md` das telas visitadas registrado em [`evidencias-18/console.md`](evidencias-18/console.md); nenhuma resposta inesperada em ação normal.
- [x] Conferência no **celular real**, em HTTP e HTTPS, feita pelo humano em 17/11/2026: 2 ❌ (voltar do aparelho/câmera e busca da entrada manual) viraram as tarefas [23](23-scanner-voltar-mobile.md) e [24](24-entrada-manual-busca-insumo.md).
- [x] Um fechamento real completo: `estoque antes → baixa → estorno → estoque depois` anotado nos 11 insumos com igualdade exata.
- [x] Cada ❌ virou uma tarefa nova (23 e 24, ambas do celular real); `usuário removido` no histórico segue **NÃO VERIFICADO** com motivo (não há exclusão de usuário pela API). Linha marcada `FEITA (#127)` e arquivo movido para `realizadas/`.

## Fora do escopo
Corrigir defeitos ou alterar código de produção da aplicação neste PR (caso alguma verificação no celular real aponte ajuste, registrar em nova tarefa), testes de carga.
