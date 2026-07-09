# Setup Windmill

## 1. Criar Resource LusoPay

No Windmill, cria um resource, por exemplo:

```text
u/lusopay_test
```

Com o valor:

```json
{
  "base_url": "https://dev.lusopay.com:8444/web_dev/api",
  "pid": "Cliente7",
  "username": "Cliente7",
  "password": "colocar-em-secret/resource"
}
```

## 2. Criar os scripts

Cria scripts TypeScript no Windmill copiando o conteúdo de `windmill/scripts/**`.

Todos os scripts expõem:

```ts
export async function main(...)
```

## 3. Primeiro teste

Testa primeiro scripts que não dependem da LusoPay real:

```text
windmill/scripts/store/obter_cliente.ts
windmill/scripts/store/resumo_cliente.ts
```

Depois testa:

```text
windmill/scripts/lusopay/listar_pagamentos.ts
```

com:

```json
{
  "lusopay": {
    "base_url": "https://dev.lusopay.com:8444/web_dev/api",
    "pid": "Cliente7",
    "username": "Cliente7",
    "password": "password-real"
  },
  "start_date": "2026-07-01",
  "end_date": "2026-07-09"
}
```

## 4. Segurança

- Não escrever passwords nos scripts.
- Usar Windmill Resources/Secrets.
- Um dono de loja deve usar credenciais/PID próprios.
- Não expor `username`, `password`, tokens ou headers `Authorization` nos outputs.

