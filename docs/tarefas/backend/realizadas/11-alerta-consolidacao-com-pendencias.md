# 11 — Alerta quando a consolidação deixa vendas retidas (ou falha)

- **Tipo:** feat · **Estado:** PENDENTE
- **Origem:** `docs/STATUS.md` 1.8 ("Alerta externo de falha" 🔴) e `docs/PLANO_PRODUCAO.md` Fase 4
- **Arquivos:** `.github/workflows/cron.yml` (job de consolidação ~36-47),
  `backend/src/infra/http/controllers/consolidacao.controller.ts` (só leitura da resposta), `docs/api.md` §5
- **Branch sugerida:** `feat/backend-alerta-consolidacao`

## Problema
O job de consolidação faz `curl --fail ... /api/vendas/consolidar` e fica **verde** sempre que a API
responde 2xx — mesmo com `vendasPendentesNaoMapeadas: 12` na resposta. Uma venda retida todo dia passa
despercebida. Também não há nenhum aviso quando o webhook responde 500.

## Comportamento esperado
- O job grava a resposta (`-o resposta.json`), escreve um resumo em `$GITHUB_STEP_SUMMARY`
  (consolidadas, retidas, produtos não encontrados) e **falha o job** quando
  `vendasPendentesNaoMapeadas`, `vendasComItensInvalidos` ou `vendasSemItens` > 0. Falha de job no
  GitHub Actions dispara e-mail para o dono do repositório — é o alerta mínimo sem serviço novo.
- Mensagem de falha aponta para `GET /api/vendas/retidas` (tarefa 10) e para o cadastro do produto.
- Nenhum segredo impresso no log (o `CRON_SECRET` já vai em header; mantenha).
- Opcional (registre como ideia, não implemente sem pedir): webhook para WhatsApp/Telegram.

## Teste
Não há teste automatizado de workflow no repositório. Prove assim, colando a saída no PR:
1. Extraia a checagem para um script versionado (ex.: `backend/scripts/checar-consolidacao.ts`, ou um
   trecho `jq` no próprio YAML) e teste-o com três respostas de exemplo: sem retidas (exit 0), com
   retidas (exit 1 e resumo), resposta inválida (exit 1).
2. Rode o workflow por `workflow_dispatch` (`tarefa: consolidacao`) depois do merge, se o dono já
   tiver ligado `CRON_ATIVO`; senão, registre no PR que fica para o primeiro deploy.

## Critério de pronto
- [x] Script/checagem testado com os 3 casos (saída no PR).
- [x] `cron.yml` atualizado sem quebrar o agendamento existente (horários e `if:` iguais).
- [x] `docs/STATUS.md` 1.8 atualizado ("Alerta externo de falha" → 🟡 com o que foi feito).

## Fora do escopo
Monitoramento do webhook em tempo real (precisa de serviço externo; anote como pendência).
