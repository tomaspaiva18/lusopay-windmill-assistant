import { getMostActiveCustomers } from '../lib/customer_analytics.ts';
import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchStoreOrders, getMockCustomers } from '../lib/store_client.ts';

export async function main(
  start_date: string,
  end_date: string,
  sort_by: 'orders_count' | 'total_spent' = 'total_spent',
  limit = 10,
  merchant_id?: string,
) {
  const merchant = await getMerchantContext(merchant_id);
  const orders = await fetchStoreOrders(merchant, start_date, end_date);
  const customers = getMostActiveCustomers(orders, getMockCustomers(), { sort_by, limit });

  return {
    period: { start_date, end_date },
    total: customers.length,
    customers,
  };
}

