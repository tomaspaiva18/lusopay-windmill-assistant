import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';
import { fetchStoreOrders, storeOrdersToPayments } from '../../shared/store.ts';

export async function main(lusopay: LusopayResource | undefined, start_date: string, end_date: string, use_mock = false) {
  const luso = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date }, use_mock);
  const storePayments = storeOrdersToPayments(fetchStoreOrders({ start_date, end_date }));
  const lusoByOrder = new Map(luso.payments.filter((p) => p.order_id).map((p) => [String(p.order_id), p]));
  const storeByOrder = new Map(storePayments.filter((p) => p.order_id).map((p) => [String(p.order_id), p]));
  const issues = [];
  let matched = 0;

  for (const [orderId, lp] of lusoByOrder) {
    const sp = storeByOrder.get(orderId);
    if (!sp) {
      issues.push({ order_id: orderId, issue: 'only_in_lusopay', store_status: null, lusopay_status: lp.payment_status, store_amount: null, lusopay_amount: lp.amount });
      continue;
    }
    matched += 1;
    if (sp.payment_status !== lp.payment_status) {
      issues.push({ order_id: orderId, issue: 'status_mismatch', store_status: sp.payment_status, lusopay_status: lp.payment_status, store_amount: sp.amount, lusopay_amount: lp.amount });
    }
    if (Number(sp.amount) !== Number(lp.amount)) {
      issues.push({ order_id: orderId, issue: 'amount_mismatch', store_status: sp.payment_status, lusopay_status: lp.payment_status, store_amount: sp.amount, lusopay_amount: lp.amount });
    }
  }

  for (const [orderId, sp] of storeByOrder) {
    if (!lusoByOrder.has(orderId)) {
      issues.push({ order_id: orderId, issue: 'only_in_store', store_status: sp.payment_status, lusopay_status: null, store_amount: sp.amount, lusopay_amount: null });
    }
  }

  return {
    summary: {
      matched,
      only_in_lusopay: issues.filter((i) => i.issue === 'only_in_lusopay').length,
      only_in_store: issues.filter((i) => i.issue === 'only_in_store').length,
      status_mismatches: issues.filter((i) => i.issue === 'status_mismatch').length,
      amount_mismatches: issues.filter((i) => i.issue === 'amount_mismatch').length,
    },
    issues,
  };
}

