import { ValidationError } from '../lib/errors.ts';
import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchStoreCustomer } from '../lib/store_client.ts';

export async function main(customer_identifier: string, merchant_id?: string) {
  if (!customer_identifier) throw new ValidationError('customer_identifier é obrigatório');
  const merchant = await getMerchantContext(merchant_id);
  const customer = await fetchStoreCustomer(merchant, customer_identifier);

  return {
    found: Boolean(customer),
    customer: customer || undefined,
    message: customer ? undefined : 'Cliente não encontrado.',
  };
}

