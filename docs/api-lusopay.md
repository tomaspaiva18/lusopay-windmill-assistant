# API LusoPay Pay by Link V3.3.8

Fonte: `PT_Manual Pay by link V3.3.8.pdf`, disponibilizado pelo proprietário
do projeto em 25 de junho de 2026.

## Autenticação

HTTP Basic Auth com username e password da software house.

O path usa o Identificador Público de Conta do comerciante:
`LUSOPAY_OWNER_ID`.

## Criar link

```text
POST {base_url}/{owner}/operations/paybylink_api_v3/run
```

Body:

```json
{
  "formParameters": {
    "L": "pt_PT",
    "CUR": "EUR",
    "OID": "ORDER-123",
    "PID": "merchant-public-id",
    "OP": "1",
    "AMT": "10.50",
    "MSG": "Encomenda ORDER-123",
    "PN": "Cliente",
    "PE": "cliente@example.com",
    "PYM": "P0",
    "GMR": "false",
    "OL": "false"
  }
}
```

Mapeamento principal:

| MCP | LusoPay |
|---|---|
| `amount` | `AMT` |
| `currency` | `CUR` |
| `description` | `MSG` |
| `order_id` | `OID` |
| `customer_name` | `PN` |
| `customer_email` | `PE` |

A moeda documentada é exclusivamente EUR. `order_id` deve respeitar
`[A-Za-z0-9- ()]`; para cartão/Apple Pay/Google Pay, o máximo é 40 caracteres.

Métodos: `P0` todos, `P1` Open Banking, `P2` Multibanco check-digit, `P3`
Multibanco ficheiro, `P4` MB Way, `P5` Payshop, `P6` Cofidis, `P7` cartão,
`P8` Apple Pay, `P9` Google Pay, `P10` Klarna, `P11` transferência imediata,
`P12` débito direto e `P13` Wero.

## Consultar/listar registos

```text
GET {base_url}/{owner}/records/transactions_pbl_api_v3
```

Intervalo documentado:

```text
?creationPeriod=2026-06-01&creationPeriod=2026-06-25
```

Os nomes antigos e novos podem coexistir. O normalizador suporta, entre
outros:

- `order_id` / `OID`
- `payment_status` / `PS`
- `chosen_payment_method` / `CPM`
- `paymentFormUrl` / `URL`
- `one_use_link` / `URL_S`

Estados documentados:

- `pending`
- `paid`
- `canceled`
- `declined`
- `refused`

## Edição de registos

O manual descreve GET da versão atual e PUT do registo, mas o exemplo técnico
está incorporado em imagens e não foi possível extrair o endpoint/body com
fidelidade suficiente. Nenhum workflow inventa esse contrato.

O projeto deixa a sincronização de LusoPay para loja preparada. A escrita na
LusoPay só deve ser adicionada após validação manual dessa secção ou obtenção
de um exemplo textual oficial.

