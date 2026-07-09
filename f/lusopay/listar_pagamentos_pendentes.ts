import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { isOlderThanHours } from '../lib/date_utils.ts';
import { filterPayments, normalizeLusopayPayments } from '../lib/payment_normalizer.ts';

export async function main(
  merchant_id?: string,
  start_date?: string,
  end_date?: string,
  older_than_hours?: number,
  include_raw = false,
) {
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant, { start_date, end_date });
  const payments = filterPayments(normalizeLusopayPayments(raw, { include_raw }), { status: 'pending' })
    .filter((payment) => isOlderThanHours(payment.created_at, older_than_hours));

  return {
    total: payments.length,
    total_amount: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    payments,
  };
}
