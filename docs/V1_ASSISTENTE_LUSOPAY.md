# V1 Assistente LusoPay em Windmill

Esta V1 é uma camada de tools TypeScript para Windmill focada na experiência do dono da loja.

Não cria links de pagamento. O foco é:

- consultas de pagamentos LusoPay;
- resumos de pagamentos;
- reconciliação loja vs LusoPay;
- análise de clientes.

## Estrutura

```text
lib/
  merchant_context.ts
  lusopay_client.ts
  payment_normalizer.ts
  store_client.ts
  reconcile.ts
  customer_analytics.ts
  date_utils.ts
  errors.ts
  types.ts

lusopay/
  listar_pagamentos.ts
  obter_pagamento_por_order_id.ts
  listar_pagamentos_pendentes.ts
  resumo_pagamentos.ts

reconciliation/
  comparar_pagamentos_loja_lusopay.ts

customers/
  obter_cliente.ts
  resumo_cliente.ts
  listar_encomendas_cliente.ts
  clientes_mais_ativos.ts
  clientes_com_pagamentos_pendentes.ts
```

## Merchant Context

Todos os scripts resolvem um `MerchantContext`.

Modelo:

```ts
interface MerchantContext {
  merchant_id: string;
  merchant_name: string;
  lusopay: {
    pid: string;
    username: string;
    password: string;
    environment: "test" | "prod";
  };
  store?: {
    platform: "woocommerce" | "shopify" | "prestashop" | "custom" | "mock";
    credentials?: Record<string, any>;
  };
}
```

Na V1, `lib/merchant_context.ts` resolve o merchant por defeito a partir de variáveis de ambiente/secret config.

Variáveis:

```env
MERCHANT_ID=demo-store
MERCHANT_NAME=Loja Demo
LUSOPAY_ENV=test
LUSOPAY_PID=Cliente7
LUSOPAY_USERNAME=...
LUSOPAY_PASSWORD=...
```

## API LusoPay

Endpoint de teste:

```text
GET https://dev.lusopay.com:8444/web_dev/api/{PID}/records/transactions_pbl_api_v3
```

Endpoint de produção:

```text
GET https://app.lusopay.com:8443/web/api/{PID}/records/transactions_pbl_api_v3
```

O cliente está em `lib/lusopay_client.ts`.

Suporta:

- ambiente `test`/`prod`;
- Basic Auth;
- filtro remoto por `creationPeriod`;
- resposta crua;
- erros HTTP consistentes.

## Segurança

Medidas implementadas:

- credenciais passam sempre pelo `MerchantContext`;
- nenhum script hardcoda credenciais;
- `raw` da LusoPay não é devolvido por defeito;
- scripts de pagamento aceitam `include_raw`, por defeito `false`;
- mensagens de erro e logs usam redaction para `password`, `username`, `authorization`, `token`, `secret`, `api_key` e equivalentes;
- queries por intervalo estão limitadas a 90 dias por defeito em `lib/date_utils.ts`.

Para produção:

- guardar `LUSOPAY_PASSWORD` como Windmill Secret;
- não passar credenciais em JSON manual de execução;
- resolver `merchant_id` a partir do utilizador autenticado, não do prompt livre.

## Scripts

### Pagamentos

- `lusopay/listar_pagamentos.ts`
- `lusopay/obter_pagamento_por_order_id.ts`
- `lusopay/listar_pagamentos_pendentes.ts`
- `lusopay/resumo_pagamentos.ts`

### Reconciliação

- `reconciliation/comparar_pagamentos_loja_lusopay.ts`

### Clientes

- `customers/obter_cliente.ts`
- `customers/resumo_cliente.ts`
- `customers/listar_encomendas_cliente.ts`
- `customers/clientes_mais_ativos.ts`
- `customers/clientes_com_pagamentos_pendentes.ts`

## Como testar no Windmill

1. Criar variáveis/secret config para:

```text
LUSOPAY_ENV
LUSOPAY_PID
LUSOPAY_USERNAME
LUSOPAY_PASSWORD
```

2. Criar/copiar os scripts TypeScript para Windmill mantendo imports relativos.

3. Testar primeiro:

```text
customers/obter_cliente.ts
```

Input:

```json
{
  "customer_identifier": "joao@example.com"
}
```

4. Testar LusoPay:

```text
lusopay/listar_pagamentos.ts
```

Input:

```json
{
  "start_date": "2026-01-01",
  "end_date": "2026-07-09"
}
```

## Loja mock

`lib/store_client.ts` usa mock data na V1. A interface já está preparada para trocar por WooCommerce, Shopify, PrestaShop, Magento, SQL/ERP ou loja própria.

TODO futuro:

- substituir `fetchStoreOrders`;
- substituir `fetchStoreCustomer`;
- adicionar credenciais reais no `MerchantContext.store`.

## Perguntas suportadas

- Quanto recebemos hoje?
- Mostra-me os pagamentos pendentes.
- A encomenda 1523 já foi paga?
- Há pagamentos pagos na LusoPay que ainda estão pendentes na loja?
- Que encomendas existem na loja mas não aparecem na LusoPay?
- Quantas encomendas fez o cliente João nos últimos 30 dias?
- Quanto gastou a Maria este mês?
- Quem foram os clientes que mais compraram esta semana?
