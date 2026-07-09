import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(lusopay?: LusopayResource, start_date?: string, end_date?: string, limit = 50, use_mock = false) {
  const result = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date, status: 'failed', limit }, use_mock);
  return {
    ok: true,
    count: result.payments.length,
    total_failed_amount: result.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    payments: result.payments,
  };
}

