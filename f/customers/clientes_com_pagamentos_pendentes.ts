import { getCustomersWithPendingOrders } from '../lib/customer_analytics.ts';
import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchStoreOrders, getMockCustomers } from '../lib/store_client.ts';

export async function main(merchant_id?: string, older_than_days?: number, limit = 20) {
  const merchant = await getMerchantContext(merchant_id);
  const orders = await fetchStoreOrders(merchant);
  const customers = getCustomersWithPendingOrders(orders, getMockCustomers(), { older_than_days, limit });

  return {
    total: customers.length,
    customers,
  };
}

