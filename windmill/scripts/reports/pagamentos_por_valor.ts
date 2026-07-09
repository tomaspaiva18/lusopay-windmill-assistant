import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(
  lusopay?: LusopayResource,
  start_date?: string,
  end_date?: string,
  min_amount?: number,
  max_amount?: number,
  status?: string,
  limit = 50,
  use_mock = false,
) {
  const result = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date, min_amount, max_amount, status, limit }, use_mock);
  return {
    ok: true,
    min_amount: min_amount ?? null,
    max_amount: max_amount ?? null,
    status: status ?? null,
    count: result.payments.length,
    total: result.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    payments: result.payments,
  };
}

