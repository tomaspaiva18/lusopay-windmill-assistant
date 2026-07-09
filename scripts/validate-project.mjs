import fs from 'node:fs';

const required = [
  'windmill/shared/types.ts',
  'windmill/shared/lusopay.ts',
  'windmill/shared/store.ts',
  'windmill/scripts/lusopay/listar_pagamentos.ts',
  'windmill/scripts/lusopay/obter_pagamento_por_order_id.ts',
  'windmill/scripts/lusopay/listar_pagamentos_pendentes.ts',
  'windmill/scripts/lusopay/resumo_pagamentos.ts',
  'windmill/scripts/reconciliation/comparar_pagamentos_loja_lusopay.ts',
  'windmill/scripts/store/obter_cliente.ts',
  'windmill/scripts/store/resumo_cliente.ts',
  'windmill/scripts/store/listar_encomendas_cliente.ts',
  'windmill/scripts/store/clientes_mais_ativos.ts',
  'windmill/scripts/store/clientes_com_pagamentos_pendentes.ts',
  'windmill/scripts/reports/pagamentos_falhados.ts',
  'windmill/scripts/reports/pagamentos_por_metodo.ts',
  'windmill/scripts/reports/pagamentos_por_valor.ts',
  'windmill/scripts/reports/relatorio_diario.ts',
  'windmill/scripts/reconciliation/pagamentos_pagos_lusopay_pendentes_loja.ts',
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

console.log('Project structure ok');

