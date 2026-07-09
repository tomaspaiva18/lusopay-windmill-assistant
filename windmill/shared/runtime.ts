import type { LusopayResource, PaymentFilters } from './types.ts';
import { listLusopayPayments } from './lusopay.ts';
import { listMockLusopayPayments } from './lusopay_mock.ts';

export async function listPaymentsFromConfiguredSource(
  lusopay: LusopayResource | undefined,
  filters: PaymentFilters,
  use_mock = false,
) {
  if (use_mock) return listMockLusopayPayments(filters);
  if (!lusopay) throw new Error('CONFIG_ERROR: lusopay resource é obrigatório quando use_mock=false');
  return listLusopayPayments(lusopay, filters);
}

