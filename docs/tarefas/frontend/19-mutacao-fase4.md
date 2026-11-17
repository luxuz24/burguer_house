# 19 — Medir e fechar a mutação das telas da Fase 4

- **Tipo:** test · **Fase:** 4 · **Estado:** PENDENTE (depois de 10 a 17)
- **Origem:** Testes que passam não provam que protegem. A [tarefa 05](realizadas/05-mutacao-f5-f6.md) mediu F5/F6 e mostrou lacunas reais (ex.: fechar o Perfil sem teste). As telas da Fase 4 mexem em estoque e dinheiro.
- **Depende de:** frontend [10](10-estoque-abas-por-categoria.md) a [17](realizadas/17-relatorios-vendas-manuais.md)
- **Branch sugerida:** `test/frontend-mutacao-fase4`

## Contexto
O frontend não tem Stryker como dependência e **não é permitido adicionar** sem aprovação. Rode de **fora** do repositório (no scratchpad/`/tmp`), uma cópia de configuração por arquivo, como descrito em [realizadas/05-mutacao-f5-f6.md](realizadas/05-mutacao-f5-f6.md) ("Como rodar"). Não commitar nada do Stryker (`.stryker-tmp`, relatórios).

## Problema
Sem medir, não sabemos se os testes das telas novas pegam as regressões que mais custam: chave de idempotência trocada ou não, botão habilitado com simulação obsoleta, quantidade fora do limite, unidade kg/g convertida errada, estorno que some depois de feito.

## Escopo (um arquivo por vez; a rodada com tudo junto é lenta)
`pages/FechamentoDia.tsx`, `pages/EntradaManual.tsx` (ou o componente equivalente), `lib/gerarChaveIdempotencia` (nome do arquivo conforme a [15](15-entrada-manual-estoque-tela.md)), `components/HistoricoMovimentacoes.tsx`, o trecho novo de `pages/Estoque.tsx` (abas e categoria), `pages/Dashboard.tsx` e `pages/Inicio.tsx` (linha de vendas manuais).

## Comportamento esperado
1. Medir cada arquivo e registrar a nota inicial.
2. Para cada sobrevivente que **muda comportamento** (não estilo ou animação), escrever um teste de **comportamento** (nunca testar o código da mutação).
3. Meta **≥ 80%** por arquivo. Abaixo disso, justificar **cada sobrevivente individualmente** (linha, mutação, por que é equivalente ou visual), não por grupo.
4. Priorizar estes pontos (têm que estar mortos): troca/reaproveitamento da chave de idempotência; limites 0..500 e data sem futuro; botão de confirmar desabilitado com impacto obsoleto ou `podeConfirmar: false`; conversão kg↔g e custo R$/unidade; estorno oculto depois de feito; aviso de "já existe fechamento no dia"; insumo repetido bloqueado na entrada manual.
5. Tabela antes → depois no PR.

## Teste que deve falhar antes
Cada teste novo é validado revertendo manualmente a mutação correspondente e vendo-o falhar.

## Critério de pronto
- [ ] Nota de **cada** arquivo medida e ≥ 80%, ou sobreviventes justificados um a um (linha por linha).
- [ ] Só arquivos `*.spec.ts(x)` alterados; se um teste revelar bug, **pare**, registre como tarefa nova e corrija em outro PR.
- [ ] `lint`, `test` e `build` verdes; nenhum artefato do Stryker commitado; nenhum `package.json`/`package-lock.json` alterado.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Mutação do backend (tarefas de cada rota), adicionar Stryker ao projeto.
