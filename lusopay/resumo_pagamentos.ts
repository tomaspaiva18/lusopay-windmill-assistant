import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { normalizeLusopayPayments, summarizePayments } from '../lib/payment_normalizer.ts';

export async function main(start_date: string, end_date: string, merchant_id?: string, include_raw = false) {
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant, { start_date, end_date });
  const payments = normalizeLusopayPayments(raw, { include_raw });

  return {
    period: { start_date, end_date },
    ...summarizePayments(payments),
  };
}
