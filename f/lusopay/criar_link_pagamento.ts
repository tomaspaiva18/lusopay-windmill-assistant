import { getMerchantContext } from '../lib/merchant_context.ts';
import { createPayByLink } from '../lib/lusopay_client.ts';
import { ValidationError, redactSensitiveData } from '../lib/errors.ts';

function assertUrl(value: string, field: string) {
  try {
    return new URL(value).toString();
  } catch {
    throw new ValidationError(`${field} deve ser um URL válido`);
  }
}

export async function main(
  amount: number,
  description: string,
  order_id: string,
  customer_name: string,
  customer_email: string,
  return_url: string,
  website_url: string,
  merchant_id?: string,
  currency = 'EUR',
  country = 'PT',
  language = 'pt_PT',
  payment_methods: string[] = ['P0'],
  dry_run = true,
) {
  const startedAt = Date.now();
  const merchant = await getMerchantContext(merchant_id);

  const result = await createPayByLink(merchant, {
    amount,
    currency,
    description,
    order_id,
    customer_name,
    customer_email,
    return_url: assertUrl(return_url, 'return_url'),
    website_url: assertUrl(website_url, 'website_url'),
    country,
    language,
    payment_methods,
    dry_run,
  });

  return {
    ...result,
    order_id,
    amount,
    currency,
    log: {
      tool: 'criar_link_pagamento',
      merchant_id: merchant.merchant_id,
      duration_ms: Date.now() - startedAt,
      dry_run: result.dry_run,
      inputs: redactSensitiveData({
        amount,
        currency,
        order_id,
        country,
        language,
        payment_methods,
        dry_run,
      }),
    },
  };
}
