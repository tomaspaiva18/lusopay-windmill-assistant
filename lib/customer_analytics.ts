import type { StoreCustomer, StoreOrder } from './types.ts';
import { isOlderThanDays } from './date_utils.ts';
import { normalizeStoreStatus } from './store_client.ts';

export function buildCustomerSummary(customer: StoreCustomer, orders: StoreOrder[], periodDays = 30) {
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const scoped = orders.filter((order) => Date.parse(order.created_at) >= cutoff);
  const count = (status: string) => scoped.filter((order) => normalizeStoreStatus(order.store_status) === status).length;

  return {
    customer,
    period_days: periodDays,
    orders_count: scoped.length,
    total_spent: scoped
      .filter((order) => normalizeStoreStatus(order.store_status) === 'paid')
      .reduce((sum, order) => sum + Number(order.amount || 0), 0),
    paid_orders: count('paid'),
    pending_orders: count('pending'),
    cancelled_orders: count('cancelled'),
    last_order_date: scoped.map((order) => order.created_at).sort().at(-1) || null,
  };
}

export function getMostActiveCustomers(
  orders: StoreOrder[],
  customers: StoreCustomer[],
  options: { sort_by?: 'orders_count' | 'total_spent'; limit?: number } = {},
) {
  const sortBy = options.sort_by || 'total_spent';
  const limit = options.limit || 10;
  const byCustomer = new Map<string, { customer: StoreCustomer; orders_count: number; total_spent: number }>();

  for (const order of orders) {
    const customer = customers.find((item) => item.id === order.customer_id) || {
      id: order.customer_id,
      name: order.customer_name || order.customer_id,
      email: order.customer_email || '',
    };
    const row = byCustomer.get(order.customer_id) || { customer, orders_count: 0, total_spent: 0 };
    row.orders_count += 1;
    row.total_spent += Number(order.amount || 0);
    byCustomer.set(order.customer_id, row);
  }

  return [...byCustomer.values()].sort((a, b) => Number(b[sortBy]) - Number(a[sortBy])).slice(0, limit);
}

export function getCustomersWithPendingOrders(
  orders: StoreOrder[],
  customers: StoreCustomer[],
  options: { older_than_days?: number; limit?: number } = {},
) {
  const pending = orders.filter((order) =>
    normalizeStoreStatus(order.store_status) === 'pending' &&
    isOlderThanDays(order.created_at, options.older_than_days)
  );
  const grouped = new Map<string, { customer: StoreCustomer; orders: StoreOrder[]; pending_orders_count: number; pending_total_amount: number }>();

  for (const order of pending) {
    const customer = customers.find((item) => item.id === order.customer_id) || {
      id: order.customer_id,
      name: order.customer_name || order.customer_id,
      email: order.customer_email || '',
    };
    const row = grouped.get(order.customer_id) || { customer, orders: [], pending_orders_count: 0, pending_total_amount: 0 };
    row.orders.push(order);
    row.pending_orders_count += 1;
    row.pending_total_amount += Number(order.amount || 0);
    grouped.set(order.customer_id, row);
  }

  return [...grouped.values()].slice(0, options.limit || 20);
}

