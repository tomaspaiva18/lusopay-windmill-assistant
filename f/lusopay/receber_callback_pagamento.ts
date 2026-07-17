import { getMerchantContext } from '../lib/merchant_context.ts';
import { normalizePaymentStatus } from '../lib/payment_normalizer.ts';
import { appendAuditLog, updateCreatedPaymentLinkState } from '../lib/payment_registry.ts';
import { ValidationError, redactSensitiveData } from '../lib/errors.ts';

// Script preparado para ser ligado a um HTTP Trigger Windmill.
// Recebe actualizações externas de estado e sincroniza o registry local.

export async function main(
  order_id: string,
  status: string,
  merchant_id?: string,
  payment_id?: string,
  amount?: number,
  currency = 'EUR',
  raw_payload?: unknown,
) {
  if (!order_id) throw new ValidationError('order_id é obrigatório');
  if (!status) throw new ValidationError('status é obrigatório');

  const startedAt = Date.now();
  const merchant = await getMerchantContext(merchant_id);
  const state = normalizePaymentStatus(status);

  // O callback actualiza o estado mesmo que a transação ainda não apareça na listagem LusoPay.
  await updateCreatedPaymentLinkState(merchant, order_id, state, {
    payment_id: payment_id || null,
    amount: amount || undefined,
    currency,
  });

  await appendAuditLog(merchant, {
    tool: 'receber_callback_pagamento',
    order_id,
    duration_ms: Date.now() - startedAt,
    result: state,
    inputs: redactSensitiveData({ order_id, status, payment_id, amount, currency, raw_payload }),
  });

  return {
    accepted: true,
    order_id,
    state,
    summary: `Callback processado para ${order_id} com estado ${state}.`,
  };
}
