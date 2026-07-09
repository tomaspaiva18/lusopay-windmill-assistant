import type { ListPaymentsResult, LusopayResource, NormalizedPayment, PaymentFilters, PaymentStatus } from './types.ts';

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

function first(...values: unknown[]): unknown {
  return values.find((v) => v !== undefined && v !== null && v !== '') ?? null;
}

function basicAuth(username: string, password: string): string {
  const raw = `${username}:${password}`;
  const maybeBtoa = (globalThis as unknown as { btoa?: (value: string) => string }).btoa;
  if (maybeBtoa) return maybeBtoa(raw);
  const maybeBuffer = (globalThis as unknown as { Buffer?: { from: (value: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybeBuffer) return maybeBuffer.from(raw).toString('base64');
  throw new Error('RUNTIME_ERROR: no base64 encoder available');
}

function validateDate(value?: string): void {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('VALIDATION_ERROR: datas devem usar YYYY-MM-DD');
  }
}

export function validateFilters(filters: PaymentFilters): void {
  validateDate(filters.start_date);
  validateDate(filters.end_date);
  if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
    throw new Error('VALIDATION_ERROR: start_date posterior a end_date');
  }
  if (filters.min_amount != null && !Number.isFinite(Number(filters.min_amount))) {
    throw new Error('VALIDATION_ERROR: min_amount inválido');
  }
  if (filters.max_amount != null && !Number.isFinite(Number(filters.max_amount))) {
    throw new Error('VALIDATION_ERROR: max_amount inválido');
  }
  if (filters.min_amount != null && filters.max_amount != null && Number(filters.min_amount) > Number(filters.max_amount)) {
    throw new Error('VALIDATION_ERROR: min_amount maior que max_amount');
  }
}

export function normalizeLusopayRecord(record: any): NormalizedPayment {
  const custom = record?.customValues || record?.custom_values || {};
  const statusRaw = first(custom.PS, custom.payment_status, custom.status, record?.status);
  const methodRaw = first(custom.CPM, custom.PYM, custom.chosen_payment_method, custom.payment_method, record?.paymentMethod);
  const amountRaw = first(custom.AMT, custom.amount, custom.paid_amount, record?.amount);
  const created = first(record?.creationDate, record?.createdAt, custom.created_at, custom.CD, custom.creation_date);
  const paid = first(custom.paid_at, custom.payment_date, custom.PD, record?.paymentDate);
  const status = normalizePaymentStatus(statusRaw);

  return {
    order_id: first(custom.OID, custom.order_id, record?.orderId) as string | null,
    payment_status: status,
    amount: Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : 0,
    currency: (first(custom.CUR, custom.currency, record?.currency) as string | null) || 'EUR',
    payment_method: normalizePaymentMethod(methodRaw),
    created_at: created as string | null,
    paid_at: status === 'paid' ? ((paid || created) as string | null) : null,
    raw_source: 'lusopay',
    raw: record,
  };
}

export function applyPaymentFilters(payments: NormalizedPayment[], filters: PaymentFilters): NormalizedPayment[] {
  const filtered = payments
    .filter((payment) => !filters.status || payment.payment_status === normalizePaymentStatus(filters.status))
    .filter((payment) => !filters.payment_method || String(payment.payment_method ?? '').toLowerCase() === filters.payment_method?.toLowerCase())
    .filter((payment) => !filters.order_id || String(payment.order_id ?? '') === String(filters.order_id))
    .filter((payment) => filters.min_amount == null || Number(payment.amount || 0) >= Number(filters.min_amount))
    .filter((payment) => filters.max_amount == null || Number(payment.amount || 0) <= Number(filters.max_amount))
    .sort((a, b) => Date.parse(b.created_at || '1970-01-01') - Date.parse(a.created_at || '1970-01-01'));

  return filters.limit ? filtered.slice(0, Number(filters.limit)) : filtered;
}

export async function listLusopayPayments(lusopay: LusopayResource, filters: PaymentFilters): Promise<ListPaymentsResult> {
  validateFilters(filters);

  const query = new URLSearchParams();
  if (filters.start_date) query.append('creationPeriod', filters.start_date);
  if (filters.end_date) query.append('creationPeriod', filters.end_date);

  const base = lusopay.base_url.replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(lusopay.pid)}/records/transactions_pbl_api_v3${query.size ? `?${query.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth(lusopay.username, lusopay.password)}`,
    },
  });

  if (response.status === 401 || response.status === 403) throw new Error('AUTH_ERROR: autenticação LusoPay recusada');
  if (response.status === 404) throw new Error('NOT_FOUND: endpoint ou PID LusoPay não encontrado');
  if (!response.ok) throw new Error(`LUSOPAY_API_ERROR: HTTP ${response.status}`);

  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('INVALID_RESPONSE: listagem LusoPay não é um array');

  const normalized = body.map(normalizeLusopayRecord);
  const payments = applyPaymentFilters(normalized, filters);

  return {
    ok: true,
    count: payments.length,
    total_before_limit: normalized.length,
    payments,
    filters,
  };
}

export function summarizePayments(payments: NormalizedPayment[]) {
  const by_method: Record<string, { count: number; total: number }> = {};
  for (const payment of payments) {
    const method = payment.payment_method || 'unknown';
    by_method[method] ??= { count: 0, total: 0 };
    by_method[method].count += 1;
    by_method[method].total += Number(payment.amount || 0);
  }

  const count = (status: PaymentStatus) => payments.filter((payment) => payment.payment_status === status).length;
  const paid = payments.filter((payment) => payment.payment_status === 'paid');
  const total_received = paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return {
    total_received,
    paid_count: count('paid'),
    pending_count: count('pending'),
    cancelled_count: count('cancelled'),
    failed_count: count('failed'),
    average_order_value: paid.length ? total_received / paid.length : 0,
    by_method,
  };
}

