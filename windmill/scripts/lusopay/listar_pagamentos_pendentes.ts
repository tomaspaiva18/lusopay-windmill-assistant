import type { LusopayResource } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(
  lusopay?: LusopayResource,
  start_date?: string,
  end_date?: string,
  older_than_hours?: number,
  limit?: number,
  use_mock = false,
) {
  const result = await listPaymentsFromConfiguredSource(lusopay, { start_date, end_date, status: 'pending', limit }, use_mock);
  const cutoff = older_than_hours ? Date.now() - Number(older_than_hours) * 60 * 60 * 1000 : null;
  const payments = result.payments.filter((payment) => !cutoff || (payment.created_at && Date.parse(payment.created_at) <= cutoff));
  return {
    ok: true,
    count: payments.length,
    total_pending: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    older_than_hours: older_than_hours ?? null,
    payments,
  };
}

