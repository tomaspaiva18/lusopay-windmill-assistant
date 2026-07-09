import { fetchStoreOrders } from '../../shared/store.ts';

export async function main(older_than_days?: number, limit = 20) {
  const cutoff = older_than_days ? Date.now() - Number(older_than_days) * 24 * 60 * 60 * 1000 : null;
  const orders = fetchStoreOrders({ status: 'pending' })
    .filter((order) => !cutoff || Date.parse(order.created_at) <= cutoff);

  const byCustomer = new Map<string, { id: string; name: string; email: string; pending_orders: unknown[]; total_pending: number }>();
  for (const order of orders) {
    const row = byCustomer.get(order.customer_id) ?? {
      id: order.customer_id,
      name: order.customer_name,
      email: order.customer_email,
      pending_orders: [],
      total_pending: 0,
    };
    row.pending_orders.push({ order_id: order.order_id, amount: order.amount, currency: order.currency, created_at: order.created_at });
    row.total_pending += Number(order.amount || 0);
    byCustomer.set(order.customer_id, row);
  }

  return {
    count: byCustomer.size,
    customers: [...byCustomer.values()].slice(0, limit),
  };
}

