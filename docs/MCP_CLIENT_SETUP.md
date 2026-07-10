# Testar o MCP Server com um cliente

## 1. Criar token no Windmill

No Windmill, cria um API token para o backend MCP.

Não coloques esse token no Git.

## 2. Configurar ambiente local em PowerShell

```powershell
$env:WINDMILL_BASE_URL="https://app.windmill.dev"
$env:WINDMILL_WORKSPACE="lusopay-mcp-server"
$env:WINDMILL_TOKEN="<token Windmill>"
$env:LUSOPAY_MCP_AUTH_MODE="static"
$env:LUSOPAY_MCP_ACCESS_TOKEN="merchant-token-demo"
$env:LUSOPAY_MCP_MERCHANTS_JSON='{"merchant-token-demo":{"merchant_id":"DEMO_STORE","merchant_name":"Loja Demo","permissions":["payments:read","customers:read","reconciliation:read"]}}'
```

## 3. Build e teste local

```powershell
npm run mcp:build
npm run mcp:test:tool -- listar_pagamentos '{\"status\":\"paid\",\"include_raw\":false}'
```

Se funcionar, o resultado deve vir como `content[0].text` com JSON de pagamentos.

## 4. Configuração genérica para clientes MCP

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
        "LUSOPAY_MCP_MERCHANTS_JSON": "{\"merchant-token-demo\":{\"merchant_id\":\"DEMO_STORE\",\"merchant_name\":\"Loja Demo\",\"permissions\":[\"payments:read\",\"customers:read\",\"reconciliation:read\"]}}"
      }
    }
  }
}
```

## Nota de produto

Para produção, não distribuir `WINDMILL_TOKEN` a clientes finais.

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
