import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { filterPayments, normalizeLusopayPayments } from '../lib/payment_normalizer.ts';
import { ValidationError } from '../lib/errors.ts';
import { appendAuditLog, findCreatedPaymentLink, updateCreatedPaymentLinkState } from '../lib/payment_registry.ts';

// Consulta por order_id com fallback para o registry local de links criados.

export async function main(order_id: string, merchant_id?: string, include_raw = false) {
  if (!order_id) throw new ValidationError('order_id é obrigatório');
  const startedAt = Date.now();
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant);
  const payment = filterPayments(normalizeLusopayPayments(raw, { include_raw }), { order_id })[0];

  if (!payment) {
    // Caso esperado: link criado, mas ainda sem transação visível na API de listagem.
    const createdLink = await findCreatedPaymentLink(merchant, order_id);
    await appendAuditLog(merchant, {
      tool: 'obter_pagamento_por_order_id',
      order_id,
      duration_ms: Date.now() - startedAt,
      result: createdLink ? 'link_created_not_in_lusopay_transactions' : 'not_found',
      inputs: { order_id, include_raw },
    });

    if (createdLink) {
      return {
        found: true,
        source: 'local_link_registry',
        order_id,
        state: createdLink.state,
        payment: {
          payment_id: createdLink.payment_id,
          order_id: createdLink.order_id,
          payment_status: createdLink.state,
          amount: createdLink.amount,
          currency: createdLink.currency,
          payment_link: createdLink.payment_link,
          created_at: createdLink.created_at,
          paid_at: null,
          raw_source: 'lusopay',
        },
        summary: 'Link criado e guardado localmente; ainda não existe transação visível na listagem da LusoPay.',
      };
    }

    return {
      found: false,
      order_id,
      message: 'Nenhum pagamento encontrado na LusoPay para este order_id.',
      summary: 'Não existe pagamento nem link local conhecido para este order_id.',
    };
  }

  await updateCreatedPaymentLinkState(merchant, order_id, payment.payment_status, {
    // Se a LusoPay já conhece a transação, sincronizamos o registry local.
    payment_id: payment.payment_id,
    expires_at: payment.expires_at,
  });
  await appendAuditLog(merchant, {
    tool: 'obter_pagamento_por_order_id',
    order_id,
    duration_ms: Date.now() - startedAt,
    result: payment.payment_status,
    inputs: { order_id, include_raw },
  });

  return {
    found: true,
    source: 'lusopay_transactions',
    payment,
    summary: `Pagamento encontrado na LusoPay com estado ${payment.payment_status}.`,
  };
}
