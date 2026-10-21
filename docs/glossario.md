# Glossário

Vocabulário da cozinha e do sistema, para a equipe e o dono falarem a mesma língua. Ver o contexto em [Arquitetura](arquitetura.md).

| Termo | Significado |
|---|---|
| **Insumo** | Qualquer coisa que entra na cozinha e tem estoque: pão, carne, queijo, óleo. Tem unidade (g, ml, unidade), estoque atual, estoque mínimo e custo. |
| **Estoque mínimo** | Quantidade abaixo da qual o sistema avisa que é hora de comprar. |
| **Produto** | O que a loja vende (ex.: X-Burger). Não tem estoque próprio: consome insumos pela ficha técnica. |
| **Ficha técnica** | A receita de um produto: quanto de cada insumo vai em uma unidade vendida. |
| **Fator de perda** | Percentual a mais de insumo consumido por causa de aparas e desperdício normal no preparo. Um fator de 0,1 significa 10% a mais do que a ficha diz. |
| **Item beneficiado** | Insumo que a própria cozinha produz (ex.: maionese caseira). Tem validade e uma **sub-ficha** com os ingredientes. |
| **Sub-ficha técnica** | Receita do item beneficiado: quanto de cada insumo bruto vai em uma unidade dele. |
| **Insumo bruto** | Ingrediente comprado e usado para produzir um item beneficiado (ex.: óleo e ovo, para a maionese). |
| **Produção** | Fazer um lote de item beneficiado: abate os insumos brutos e soma no estoque do beneficiado. |
| **Perda** | Insumo que saiu do estoque sem virar venda, com um motivo: vencimento, erro de preparo, estragado ou outro. |
| **Venda** | Registro bruto de um pedido recebido da Anota AI. Só vira baixa de estoque na consolidação. |
| **Consolidação** | Rotina de fim de dia que transforma as vendas pendentes em baixa de estoque, pela ficha técnica. Roda pelo cron, não é instantânea. |
| **Estado do pedido (`check`)** | Número da Anota AI que diz em que pé está o pedido: 0 em análise, 1 em produção, 2 pronto, 3 finalizado, 4 cancelado, 5 negado. Só os aceitos (1, 2, 3) abatem estoque. |
| **Webhook** | Aviso que a Anota AI manda ao nosso sistema quando algo acontece com um pedido. |
| **`externalId`** | Identificador do pedido na Anota AI, guardado na venda para reconhecer eventos do mesmo pedido. |
| **Nota fiscal de entrada** | Nota da compra de insumos. Ao confirmar, soma o estoque e atualiza o custo. |
| **NFC-e** | Nota fiscal de consumidor, a do cupom com QR code. |
| **NF-e** | Nota fiscal eletrônica em XML, comum nas compras de fornecedor. |
| **Chave de acesso** | Número de 44 dígitos que identifica uma nota. É único: impede importar a mesma nota duas vezes. |
| **SEFAZ** | Secretaria da Fazenda do estado. O QR code da NFC-e aponta para uma página pública dela. |
| **Cold start** | Demora do primeiro acesso depois de o serviço gratuito "dormir". Por isso há o ping de aquecimento antes de abrir a loja. |
| **Cron** | Agendador que dispara tarefas em horários fixos (aqui, o GitHub Actions). |
| **JWT** | Token de login enviado em cada chamada à API. Dura 7 dias. |
