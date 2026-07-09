import type { PaymentStatus, StoreCustomer, StoreOrder } from './types.ts';

export const mockCustomers: StoreCustomer[] = [
  { id: 'c001', name: 'João Silva', email: 'joao@example.com' },
  { id: 'c002', name: 'Maria Costa', email: 'maria@example.com' },
  { id: 'c003', name: 'Ana Martins', email: 'ana@example.com' },
];

const rawOrders = [
  { order_id: '1001', customer_id: 'c001', customer_name: 'João Silva', customer_email: 'joao@example.com', amount: 29.9, currency: 'EUR', store_status: 'paid', created_at: '2026-07-01T10:00:00Z', payment_method: 'mbway' },
  { order_id: '1002', customer_id: 'c002', customer_name: 'Maria Costa', customer_email: 'maria@example.com', amount: 54.5, currency: 'EUR', store_status: 'pending', created_at: '2026-07-01T12:30:00Z', payment_method: 'multibanco' },
  { order_id: '1003', customer_id: 'c001', customer_name: 'João Silva', customer_email: 'joao@example.com', amount: 15, currency: 'EUR', store_status: 'pending', created_at: '2026-06-28T09:15:00Z', payment_method: 'card' },
  { order_id: '1004', customer_id: 'c003', customer_name: 'Ana Martins', customer_email: 'ana@example.com', amount: 120, currency: 'EUR', store_status: 'paid', created_at: '2026-06-25T17:40:00Z', payment_method: 'card' },
];

export function normalizeStoreStatus(value: string): PaymentStatus {
  const v = value.toLowerCase();
  if (['paid', 'completed', 'processing'].includes(v)) return 'paid';
  if (['pending', 'on-hold', 'awaiting_payment'].includes(v)) return 'pending';
  if (['cancelled', 'canceled'].includes(v)) return 'cancelled';
  if (['failed', 'refunded'].includes(v)) return 'failed';
  return 'unknown';
}

export function fetchStoreOrders(filters: { start_date?: string; end_date?: string; status?: string; customer_identifier?: string; limit?: number } = {}): StoreOrder[] {
  const identifier = filters.customer_identifier?.toLowerCase();
  const orders = rawOrders
    .map((order) => ({ ...order, normalized_status: normalizeStoreStatus(order.store_status) }))
    .filter((order) => !filters.start_date || order.created_at.slice(0, 10) >= filters.start_date)
    .filter((order) => !filters.end_date || order.created_at.slice(0, 10) <= filters.end_date)
    .filter((order) => !filters.status || order.normalized_status === normalizeStoreStatus(filters.status))
    .filter((order) => !identifier || [order.customer_id, order.customer_email, order.customer_name].some((value) => value.toLowerCase().includes(identifier)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return filters.limit ? orders.slice(0, Number(filters.limit)) : orders;
}

export function fetchStoreCustomer(customer_identifier: string): StoreCustomer | null {
  const identifier = customer_identifier.toLowerCase().trim();
  return mockCustomers.find((customer) =>
    customer.id.toLowerCase() === identifier ||
    customer.email.toLowerCase() === identifier ||
    customer.name.toLowerCase().includes(identifier)
  ) ?? null;
}

export function storeOrdersToPayments(orders: StoreOrder[]) {
  return orders.map((order) => ({
    order_id: order.order_id,
    payment_status: order.normalized_status,
    amount: order.amount,
    currency: order.currency,
    payment_method: order.payment_method,
    created_at: order.created_at,
    paid_at: order.normalized_status === 'paid' ? order.created_at : null,
    raw_source: 'store_mock' as const,
    raw: order,
  }));
}

