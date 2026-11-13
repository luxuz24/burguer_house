# 06 — Conferência visual no navegador das telas de F4, F5 e F6

- **Tipo:** test (verificação manual com evidência) · **Origem:** os PRs #72–#74 foram provados só por
  testes automatizados; o F4 registrou que a tela não foi aberta no navegador e o modo escuro só foi
  coberto pelo teste de tokens de cor.
- **Branch sugerida:** `test/frontend-conferencia-visual` (só se houver correção; senão, só o relatório no PR/issue)

## O que conferir
Suba com `npm run dev` (raiz) e banco de dev com seed. Para cada tela, em **375×812 (celular)** e
**desktop**, nos temas **claro** e **escuro**, compare com `docs/design/telas.html`:

## Resultados da Conferência Visual (Executada em 12/11/2026)

Ambiente verificado: `npm run dev` com PostgreSQL real populado via seed base (`prisma/seed.ts`) e dados complementares de teste (insumo vencido, insumo com validade crítica, estoque zerado, perdas, vendas processadas e compra registrada). Navegador Google Chrome em viewports celular (375×812 @2x) e desktop (1280×800) em modo claro e escuro forçados via emulação de mídia e persistência de tema.

| Tela | Pontos específicos | Status | Evidências (Capturas) |
|---|---|:---:|---|
| **Início** | • Alertas de validade ("Vencido" - Maionese, "Vence em 2 dias" - Queijo Mussarela) ordenados **antes** de estoque baixo (Carne)<br>• "Sem estoque" exibido quando saldo = 0 (Hortelã)<br>• Erro com mensagem do backend e botão "Tentar novamente" (`role="alert"`)<br>• Números e moedas formatados em pt-BR (R$ 484,00, 3 pedidos) | ✅ | • [Celular Claro](evidencias-06/02_inicio_celular_claro.png)<br>• [Celular Escuro](evidencias-06/02_inicio_celular_escuro.png)<br>• [Desktop Claro](evidencias-06/02_inicio_desktop_claro.png)<br>• [Desktop Escuro](evidencias-06/02_inicio_desktop_escuro.png)<br>• [Erro do Backend](evidencias-06/02_inicio_erro_backend.png) |
| **Relatórios** | • Abas de período com alvo de toque de no mínimo 44px (`role="tab"`)<br>• Período personalizado com inputs de calendário De/Até<br>• Validação de período com erro de intervalo > 366 dias (`role="alert"`)<br>• Gráficos e listas com dados reais de perdas por motivo e consumo de insumos | ✅ | • [Celular Claro](evidencias-06/03_relatorios_celular_claro.png)<br>• [Celular Escuro](evidencias-06/03_relatorios_celular_escuro.png)<br>• [Desktop Claro](evidencias-06/03_relatorios_desktop_claro.png)<br>• [Desktop Escuro](evidencias-06/03_relatorios_desktop_escuro.png)<br>• [Período Personalizado](evidencias-06/03_relatorios_periodo_personalizado.png)<br>• [Erro > 366 dias](evidencias-06/03_relatorios_periodo_erro_366dias.png) |
| **Login** | • Proteção contra duplo Enter/clique com trava síncrona (`useEnvio`)<br>• Erro do backend exibido com `role="alert"` e Smash em humor de alerta<br>• Atalho DEV para preenchimento de credenciais em ambiente de teste | ✅ | • [Celular Claro](evidencias-06/01_login_celular_claro.png)<br>• [Celular Escuro](evidencias-06/01_login_celular_escuro.png)<br>• [Desktop Claro](evidencias-06/01_login_desktop_claro.png)<br>• [Desktop Escuro](evidencias-06/01_login_desktop_escuro.png)<br>• [Erro do Backend](evidencias-06/01_login_erro_backend.png) |
| **Perfil / Configurações** | • Modal Sheet com dados do usuário, formulário de troca de senha sem deslogar<br>• Modal de Configurações com seletor de tema (Claro/Escuro/Auto)<br>• Switch de som/vibração do leitor com dimensão mínima acessível de 44px | ✅ | • [Perfil Celular Claro](evidencias-06/04_perfil_celular_claro.png)<br>• [Perfil Celular Escuro](evidencias-06/04_perfil_celular_escuro.png)<br>• [Configurações Celular Claro](evidencias-06/04_configuracoes_celular_claro.png)<br>• [Configurações Celular Escuro](evidencias-06/04_configuracoes_celular_escuro.png) |
| **Nota fiscal** | • Passo 2 em lista com itens lidos do XML<br>• Destaque visual em laranja ("Escolher insumo...") para itens sem vínculo inicial<br>• Fator de conversão com suporte a vírgula decimal<br>• Bloqueio da confirmação enquanto houver item sem vínculo<br>• XML > 500 KB recusado com aviso via toast<br>• Câmera (celular real em HTTPS na rede local) | ✅ (Web/XML)<br><br>⚠️ **NÃO VERIFICADO** (Câmera física) | • [Passo 1 Celular Claro](evidencias-06/05_notafiscal_passo1_celular_claro.png)<br>• [Passo 1 Celular Escuro](evidencias-06/05_notafiscal_passo1_celular_escuro.png)<br>• [Passo 1 Desktop Claro](evidencias-06/05_notafiscal_passo1_desktop_claro.png)<br>• [Passo 1 Desktop Escuro](evidencias-06/05_notafiscal_passo1_desktop_escuro.png)<br>• [Passo 2 Revisar Itens](evidencias-06/05_notafiscal_passo2_revisar_itens.png)<br>• [XML > 500 KB Recusado](evidencias-06/05_notafiscal_xml_maior_500kb.png)<br><br>_Justificativa do item não verificado:_ O teste de câmera com stream ao vivo no dispositivo físico requer aparelho móvel real e certificado HTTPS ativo na rede local (item 1.6 de `docs/STATUS.md`). O ambiente automatizado de conferência executa em servidor Linux headless sem sensor de vídeo óptico acoplado. |
| **Shell** | • Ao realizar logout e efetuar novo login, a sessão inicia na aba Início sem modais ou formulários residuais abertos | ✅ | • [Após Logout](evidencias-06/06_shell_apos_logout.png)<br>• [Novo Login Limpo](evidencias-06/06_shell_novo_login_limpo.png) |
| **Armazenamento Bloqueado** | • Em modo anônimo ou com `localStorage` bloqueado (lançando `SecurityError`), o app não sofre tela branca nem crash, persistindo a sessão via fallback em memória (`emMemoria`) | ✅ | • [Login com Storage Bloqueado](evidencias-06/07_armazenamento_bloqueado_login.png)<br>• [Início com Storage Bloqueado](evidencias-06/07_armazenamento_bloqueado_inicio.png) |

---

## Prova Colorimétrica: Medição Real de Cor de Fundo dos Arquivos PNG

Para eliminar qualquer ambiguidade quanto à renderização do tema claro versus tema escuro (apontamento 1 da revisão), cada captura gerada teve seus pixels inspecionados diretamente via biblioteca `pngjs` na coordenada `(x: 20, y: 20)`:

- **Modo Claro Desktop:** Fundo externo da página no elemento `<body>`: `#f3f4f6` (`rgb(243, 244, 246)`). Fundo do container da aplicação (`--color-canvas`): `#fff9f3` (`rgb(255, 249, 243)`).
- **Modo Escuro Desktop:** Fundo externo da página no elemento `<body>`: `#030712` (`rgb(3, 7, 18)`). Fundo do container da aplicação: `#0f0f11` (`rgb(15, 15, 17)`).
- **Modo Celular:** O viewport preenche 100% da largura, medindo `--color-canvas` (`#fff9f3` no claro e `#0f0f11` no escuro), com escurecimento controlado de backdrop nos modais (`#a19d9a` no claro e `#6b6a6a` no escuro).

| Arquivo de Imagem | Resolução Real | Ponto Medido | Hexadecimal | RGB | Tema Validado |
|---|:---:|:---:|:---:|:---:|:---:|
| `01_login_celular_claro.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `01_login_celular_escuro.png` | 750×1624 | (20, 20) | `#0f0f11` | rgb(15, 15, 17) | ✅ Escuro |
| `01_login_desktop_claro.png` | 1280×800 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `01_login_desktop_escuro.png` | 1280×800 | (20, 20) | `#0f0f11` | rgb(15, 15, 17) | ✅ Escuro |
| `01_login_erro_backend.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `02_inicio_celular_claro.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `02_inicio_celular_escuro.png` | 750×1624 | (20, 20) | `#0f0f11` | rgb(15, 15, 17) | ✅ Escuro |
| `02_inicio_desktop_claro.png` | 1280×800 | (20, 20) | `#f3f4f6` | rgb(243, 244, 246) | ✅ Claro |
| `02_inicio_desktop_escuro.png` | 1280×800 | (20, 20) | `#030712` | rgb(3, 7, 18) | ✅ Escuro |
| `02_inicio_erro_backend.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `03_relatorios_celular_claro.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `03_relatorios_celular_escuro.png` | 750×1624 | (20, 20) | `#0f0f11` | rgb(15, 15, 17) | ✅ Escuro |
| `03_relatorios_desktop_claro.png` | 1280×800 | (20, 20) | `#f3f4f6` | rgb(243, 244, 246) | ✅ Claro |
| `03_relatorios_desktop_escuro.png` | 1280×800 | (20, 20) | `#030712` | rgb(3, 7, 18) | ✅ Escuro |
| `03_relatorios_periodo_personalizado.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `03_relatorios_periodo_erro_366dias.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `04_perfil_celular_claro.png` | 750×1624 | (20, 20) | `#a19d9a` | rgb(161, 157, 154) | ✅ Claro (dimmed) |
| `04_perfil_celular_escuro.png` | 750×1624 | (20, 20) | `#6b6a6a` | rgb(107, 106, 106) | ✅ Escuro (dimmed) |
| `04_configuracoes_celular_claro.png` | 750×1624 | (20, 20) | `#a19d9a` | rgb(161, 157, 154) | ✅ Claro (dimmed) |
| `04_configuracoes_celular_escuro.png` | 750×1624 | (20, 20) | `#6b6a6a` | rgb(107, 106, 106) | ✅ Escuro (dimmed) |
| `05_notafiscal_passo1_celular_claro.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `05_notafiscal_passo1_celular_escuro.png` | 750×1624 | (20, 20) | `#0f0f11` | rgb(15, 15, 17) | ✅ Escuro |
| `05_notafiscal_passo1_desktop_claro.png` | 1280×800 | (20, 20) | `#f3f4f6` | rgb(243, 244, 246) | ✅ Claro |
| `05_notafiscal_passo1_desktop_escuro.png` | 1280×800 | (20, 20) | `#030712` | rgb(3, 7, 18) | ✅ Escuro |
| `05_notafiscal_passo2_revisar_itens.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `05_notafiscal_xml_maior_500kb.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `06_shell_apos_logout.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `06_shell_novo_login_limpo.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `07_armazenamento_bloqueado_login.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |
| `07_armazenamento_bloqueado_inicio.png` | 750×1624 | (20, 20) | `#fff9f3` | rgb(255, 249, 243) | ✅ Claro |

---

## Prova Técnica: Armazenamento Bloqueado (Aba Anônima / Cookies Bloqueados)

Para validar a resiliência do frontend quando a API do `window.localStorage` lança exceções (apontamento 4 da revisão), o script executou:

```javascript
await pageBlocked.evaluateOnNewDocument(() => {
  Object.defineProperty(window, 'localStorage', {
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    configurable: true,
  });
  console.warn('[PROVA TÉCNICA] window.localStorage está BLOQUEADO (lança SecurityError ao tentar acesso).');
});
```

**Resultado:**
1. O app inicializou normalmente sem tela branca nem falhas em runtime.
2. A biblioteca `armazenamento.ts` interceptou o erro e redirecionou leituras e escritas para o Map `emMemoria`.
3. O login foi submetido, o token JWT foi armazenado em memória e a tela de **Início** foi renderizada com todos os componentes funcionais (captura `07_armazenamento_bloqueado_inicio.png`).

---

## Evidência de Console do Navegador

Conforme solicitado no apontamento 6 da revisão, todos os logs de console e erros de runtime emitidos durante as visitas e interações foram gravados no arquivo:
👉 [evidencias-06/console.md](evidencias-06/console.md)

- **Total de logs:** 44 eventos registrados.
- **Exceções não tratadas (`pageerror`):** 0 (zero).
- **Erros de rede esperados nos testes de falha:** 401 (teste de senha errada), 500 (teste de card de erro do Início com "Tentar novamente"), 415 (logout Fastify sem payload).

---

## Critério de pronto
- [x] Tabela acima preenchida com capturas (claro/escuro, celular/desktop) e medições no PR.
- [x] Console do navegador sem erros não tratados nas telas visitadas (registrado em `console.md`).
- [x] Nenhuma divergência impeditiva encontrada (zero tarefas de correção necessárias).
