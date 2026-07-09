# LusoPay Windmill Assistant V1

Backend/tools TypeScript para Windmill, orientado a donos de loja que usam LusoPay.

Esta V1 não cria links de pagamento. Implementa:

- consultas de pagamentos LusoPay;
- resumos;
- reconciliação loja vs LusoPay;
- análise de clientes.

## Estrutura

```text
lib/
lusopay/
reconciliation/
customers/
examples/
docs/
```

## Setup

Configura no Windmill:

```env
LUSOPAY_ENV=test
LUSOPAY_PID=Cliente7
LUSOPAY_USERNAME=Cliente7
LUSOPAY_PASSWORD=secret
MERCHANT_ID=demo-store
MERCHANT_NAME=Loja Demo
```

Segurança por defeito:

- `raw` da LusoPay não é devolvido salvo se `include_raw=true`;
- dados sensíveis são redigidos em erros/logs;
- intervalos de consulta estão limitados a 90 dias.

## Validação local

```powershell
npm install
npm run validate
npm run check
```

## Documentação

Ver [docs/V1_ASSISTENTE_LUSOPAY.md](docs/V1_ASSISTENTE_LUSOPAY.md).
