<div align="center">

<img src="frontend/public/icon-192.png" width="96" alt="Ícone do Burguer House" />

# Burguer House · BurgerStock

**Controle de estoque da cozinha de uma hamburgueria, feito para o celular.**

Compra entra pela nota fiscal, venda sai pela ficha técnica, perda é registrada com um toque
e os relatórios mostram para onde o dinheiro está indo. Sem planilha.

![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify_5-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-06B6D4?logo=tailwindcss&logoColor=white)

</div>

> As telas abaixo usam o banco de demonstração do projeto, com 30 dias de movimento **fictício**
> sobre o catálogo real da loja (insumos, receitas e cardápio).

## O aplicativo

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/login.png" width="230" alt="Tela de login" /></td>
    <td align="center"><img src="docs/screenshots/inicio.png" width="230" alt="Tela inicial" /></td>
    <td align="center"><img src="docs/screenshots/inicio-claro.png" width="230" alt="Tela inicial no tema claro" /></td>
  </tr>
  <tr>
    <td align="center"><b>Login</b></td>
    <td align="center"><b>Início</b><br/><sub>alertas, atalhos e vendas retidas</sub></td>
    <td align="center"><b>Tema claro</b><br/><sub>claro, escuro ou o do sistema</sub></td>
  </tr>
</table>

### Estoque

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/estoque.png" width="230" alt="Lista de insumos do estoque" /></td>
    <td align="center"><img src="docs/screenshots/ficha-tecnica.png" width="230" alt="Ficha técnica de um lanche" /></td>
    <td align="center"><img src="docs/screenshots/contagem.png" width="230" alt="Contagem de estoque" /></td>
  </tr>
  <tr>
    <td align="center"><b>Insumos</b><br/><sub>saldo, estoque mínimo e alertas</sub></td>
    <td align="center"><b>Ficha técnica</b><br/><sub>o que cada lanche consome</sub></td>
    <td align="center"><b>Contagem</b><br/><sub>ajuste pelo que está na prateleira</sub></td>
  </tr>
</table>

### Entradas e saídas

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/nota-fiscal.png" width="230" alt="Importação de nota fiscal" /></td>
    <td align="center"><img src="docs/screenshots/fechar-o-dia.png" width="230" alt="Fechamento do dia" /></td>
    <td align="center"><img src="docs/screenshots/perdas.png" width="230" alt="Registro de perdas" /></td>
  </tr>
  <tr>
    <td align="center"><b>Nota fiscal</b><br/><sub>QR code da NFC-e ou XML da NF-e</sub></td>
    <td align="center"><b>Fechar o dia</b><br/><sub>prévia do impacto antes da baixa</sub></td>
    <td align="center"><b>Perdas</b><br/><sub>vencimento, erro de preparo, estragado</sub></td>
  </tr>
</table>

### Relatórios

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/relatorios.png" width="230" alt="Resumo do mês" /></td>
    <td align="center"><img src="docs/screenshots/relatorios-ranking.png" width="230" alt="Ranking de vendas e consumo" /></td>
  </tr>
  <tr>
    <td align="center"><b>Resumo do período</b><br/><sub>pedidos, compras, perdas e fornecedores</sub></td>
    <td align="center"><b>O que vai faltar e o que mais sai</b><br/><sub>mais vendidos e custo do consumo</sub></td>
  </tr>
</table>

## Como funciona

```mermaid
flowchart LR
    nf["Nota fiscal<br/>(QR code ou XML)"] -- entrada --> est[("Estoque<br/>de insumos")]
    cont["Contagem e<br/>entrada manual"] -- ajuste --> est
    prep["Preparo interno<br/>(maionese, cebola...)"] -- "brutos → beneficiado" --> est
    est -- "baixa pela ficha técnica" --> venda["Vendas do dia<br/>(Fechar o dia)"]
    est -- baixa --> perda["Perdas"]
    est --> rel["Relatórios e alertas"]
```

1. **A compra entra pela nota.** O app lê o QR code da NFC-e (consulta a página pública da SEFAZ) ou o
   XML da NF-e, sugere qual insumo corresponde a cada item da nota e, depois da conferência, soma o
   estoque e atualiza o custo. A mesma nota não entra duas vezes.
2. **A venda sai pela ficha técnica.** Cada lanche do cardápio tem a lista de insumos que consome, com
   fator de perda. No **Fechar o dia** a equipe informa quantas unidades de cada produto saíram e o app
   mostra o impacto em cada insumo, inclusive o que ficaria negativo, antes de dar baixa.
3. **O que é feito na cozinha também conta.** Receitas da casa (maionese, cebola caramelizada, empanados)
   consomem os insumos brutos e geram o item beneficiado, com validade.
4. **Perda é registrada com um toque**, com o motivo, e entra nos relatórios.
5. **Alertas na tela inicial:** insumos abaixo do mínimo, itens perto do vencimento e vendas retidas
   (produto sem ficha técnica ou fora do cardápio) que esperam um ajuste para baixar o estoque.
6. **Relatórios** por dia, 7 dias, mês ou período: compras por fornecedor, perdas por motivo, o que está
   para faltar, mais vendidos e o custo estimado do que a cozinha consumiu.

O acesso tem papéis: o **admin** faz tudo; **gerente** e **operador** consultam em modo somente leitura.
O app pode ser instalado na tela inicial do celular.

## Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Motion (animações), Recharts (gráficos), Phosphor Icons, html5-qrcode (leitor de QR), Axios |
| **Backend** | Node.js, Fastify 5, TypeScript, Zod (validação), JWT (@fastify/jwt), bcryptjs, fast-xml-parser (XML da NF-e), Cheerio (página da NFC-e) |
| **Banco** | PostgreSQL com Prisma 7 (`@prisma/adapter-pg`) |
| **Testes** | Vitest e Testing Library (unitários, integração com Postgres real), Stryker (testes de mutação) |
| **Infra** | Docker Compose no desenvolvimento, GitHub Actions (CI e agendamentos), Render (API e site) e Neon (Postgres) |

Mais detalhes da arquitetura, dos fluxos e do contrato da API em [`docs/`](docs/README.md).
