# 06 — Conferência visual no navegador das telas de F4, F5 e F6

- **Tipo:** test (verificação manual com evidência) · **Origem:** os PRs #72–#74 foram provados só por
  testes automatizados; o F4 registrou que a tela não foi aberta no navegador e o modo escuro só foi
  coberto pelo teste de tokens de cor.
- **Branch sugerida:** `test/frontend-conferencia-visual` (só se houver correção; senão, só o relatório no PR/issue)

## O que conferir
Suba com `npm run dev` (raiz) e banco de dev com seed. Para cada tela, em **375×812 (celular)** e
**desktop**, nos temas **claro** e **escuro**, compare com `docs/design/telas.html`:

| Tela | Pontos específicos |
|---|---|
| Início | alertas de validade ("Vence em 2 dias", "Vencido") antes de estoque baixo; "Sem estoque"; erro com mensagem do backend e "Tentar novamente"; números em pt-BR |
| Relatórios | abas de período (44px); período personalizado (calendário, De/Até, erro de data inválida e de >366 dias); "Nenhuma perda no período." |
| Login | duplo Enter não envia duas vezes; erro do backend |
| Perfil / Configurações | trocar senha e continuar logado; switch de som; tema |
| Nota fiscal | passo 2 em lista, "Escolher insumo" destacado, fator com vírgula, bloqueio por item sem vínculo, XML > 500 KB recusado; câmera (celular real em HTTPS na rede local, ver `docs/STATUS.md` 1.6) |
| Shell | logout e novo login começam na aba Início, sem Perfil aberto |

Também: aba anônima (armazenamento bloqueado) abre o app e permite logar.

## Como registrar
Para cada item: ✅ ou ❌ com captura. Cada ❌ vira **uma tarefa nova** neste diretório (`NN-slug.md`,
mesmo formato) — não corrija tudo junto num PR de conferência.

## Critério de pronto
- [ ] Tabela acima preenchida com capturas (claro/escuro, celular/desktop) no PR ou issue.
- [ ] Console do navegador sem erros nas telas visitadas.
- [ ] Tarefas novas criadas para cada divergência encontrada.
