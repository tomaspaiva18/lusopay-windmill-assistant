# Arquitectura SaaS LusoPay MCP

Este projecto está a evoluir de uma integração single-merchant para uma feature SaaS hospedada pela LusoPay.

## Objectivo

A LusoPay hospeda o MCP Server, o Windmill e a gestão de merchants. Os donos das lojas usam a feature através de um chatbot/cliente MCP sem acesso a tokens internos, Windmill ou credenciais de outros clientes.

```text
Dono da loja
  -> Cliente MCP / Chatbot
  -> MCP Server LusoPay
  -> Autenticação por token de merchant
  -> Windmill interno
  -> API LusoPay
```

## Componentes

- `mcp-server/`: servidor MCP exposto aos clientes/agentes.
- `f/lusopay/`: scripts Windmill deployáveis.
- `f/lib/`: código partilhado usado pelos scripts Windmill.
- `lib/`: equivalente local para validação/testes.
- `merchant_context.ts`: resolve credenciais por `merchant_id`.

## Modelo multi-tenant

Cada cliente/loja tem:

- `merchant_id`
- `merchant_name`
- credenciais LusoPay próprias
- permissões MCP
- tokens de acesso ao assistente
- auditoria isolada

Exemplo de registry de merchants:

```json
{
  "DEMO_STORE": {
    "merchant_name": "Loja Demo",
    "lusopay": {
      "pid": "Cliente7",
      "username": "Cliente7",
      "password": "secret",
      "environment": "test"
    },
    "active": true
  }
}
```

Em piloto, este registry pode ser uma variável secreta Windmill:

```text
u/<user>/LUSOPAY_MERCHANTS_JSON
```

Em produção, deve passar para base de dados/secret manager.

## Tokens de merchant

O cliente recebe apenas um token do assistente, por exemplo:

```text
lusopay_mcp_live_xxxxx
```

O MCP Server deve guardar apenas hash SHA-256 do token:

```bash
npm run merchant:hash-token -- --merchant-id=DEMO_STORE --merchant-name="Loja Demo" --permissions=payments:read,payments:write --expires-at=2026-12-31T23:59:59Z
```

Exemplo de mapping para piloto:

```json
[
  {
    "token_hash": "sha256_do_token",
    "merchant_id": "DEMO_STORE",
    "merchant_name": "Loja Demo",
    "label": "default",
    "permissions": ["payments:read", "payments:write"],
    "expires_at": "2026-12-31T23:59:59Z",
    "active": true
  }
]
```

O token em claro só deve ser mostrado uma vez ao cliente. Para revogar acesso, colocar `active:false` ou remover o registo.

## Isolamento

O `merchant_id` vem da sessão autenticada no MCP Server. O cliente não deve conseguir escolher outro merchant manualmente.

O MCP Server injecta o `merchant_id` em todas as chamadas Windmill.

## Produção recomendada

Substituir as variáveis JSON por tabelas:

- `merchants`
- `merchant_tokens`
- `merchant_permissions`
- `created_payment_links`
- `audit_logs`

Também deve existir:

- rotação/revogação de tokens;
- encriptação de credenciais;
- rate limiting por merchant;
- logs centralizados;
- HTTP Trigger real para callbacks LusoPay.
