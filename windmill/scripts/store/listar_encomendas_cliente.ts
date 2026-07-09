import { fetchStoreOrders } from '../../shared/store.ts';

export async function main(customer_identifier: string, start_date?: string, end_date?: string, limit = 50) {
  if (!customer_identifier) throw new Error('VALIDATION_ERROR: customer_identifier é obrigatório');
  const orders = fetchStoreOrders({ customer_identifier, start_date, end_date, limit });
  return {
    count: orders.length,
    orders,
  };
}

