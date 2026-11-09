# F0.5: Fundação visual do frontend

> **Status:** especificação aprovada pelo dono em 09/11/2026 (nível B: movimento + identidade; ícones da barra inferior no estilo 1).
> **Dono:** agente FRONT. **Depende de:** F0 (#57) mergeado.
> **Referência visual obrigatória:** [`docs/design/referencia-visual.html`](design/referencia-visual.html). Abra no navegador: ela traz a paleta, o mascote nos 6 humores, os ícones da barra inferior e a tela inicial reimaginada. Quando este texto e o HTML divergirem em aparência, o HTML vale. Quando divergirem em regra (acessibilidade, testes, escopo), este texto vale.
> **Origem:** o "jeito" visual vem do projeto Meister (`/home/feltan/Projetos/Meister-main/frontend`). Os caminhos citados como "Meister:" são arquivos daquele repositório para usar de modelo.

## Objetivo

Criar a base visual compartilhada (tokens, movimento, componentes de feedback, mascote e ícones) **sem reescrever as telas**. As telas migram depois, uma por fase (F1–F6), num commit `style(frontend)` separado do endurecimento (ver "Migração das telas" abaixo).

## Fora do escopo

- Restyle das páginas em `src/pages/*` (exceto o que muda sozinho por usar componentes compartilhados).
- Redesenho da tela inicial: entra no **F4**, usando a seção 4 da referência visual.
- Qualquer mudança de lógica, contrato de API ou backend.
- Confete, vidro (`glass-bar`), `TiltCard` e fundo decorativo (nível C, não aprovado).

## Dependências novas (aprovadas pelo dono em 09/11/2026)

O AGENTS.md exige aprovação para mexer em dependências; estas estão aprovadas:

| Pacote | Versão | Motivo |
|---|---|---|
| `motion` | `^14.9.1` (a mesma do Meister) | animações (molas, `AnimatePresence`, `useReducedMotion`) |
| `@phosphor-icons/react` | `^2.1.10` (a mesma do Meister) | ícones utilitários |
| ~~`lucide-react`~~ | remover | substituído pelo Phosphor |

Fonte: **Plus Jakarta Sans** (400, 500, 600, 700, 800) via Google Fonts no `index.html`, como no Meister (`index.html`, linhas 15–18). Nenhuma outra dependência.

---

## Entregáveis (um commit por item)

### 1. Tokens de design: `src/index.css`

Substituir o CSS atual por um bloco `@theme` no modelo de `Meister: src/index.css`, com a paleta abaixo. **Todas as cores do app passam a vir de tokens** (`bg-canvas`, `text-ink`, `bg-primary`…). Nada de `gray-*`, `red-*`, `blue-*` em código novo.

| Token (`--color-*`) | Claro | Escuro | Uso |
|---|---|---|---|
| `canvas` | `#FFF9F3` | `#0F0F11` | fundo da tela |
| `card` | `#FFFFFF` | `#1A1A1D` | cards, barra inferior |
| `card-2` | `#FBF3EA` | `#222226` | card secundário, trilho de barras |
| `field` | `#F6EEE5` | `#26262B` | campos de formulário |
| `line` | `#EFE4D8` | `#2E2E34` | bordas e divisores |
| `ink` | `#151413` | `#F5F3F0` | texto principal |
| `ink-soft` | `#3D3A36` | `#D6D3D1` | texto de apoio forte |
| `muted` | `#6B625A` | `#A8A29E` | texto secundário |
| `faint` | `#9C958D` | `#78716C` | placeholder, metadado |
| `primary` | `#FF7A1A` | `#FF8A33` | botão principal, destaque, barras |
| `primary-deep` | `#E85D04` | `#FF7A1A` | hover/pressionado |
| `primary-soft` | `#FFE8D6` | `#3A2210` | fundo de chip e da aba ativa |
| `brand` | `#B54708` | `#FFB077` | **texto** laranja (o `primary` não passa contraste como texto) |
| `on-primary` | `#151413` | `#151413` | texto sobre `primary` (**sempre preto**) |
| `secondary` | `#1D4ED8` | `#7AA7FF` | ação secundária, link, informação |
| `secondary-soft` | `#DCE7FF` | `#16264A` | fundo de chip azul |
| `on-secondary` | `#FFFFFF` | `#0B1A3A` | texto sobre `secondary` |
| `danger` | `#C0262D` | `#FF7B7B` | erro, vencido (vermelho "ketchup", ≠ laranja) |
| `danger-soft` | `#FDE2E2` | `#3B1416` | fundo de alerta |
| `success` | `#15803D` | `#4ADE80` | sucesso |
| `success-soft` | `#EAF8EE` | `#123322` | fundo de sucesso |

**Modo escuro:** o Burguer já usa a classe `.dark` (`@custom-variant dark` + `ThemeContext`). Os valores escuros vão num bloco `.dark { --color-…: … }` que redefine as variáveis. Com isso as telas migradas **não precisam de `dark:`**: o token muda sozinho. Manter o `@custom-variant` para as telas ainda não migradas.

**Contraste (medido, WCAG AA ≥ 4,5):** ink/canvas 17,6 · muted/card 6,0 · preto/primary 7,1 · brand/card 5,4 · branco/secondary 6,7 · danger/card 5,9 · success/card 5,0. Sobre fundo suave (chips e alertas): secondary/secondary-soft 5,4 · danger/danger-soft 4,8 · success/success-soft 4,6 · brand/primary-soft 4,6. No escuro todos ≥ 6,2. **Proibido:** texto branco sobre `primary` (2,6). Teste obrigatório: um spec que calcula o contraste dos pares da tabela a partir do CSS e falha abaixo de 4,5.

Demais tokens: copiar de `Meister: src/index.css` os raios (`--radius-card: 1.5rem`), as sombras (`--shadow-card`, `--shadow-float`), as curvas (`--ease-spring`, `--ease-out-expo`), as animações CSS (`fade-in`, `scale-up`, `shimmer`) e o bloco `@layer base`: fonte 16 px nos campos no celular (evita zoom no iOS), `touch-action: manipulation`, `:focus-visible` com contorno em `primary-deep`, utilitários `pt-safe`/`pb-safe`. A sombra "honey" vira `--shadow-primary` com a cor laranja.

### 2. Movimento: `src/lib/motion.ts`

Copiar `Meister: src/lib/motion.ts` (37 linhas): `spring`, `springSoft`, `stagger`, `rise`, `page`, `tap`. Manter o comentário sobre **não usar `filter`** na transição de página, porque quebra `position: fixed` dentro dela.

- **Transição entre abas:** o `App.tsx` troca de tela por estado (`activeTab`), sem roteador. Envolver o conteúdo em `<AnimatePresence mode="wait">` com `key={activeTab}` e as variantes `page`.
- **Reduzir movimento:** todo componente animado usa `useReducedMotion()` e desliga loops e deslocamentos quando ele estiver ativo (como o `Mel.tsx` e o `Sheet.tsx` do Meister).
- **Testes:** em `src/test/setup.ts`, `MotionGlobalConfig.skipAnimations = true` (import de `motion/react`), para que `AnimatePresence` não atrase a desmontagem no jsdom. Um teste prova isso: abre e fecha um `Sheet` e verifica que ele sai do DOM sem esperar.

### 3. Componentes de interface: `src/components/ui/`

Portar do Meister, adaptando aos tokens do Burguer (os nomes de classe mudam: `bg-card`, `text-ink`… já existem nos dois; trocar `honey`/`primary` conforme a tabela):

| Componente | Origem (Meister) | Observação |
|---|---|---|
| `Sheet.tsx` | `components/ui/Sheet.tsx` (147 l.) | no celular sobe de baixo e fecha arrastando; no desktop vira diálogo; foco preso e `Esc` fecham |
| `Toast.tsx` | `components/ui/Toast.tsx` (146 l.) | variantes `success`/`danger`/`info`/`warning` |
| `ConfirmDialog.tsx` | `components/ui/ConfirmDialog.tsx` (75 l.) | `confirmVariant: 'danger' \| 'primary'` |
| `AnimatedNumber.tsx` | `components/ui/AnimatedNumber.tsx` (52 l.) | **formatar com `formatarMoeda`/`formatarQuantidade` do F0**, não com o `formatBRL` do Meister |
| `MotionIcon.tsx` | `components/ui/MotionIcon.tsx` (43 l.) | `wave`, `twinkle`, `pulse`, `pop`, `bounce`, `wiggle` |
| `Portal.tsx` | `components/ui/Portal.tsx` (12 l.) | usado por Sheet/Toast |

**`FeedbackContext` mantém a API.** As telas chamam `toast.sucesso/erro/info/aviso(msg)` e `confirmar({ titulo, mensagem, textoConfirmar, perigoso })`. Essa interface **não muda**. Só a renderização interna passa a usar `Toast` e `ConfirmDialog` (`perigoso: true` → `confirmVariant="danger"`). Os testes atuais do contexto devem passar sem alteração; se algum precisar mudar, explicar no PR por quê.

`PerfilModal` e `ConfiguracoesModal` **não** migram para `Sheet` aqui. Isso fica no F5, junto do endurecimento deles.

### 4. Ícones utilitários: Phosphor

- `src/components/ui/icons.ts` no modelo de `Meister: src/components/ui/icons.ts`: **um export por ícone, importado pelo caminho do arquivo** (`@phosphor-icons/react/dist/csr/Trash`). Importar do índice faz o Vite carregar a biblioteca inteira (6 MB) no modo dev.
- Trocar os **42 ícones lucide em 14 arquivos** e remover o `lucide-react` do `package.json`. Mapa de referência (completar com o equivalente direto para os demais):

| lucide | Phosphor | | lucide | Phosphor |
|---|---|---|---|---|
| `Trash2` | `Trash` | | `BarChart2` | `ChartBar` |
| `Edit2` | `PencilSimple` | | `RefreshCw` | `ArrowsClockwise` |
| `Loader2` | `CircleNotch` (girando) | | `Store` | `Storefront` |
| `AlertTriangle` | `Warning` | | `LogIn` / `LogOut` | `SignIn` / `SignOut` |
| `AlertCircle` | `WarningCircle` | | `Mail` | `Envelope` |
| `CheckCircle2` | `CheckCircle` | | `Settings` | `Gear` |
| `HelpCircle` | `Question` | | `KeyRound` | `Key` |
| `Sparkles` | `Sparkle` | | `ChefHat` | `ChefHat` |

- **Pesos (convenção do Meister):** `bold` como padrão · `duotone` em ícone de destaque (ações principais, títulos de seção) · `fill` em estado ativo/selecionado e em avisos.
- Ícones de domínio disponíveis e preferidos onde couber: `Hamburger`, `CookingPot`, `Scales`, `Thermometer`, `Truck`, `Receipt`, `QrCode`, `Package`, `ShoppingCart`, `TrendDown`.
- Props: o lucide usa `size`/`strokeWidth`; o Phosphor usa `size`/`weight`. Não passar `strokeWidth` adiante.

### 5. Ícones próprios da barra inferior: `src/components/brand/NavIcons.tsx`

Quatro ícones desenhados (SVG `viewBox="0 0 32 32"`), **estilo 1 "adesivo"**, com os traços da seção 3 da referência visual:

| Aba | Desenho |
|---|---|
| Início | hambúrguer (pão, alface, queijo, carne, pão) |
| Estoque | geladeira azul com queijo e tomate |
| Perdas | lixeira com pão mordido caindo |
| Relatórios | comanda picotada com barras de gráfico |

- **Inativo:** só contorno, cor `muted`, `stroke-width` 1,7, sem preenchimento.
- **Ativo:** preenchido com as cores da marca, contorno preto `#151413`, `stroke-width` 1,9, dentro de uma pílula `primary-soft`, rótulo em `brand` peso 600; entra com "pop" (`scale 0.6 → 1.18 → 1`, mola). Sem pop com "reduzir movimento".
- As cores internas vêm de tokens (`primary`, `secondary`); as cores "de comida" (queijo `#FFC531`, carne `#5A3220`, alface `#4CAF50`, pão de baixo `#E9A057`) ficam como constantes nomeadas no arquivo.
- Testar em 24 e 28 px no celular real antes de fechar o PR (traço fino demais some). Ajuste fino de traço é esperado; mudança de conceito, não.
- `BottomNav.tsx` passa a usar esses ícones; `aria-current="page"` na aba ativa; alvo de toque ≥ 44×44 px.

### 6. Mascote Smash: `src/components/brand/Smash.tsx`

> **Nome: Smash** (decidido pelo dono em 09/11/2026). Componente `Smash`, texto alternativo padrão "Smash, o mascote do Burguer House" (como o `title` do `Mel`).

- Modelo: `Meister: src/components/brand/Mel.tsx` (176 linhas): SVG puro + `motion`, `useId` para ids de gradiente/clip, `useReducedMotion`.
- Desenho: seção 2 da referência visual (`viewBox="0 0 160 160"`): pão de cima laranja com gergelim, boné azul, rosto no pão, alface, queijo derretendo, carne, pão de baixo, braços pretos com luvas brancas, sombra no chão.
- Props: `mood: 'idle' | 'happy' | 'thinking' | 'alert' | 'wave' | 'celebrate'`, `size` (padrão 120), `animated` (padrão `true`; desligar em tamanhos pequenos), `className`, `title`.
- Humores (movimento e expressão como na referência):

| Humor | Expressão | Movimento | Onde vai aparecer (nas fases seguintes) |
|---|---|---|---|
| `idle` | olhos abertos, sorriso | flutua devagar | Início sem pendências |
| `wave` | sorriso, braço levantado | balança | Login |
| `thinking` | sorriso pequeno, balões de pensamento | flutua e inclina | telas vazias (`EstadoVazio`) |
| `happy` | olhos fechados (^^), boca aberta | quica | ação salva |
| `alert` | sobrancelhas, boca torta, gota de suor azul | treme a cada 2 s | estoque baixo, vencido, sem conexão |
| `celebrate` | olhos fechados, dois braços para cima, confete | o pão de cima "pula" | NF importada |

- Piscar de olhos em `idle`, `thinking`, `alert` e `wave` (como o Mel).
- **No F0.5 o mascote só entra em dois lugares:** `EstadoVazio.tsx` (`thinking`) e a tela de carregamento do `App.tsx` (`idle`, no lugar do spinner). O resto acontece nas fases das telas.
- Teste: renderiza cada humor sem erro e com `role="img"` + rótulo; com "reduzir movimento", nenhum `animate` em loop.

---

## Migração das telas (regra para F1–F6)

Cada PR de fase passa a ter **dois commits separados**:

1. `fix(frontend): …`: endurecimento (lógica, testes, achados), como já previsto no `PLANO_FRONTEND.md`.
2. `style(frontend): migrar <Tela> para os tokens`: só visual:
   - trocar pares `bg-white dark:bg-gray-900` → `bg-card`, `text-gray-500 dark:text-gray-400` → `text-muted`, etc. **Zero `dark:` e zero cor literal** na tela migrada;
   - modais da tela → `Sheet`; listas e cards com `stagger`/`rise`; botões com `whileTap={tap}`; valores com `AnimatedNumber` onde houver número de destaque;
   - ícones de destaque em `duotone`.

O commit de estilo **não pode mudar comportamento**: os testes do commit 1 passam sem alteração. Um teste de `grep` (spec que lê o arquivo da tela) garante que a tela migrada não contém `dark:` nem `-gray-`.

A tela inicial do F4 segue a seção 4 da referência visual:
- saudação + mascote com fala;
- card de vendas em `ink` com número animado;
- duas ações principais (`primary` e `secondary`) e dois atalhos;
- "Pedem atenção" com a ação certa por item;
- "Mais vendidos hoje".

---

## Critério de pronto do F0.5

1. `npm --prefix frontend run lint`, `test` e `build` verdes; `lucide-react` fora do `package.json` e do código (`grep -r lucide src` vazio).
2. Testes novos (cada um provado por mutação, como no F0):
   - contraste dos pares de tokens ≥ 4,5;
   - `Sheet` monta, fecha com `Esc` e sai do DOM (com `skipAnimations`);
   - `FeedbackContext`: os testes antigos passam sem alteração e `perigoso` vira variante `danger`;
   - `Smash`: os 6 humores renderizam, com rótulo, e respeitam "reduzir movimento";
   - `BottomNav`: aba ativa com `aria-current` e ícone preenchido.
3. **Verificação visual registrada no PR:** capturas da barra inferior, de um toast, de um confirm, do `EstadoVazio` e da tela de carregamento, em **claro e escuro**, a 375 px de largura. Comparar com a referência visual.
4. Nenhuma página de `src/pages/*` com mudança de lógica; diferenças visuais nelas só as que vêm de componentes compartilhados.
5. Bundle: registrar no PR o tamanho do `dist` antes e depois. Se o `motion` + Phosphor aumentarem mais de 150 kB (gzip), explicar.
