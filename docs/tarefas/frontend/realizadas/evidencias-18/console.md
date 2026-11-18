# Registro de Console e Erros — Conferência Visual Fase 4 (Tarefa 18)

- **Data:** 2026-11-17T23:31:53.048Z
- **Capturas validadas:** 70 PNGs em `evidencias-18/`
- **Exceções não tratadas (`pageerror`):** 0
- **Total de mensagens `console.error`:** 5

## Exceções de Página (`pageerror`)
_Nenhuma exceção não tratada lançada (0 erros)._

## Respostas HTTP >= 400 observadas durante a conferência
| Tela / Ação | Status | Método | Caminho | Classificação |
|---|:---:|:---:|---|---|
| Cadastro insumo Ingrediente com Beneficiado/Validade | 400 | POST | `/api/insumos` | Cenário negativo provocado intencionalmente para validar mensagem na UI |
| Lista Usuários (Claro) | 409 | POST | `/api/usuarios` | Cenário negativo provocado intencionalmente para validar mensagem na UI |

## Mensagens de Console (`warn` / `error`)
| Tela | Tipo | Mensagem |
|---|:---:|---|
| Cadastro insumo Ingrediente com Beneficiado/Validade | `error` | Failed to load resource: the server responded with a status of 400 (Bad Request) |
| Entrada manual formulário completo (375 Claro) | `error` | Failed to load resource: net::ERR_FAILED |
| Lista Usuários (Claro) | `error` | Failed to load resource: the server responded with a status of 409 (Conflict) |
| Fechamento diálogo confirmação | `error` | Failed to load resource: net::ERR_FAILED |
| Fechamento falha de rede preserva mesma chave (negativo intencional) | `error` | Failed to load resource: net::ERR_FAILED |
| Armazenamento bloqueado (localStorage SecurityError) | `warning` | [PROVA TÉCNICA] window.localStorage bloqueado com SecurityError. |
| Armazenamento bloqueado — Login | `warning` | [PROVA TÉCNICA] window.localStorage bloqueado com SecurityError. |
