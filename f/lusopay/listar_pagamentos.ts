import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { filterPayments, normalizeLusopayPayments } from '../lib/payment_normalizer.ts';
import { redactSensitiveData } from '../lib/errors.ts';
import { appendAuditLog } from '../lib/payment_registry.ts';

// Listagem principal de pagamentos LusoPay, com filtros adicionais aplicados localmente.

export async function main(
  merchant_id?: string,
  start_date?: string,
  end_date?: string,
  status?: string,
  payment_method?: string,
  order_id?: string,
  include_raw = false,
) {
  const startedAt = Date.now();
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant, { start_date, end_date });
  // Normaliza antes de filtrar para todos os consumidores receberem o mesmo contrato.
  const payments = filterPayments(normalizeLusopayPayments(raw, { include_raw }), { status, payment_method, order_id });
  await appendAuditLog(merchant, {
    tool: 'listar_pagamentos',
    duration_ms: Date.now() - startedAt,
    result: `results:${payments.length}`,
    inputs: redactSensitiveData({ start_date, end_date, status, payment_method, order_id, include_raw }),
  });

  return {
    total: payments.length,
    filters: { start_date, end_date, status, payment_method, order_id },
    payments,
    summary: `Foram encontrados ${payments.length} pagamentos na LusoPay para os filtros indicados.`,
    log: {
      tool: 'listar_pagamentos',
      merchant_id: merchant.merchant_id,
      duration_ms: Date.now() - startedAt,
      results_count: payments.length,
      inputs: redactSensitiveData({ start_date, end_date, status, payment_method, order_id, include_raw }),
    },
  };
}
