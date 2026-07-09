# LusoPay Windmill Assistant

Projeto Windmill para um assistente operacional de donos de loja que usam LusoPay.

Esta versão não cria links de pagamento. Foca-se em:

- consultas de pagamentos LusoPay;
- resumos e relatórios;
- reconciliação Loja vs LusoPay;
- análise de clientes;
- scripts prontos para serem importados/criados no Windmill.

## Estrutura

```text
windmill/
  scripts/
    lusopay/
    store/
    reports/
    reconciliation/
  shared/
  resources/
docs/
examples/
scripts/
```

## Configuração segura

Não coloques credenciais no Git.

No Windmill, cria um Resource ou Variables/Secrets com:

```json
{
  "base_url": "https://dev.lusopay.com:8444/web_dev/api",
  "pid": "Cliente7",
  "username": "Cliente7",
  "password": "secret"
}
```

Em produção troca `base_url` para:

```text
https://app.lusopay.com:8443/web/api
```

## Scripts principais

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

## Validação local

```powershell
npm install
npm run check
npm run validate
```

