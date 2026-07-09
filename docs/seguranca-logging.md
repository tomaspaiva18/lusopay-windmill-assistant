# Segurança e logging

## Segurança

- Credenciais LusoPay apenas no Credential Store encriptado do n8n.
- Segredo MCP distinto das credenciais LusoPay.
- Porta 5678 limitada a localhost no Compose.
- HTTPS obrigatório quando o MCP for acessível externamente.
- Nenhuma ferramenta aceita URL, método HTTP ou body arbitrário.
- O acesso `$env` em nós está ativo porque os adapters consomem configuração
  do deployment; apenas administradores devem poder editar workflows.
- `N8N_ENCRYPTION_KEY` deve ser estável, longa e incluída em backups seguros.
- A criação de links deve ser sujeita a autorização do cliente MCP.
- A sincronização real deve ser idempotente e auditável.

## Erros tratados

- timeout de 15 segundos;
- HTTP 401/403 convertido em `AUTH_ERROR`;
- outros HTTP >= 400 convertidos em `LUSOPAY_API_ERROR`;
- respostas sem estrutura esperada convertidas em `INVALID_RESPONSE`;
- inputs inválidos convertidos em `VALIDATION_ERROR`;
- configuração ausente convertida em `CONFIG_ERROR`.

## Formato de log

```json
{
  "timestamp": "2026-06-25T12:00:00.000Z",
  "tool": "listar_pagamentos",
  "parameters": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-25"
  },
  "duration_ms": 184,
  "result": "success",
  "error": null
}
```

Em erros, `parameters` é redigido para evitar duplicar dados pessoais. O ID e
URL da execução permitem consultar os detalhes segundo as permissões do n8n.

Por defeito, execuções bem-sucedidas não são persistidas e erros são
guardados por sete dias (`168` horas).
