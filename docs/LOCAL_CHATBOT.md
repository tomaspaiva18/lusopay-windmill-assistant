# Chatbot local em localhost

Esta demo cria uma interface web local para testar o assistente LusoPay com linguagem natural.

## O que faz

```text
Browser localhost
  -> local-chat/server.mjs
  -> LLM OpenAI-compatible
  -> MCP Server local
  -> Windmill
  -> API LusoPay
```

## Pré-requisitos

- Node.js instalado
- Projecto compilável com `npm run mcp:build`
- Token Windmill válido
- Token MCP de merchant
- Um LLM OpenAI-compatible

## Variáveis necessárias

No PowerShell:

```powershell
$env:WINDMILL_BASE_URL="https://app.windmill.dev"
$env:WINDMILL_WORKSPACE="lusopay-mcp-server"
$env:WINDMILL_TOKEN="COLOCA_AQUI_O_TOKEN_WINDMILL"

$env:LUSOPAY_MCP_AUTH_MODE="static"
$env:LUSOPAY_MCP_ACCESS_TOKEN="owner-test-token"
$env:MERCHANT_ID="DEMO_STORE"
$env:LUSOPAY_MCP_MERCHANTS_JSON='[{"token":"owner-test-token","merchant_id":"DEMO_STORE","merchant_name":"Loja Demo","permissions":["payments:read","payments:write","customers:read","reconciliation:read"]}]'
```

Para OpenAI ou outro endpoint compatível:

```powershell
$env:OPENAI_API_KEY="COLOCA_AQUI_A_API_KEY"
$env:OPENAI_MODEL="gpt-4o-mini"
```

Ou, para Ollama com API compatível OpenAI:

```powershell
$env:LLM_BASE_URL="http://localhost:11434/v1"
$env:LLM_MODEL="llama3.1"
$env:LLM_API_KEY="ollama"
```

## Arranque

```powershell
npm run chat:local
```

Abrir:

```text
http://localhost:3000
```

## Perguntas para demo

```text
Lista os pagamentos pagos.
```

```text
Mostra um resumo dos pagamentos de Julho de 2026.
```

```text
Acompanha a encomenda TESTE-UPGRADE-REGISTRY-001.
```

```text
Prepara um Pay by Link em dry run de 1 euro para a encomenda DEMO-CHAT-001.
```

## Segurança

- Não colocar tokens reais em ficheiros commitados.
- Para criar Pay by Link real, pedir explicitamente `dry_run=false`.
- Para apresentação, usar ambiente de teste LusoPay.

