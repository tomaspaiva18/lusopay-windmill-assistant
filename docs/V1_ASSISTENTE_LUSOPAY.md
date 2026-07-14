# V1 Assistente LusoPay

Esta V1 é uma camada de tools para o dono da loja consultar e analisar pagamentos LusoPay.

Não cria links de pagamento nesta fase. O foco é leitura, análise e diagnóstico operacional.

## Scope ativo

- Consultar pagamentos LusoPay.
- Consultar pagamento por `order_id`.
- Listar pagamentos pendentes.
- Listar pagamentos confirmados.
- Listar pagamentos cancelados.
- Listar pagamentos falhados.
- Detetar pagamentos pendentes antigos.
- Detetar links expirados.
- Gerar resumo por período.
- Gerar resumo mensal.
- Criar/preparar Pay by Link com permissão `payments:write`.

Adapters de loja, clientes e reconciliação podem existir no repositório como estrutura futura, mas não fazem parte do MCP ativo desta fase.

## Estrutura principal

```text
f/
  lib/
  lusopay/

lib/
  merchant_context.ts
  lusopay_client.ts
  payment_normalizer.ts
  date_utils.ts
  errors.ts
  types.ts

lusopay/
  listar_pagamentos.ts
  obter_pagamento_por_order_id.ts
  listar_pagamentos_pendentes.ts
  listar_links_expirados.ts
  criar_link_pagamento.ts
  resumo_pagamentos.ts
  resumo_mensal_pagamentos.ts

mcp-server/
  src/
    index.ts
    auth.ts
    config.ts
    tools.ts
    windmill.ts
```

`f/` é a pasta sincronizável com Windmill. A pasta raiz mantém a fonte lógica e documentação do projeto.

## API LusoPay

Endpoint de teste:

```text
GET https://dev.lusopay.com:8444/web_dev/api/{PID}/records/transactions_pbl_api_v3
```

Endpoint de produção:

```text
GET https://app.lusopay.com:8443/web/api/{PID}/records/transactions_pbl_api_v3
```

## Segurança

Medidas implementadas:

- Credenciais passam pelo `MerchantContext`.
- Nenhum script hardcoda credenciais.
- `raw` da LusoPay não é devolvido por defeito.
- Logs/erros usam redaction para dados sensíveis.
- Intervalos de datas estão limitados a 90 dias por defeito.
- MCP ativo requer `payments:read`.

Para produção:

- guardar `LUSOPAY_PASSWORD` como Windmill Secret;
- não passar credenciais em JSON manual de execução;
- resolver `merchant_id` a partir do utilizador autenticado;
- usar auth `introspection` controlada pela LusoPay.

## Tools MCP ativas

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
- `criar_link_pagamento` apenas com `payments:write`

## Próximo passo

`criar_link_pagamento` usa as regras das extensões Moodle/OpenCart: POST para `offline_engine.php` com campo `data` em base64. Por defeito corre em `dry_run:true`.
