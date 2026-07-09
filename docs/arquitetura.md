# Arquitetura

```text
Cliente MCP
    |
    | Streamable HTTP / SSE + Bearer Auth
    v
LusoPay MCP Server (MCP Server Trigger)
    |
    +--> MCP Tool - criar_link_pagamento
    |       `--> ADAPTER LusoPay - Criar link
    |
    +--> MCP Tool - consultar/listar/pendentes/confirmados
    |       `--> ADAPTER LusoPay - Listar pagamentos
    |
    +--> MCP Tool - comparar_pagamentos_loja
    |       +--> ADAPTER LusoPay - Listar pagamentos
    |       `--> INTERFACE Loja - Listar pagamentos
    |
    `--> MCP Tool - sincronizar_pagamentos
            `--> comparação --> plano dry-run

Qualquer erro --> COMMON - LusoPay - Error Logger
```

## Responsabilidades

### Server

Expõe exclusivamente ferramentas de negócio conhecidas. Não permite URL,
método HTTP ou body arbitrário.

### Tools

Definem os contratos MCP, validam intenção e orquestram adapters. Não conhecem
credenciais nem detalhes de autenticação.

### Adapters

Traduzem o contrato interno para APIs externas. Os adapters LusoPay normalizam
respostas para:

```json
{
  "payment_id": "string|null",
  "order_id": "string|null",
  "status": "string|null",
  "amount": 10.5,
  "currency": "EUR",
  "payment_method": "string|null",
  "date": "ISO-8601|null",
  "reference": "string|null"
}
```

O adapter da loja deve preservar este contrato. Assim, trocar WooCommerce por
Shopify não exige alterar as ferramentas MCP.

## Comparação

A chave de reconciliação preferida é `order_id`; `payment_id` serve de
fallback. O relatório contém:

- `only_store`
- `only_lusopay`
- `amount_mismatches`
- `status_mismatches`

O adapter da loja deve normalizar estados para os valores LusoPay ou aplicar
um mapa antes de devolver os pagamentos.

