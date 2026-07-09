import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(lusopay: LusopayResource | undefined, order_id: string, use_mock = false) {
  if (!order_id) throw new Error('VALIDATION_ERROR: order_id é obrigatório');
  const result = await listPaymentsFromConfiguredSource(lusopay, { order_id }, use_mock);
  const payment = result.payments[0];
  if (!payment) {
    return {
      found: false,
      order_id,
      message: 'Nenhum pagamento encontrado na LusoPay para este order_id.',
    };
  }
  return {
    found: true,
    order_id: payment.order_id,
    status: payment.payment_status,
    amount: payment.amount,
    payment_method: payment.payment_method,
    created_at: payment.created_at,
    paid_at: payment.paid_at,
  };
}

