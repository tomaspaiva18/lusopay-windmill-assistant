import type { LusopayResource, PaymentFilters } from '../../shared/types.ts';
import { listPaymentsFromConfiguredSource } from '../../shared/runtime.ts';

export async function main(
  lusopay?: LusopayResource,
  start_date?: string,
  end_date?: string,
  status?: string,
  payment_method?: string,
  order_id?: string,
  min_amount?: number,
  max_amount?: number,
  limit?: number,
  use_mock = false,
) {
  const filters: PaymentFilters = { start_date, end_date, status, payment_method, order_id, min_amount, max_amount, limit };
  return listPaymentsFromConfiguredSource(lusopay, filters, use_mock);
}

