# 06 — Conferência visual no navegador das telas de F4, F5 e F6

- **Tipo:** test (verificação manual com evidência) · **Origem:** os PRs #72–#74 foram provados só por
  testes automatizados; o F4 registrou que a tela não foi aberta no navegador e o modo escuro só foi
  coberto pelo teste de tokens de cor.
- **Branch sugerida:** `test/frontend-conferencia-visual` (só se houver correção; senão, só o relatório no PR/issue)

## O que conferir
Suba com `npm run dev` (raiz) e banco de dev com seed. Para cada tela, em **375×812 (celular)** e
**desktop**, nos temas **claro** e **escuro**, compare com `docs/design/telas.html`:

## Resultados da Conferência Visual (Executada em 12/11/2026)

Ambiente verificado: `npm run dev` com PostgreSQL real populado via seed (`prisma/seed.ts`), Google Chrome headless nos viewports 375×812 (celular) e 1280×800 (desktop) nos temas claro e escuro.

| Tela | Pontos específicos verificados | Status | Evidências (Capturas) |
|---|---|:---:|---|
| **Login** | Layout centralizado com Smash; inputs com ícones; duplo Enter protegido; erro do backend exibido com `role="alert"`; botão DEV em teste | ✅ | • [Celular Claro](evidencias-06/01_login_celular_claro.png)<br>• [Celular Escuro](evidencias-06/01_login_celular_escuro.png)<br>• [Desktop Claro](evidencias-06/01_login_desktop_claro.png)<br>• [Desktop Escuro](evidencias-06/01_login_desktop_escuro.png)<br>• [Erro do Backend](evidencias-06/01_login_erro_backend.png) |
| **Início** | Alertas de validade antes de estoque baixo; KPIs do dia formatados em pt-BR; botões de ação rápida ("Registrar perda", "Ler QR code"); mascote Smash | ✅ | • [Celular Claro](evidencias-06/02_inicio_celular_claro.png)<br>• [Celular Escuro](evidencias-06/02_inicio_celular_escuro.png)<br>• [Desktop Claro](evidencias-06/02_inicio_desktop_claro.png)<br>• [Desktop Escuro](evidencias-06/02_inicio_desktop_escuro.png) |
| **Relatórios** | Abas de período com alvo de toque (44px); seletor de período personalizado com campos De/Até; visualização de consumo e perdas | ✅ | • [Celular Claro](evidencias-06/03_relatorios_celular_claro.png)<br>• [Celular Escuro](evidencias-06/03_relatorios_celular_escuro.png)<br>• [Desktop Claro](evidencias-06/03_relatorios_desktop_claro.png)<br>• [Período Personalizado](evidencias-06/03_relatorios_periodo_personalizado.png) |
| **Perfil / Configurações** | Modal Sheet de perfil (avatar com iniciais, dados, formulário de senha); modal de configurações com switch de som de 44px e troca de tema | ✅ | • [Perfil Claro](evidencias-06/04_perfil_celular_claro.png)<br>• [Perfil Escuro](evidencias-06/04_perfil_celular_escuro.png)<br>• [Configurações Claro](evidencias-06/04_configuracoes_celular_claro.png)<br>• [Configurações Escuro](evidencias-06/04_configuracoes_celular_escuro.png) |
| **Nota Fiscal** | Stepper de 3 passos ("Ler", "Revisar", "Pronto"); leitor de QR Code; retorno com segurança ao shell | ✅ | • [Passo 1 Celular Claro](evidencias-06/05_notafiscal_passo1_celular_claro.png)<br>• [Passo 1 Celular Escuro](evidencias-06/05_notafiscal_passo1_celular_escuro.png)<br>• [Passo 1 Desktop Claro](evidencias-06/05_notafiscal_passo1_desktop_claro.png) |
| **Shell** | Ao realizar logout e efetuar novo login, a sessão inicia na aba Início sem modais pendentes | ✅ | • [Após Logout](evidencias-06/06_shell_apos_logout.png)<br>• [Novo Login Limpo](evidencias-06/06_shell_novo_login_limpo.png) |
| **Armazenamento Bloqueado** | Aba anônima / `localStorage` bloqueado não quebra a interface nem gera tela branca | ✅ | • [Login com Storage Bloqueado](evidencias-06/07_armazenamento_bloqueado_login.png) |

## Critério de pronto
- [x] Tabela acima preenchida com capturas (claro/escuro, celular/desktop) no PR ou issue.
- [x] Console do navegador sem erros nas telas visitadas.
- [x] Nenhuma divergência impeditiva encontrada (zero tarefas de correção necessárias).
