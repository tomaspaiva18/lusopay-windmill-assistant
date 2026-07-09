# V1 Assistente LusoPay para Donos de Loja

Esta V1 deixa de estar focada em criar links de pagamento. O objetivo é disponibilizar um MCP Server em n8n para consultas, reconciliação e análise operacional de loja.

## Arquitetura

```text
Dono da loja / Cliente MCP
        ↓
n8n MCP Server Trigger
        ↓
MCP Tools V1
        ↓
Adapters
        ├── LusoPay Pay by Link records API
        └── Interface abstrata da loja
```

## Endpoint LusoPay usado

Teste:

```text
GET https://dev.lusopay.com:8444/web_dev/api/{PID}/records/transactions_pbl_api_v3
```

Produção:

```text
GET https://app.lusopay.com:8443/web/api/{PID}/records/transactions_pbl_api_v3
```

O PID vem de `LUSOPAY_OWNER_ID`. A autenticação é Basic Auth configurada em n8n Credentials.

## Tools MCP da V1

1. `listar_pagamentos`
2. `obter_pagamento_por_order_id`
3. `listar_pagamentos_pendentes`
4. `resumo_pagamentos`
5. `comparar_pagamentos_loja_lusopay`
6. `obter_cliente`
7. `resumo_cliente`
8. `listar_encomendas_cliente`
9. `clientes_mais_ativos`
10. `clientes_com_pagamentos_pendentes`
11. `pagamentos_falhados`
12. `pagamentos_por_metodo`
13. `pagamentos_por_valor`
14. `relatorio_diario`
15. `pagamentos_pagos_lusopay_pendentes_loja`

`criar_link_pagamento` fica fora da V1 e deve ser tratado como futura V2.

## Workflows principais

Adapters:

```text
ADAPTER - LusoPay - Listar pagamentos V1
ADAPTER - LusoPay - Listar pagamentos MOCK V1
INTERFACE - Loja - Listar encomendas/pagamentos V1
INTERFACE - Loja - Obter cliente V1
```

Servidor:

```text
LusoPay Assistente MCP Server V1
```

Tools:

```text
MCP Tool - listar_pagamentos
MCP Tool - obter_pagamento_por_order_id
MCP Tool - listar_pagamentos_pendentes
MCP Tool - resumo_pagamentos
MCP Tool - comparar_pagamentos_loja_lusopay
MCP Tool - obter_cliente
MCP Tool - resumo_cliente
MCP Tool - listar_encomendas_cliente
MCP Tool - clientes_mais_ativos
MCP Tool - clientes_com_pagamentos_pendentes
MCP Tool - pagamentos_falhados
MCP Tool - pagamentos_por_metodo
MCP Tool - pagamentos_por_valor
MCP Tool - relatorio_diario
MCP Tool - pagamentos_pagos_lusopay_pendentes_loja
```

## Normalização

Estados LusoPay são normalizados para:

```text
paid
pending
cancelled
failed
unknown
```

Métodos de pagamento são normalizados, quando possível, para:

```text
mbway
multibanco
card
```

## Configuração

Variáveis relevantes:

```env
LUSOPAY_BASE_URL=https://dev.lusopay.com:8444/web_dev/api
LUSOPAY_OWNER_ID=replace-with-lusopay-pid
STORE_ADAPTER_TYPE=mock
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Credenciais n8n:

```text
LusoPay Basic Auth
LusoPay MCP Bearer Auth
```

## Importação no n8n

Gerar JSONs importáveis:

```powershell
cd "C:\Users\Tomás\Desktop\lusopay-mcp"
npm run prepare:import
```

Importar ficheiro a ficheiro a partir de:

```text
dist/workflows-import/
```

Depois configurar manualmente:

- Credential `LusoPay Basic Auth` no HTTP Request do adapter LusoPay.
- Workflows alvo nos nós `Execute Workflow`.
- Credential `LusoPay MCP Bearer Auth` no MCP Server Trigger.

## Checklist de testes manuais

1. Testar `ADAPTER - LusoPay - Listar pagamentos MOCK V1`.
   - Deve devolver dados mock sem credentials.
2. Testar `ADAPTER - LusoPay - Listar pagamentos V1`.
   - Com credenciais inválidas, o resultado esperado é `AUTH_ERROR`.
   - Com credenciais válidas, deve devolver `payments`.
3. Testar `MCP Tool - listar_pagamentos`.
4. Testar `MCP Tool - obter_pagamento_por_order_id`.
5. Testar `MCP Tool - resumo_pagamentos`.
6. Testar tools de loja com mock:
   - `MCP Tool - obter_cliente`
   - `MCP Tool - resumo_cliente`
   - `MCP Tool - listar_encomendas_cliente`
   - `MCP Tool - clientes_mais_ativos`
   - `MCP Tool - clientes_com_pagamentos_pendentes`
7. Ativar `LusoPay Assistente MCP Server V1`.
8. Confirmar endpoint MCP gerado no nó `LusoPay Assistente MCP`.

## Perguntas suportadas

```text
Quanto recebemos hoje?
A encomenda 1523 já foi paga?
Que pagamentos estão pendentes?
Há pagamentos pagos na LusoPay que ainda estão pendentes na loja?
Quantas encomendas fez o cliente João nos últimos 30 dias?
Quanto gastou a Maria este mês?
Quem foram os clientes que mais compraram esta semana?
Que clientes têm pagamentos pendentes?
Que pagamentos falharam hoje?
Quanto recebemos por MB Way esta semana?
Mostra pagamentos acima de 100 euros
Faz o relatório diário de hoje
Há pagamentos pagos na LusoPay que continuam pendentes na loja?
```

## Limitações da V1

- A criação de links Pay by Link não faz parte desta versão.
- Os dados da loja usam mock/interface abstrata até existir integração real.
- A validação completa da LusoPay requer credenciais válidas para o ambiente configurado.
