# LusoPay MCP Server

Este servidor MCP expõe ferramentas para agentes IA chamarem os scripts Windmill da LusoPay sem expor credenciais LusoPay ao agente.

## Arquitetura

```text
Cliente MCP / Agente IA
        ↓
mcp-server
        ↓
Windmill API
        ↓
Scripts f/lusopay, f/customers, f/reconciliation
        ↓
API LusoPay
```

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
    "permissions": ["payments:read", "customers:read", "reconciliation:read"]
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
  "permissions": ["payments:read", "customers:read"]
}
```

## Tools expostas

- `listar_pagamentos`
- `obter_pagamento_por_order_id`
- `listar_pagamentos_pendentes`
- `resumo_pagamentos`
- `comparar_pagamentos_loja_lusopay`
- `obter_cliente`
- `resumo_cliente`
- `listar_encomendas_cliente`
- `clientes_mais_ativos`
- `clientes_com_pagamentos_pendentes`

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
$env:LUSOPAY_MCP_MERCHANTS_JSON='{"merchant-token-demo":{"merchant_id":"DEMO_STORE","permissions":["payments:read","customers:read","reconciliation:read"]}}'
npm run mcp:start
```

## Exemplo de configuração para cliente MCP local

```json
{
  "mcpServers": {
    "lusopay": {
      "command": "node",
      "args": ["C:\\Users\\Tomás\\Desktop\\lusopay-mcp\\mcp-server\\dist\\index.js"],
      "env": {
        "WINDMILL_BASE_URL": "https://app.windmill.dev",
        "WINDMILL_WORKSPACE": "lusopay-mcp-server",
        "WINDMILL_TOKEN": "<token Windmill>",
        "LUSOPAY_MCP_AUTH_MODE": "static",
        "LUSOPAY_MCP_ACCESS_TOKEN": "merchant-token-demo",
        "LUSOPAY_MCP_MERCHANTS_JSON": "{\"merchant-token-demo\":{\"merchant_id\":\"DEMO_STORE\",\"permissions\":[\"payments:read\",\"customers:read\",\"reconciliation:read\"]}}"
      }
    }
  }
}
```

## Nota de produto

Na versão de produto, o cliente final não deve receber `WINDMILL_TOKEN`. Esse token deve ficar num backend controlado pela LusoPay. Para distribuição desktop/local, usar tokens de merchant com escopo limitado e preferir um gateway HTTP gerido pela LusoPay.
