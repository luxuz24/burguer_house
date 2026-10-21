# BurgerStock: documentação do projeto

Esta pasta (`docs/`) é também um **vault do Obsidian**: abra o Obsidian, escolha **Abrir pasta como cofre** e selecione `docs/`. Os links são relativos e funcionam no Obsidian e no GitHub. A configuração local do Obsidian (`.obsidian/`) e as notas pessoais (`pessoal/`, `reunioes/`) não vão para o Git.

## Por onde começar

| Quero... | Leia |
|---|---|
| Entender o sistema por inteiro | [Arquitetura](arquitetura.md) |
| Ver as rotas e o formato das respostas | [Contrato da API](api.md) |
| Saber o que o projeto deve entregar e em que ordem | [Plano](PLANO.md) |
| Ver pedidos entre áreas, decisões e pendências | [Pedidos e decisões](requests.md) |

## Mapa dos arquivos

- [arquitetura.md](arquitetura.md): diagramas (contexto, backend, banco, fluxos, frontend, infraestrutura).
- [api.md](api.md): contrato das rotas. **Fonte de verdade**: se mudar uma rota, atualize no mesmo commit.
- [PLANO.md](PLANO.md): escopo e critério de "pronto" de cada fase.
- [STATUS.md](STATUS.md): comparação do plano com o que foi implementado. **Está desatualizado** (ainda lista como pendentes itens que já existem, como o webhook e a consolidação) e usa caminhos absolutos que não abrem no Obsidian.
- [requests.md](requests.md): pedidos de mudança entre áreas (schema, testes) e decisões pendentes do dono da loja.
- [dados_reais.md](dados_reais.md) e `dados_reais.json`: dados reais da loja (insumos e métricas). Não contêm payloads do webhook.
- `exemplo_nfe.xml`: exemplo de nota fiscal para testes do parser.

## Notas pessoais (ficam fora do Git)

A pasta `docs/pessoal/` existe só no seu computador e está no `.gitignore`: atas de reunião, glossário e anotações de estudo do produto ficam lá, dentro do mesmo vault, e **nunca são enviadas ao repositório**. Para criar uma nota pessoal, basta criar o arquivo dentro de `docs/pessoal/` (ou de `docs/reunioes/`, que também é ignorada).

## Convenções

- Escreva links como `[texto](arquivo.md)` (não use `[[wikilinks]]`, que o GitHub não resolve).
- Diagramas são em **Mermaid** dentro de blocos ` ```mermaid `: o GitHub e o Obsidian desenham sozinhos.
- Mudou código que altera um diagrama? Atualize [arquitetura.md](arquitetura.md) no mesmo PR.
- Dados pessoais (CPF, telefone, endereço de clientes) nunca entram nas notas.
