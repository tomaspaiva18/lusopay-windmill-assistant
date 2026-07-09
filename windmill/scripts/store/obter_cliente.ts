import { fetchStoreCustomer } from '../../shared/store.ts';

export async function main(customer_identifier: string) {
  if (!customer_identifier) throw new Error('VALIDATION_ERROR: customer_identifier é obrigatório');
  const customer = fetchStoreCustomer(customer_identifier);
  return {
    found: Boolean(customer),
    customer,
    message: customer ? null : 'Cliente não encontrado na interface da loja.',
  };
}

