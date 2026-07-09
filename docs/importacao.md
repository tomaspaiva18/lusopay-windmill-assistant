# Importação e configuração n8n

## Gerar ficheiros importáveis

```powershell
cd "C:\Users\Tomás\Desktop\lusopay-mcp"
npm run prepare:import
```

Os ficheiros para importar ficam em:

```text
dist/workflows-import/
```

## Ordem de importação V1

Importar um ficheiro por vez:

Também podes seguir o ficheiro gerado:

```text
dist/workflows-import/IMPORT_ORDER.md
```

```text
common/error_logger.workflow.json

adapters/lusopay_listar_pagamentos.adapter.json
adapters/lusopay_listar_pagamentos_mock.adapter.json
adapters/loja_listar_pagamentos.interface.json
adapters/loja_obter_cliente.interface.json

tools/listar_pagamentos.workflow.json
tools/obter_pagamento_por_order_id.workflow.json
tools/listar_pagamentos_pendentes.workflow.json
tools/resumo_pagamentos.workflow.json
tools/comparar_pagamentos_loja_lusopay.workflow.json
tools/obter_cliente.workflow.json
tools/resumo_cliente.workflow.json
tools/listar_encomendas_cliente.workflow.json
tools/clientes_mais_ativos.workflow.json
tools/clientes_com_pagamentos_pendentes.workflow.json
tools/pagamentos_falhados.workflow.json
tools/pagamentos_por_metodo.workflow.json
tools/pagamentos_por_valor.workflow.json
tools/relatorio_diario.workflow.json
tools/pagamentos_pagos_lusopay_pendentes_loja.workflow.json

server/lusopay_mcp_server.workflow.json
```

## Configurar credentials

Criar em `Credentials`:

```text
LusoPay Basic Auth
```

Tipo:

```text
Generic Credential Type → Basic Auth
```

Criar também:

```text
LusoPay MCP Bearer Auth
```

Usar um token forte. Este token protege o endpoint MCP.

## Ligar workflows alvo

Depois da importação, os nós `Execute Workflow` precisam de ser ligados manualmente porque os IDs são gerados pelo n8n.

Também podes seguir o ficheiro gerado:

```text
dist/workflows-import/CONFIGURE_AFTER_IMPORT.md
```

Mapeamento:

```text
MCP Tool - listar_pagamentos
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - obter_pagamento_por_order_id
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - listar_pagamentos_pendentes
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - resumo_pagamentos
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - comparar_pagamentos_loja_lusopay
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção
→ INTERFACE - Loja - Listar encomendas/pagamentos V1

MCP Tool - obter_cliente
→ INTERFACE - Loja - Obter cliente V1

MCP Tool - resumo_cliente
→ INTERFACE - Loja - Obter cliente V1
→ INTERFACE - Loja - Listar encomendas/pagamentos V1

MCP Tool - listar_encomendas_cliente
→ INTERFACE - Loja - Listar encomendas/pagamentos V1

MCP Tool - clientes_mais_ativos
→ INTERFACE - Loja - Listar encomendas/pagamentos V1

MCP Tool - clientes_com_pagamentos_pendentes
→ INTERFACE - Loja - Listar encomendas/pagamentos V1

MCP Tool - pagamentos_falhados
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - pagamentos_por_metodo
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - pagamentos_por_valor
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - relatorio_diario
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção

MCP Tool - pagamentos_pagos_lusopay_pendentes_loja
→ ADAPTER - LusoPay - Listar pagamentos MOCK V1 em desenvolvimento
→ ADAPTER - LusoPay - Listar pagamentos V1 em produção
→ INTERFACE - Loja - Listar encomendas/pagamentos V1
```

No workflow `LusoPay Assistente MCP Server V1`, ligar cada tool node ao workflow `MCP Tool - ...` correspondente.

## Testes manuais mínimos

1. Testar `INTERFACE - Loja - Obter cliente V1` com `customer_identifier = joao@example.com`.
2. Testar `MCP Tool - obter_cliente`.
3. Testar `MCP Tool - resumo_cliente`.
4. Testar `ADAPTER - LusoPay - Listar pagamentos MOCK V1`.
   - Deve devolver dados mock sem credenciais LusoPay.
5. Testar `ADAPTER - LusoPay - Listar pagamentos V1`.
   - Com credenciais inválidas, espera-se `AUTH_ERROR`.
   - Com credenciais válidas, espera-se lista normalizada.
6. Testar `MCP Tool - listar_pagamentos`.
7. Ativar `LusoPay Assistente MCP Server V1`.
