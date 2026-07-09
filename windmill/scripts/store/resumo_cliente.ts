import { fetchStoreCustomer, fetchStoreOrders } from '../../shared/store.ts';

export async function main(customer_identifier: string, period_days = 30) {
  if (!customer_identifier) throw new Error('VALIDATION_ERROR: customer_identifier é obrigatório');
  const customer = fetchStoreCustomer(customer_identifier);
  if (!customer) return { found: false, message: 'Cliente não encontrado.' };

  const cutoff = Date.now() - Number(period_days) * 24 * 60 * 60 * 1000;
  const orders = fetchStoreOrders({ customer_identifier: customer.id })
    .filter((order) => Date.parse(order.created_at) >= cutoff);
  const count = (status: string) => orders.filter((order) => order.normalized_status === status).length;

  return {
    found: true,
    customer,
    period_days,
    orders_count: orders.length,
    total_spent: orders.filter((order) => order.normalized_status === 'paid').reduce((sum, order) => sum + Number(order.amount || 0), 0),
    paid_orders: count('paid'),
    pending_orders: count('pending'),
    cancelled_orders: count('cancelled'),
    last_order_date: orders.map((order) => order.created_at).sort().at(-1) ?? null,
  };
}

