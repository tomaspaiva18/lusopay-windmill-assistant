import { getMerchantContext } from '../lib/merchant_context.ts';
import { createPayByLink } from '../lib/lusopay_client.ts';
import { ValidationError, redactSensitiveData } from '../lib/errors.ts';
import { appendAuditLog, saveCreatedPaymentLink } from '../lib/payment_registry.ts';

// Ferramenta de escrita: cria Pay by Link na LusoPay.
// Por defeito corre em dry_run para evitar criação acidental de links reais.

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

  // A chamada real à LusoPay fica encapsulada no cliente partilhado.
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

  if (!result.dry_run && result.payment_link) {
    // Guardamos localmente porque a listagem da LusoPay pode não mostrar imediatamente links recém-criados.
    await saveCreatedPaymentLink(merchant, {
      merchant_id: merchant.merchant_id,
      order_id,
      payment_id: result.payment_id,
      payment_link: result.payment_link,
      amount,
      currency,
      customer_email,
      customer_name,
      created_at: result.created_at,
      state: 'link_created',
    });
  }

  await appendAuditLog(merchant, {
    // Auditoria operacional para perceber quem criou o quê sem expor dados sensíveis.
    tool: 'criar_link_pagamento',
    order_id,
    duration_ms: Date.now() - startedAt,
    result: result.dry_run ? 'prepared' : String(result.estado),
    inputs: redactSensitiveData({ amount, currency, order_id, country, language, payment_methods, dry_run }),
  });

  return {
    ...result,
    order_id,
    amount,
    currency,
    summary: result.dry_run
      ? `Pay by Link preparado para a encomenda ${order_id}; ainda não foi criado na LusoPay.`
      : `Pay by Link criado para a encomenda ${order_id}. Envia o payment_link ao cliente.`,
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
