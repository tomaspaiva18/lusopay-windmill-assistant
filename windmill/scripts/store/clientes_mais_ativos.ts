import { fetchStoreOrders } from '../../shared/store.ts';

export async function main(start_date?: string, end_date?: string, sort_by: 'orders_count' | 'total_spent' = 'total_spent', limit = 10) {
  const orders = fetchStoreOrders({ start_date, end_date });
  const byCustomer = new Map<string, { id: string; name: string; email: string; orders_count: number; total_spent: number }>();

  for (const order of orders) {
    const row = byCustomer.get(order.customer_id) ?? {
      id: order.customer_id,
      name: order.customer_name,
      email: order.customer_email,
      orders_count: 0,
      total_spent: 0,
    };
    row.orders_count += 1;
    row.total_spent += Number(order.amount || 0);
    byCustomer.set(order.customer_id, row);
  }

  return {
    sort_by,
    limit,
    ranking: [...byCustomer.values()].sort((a, b) => Number(b[sort_by]) - Number(a[sort_by])).slice(0, limit),
  };
}

