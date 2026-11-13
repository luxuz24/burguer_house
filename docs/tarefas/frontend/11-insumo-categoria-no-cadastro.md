# 11 — Categoria do insumo no cadastro e na edição

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Pedido da hamburgueria (embalagens e bebidas em abas próprias); o backend já expõe `categoria` na tarefa 21
- **Depende de:** backend [21](../backend/21-insumos-categoria.md); frontend [07](07-estoque-editar-excluir-no-sheet.md) e [10](10-estoque-abas-por-categoria.md)
- **Arquivos:** `frontend/src/pages/Estoque.tsx` (Sheet de cadastro/edição, `FormInsumo`, `formInsumoVazio`, `basePayload`), `frontend/src/pages/Estoque.spec.tsx`
- **Branch sugerida:** `feat/frontend-insumo-categoria-cadastro`

## Contexto
O formulário do Sheet cadastra e edita insumo (nome, unidade, estoque, mínimo, custo, fator de perda, beneficiado, validade). A categoria existe no banco desde a Fase 2, mas a tela não permite escolher nem alterar.

## Problema
Sem o campo, todo insumo novo nasce `INGREDIENTE`: uma bebida ou embalagem cadastrada pela tela cai na aba errada. E os 49 insumos antigos cujo nome fugiu do padrão do seed (ex.: "Coca Cola 600mL (promo)") ficaram como ingrediente e não têm como ser reclassificados.

## Comportamento esperado
- Campo **Categoria** no Sheet: três opções (Ingrediente, Embalagem, Bebida) em grupo de rádio com `role="radiogroup"`, alvo de 44px, nome acessível.
- **Cadastro novo:** vem selecionada a categoria da aba aberta (aba Bebidas → Bebida). Na aba Prontos não há cadastro de insumo.
- **Edição:** mostra a categoria atual; ao salvar, o `PUT` leva `categoria`.
- Campos que não fazem sentido para embalagem e bebida (**Beneficiado** e **Validade em dias**) ficam ocultos nessas categorias. Se o insumo editado já é beneficiado, o campo permanece visível (não esconder dado existente).
- O payload do `POST`/`PUT` sempre inclui `categoria` (enum `INGREDIENTE` | `EMBALAGEM` | `BEBIDA`).
- Depois de salvar uma troca de categoria, o item aparece na aba nova e some da antiga, com aviso `toast`: "Movido para Bebidas.".
- Erro do backend (`400`) aparece com a mensagem dele e o Sheet continua aberto, dados preservados.
- Travar o envio com `useEnvio` (duplo toque não envia duas vezes), como o resto do formulário.

## Teste que deve falhar antes
- Abrir "+" na aba Embalagens: o rádio **Embalagem** vem marcado; salvar envia `categoria: 'EMBALAGEM'`.
- Editar um insumo `INGREDIENTE`, trocar para **Bebida**, salvar: `PUT` com `categoria: 'BEBIDA'` e o item passa para a aba Bebidas.
- Categoria Embalagem/Bebida oculta Beneficiado e Validade; um beneficiado existente continua mostrando.
- Erro `400` mantém o Sheet aberto com a mensagem do backend.
- Duplo clique em "Salvar" faz uma única chamada.
- Regressão: cadastro e edição de ingrediente continuam como antes (todos os testes atuais verdes).

## Critério de pronto
- [ ] Testes novos e todos os do Estoque verdes.
- [ ] `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px) com captura e **medição da cor de fundo**; reclassificar um insumo de verdade e ver a mudança de aba.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Reclassificação em massa, mudanças no backend, renomear insumos.
