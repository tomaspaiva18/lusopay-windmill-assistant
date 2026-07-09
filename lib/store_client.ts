import type { MerchantContext, StoreCustomer, StoreOrder } from './types.ts';
import { isWithinDateRange } from './date_utils.ts';
import { StoreDataError } from './errors.ts';

const mockCustomers: StoreCustomer[] = [
  { id: 'c001', name: 'João Silva', email: 'joao@example.com' },
  { id: 'c002', name: 'Maria Costa', email: 'maria@example.com' },
  { id: 'c003', name: 'Ana Martins', email: 'ana@example.com' },
  { id: 'c004', name: 'Rita Sousa', email: 'rita@example.com' },
];

const mockOrders: StoreOrder[] = [
  { order_id: '1001', customer_id: 'c001', amount: 29.9, currency: 'EUR', store_status: 'paid', created_at: '2026-07-01T10:00:00Z', customer_name: 'João Silva', customer_email: 'joao@example.com', payment_method: 'mbway' },
  { order_id: '1002', customer_id: 'c002', amount: 54.5, currency: 'EUR', store_status: 'pending', created_at: '2026-07-01T12:30:00Z', customer_name: 'Maria Costa', customer_email: 'maria@example.com', payment_method: 'multibanco' },
  { order_id: '1003', customer_id: 'c001', amount: 15, currency: 'EUR', store_status: 'pending', created_at: '2026-06-28T09:15:00Z', customer_name: 'João Silva', customer_email: 'joao@example.com', payment_method: 'card' },
  { order_id: '1004', customer_id: 'c003', amount: 120, currency: 'EUR', store_status: 'paid', created_at: '2026-06-25T17:40:00Z', customer_name: 'Ana Martins', customer_email: 'ana@example.com', payment_method: 'card' },
  { order_id: '1007', customer_id: 'c004', amount: 18, currency: 'EUR', store_status: 'cancelled', created_at: '2026-07-02T11:10:00Z', customer_name: 'Rita Sousa', customer_email: 'rita@example.com', payment_method: 'mbway' },
];

function assertMockStore(context: MerchantContext) {
  if ((context.store?.platform || 'mock') !== 'mock') {
    throw new StoreDataError(`Store platform ${context.store?.platform} ainda não implementada na V1`);
  }
}

export async function fetchStoreOrders(context: MerchantContext, startDate?: string, endDate?: string): Promise<StoreOrder[]> {
  assertMockStore(context);
  return mockOrders
    .filter((order) => isWithinDateRange(order.created_at, startDate, endDate))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function fetchStoreCustomer(context: MerchantContext, customerIdentifier: string): Promise<StoreCustomer | null> {
  assertMockStore(context);
  const id = customerIdentifier.toLowerCase().trim();
  return mockCustomers.find((customer) =>
    customer.id.toLowerCase() === id ||
    customer.email.toLowerCase() === id ||
    customer.name.toLowerCase().includes(id)
  ) ?? null;
}

export async function fetchStoreOrdersByCustomer(
  context: MerchantContext,
  customerId: string,
  startDate?: string,
  endDate?: string,
): Promise<StoreOrder[]> {
  const orders = await fetchStoreOrders(context, startDate, endDate);
  return orders.filter((order) => order.customer_id === customerId);
}

export function getMockCustomers(): StoreCustomer[] {
  return mockCustomers;
}

export function normalizeStoreStatus(status: string) {
  const value = status.toLowerCase();
  if (['paid', 'completed', 'processing'].includes(value)) return 'paid';
  if (['pending', 'on-hold', 'awaiting_payment'].includes(value)) return 'pending';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  if (['failed', 'refunded'].includes(value)) return 'failed';
  return 'unknown';
}

