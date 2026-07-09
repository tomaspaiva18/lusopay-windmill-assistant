import type { LusopayResource } from '../../shared/types.ts';
import { summarizePayments } from '../../shared/lusopay.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(lusopay: LusopayResource | undefined, start_date: string, end_date: string, use_mock = false) {
  const result = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date }, use_mock);
  return {
    period: { start_date, end_date },
    ...summarizePayments(result.payments),
    payments_count: result.payments.length,
  };
}

