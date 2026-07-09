import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { normalizeLusopayPayments } from '../lib/payment_normalizer.ts';
import { fetchStoreOrders } from '../lib/store_client.ts';
import { reconcilePayments } from '../lib/reconcile.ts';

export async function main(start_date: string, end_date: string, merchant_id?: string, include_raw = false) {
  const merchant = await getMerchantContext(merchant_id);
  const [rawPayments, storeOrders] = await Promise.all([
    fetchTransactions(merchant, { start_date, end_date }),
    fetchStoreOrders(merchant, start_date, end_date),
  ]);

  return reconcilePayments(storeOrders, normalizeLusopayPayments(rawPayments, { include_raw }));
}
