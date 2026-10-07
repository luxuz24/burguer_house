# Dados Reais de Operação — Burguer House

Este documento consolida os dados operacionais, de engenharia de cardápio, custos e fichas técnicas extraídos diretamente da planilha oficial da hamburgueria. Ele serve como fonte da verdade para o seed do banco de dados, cadastro de fichas técnicas e cálculos de baixa automática de estoque.

---

## 1. Métricas Financeiras e Parâmetros Operacionais

- **Faturamento Médio Mensal**: R$ 40.670,87
- **Despesas Fixas Totais (Mês base - Dezembro)**: R$ 11.019,26 (27,09% da receita)
- **Detalhamento das Despesas Fixas**:
  - Aluguel: R$ 1.500,00
  - Luz: R$ 757,17
  - Água: R$ 225,11
  - Contador: R$ 150,00
  - Internet / Telefone: R$ 119,99
  - Sistema (Cardápio digital): R$ 279,99
  - Marketing: R$ 1.100,00
  - Gás: R$ 120,00
  - Material de Limpeza: R$ 120,00
  - Papelaria / Bobinas: R$ 210,00
  - Óleo de fritura: R$ 160,00
  - Motoboy fixo: R$ 1.560,00
  - Motoboy domingo: R$ 240,00
  - Parrilha: R$ 960,00
  - Associação Hamburgueiros: R$ 80,00
  - Mensalidade iFood: R$ 150,00
  - Diarista Sábado e Domingo: R$ 600,00
  - Carvão: R$ 750,00
  - Anúncio iFood: R$ 1.937,00
- **Taxas Comerciais e Impostos**:
  - Taxa Máquina de Cartão Crédito: 3,29% (0,0329)
  - Imposto: 4,00% (0,04)
  - Custo Fixo Operacional: 27,09% (0,2709)
- **DNA Total (Percentual de Encargos/Taxas por Venda)**: **34,38%** (0,3438)

---

## 2. Insumos Cadastrados (49 Itens)

| ID | Nome do Insumo | Peso/Qtd Embalagem | Unidade | Preço Compra (R$) | Fator de Perda (%) | Peso/Qtd Líquida | Custo Unitário Real (R$) | Custo por Extenso |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | Pão Brioche | 1 | Unidade | 2,11 | 0% | 1 un | 2,1100 | R$ 2,1100 por und |
| 2 | Carne de Hambúrguer | 1000 | Gramas | 31,90 | 0% | 1000 g | 0,0319 | R$ 0,0319 por g (R$ 31,90/kg) |
| 3 | Bacon fatiado | 1000 | Gramas | 35,00 | 0% | 1000 g | 0,0350 | R$ 0,0350 por g (R$ 35,00/kg) |
| 4 | Queijo Mussarela Fatia | 1 | Unidade | 0,37 | 0% | 1 un | 0,3700 | R$ 0,3700 por und |
| 5 | Queijo Cheddar Fatia | 1 | Unidade | 0,46 | 0% | 1 un | 0,4600 | R$ 0,4600 por und |
| 6 | Alface Americana | 1000 | Gramas | 24,60 | 0% | 1000 g | 0,0246 | R$ 0,0246 por g |
| 7 | Tomate | 1000 | Gramas | 5,99 | 0% | 1000 g | 0,0060 | R$ 0,0060 por g |
| 8 | Rúcula | 1000 | Gramas | 18,00 | 50% | 500 g | 0,0360 | R$ 0,0360 por g líq. |
| 9 | Cebola branca | 1000 | Gramas | 2,89 | 10,5% | 895 g | 0,0032 | R$ 0,0032 por g líq. |
| 10 | Molho Barbecue | 3500 | Gramas | 39,00 | 0% | 3500 g | 0,0111 | R$ 0,0111 por g |
| 11 | Geleia de Pimenta | 2500 | Gramas | 110,00 | 0% | 2500 g | 0,0440 | R$ 0,0440 por g |
| 12 | Frango Empanado | 1 | Unidade | 3,599 | 0% | 1 un | 3,5990 | R$ 3,5990 por und |
| 13 | Batata Frita Bem Brasil | 1000 | Gramas | 14,75 | 0% | 1000 g | 0,0148 | R$ 0,0148 por g |
| 14 | Batata Inglesa | 1000 | Gramas | 5,99 | 3% | 970 g | 0,0062 | R$ 0,0062 por g líq. |
| 15 | Cebola Roxa | 1000 | Gramas | 6,99 | 10,5% | 895 g | 0,0078 | R$ 0,0078 por g líq. |
| 16 | Maionese da Casa - Beneficiado | 1000 | Gramas | 9,02 | 0% | 1000 g | 0,0090 | R$ 0,0090 por g (R$ 9,02/kg) |
| 17 | Mussarela Empanada - Beneficiado | 1 | Unidade | 2,47 | 0% | 1 un | 2,4700 | R$ 2,4700 por und |
| 18 | Carne seca com requeijão - Beneficiado | 1000 | Gramas | — | 0% | 1000 g | — | Item beneficiado |
| 19 | Cebola Caremelizada - Beneficiado | 1000 | Gramas | 6,05 | 0% | 1000 g | 0,0061 | R$ 0,0061 por g (R$ 6,05/kg) |
| 20 | Sal Fino | 1000 | Gramas | 2,75 | 0% | 1000 g | 0,0028 | R$ 0,0028 por g |
| 21 | Óleo de soja | 900 | Mililitros | 5,99 | 0% | 900 ml | 0,0067 | R$ 0,0067 por ml |
| 22 | Alho desidratado | 1000 | Gramas | 49,00 | 0% | 1000 g | 0,0490 | R$ 0,0490 por g |
| 23 | Mostarda em pó desidratada | 1000 | Gramas | 49,00 | 0% | 1000 g | 0,0490 | R$ 0,0490 por g |
| 24 | Manjericão | 1000 | Gramas | 22,30 | 0% | 1000 g | 0,0223 | R$ 0,0223 por g |
| 25 | Cebolinha | 1000 | Gramas | 32,45 | 0% | 1000 g | 0,0325 | R$ 0,0325 por g |
| 26 | Salsinha | 1000 | Gramas | 64,90 | 0% | 1000 g | 0,0649 | R$ 0,0649 por g |
| 27 | Hortelã | 1000 | Gramas | 49,90 | 0% | 1000 g | 0,0499 | R$ 0,0499 por g |
| 28 | Leite | 1000 | Mililitros | 3,79 | 0% | 1000 ml | 0,0038 | R$ 0,0038 por ml |
| 29 | Shoyu | 6200 | Gramas | 43,90 | 0% | 6200 g | 0,0071 | R$ 0,0071 por g |
| 30 | Açúcar | 1000 | Gramas | 5,50 | 0% | 1000 g | 0,0055 | R$ 0,0055 por g |
| 31 | Panko | 1000 | Gramas | 24,90 | 0% | 1000 g | 0,0249 | R$ 0,0249 por g |
| 32 | Ovo | 1 | Unidade | 0,50 | 0% | 1 un | 0,5000 | R$ 0,5000 por und |
| 33 | Queijo Mussarela para empanamento | 1000 | Gramas | 29,95 | 0% | 1000 g | 0,0300 | R$ 0,0300 por g |
| 34 | Papel Acoplado | 1 | Unidade | 0,30 | 0% | 1 un | 0,3000 | R$ 0,3000 por und |
| 35 | Coca Cola Zero 350ml | 1 | Unidade | 3,05 | 0% | 1 un | 3,0500 | R$ 3,0500 por und |
| 36 | Coca Cola Original 350ml | 1 | Unidade | 3,05 | 0% | 1 un | 3,0500 | R$ 3,0500 por und |
| 37 | Coca Cola 600mL | 1 | Unidade | 4,10 | 0% | 1 un | 4,1000 | R$ 4,1000 por und |
| 38 | Coca Cola Zero 600ml | 1 | Unidade | 4,10 | 0% | 1 un | 4,1000 | R$ 4,1000 por und |
| 39 | agua com gás | 1 | Unidade | 1,55 | 0% | 1 un | 1,5500 | R$ 1,5500 por und |
| 40 | agua sem gás | 1 | Unidade | 1,44 | 0% | 1 un | 1,4400 | R$ 1,4400 por und |
| 41 | heineken long neck | 1 | Unidade | 5,91 | 0% | 1 un | 5,9100 | R$ 5,9100 por und |
| 42 | coca litro | 1 | Unidade | 4,00 | 0% | 1 un | 4,0000 | R$ 4,0000 por und |
| 43 | Embalagem de molho (potinho) | 1 | Unidade | 0,22 | 0% | 1 un | 0,2200 | R$ 0,2200 por und |
| 44 | Palito de madeira | 1 | Unidade | 0,10 | 0% | 1 un | 0,1000 | R$ 0,1000 por und |
| 45 | Embalagem de Batata | 1 | Unidade | 0,03 | 0% | 1 un | 0,0300 | R$ 0,0300 por und |
| 46 | Margarina | 1010 | Gramas | 21,00 | 0% | 1010 g | 0,0208 | R$ 0,0208 por g |
| 47 | Saco Kraft Delivery | 1 | Unidade | 0,71 | 0% | 1 un | 0,7100 | R$ 0,7100 por und |
| 48 | Crispy Mandioca - Beneficiado | 1000 | Gramas | 14,00 | 0% | 1000 g | 0,0140 | R$ 0,0140 por g |
| 49 | Mandioca | 1000 | Gramas | 7,00 | 0% | 1000 g | 0,0070 | R$ 0,0070 por g |

---

## 3. Receitas de Produção Interna (Beneficiados - 5 Itens)

### 3.1. Maionese Caseira
- **Rendimento**: 1.558 g
- **Custo Total da Receita**: R$ 14,05
- **Custo Unitário**: R$ 0,00902 / g
- **Ingredientes / Insumos**:
  - Óleo de soja: 967 ml (R$ 6,44)
  - Leite: 500 ml (R$ 1,90)
  - Salsinha: 42 g (R$ 2,73)
  - Cebolinha: 34 g (R$ 1,10)
  - Alho desidratado: 20 g (R$ 0,98)
  - Mostarda em pó: 14 g (R$ 0,69)
  - Sal Fino: 14 g (R$ 0,04)
  - Manjericão: 4 g (R$ 0,09)
  - Hortelã: 2 g (R$ 0,10)

### 3.2. Cebola Caramelizada
- **Rendimento**: 400 g
- **Custo Total da Receita**: R$ 2,42
- **Custo Unitário**: R$ 0,00605 / g
- **Ingredientes / Insumos**:
  - Cebola branca: 440 g (R$ 1,42)
  - Shoyu: 102 g (R$ 0,72)
  - Açúcar: 50 g (R$ 0,27)

### 3.3. Mussarela Empanada
- **Rendimento**: 1 unidade
- **Custo Total da Receita**: R$ 2,47
- **Custo Unitário**: R$ 2,4700 / und
- **Ingredientes / Insumos**:
  - Queijo Mussarela para empanamento: 60 g (R$ 1,80)
  - Panko: 17 g (R$ 0,42)
  - Ovo: 0,5 unidade (R$ 0,25)

### 3.4. Crispy Mandioca
- **Rendimento**: 1.000 g
- **Custo Total da Receita**: R$ 14,00
- **Custo Unitário**: R$ 0,0140 / g
- **Ingredientes / Insumos**:
  - Mandioca: 2.000 g (R$ 14,00)

### 3.5. Carne seca com requeijão
- Cadastrada para futuras preparações especiais.

---

## 4. Produtos do Cardápio (22 Itens) e Fichas Técnicas

*Nota: Em todos os hambúrgueres comercializados, o padrão de embalagem para entrega contempla:*
- *0,5 Saco Kraft Delivery (R$ 0,355)*
- *1 Palito de madeira (R$ 0,10)*
- *1 Papel Acoplado (R$ 0,30)*
- *1 Embalagem de molho potinho (R$ 0,22)*
- *40g de Maionese da Casa extra no potinho (R$ 0,36)*

---

### 4.1. BACON HOUSE
- **Preço de Venda**: R$ 30,00
- **Custo Total (CMV + Embalagem)**: R$ 11,01
- **Lucro Líquido Estimado**: R$ 8,68 (28,93%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 160 g
  - Queijo Cheddar Fatia: 2 un
  - Bacon fatiado: 32 g
  - Maionese da Casa (lanche): 40 g
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.2. HOUSE DUPLO
- **Preço de Venda**: R$ 39,00
- **Custo Total (CMV + Embalagem)**: R$ 15,88
- **Lucro Líquido Estimado**: R$ 9,71 (24,89%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 320 g (2 carnes de 160g)
  - Queijo Cheddar Fatia: 4 un
  - Molho Barbecue: 30 g
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.3. SELADINHO HOUSE
- **Preço de Venda**: R$ 28,00
- **Custo Total (CMV + Embalagem)**: R$ 9,53
- **Lucro Líquido Estimado**: R$ 8,85 (31,60%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 160 g
  - Queijo Cheddar Fatia: 2 un
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.4. HOUSE CARAMELIZADO
- **Preço de Venda**: R$ 34,00
- **Custo Total (CMV + Embalagem)**: R$ 11,37
- **Lucro Líquido Estimado**: R$ 10,94 (32,18%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 160 g
  - Cebola Caramelizada - Beneficiado: 60 g
  - Bacon fatiado: 32 g
  - Queijo Cheddar Fatia: 2 un
  - Maionese da Casa (lanche): 40 g
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.5. MUSSARELA HOUSE
- **Preço de Venda**: R$ 37,00
- **Custo Total (CMV + Embalagem)**: R$ 13,28
- **Lucro Líquido Estimado**: R$ 11,00 (29,74%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 160 g
  - Queijo Cheddar Fatia: 2 un
  - Mussarela Empanada - Beneficiado: 1 un
  - Geleia de Pimenta: 25 g
  - Maionese da Casa (lanche): 20 g
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.6. RÚCULA HOUSE
- **Preço de Venda**: R$ 35,00
- **Custo Total (CMV + Embalagem)**: R$ 11,34
- **Lucro Líquido Estimado**: R$ 11,63 (33,22%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 160 g
  - Queijo Cheddar Fatia: 2 un
  - Bacon fatiado: 32 g
  - Molho Barbecue: 30 g
  - Rúcula: 10 g
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.7. HOUSE PANTENEIRO
- **Preço de Venda**: R$ 38,00
- **Custo Total (CMV + Embalagem)**: R$ 14,88
- **Lucro Líquido Estimado**: R$ 10,06 (26,47%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 310 g (160g + 150g)
  - Queijo Mussarela Fatia: 2 un
  - Tomate: 20 g
  - Crispy Mandioca - Beneficiado: 20 g
  - Maionese da Casa (lanche): 40 g
  - Sal Fino: 5 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.8. CHICKEN SUPREME
- **Preço de Venda**: R$ 32,00
- **Custo Total (CMV + Embalagem)**: R$ 8,80
- **Lucro Líquido Estimado**: R$ 12,20 (38,12%)
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Frango Empanado: 1 un
  - Queijo Mussarela Fatia: 2 un
  - Alface Americana: 20 g
  - Tomate: 20 g
  - Maionese da Casa (lanche): 40 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.9. HOUSE SALADA
- **Custo Total (CMV + Embalagem)**: R$ 10,48
- **Ficha Técnica**:
  - Pão Brioche: 1 un
  - Carne de Hambúrguer: 160 g
  - Queijo Cheddar Fatia: 2 un
  - Alface Americana: 20 g
  - Tomate: 20 g
  - Maionese da Casa (lanche): 40 g
  - Margarina: 2 g
  - Kit Embalagem Delivery + Potinho Maionese Casa (40g)

### 4.10. CHICKEN HOUSE
- Produto cadastrado no catálogo.

### 4.11. BATATA CHIPS CROCANTE
- **Preço de Venda**: R$ 5,00
- **Custo Total (CMV + Embalagem)**: R$ 0,85
- **Lucro Líquido Estimado**: R$ 2,43 (48,69%)
- **Ficha Técnica**:
  - Batata Inglesa: 130 g
  - Sal Fino: 5 g
  - Embalagem de Batata: 1 un

### 4.12. BATATA CRINKLE
- **Preço de Venda**: R$ 9,00
- **Custo Total (CMV + Embalagem)**: R$ 2,99
- **Lucro Líquido Estimado**: R$ 2,91 (32,35%)
- **Ficha Técnica**:
  - Batata Frita Bem Brasil: 200 g
  - Sal Fino: 5 g
  - Embalagem de Batata: 1 un

### 4.13. MAIONESE HOUSE (Pote Extra)
- **Preço de Venda**: R$ 2,00
- **Custo Total (CMV + Embalagem)**: R$ 0,58
- **Lucro Líquido Estimado**: R$ 0,73 (36,58%)
- **Ficha Técnica**:
  - Maionese da Casa - Beneficiado: 40 g
  - Embalagem de molho (potinho): 1 un

### 4.14. BARBECUE HOUSE (Pote Extra)
- **Preço de Venda**: R$ 3,50
- **Custo Total (CMV + Embalagem)**: R$ 0,67
- **Lucro Líquido Estimado**: R$ 1,63 (46,60%)
- **Ficha Técnica**:
  - Molho Barbecue: 40 g
  - Embalagem de molho (potinho): 1 un

### 4.15 a 4.22. Bebidas

| Item | Preço Venda (R$) | Custo Unitário (R$) | Lucro Líquido (R$) | Margem Líquida (%) |
| :--- | :---: | :---: | :---: | :---: |
| **COCA COLA 350ML** | R$ 6,50 | R$ 3,05 | R$ 1,22 | 18,69% |
| **COCA COLA ZERO 350ML** | R$ 6,50 | R$ 3,05 | R$ 1,22 | 18,69% |
| **COCA COLA 600ML** | R$ 7,50 | R$ 4,10 | R$ 0,82 | 10,95% |
| **COCA COLA ZERO 600ML** | R$ 7,50 | R$ 4,10 | R$ 0,82 | 10,95% |
| **ÁGUA COM GÁS** | R$ 4,00 | R$ 1,55 | R$ 1,07 | 26,87% |
| **ÁGUA SEM GÁS** | R$ 4,00 | R$ 1,44 | R$ 1,18 | 29,62% |
| **HEINEKEN LONG NECK** | R$ 10,00 | R$ 5,91 | R$ 0,65 | 6,52% |
| **COCA COLA LITRO** | R$ 8,00 | R$ 4,00 | R$ 1,25 | 15,62% |
