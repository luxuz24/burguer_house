# 01 — Som do leitor de QR ignora a preferência com armazenamento bloqueado

- **Tipo:** fix · **Origem:** endurecimento F5 (PR #72), achado registrado e não corrigido
- **Arquivos:** `frontend/src/lib/bipScanner.ts`, `frontend/src/components/ConfiguracoesModal.tsx`
- **Branch sugerida:** `fix/frontend-som-leitor-armazenamento`

## Contexto
A preferência "Som e vibração no QR code" (Configurações) fica na chave `cfg_som_scanner`. O F5 criou
`frontend/src/lib/armazenamento.ts` (`lerArmazenado`, `gravarArmazenado`, `removerArmazenado`), que
nunca lança e guarda uma cópia em memória quando o navegador recusa o `localStorage` (aba anônima,
dados de site bloqueados, cota cheia). Tema e sessão já usam esse módulo; o som do leitor não.

## Problema
- `bipScanner.ts:5-11` (`lerSomScanner`) lê `localStorage.getItem` direto e, se lançar, devolve `true`.
- `ConfiguracoesModal.tsx:27-35` (`alternarSom`) grava com `localStorage.setItem` direto e ignora a falha.

Resultado com armazenamento bloqueado: o usuário **desliga** o som, o switch mostra desligado, mas
`tocarBipScanner()` relê o storage, cai no `catch` e devolve `true`: o bip e a vibração continuam.
Ao reabrir Configurações o switch volta para ligado. Com cota cheia e um `'false'` antigo gravado, ligar
de novo não tem efeito (o valor velho continua lá).

## Comportamento esperado
- Ler e gravar a preferência só por `lerArmazenado`/`gravarArmazenado` (mesma chave
  `CHAVE_SOM_SCANNER`). Padrão continua **ligado** quando não há valor.
- Com armazenamento bloqueado, desligar vale até a aba fechar: switch e bip concordam.
- `ConfiguracoesModal` não acessa `localStorage` direto (nenhum `localStorage.` sobra nos dois arquivos).

## Teste que deve falhar antes
Em `frontend/src/lib/bipScanner.spec.ts` (e/ou `PerfilConfiguracoes.spec.tsx`):
1. Simule `localStorage.getItem`/`setItem` lançando `SecurityError` (veja como `armazenamento.spec.ts`
   ou os testes do `ThemeContext` fazem isso) e chame `limparArmazenamentoEmMemoria()` no `beforeEach`.
2. Desligue o som pelo switch de Configurações (ou `gravarArmazenado(CHAVE_SOM_SCANNER, 'false')`).
3. Chame `tocarBipScanner()` com `AudioContext` e `navigator.vibrate` falsos.
4. Espere que **nenhum** oscilador seja criado e `vibrate` não seja chamado. Hoje falha.
5. Reabra Configurações: o switch continua `aria-checked="false"`. Hoje falha.

## Critério de pronto
- [x] Testes acima falhando antes (saída colada no PR) e passando depois.
- [x] Teste de regressão: com storage normal, padrão ligado e alternar continua funcionando.
- [x] `graphify affected "lerSomScanner()"` conferido; chamadores (`ImportarNotaFiscal.tsx`,
      `ConfiguracoesModal.tsx`) sem mudança de comportamento com storage normal.
- [x] Lint, testes e build verdes.

## Fora do escopo
O tamanho do switch (tarefa 02).
