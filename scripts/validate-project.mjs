import fs from 'node:fs';

const required = [
  'f/lib/merchant_context.ts',
  'f/lib/lusopay_client.ts',
  'f/lib/payment_normalizer.ts',
  'f/lib/store_client.ts',
  'f/reconciliation/comparar_pagamentos_loja_lusopay.ts',
  'f/customers/obter_cliente.ts',
  'f/lusopay/listar_pagamentos.ts',
  'lib/merchant_context.ts',
  'lib/lusopay_client.ts',
  'lib/payment_normalizer.ts',
  'lib/store_client.ts',
  'lib/reconcile.ts',
  'lib/customer_analytics.ts',
  'lib/date_utils.ts',
  'lib/errors.ts',
  'lib/types.ts',
  'lusopay/listar_pagamentos.ts',
  'lusopay/obter_pagamento_por_order_id.ts',
  'lusopay/listar_pagamentos_pendentes.ts',
  'lusopay/resumo_pagamentos.ts',
  'reconciliation/comparar_pagamentos_loja_lusopay.ts',
  'customers/obter_cliente.ts',
  'customers/resumo_cliente.ts',
  'customers/listar_encomendas_cliente.ts',
  'customers/clientes_mais_ativos.ts',
  'customers/clientes_com_pagamentos_pendentes.ts',
  'examples/mock_store_orders.json',
  'examples/mock_customers.json',
  'docs/V1_ASSISTENTE_LUSOPAY.md',
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

for (const file of ['examples/mock_store_orders.json', 'examples/mock_customers.json']) {
  JSON.parse(fs.readFileSync(file, 'utf8'));
}

const libMetadataFiles = fs
  .readdirSync('f/lib', { recursive: true })
  .map((file) => String(file))
  .filter((file) => file.endsWith('.script.yaml') || file.endsWith('.script.lock'));

if (libMetadataFiles.length > 0) {
  throw new Error(`f/lib must stay as shared code, not Windmill scripts: ${libMetadataFiles.join(', ')}`);
}

console.log('Project structure ok');
