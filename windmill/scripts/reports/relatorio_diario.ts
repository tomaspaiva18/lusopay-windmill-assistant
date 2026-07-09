import type { LusopayResource } from '../../shared/types.ts';
import { summarizePayments } from '../../shared/lusopay.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(lusopay?: LusopayResource, date = new Date().toISOString().slice(0, 10), use_mock = false) {
  const result = await listPaymentsFromConfiguredSource(lusopay, { start_date: date, end_date: date }, use_mock);
  return {
    date,
    ...summarizePayments(result.payments),
    payments: result.payments,
  };
}

