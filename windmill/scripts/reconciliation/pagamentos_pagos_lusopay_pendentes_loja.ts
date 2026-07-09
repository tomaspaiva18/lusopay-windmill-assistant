import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';
import { fetchStoreOrders, storeOrdersToPayments } from '../../shared/store.ts';

export async function main(lusopay: LusopayResource | undefined, start_date: string, end_date: string, use_mock = false) {
  const luso = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date, status: 'paid' }, use_mock);
  const storePayments = storeOrdersToPayments(fetchStoreOrders({ start_date, end_date }));
  const storeByOrder = new Map(storePayments.filter((p) => p.order_id).map((p) => [String(p.order_id), p]));

  const issues = [];
  for (const lp of luso.payments) {
    const sp = storeByOrder.get(String(lp.order_id));
    if (sp && lp.payment_status === 'paid' && sp.payment_status === 'pending') {
      issues.push({
        order_id: lp.order_id,
        lusopay_status: lp.payment_status,
        store_status: sp.payment_status,
        amount: lp.amount,
        currency: lp.currency,
        payment_method: lp.payment_method,
        lusopay_paid_at: lp.paid_at,
        store_created_at: sp.created_at,
      });
    }
  }

  return {
    ok: true,
    count: issues.length,
    total_amount: issues.reduce((sum, issue) => sum + Number(issue.amount || 0), 0),
    issues,
  };
}

