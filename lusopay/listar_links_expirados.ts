import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { filterPayments, normalizeLusopayPayments } from '../lib/payment_normalizer.ts';
import { redactSensitiveData } from '../lib/errors.ts';

function isExpiredLink(payment: { link_status?: string | null; expires_at?: string | null; payment_status?: string }) {
  const linkStatus = String(payment.link_status ?? '').toLowerCase();
  if (['expired', 'expirado', 'inactive', 'inativo', 'cancelled', 'canceled', 'cancelado'].includes(linkStatus)) return true;

  if (!payment.expires_at || payment.payment_status === 'paid') return false;
  const expiresAt = Date.parse(payment.expires_at);
  return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

export async function main(
  merchant_id?: string,
  start_date?: string,
  end_date?: string,
  include_raw = false,
) {
  const startedAt = Date.now();
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant, { start_date, end_date });
  const payments = filterPayments(normalizeLusopayPayments(raw, { include_raw }), {})
    .filter((payment) => isExpiredLink(payment));

  return {
    total: payments.length,
    filters: { start_date, end_date },
    payments,
    log: {
      tool: 'listar_links_expirados',
      merchant_id: merchant.merchant_id,
      duration_ms: Date.now() - startedAt,
      results_count: payments.length,
      inputs: redactSensitiveData({ start_date, end_date, include_raw }),
    },
  };
}
