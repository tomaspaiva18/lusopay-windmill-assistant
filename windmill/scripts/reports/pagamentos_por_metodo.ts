import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(
  lusopay: LusopayResource | undefined,
  payment_method: string,
  start_date?: string,
  end_date?: string,
  status?: string,
  limit = 50,
  use_mock = false,
) {
  if (!payment_method) throw new Error('VALIDATION_ERROR: payment_method é obrigatório');
  const result = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date, status, payment_method, limit }, use_mock);
  return {
    ok: true,
    payment_method,
    status: status ?? null,
    count: result.payments.length,
    total: result.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    payments: result.payments,
  };
}

