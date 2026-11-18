# 23 — Voltar do celular nas subtelas e desligamento seguro da câmera

- **Tipo:** fix · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Conferência no celular real da [tarefa 18](realizadas/18-conferencia-visual-fase4.md) (17/11/2026, HTTP `:5173` e HTTPS `:5174`)
- **Arquivos:** `frontend/src/App.tsx` (subtelas `importarNota`, `fechamentoDia`, `usuarios`), `frontend/src/pages/Estoque.tsx` (`mostrarImportarNota`, `mostrarEntradaManual`, `mostrarContagemEstoque`), `frontend/src/pages/ImportarNotaFiscal.tsx` (câmera, linhas 135-194 e 521-523), specs
- **Branch sugerida:** `fix/frontend-scanner-voltar-mobile`

## Contexto
As subtelas de tela cheia (Importar NF-e, Entrada manual, Contagem, Fechar o dia, Usuários) e a câmera do leitor de QR code abrem só por `useState`. Nenhum lugar do frontend usa `history.pushState` nem escuta `popstate`. No celular, o gesto ou botão **Voltar** do aparelho volta o **navegador**, não o app.

## Problema
1. **Voltar sai do app.** Com uma subtela ou a câmera aberta, o Voltar do celular tira o usuário do app (em `https://IP:5174` cai na página anterior ou no aviso de certificado). O que estava preenchido se perde.
2. **Câmera fica ligada.** Em `ImportarNotaFiscal.tsx`, se o usuário fecha a câmera ou troca para a aba XML enquanto `scanner.start()` ainda está abrindo, `pararCamera()` (linha 178) não para nada, porque `isScanning` ainda é `false`; o `#qr-reader` sai da tela (linha 521). Quando o `start()` termina, `pararSeDesmontado()` (linha 190) só confere `!montadoRef.current` e a câmera continua ligada sem aparecer.

## Comportamento esperado
- Abrir uma subtela (as 5 acima) empilha uma entrada no histórico (`history.pushState`); o Voltar do aparelho (`popstate`) fecha a subtela e volta para a tela de onde ela foi aberta, **sem sair da URL do app**. O botão "Voltar" da própria subtela usa o mesmo caminho (não deixa entrada sobrando no histórico).
- Com a câmera aberta, o primeiro Voltar fecha **só a câmera**; o seguinte fecha a subtela.
- Subtela com formulário preenchido mantém a confirmação de descarte que já existe (Entrada manual, Contagem) também no Voltar do aparelho.
- Câmera: uma ref `cameraAtivaRef` indica se a câmera ainda é desejada. Ao fechar, trocar para XML ou sair da tela durante o `start()`, a câmera é parada assim que o `start()` resolver, e nada opera sobre um `#qr-reader` que já saiu da tela.
- Rode `graphify affected` antes de alterar `App.tsx`, `Estoque.tsx` e `ImportarNotaFiscal.tsx`; prefira um único hook reaproveitado pelas subtelas (ex.: `useSubtelaNoHistorico`) a repetir a lógica em cada uma.

## Teste que deve falhar antes
- Abrir cada subtela e disparar `popstate`: a subtela fecha e a tela anterior aparece (`App.spec.tsx` e `Estoque.spec.tsx`).
- Fechar pelo botão "Voltar" da subtela não deixa entrada extra no histórico (`history.length` ou espião de `history.back`).
- Com a câmera aberta, `popstate` fecha a câmera e mantém a tela de Importar NF-e.
- `ImportarNotaFiscal.spec.tsx`: com `start()` pendente (promessa controlada no mock do `Html5Qrcode`), fechar a câmera ou trocar para XML e depois resolver o `start()` chama `stop()`; o mesmo ao desmontar a tela.
- Entrada manual com dados: `popstate` pede confirmação e, se cancelar, continua na tela.

## Critério de pronto
- [ ] Testes novos verdes (com a contagem de falhas antes) e nenhum antigo quebrado; `lint`, `test` e `build` verdes.
- [ ] Conferido **no celular real** em `http://IP` e `https://IP`: Voltar em cada subtela e com a câmera aberta, sem sair do app; câmera desligada (luz/indicador apagado) após fechar durante a abertura.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Roteador de URLs (rotas reais por tela), deep link, mudanças no backend.
