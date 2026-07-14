# LusoPay MCP Server

Este servidor MCP expõe ferramentas para agentes IA fazerem queries à API da LusoPay através dos scripts Windmill, sem expor credenciais LusoPay ao agente.

## Arquitetura

```text
Cliente MCP / Agente IA
        ↓
mcp-server
        ↓
Windmill API
        ↓
Scripts f/lusopay
        ↓
API LusoPay
```

## Orientação atual

A V1 pública está focada apenas em queries reais à API da LusoPay.

As tools de loja, clientes e reconciliação baseadas em mock foram removidas do MCP público. Esses adapters podem continuar como estrutura interna/futura, mas não devem ser expostos ao agente enquanto não houver integração real.

## Autenticação

O servidor suporta três modos:

- `static`: valida `LUSOPAY_MCP_ACCESS_TOKEN` contra `LUSOPAY_MCP_MERCHANTS_JSON`.
- `introspection`: chama um endpoint da LusoPay para validar o token do merchant.
- `disabled`: apenas desenvolvimento local.

Para produto LusoPay, usar `introspection`.

## Variáveis necessárias

```text
WINDMILL_BASE_URL=https://app.windmill.dev
WINDMILL_WORKSPACE=lusopay-mcp-server
WINDMILL_TOKEN=<token Windmill com permissão para correr scripts>
LUSOPAY_MCP_AUTH_MODE=static
LUSOPAY_MCP_ACCESS_TOKEN=<token entregue ao cliente/merchant>
MERCHANT_ID=DEMO_STORE
```

Para modo `static` multi-merchant:

```json
{
  "merchant-token-demo": {
    "merchant_id": "DEMO_STORE",
    "merchant_name": "Loja Demo",
    "permissions": ["payments:read"]
  }
}
```

Guardar esse JSON em:

```text
LUSOPAY_MCP_MERCHANTS_JSON
```

Para modo `introspection`:

```text
LUSOPAY_MCP_AUTH_MODE=introspection
LUSOPAY_AUTH_INTROSPECTION_URL=https://api.lusopay.pt/oauth/introspect
LUSOPAY_AUTH_SERVICE_TOKEN=<token interno da LusoPay>
```

O endpoint deve responder algo neste formato:

```json
{
  "active": true,
  "merchant_id": "cliente_123",
  "merchant_name": "Loja Cliente",
  "permissions": ["payments:read"]
}
```

## Tools expostas na V1 LusoPay API only

- `listar_pagamentos`
- `obter_pagamento_por_order_id`
- `consultar_pagamento`
- `listar_pagamentos_pendentes`
- `pagamentos_confirmados`
- `resumo_pagamentos`

## Build

```powershell
npm run mcp:build
```

## Execução local

```powershell
$env:WINDMILL_BASE_URL="https://app.windmill.dev"
$env:WINDMILL_WORKSPACE="lusopay-mcp-server"
$env:WINDMILL_TOKEN="<token>"
$env:LUSOPAY_MCP_AUTH_MODE="static"
$env:LUSOPAY_MCP_ACCESS_TOKEN="merchant-token-demo"
$env:LUSOPAY_MCP_MERCHANTS_JSON='{"merchant-token-demo":{"merchant_id":"DEMO_STORE","permissions":["payments:read"]}}'
npm run mcp:start
```

## Nota de produto

Na versão de produto, o cliente final não deve receber `WINDMILL_TOKEN`. Esse token deve ficar num backend controlado pela LusoPay.

O modelo recomendado é:

```text
Cliente MCP
  ↓
Gateway/Backend LusoPay autenticado
  ↓
Windmill
  ↓
API LusoPay
```

O modo `static` serve para desenvolvimento e demo. O modo final deve ser `introspection`, em que o MCP valida o token do cliente num endpoint controlado pela LusoPay.
