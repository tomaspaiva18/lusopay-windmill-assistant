import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { filterPayments, normalizeLusopayPayments } from '../lib/payment_normalizer.ts';
import { ValidationError } from '../lib/errors.ts';

export async function main(order_id: string, merchant_id?: string, include_raw = false) {
  if (!order_id) throw new ValidationError('order_id é obrigatório');
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant);
  const payment = filterPayments(normalizeLusopayPayments(raw, { include_raw }), { order_id })[0];

  if (!payment) {
    return {
      found: false,
      order_id,
      message: 'Nenhum pagamento encontrado na LusoPay para este order_id.',
    };
  }

  return {
    found: true,
    payment,
  };
}
