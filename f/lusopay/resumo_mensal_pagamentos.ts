import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { normalizeLusopayPayments, summarizePayments } from '../lib/payment_normalizer.ts';
import { ValidationError } from '../lib/errors.ts';

function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ValidationError('month deve usar formato YYYY-MM');
  const [yearValue, monthValue] = month.split('-').map(Number);
  if (monthValue < 1 || monthValue > 12) throw new ValidationError('month deve estar entre 01 e 12');

  const start_date = `${month}-01`;
  const lastDay = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
  const end_date = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { start_date, end_date };
}

export async function main(month: string, merchant_id?: string, include_raw = false) {
  const merchant = await getMerchantContext(merchant_id);
  const period = monthRange(month);
  const raw = await fetchTransactions(merchant, period);
  const payments = normalizeLusopayPayments(raw, { include_raw });
  const summary = summarizePayments(payments);

  return {
    month,
    period,
    total_payments: payments.length,
    ...summary,
    insights: [
      `Pagamentos pagos: ${summary.paid_count}`,
      `Pagamentos pendentes: ${summary.pending_count}`,
      `Pagamentos cancelados: ${summary.cancelled_count}`,
      `Pagamentos falhados: ${summary.failed_count}`,
    ],
  };
}
