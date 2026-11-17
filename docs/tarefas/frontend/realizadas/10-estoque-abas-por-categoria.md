# 10 — Estoque com abas por categoria (Insumos, Embalagens, Bebidas, Prontos)

- **Tipo:** feat · **Fase:** 4 · **Estado:** FEITA (#113)
- **Origem:** Pedido da hamburgueria: controle separado de embalagens e bebidas, mais organizado
- **Depende de:** backend [21](../backend/21-insumos-categoria.md) (campo `categoria` e filtro). Fazer depois da [07](07-estoque-editar-excluir-no-sheet.md) (mesmos arquivos).
- **Arquivos:** `frontend/src/pages/Estoque.tsx` (`abaAtiva`, `filtroInsumos`, `busca`), `frontend/src/pages/Estoque.spec.tsx`
- **Branch sugerida:** `feat/frontend-estoque-abas-categoria`

## Contexto
Hoje o Estoque tem duas abas (`insumos` | `produtos`) e um filtro interno (`todos` | `beneficiados` | `alertas`). Os 49 insumos aparecem juntos: ingredientes, as 8 bebidas e as 5 embalagens (caixa, saco, potinho...). A loja controla cada grupo de um jeito (bebida conta por unidade comprada em fardo; embalagem por pacote) e quer olhar um de cada vez.

## Problema
Misturar tudo numa lista só dificulta achar uma bebida ou ver o que falta de embalagem. Como o alerta de estoque mínimo vale para as três categorias, um insumo crítico de embalagem some no meio dos ingredientes.

## Comportamento esperado
- Abas, nesta ordem: **Insumos** (categoria `INGREDIENTE`), **Embalagens** (`EMBALAGEM`), **Bebidas** (`BEBIDA`), **Prontos** (hoje "Produtos Prontos"). Rótulos curtos para caber em 375px sem rolagem horizontal.
- Acessibilidade: `role="tablist"` / `role="tab"` / `aria-selected`, setas do teclado trocam de aba, foco visível; cada aba com alvo `min-h-[44px]`.
- **Uma só busca de dados**: `GET /api/insumos` sem filtro (49 itens) e filtro no cliente por `categoria`. Evita recarregar a cada troca de aba. Insumo sem `categoria` na resposta (backend ainda antigo) é tratado como `INGREDIENTE` num único helper com teste.
- **Selo de alerta em cada aba**: número de insumos com alerta (crítico, vencido ou perto de vencer) da categoria, reaproveitando `temAlerta`/`estaCritico` (não duplicar a regra). Sem alerta, sem selo.
- O filtro interno (`todos` | `beneficiados` | `alertas`) continua dentro de cada aba de insumos; `beneficiados` só existe na aba **Insumos** (embalagem e bebida não são beneficiadas).
- A busca por nome vale só dentro da aba atual; trocar de aba mantém o texto digitado e mostra o resultado daquela categoria.
- Estado vazio por aba, com mensagem própria: "Nenhuma embalagem cadastrada. Toque em + para cadastrar." (idem bebidas).
- O botão "+" abre o cadastro já na categoria da aba (a seleção do campo é da [11](11-insumo-categoria-no-cadastro.md)).
- O estado da aba é só da sessão (não gravar no `localStorage`: ele pode estar bloqueado).
- Layout mobile-first, tokens de design, claro e escuro.

## Teste que deve falhar antes
Em `Estoque.spec.tsx`, com fixtures das três categorias:
- Cada aba mostra só os insumos da sua categoria; `Prontos` continua listando produtos.
- Selo de alerta com a contagem certa por categoria; sem selo quando é zero.
- Filtro `beneficiados` aparece só na aba Insumos.
- Busca "coca" na aba Bebidas encontra; a mesma busca na aba Insumos não mostra bebida.
- Insumo sem `categoria` cai em Insumos.
- Estado vazio de Embalagens quando não há nenhuma.
- Teclado: seta direita/esquerda troca de aba e atualiza `aria-selected`.
- Regressão: os testes atuais de Insumos e Produtos continuam verdes (adaptar, não apagar).

## Critério de pronto
- [x] Testes novos e todos os do Estoque verdes; nenhum caso antigo apagado sem equivalente.
- [x] `npm --prefix frontend run lint`, `test` e `build` verdes.
- [x] Conferido no navegador (claro `rgb(255, 249, 243)`, escuro `rgb(15, 15, 17)`, 375px e desktop 1280px, API mock local com as três categorias e alertas) com captura.
- [x] Linha marcada `FEITA (#113)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Campo de categoria no formulário ([11](11-insumo-categoria-no-cadastro.md)), entrada manual ([15](15-entrada-manual-estoque-tela.md)), mudanças no backend.
