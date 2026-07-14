# Testar o MCP Server com um cliente

O MCP está focado na V1 do dono da loja / backoffice LusoPay.

## 1. Criar token no Windmill

No Windmill, cria um API token para o backend MCP.

Não coloques esse token no Git nem no chat.

## 2. Configurar ambiente local em PowerShell

```powershell
$env:WINDMILL_BASE_URL="https://app.windmill.dev"
$env:WINDMILL_WORKSPACE="lusopay-mcp-server"
$env:WINDMILL_TOKEN="<token Windmill>"
$env:LUSOPAY_MCP_AUTH_MODE="static"
$env:LUSOPAY_MCP_ACCESS_TOKEN="merchant-token-demo"
$env:LUSOPAY_MCP_MERCHANTS_JSON='{"merchant-token-demo":{"merchant_id":"DEMO_STORE","merchant_name":"Loja Demo","permissions":["payments:read"]}}'
```

## 3. Build e teste local

```powershell
npm run mcp:build
npm run mcp:test:tool -- listar_pagamentos "{status:paid,include_raw:false}"
```

Se funcionar, o resultado vem como `content[0].text` com JSON de pagamentos.

## Tools disponíveis

- `listar_pagamentos`
- `obter_pagamento_por_order_id`
- `consultar_pagamento`
- `listar_pagamentos_pendentes`
- `pagamentos_confirmados`
- `listar_pagamentos_cancelados`
- `listar_pagamentos_falhados`
- `detetar_pagamentos_pendentes_antigos`
- `detetar_links_expirados`
- `resumo_pagamentos`
- `resumo_mensal_pagamentos`

Disponível apenas com `payments:write`:

- `criar_link_pagamento`

Exemplo de token com escrita:

```powershell
$env:LUSOPAY_MCP_MERCHANTS_JSON='{"merchant-token-demo":{"merchant_id":"DEMO_STORE","merchant_name":"Loja Demo","permissions":["payments:read","payments:write"]}}'
```

Exemplo em modo seguro, sem criar link real:

```powershell
npm run mcp:test:tool -- criar_link_pagamento "{amount:10,description:Teste MCP,order_id:TESTE-001,customer_name:Cliente Teste,customer_email:cliente@teste.pt,return_url:https://loja.example/return,website_url:https://loja.example,dry_run:true}"
```

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
        "LUSOPAY_MCP_MERCHANTS_JSON": "{\"merchant-token-demo\":{\"merchant_id\":\"DEMO_STORE\",\"merchant_name\":\"Loja Demo\",\"permissions\":[\"payments:read\"]}}"
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
