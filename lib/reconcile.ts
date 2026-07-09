import type { NormalizedPayment, ReconciliationIssue, StoreOrder } from './types.ts';
import { normalizeStoreStatus } from './store_client.ts';

export function reconcilePayments(storeOrders: StoreOrder[], lusopayPayments: NormalizedPayment[]) {
  const issues: ReconciliationIssue[] = [];
  const lusopayByOrder = new Map(lusopayPayments.filter((payment) => payment.order_id).map((payment) => [String(payment.order_id), payment]));
  const storeByOrder = new Map(storeOrders.map((order) => [String(order.order_id), order]));
  let matched = 0;

  for (const [orderId, payment] of lusopayByOrder) {
    const order = storeByOrder.get(orderId);
    if (!order) {
      issues.push({ order_id: orderId, issue: 'only_in_lusopay', store_status: null, lusopay_status: payment.payment_status, store_amount: null, lusopay_amount: payment.amount });
      continue;
    }

    matched += 1;
    const storeStatus = normalizeStoreStatus(order.store_status);
    if (storeStatus !== payment.payment_status) {
      issues.push({ order_id: orderId, issue: 'status_mismatch', store_status: storeStatus, lusopay_status: payment.payment_status, store_amount: order.amount, lusopay_amount: payment.amount });
    }
    if (payment.amount !== null && Number(order.amount) !== Number(payment.amount)) {
      issues.push({ order_id: orderId, issue: 'amount_mismatch', store_status: storeStatus, lusopay_status: payment.payment_status, store_amount: order.amount, lusopay_amount: payment.amount });
    }
  }

  for (const [orderId, order] of storeByOrder) {
    if (!lusopayByOrder.has(orderId)) {
      issues.push({ order_id: orderId, issue: 'only_in_store', store_status: normalizeStoreStatus(order.store_status), lusopay_status: null, store_amount: order.amount, lusopay_amount: null });
    }
  }

  return {
    summary: {
      matched,
      only_in_lusopay: issues.filter((issue) => issue.issue === 'only_in_lusopay').length,
      only_in_store: issues.filter((issue) => issue.issue === 'only_in_store').length,
      status_mismatches: issues.filter((issue) => issue.issue === 'status_mismatch').length,
      amount_mismatches: issues.filter((issue) => issue.issue === 'amount_mismatch').length,
    },
    issues,
  };
}

