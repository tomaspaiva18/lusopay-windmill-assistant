import { ValidationError } from '../lib/errors.ts';
import { buildCustomerSummary } from '../lib/customer_analytics.ts';
import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchStoreCustomer, fetchStoreOrdersByCustomer } from '../lib/store_client.ts';

export async function main(customer_identifier: string, merchant_id?: string, period_days = 30) {
  if (!customer_identifier) throw new ValidationError('customer_identifier é obrigatório');
  const merchant = await getMerchantContext(merchant_id);
  const customer = await fetchStoreCustomer(merchant, customer_identifier);
  if (!customer) return { found: false, message: 'Cliente não encontrado.' };

  const orders = await fetchStoreOrdersByCustomer(merchant, customer.id);
  return buildCustomerSummary(customer, orders, period_days);
}

