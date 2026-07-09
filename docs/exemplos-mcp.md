# Exemplos MCP

Os clientes MCP apresentam as ferramentas segundo a sua própria interface. Os
objetos seguintes representam argumentos e resultados.

## Criar link

```json
{
  "amount": 49.9,
  "currency": "EUR",
  "description": "Encomenda ORDER-1001",
  "order_id": "ORDER-1001",
  "customer_name": "Ana Silva",
  "customer_email": "ana@example.com"
}
```

```json
{
  "ok": true,
  "payment_link": "https://pay.lusopay.com/...",
  "payment_id": null,
  "order_id": "ORDER-1001",
  "status": "link_created",
  "created_at": "2026-06-25T12:00:00.000Z",
  "amount": "49.90",
  "currency": "EUR"
}
```

## Consultar pagamento

```json
{ "order_id": "ORDER-1001" }
```

```json
{
  "ok": true,
  "found": true,
  "payment": {
    "payment_id": "5741493202915806184",
    "order_id": "ORDER-1001",
    "status": "paid",
    "amount": 49.9,
    "currency": "EUR",
    "payment_method": "mb_way"
  }
}
```

## Listar

```json
{
  "start_date": "2026-06-01",
  "end_date": "2026-06-25",
  "status": "paid",
  "min_amount": 10,
  "max_amount": 100
}
```

## Comparar

```json
{
  "start_date": "2026-06-01",
  "end_date": "2026-06-25"
}
```

```json
{
  "summary": {
    "lusopay": 20,
    "store": 20,
    "only_lusopay": 1,
    "only_store": 1,
    "amount_mismatches": 0,
    "status_mismatches": 2
  },
  "differences": {
    "only_lusopay": [],
    "only_store": [],
    "amount_mismatches": [],
    "status_mismatches": []
  }
}
```

## Sincronizar

```json
{
  "start_date": "2026-06-01",
  "end_date": "2026-06-25",
  "dry_run": true
}
```

A ferramenta gera um plano e não escreve enquanto o adapter da loja não
estiver implementado e validado.

