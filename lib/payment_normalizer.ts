import type { NormalizedPayment, PaymentStatus } from './types.ts';

function first(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  const v = String(value ?? '').toLowerCase();
  if (['paid', 'pago', 'success', 'successful', 'confirmed'].includes(v)) return 'paid';
  if (['pending', 'pendente', 'created', 'waiting'].includes(v)) return 'pending';
  if (['cancelled', 'canceled', 'cancelado', 'canceled_by_user'].includes(v)) return 'cancelled';
  if (['failed', 'declined', 'refused', 'error', 'falhado', 'recusado'].includes(v)) return 'failed';
  return 'unknown';
}

export function normalizePaymentMethod(value: unknown): string | null {
  const original = value == null ? '' : String(value);
  const v = original.toLowerCase();
  if (v.includes('mbway') || v.includes('mb way')) return 'mbway';
  if (v.includes('multibanco') || v === 'mb' || v.includes('reference')) return 'multibanco';
  if (v.includes('card') || v.includes('visa') || v.includes('mastercard') || v.includes('cart')) return 'card';
  return original || null;
}

export function normalizeLusopayPayment(raw: any): NormalizedPayment {
  const custom = raw?.customValues || raw?.custom_values || {};
  const statusRaw = first(custom.PS, custom.payment_status, custom.status, raw?.status);
  const methodRaw = first(custom.CPM, custom.PYM, custom.chosen_payment_method, custom.payment_method, raw?.paymentMethod);
  const amountRaw = first(custom.AMT, custom.amount, custom.paid_amount, raw?.amount);
  const created = first(raw?.creationDate, raw?.createdAt, custom.created_at, custom.CD, custom.creation_date);
  const paid = first(custom.paid_at, custom.payment_date, custom.PD, raw?.paymentDate);
  const paymentStatus = normalizePaymentStatus(statusRaw);

  return {
    order_id: first(custom.OID, custom.order_id, raw?.orderId) as string | null,
    payment_status: paymentStatus,
    amount: Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null,
    currency: (first(custom.CUR, custom.currency, raw?.currency) as string | null) || 'EUR',
    payment_method: normalizePaymentMethod(methodRaw),
    created_at: created as string | null,
    paid_at: paymentStatus === 'paid' ? ((paid || created) as string | null) : null,
    raw_source: 'lusopay',
    raw,
  };
}

export function normalizeLusopayPayments(rawRecords: unknown[]): NormalizedPayment[] {
  return rawRecords.map((record) => normalizeLusopayPayment(record));
}

export function filterPayments(payments: NormalizedPayment[], filters: {
  status?: string;
  payment_method?: string;
  order_id?: string;
}) {
  return payments
    .filter((payment) => !filters.status || payment.payment_status === normalizePaymentStatus(filters.status))
    .filter((payment) => !filters.payment_method || payment.payment_method === normalizePaymentMethod(filters.payment_method))
    .filter((payment) => !filters.order_id || String(payment.order_id ?? '') === String(filters.order_id))
    .sort((a, b) => Date.parse(b.created_at || '1970-01-01') - Date.parse(a.created_at || '1970-01-01'));
}

export function summarizePayments(payments: NormalizedPayment[]) {
  const by_method: Record<string, number> = {};
  for (const payment of payments) {
    const method = payment.payment_method || 'unknown';
    by_method[method] = (by_method[method] || 0) + Number(payment.amount || 0);
  }
  const count = (status: PaymentStatus) => payments.filter((payment) => payment.payment_status === status).length;
  return {
    total_received: payments
      .filter((payment) => payment.payment_status === 'paid')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    paid_count: count('paid'),
    pending_count: count('pending'),
    cancelled_count: count('cancelled'),
    failed_count: count('failed'),
    by_method,
  };
}

