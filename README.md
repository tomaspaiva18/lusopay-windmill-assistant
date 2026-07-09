# LusoPay Assistente MCP Server V1 em n8n

Servidor MCP modular em n8n para donos de loja que usam LusoPay.

Esta V1 é focada em:

- consultas de pagamentos LusoPay;
- resumos e relatórios;
- reconciliação Loja vs LusoPay;
- análise de clientes através de uma interface abstrata da loja.

A criação de links Pay by Link fica fora do scope desta V1 e deve ser tratada como futura V2.

## Componentes

- `workflows/server/`: MCP Server Trigger.
- `workflows/tools/`: um workflow independente por tool MCP.
- `workflows/adapters/`: adapter LusoPay e interfaces abstratas da loja.
- `workflows/common/`: tratamento comum de erros.
- `docs/`: documentação técnica.
- `examples/`: exemplos de inputs/outputs e mock data.
- `config/`: exemplos de configuração.

## Tools V1

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
- `pagamentos_falhados`
- `pagamentos_por_metodo`
- `pagamentos_por_valor`
- `relatorio_diario`
- `pagamentos_pagos_lusopay_pendentes_loja`

## Arranque

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Configura no `.env`:

```env
LUSOPAY_BASE_URL=https://dev.lusopay.com:8444/web_dev/api
LUSOPAY_OWNER_ID=replace-with-lusopay-pid
STORE_ADAPTER_TYPE=mock
```

Produção:

```env
LUSOPAY_BASE_URL=https://app.lusopay.com:8443/web/api
```

## Gerar workflows importáveis

```powershell
npm run prepare:import
```

Importar no n8n os ficheiros de:

```text
dist/workflows-import/
```

Importa um ficheiro por vez.
Segue `dist/workflows-import/IMPORT_ORDER.md` e depois `dist/workflows-import/CONFIGURE_AFTER_IMPORT.md`.

Durante desenvolvimento, liga as tools de pagamentos ao adapter:

```text
ADAPTER - LusoPay - Listar pagamentos MOCK V1
```

Quando tiveres credenciais reais, troca esses nós para:

```text
ADAPTER - LusoPay - Listar pagamentos V1
```

## Configuração no n8n

Criar credentials:

```text
LusoPay Basic Auth
LusoPay MCP Bearer Auth
```

Depois configurar:

- `LusoPay Basic Auth` no nó HTTP Request do adapter LusoPay.
- Workflows alvo nos nós `Execute Workflow`.
- `LusoPay MCP Bearer Auth` no MCP Server Trigger.

## Documentação principal

- [V1 Assistente LusoPay](docs/V1_ASSISTENTE_LUSOPAY.md)
- [Mapeamento da API LusoPay](docs/api-lusopay.md)
- [Importação e configuração](docs/importacao.md)
- [Segurança e logging](docs/seguranca-logging.md)
