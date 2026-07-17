import type { NormalizedPayment, PaymentStatus } from './types.ts';

// A API da LusoPay pode devolver campos em customValues e nomes variáveis.
// Este módulo transforma essas respostas num contrato único usado pelo MCP.

function first(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  // Estados internos explícitos evitam confundir “link criado” com “pagamento pago”.
  const v = String(value ?? '').toLowerCase();
  if (['link_created', 'created_link', 'link created'].includes(v)) return 'link_created';
  if (['paid', 'pago', 'success', 'successful', 'confirmed', 'payment_paid'].includes(v)) return 'payment_paid';
  if (['pending', 'pendente', 'created', 'waiting', 'payment_pending'].includes(v)) return 'payment_pending';
  if (['cancelled', 'canceled', 'cancelado', 'canceled_by_user', 'payment_cancelled'].includes(v)) return 'payment_cancelled';
  if (['failed', 'declined', 'refused', 'error', 'falhado', 'recusado', 'payment_failed'].includes(v)) return 'payment_failed';
  if (['expired', 'expirado', 'inactive', 'inativo'].includes(v)) return 'expired';
  return 'unknown';
}

export function normalizePaymentMethod(value: unknown): string | null {
  // Unifica nomes comerciais e variantes textuais para facilitar filtros e relatórios.
  const original = value == null ? '' : String(value);
  const v = original.toLowerCase();
  if (v.includes('mbway') || v.includes('mb way')) return 'mbway';
  if (v.includes('multibanco') || v === 'mb' || v.includes('reference')) return 'multibanco';
  if (v.includes('card') || v.includes('visa') || v.includes('mastercard') || v.includes('cart')) return 'card';
  return original || null;
}

export type NormalizePaymentOptions = {
  include_raw?: boolean;
};

export function normalizeLusopayPayment(raw: any, options: NormalizePaymentOptions = {}): NormalizedPayment {
  // customValues é onde o Pay by Link costuma transportar OID, estado, moeda e URL.
  const custom = raw?.customValues || raw?.custom_values || {};
  const statusRaw = first(custom.PS, custom.payment_status, custom.status, raw?.status);
  const methodRaw = first(custom.CPM, custom.PYM, custom.chosen_payment_method, custom.payment_method, raw?.paymentMethod);
  const amountRaw = first(
    custom.AMT,
    custom.AMOUNT,
    custom.amount,
    custom.VAL,
    custom.VALUE,
    custom.valor,
    custom.montante,
    custom.paid_amount,
    raw?.amount,
    raw?.value,
    raw?.totalAmount,
  );
  const created = first(raw?.creationDate, raw?.createdAt, custom.created_at, custom.CD, custom.creation_date);
  const paid = first(custom.paid_at, custom.payment_date, custom.PD, raw?.paymentDate);
  const expires = first(custom.ED, custom.expires_at, custom.expiration_date, custom.expiry_date, raw?.expirationDate);
  const paymentStatus = normalizePaymentStatus(statusRaw);

  return {
    payment_id: first(raw?.id, custom.payment_id, custom.PID) as string | null,
    order_id: first(custom.OID, custom.order_id, raw?.orderId) as string | null,
    payment_status: paymentStatus,
    amount: parseAmount(amountRaw),
    currency: (first(custom.CUR, custom.currency, raw?.currency) as string | null) || 'EUR',
    payment_method: normalizePaymentMethod(methodRaw),
    payment_link: first(custom.URL, custom.payment_link, raw?.paymentLink, raw?.url) as string | null,
    link_status: first(custom.URL_S, custom.link_status, raw?.linkStatus) as string | null,
    expires_at: expires as string | null,
    created_at: created as string | null,
    paid_at: paymentStatus === 'payment_paid' ? ((paid || created) as string | null) : null,
    raw_source: 'lusopay',
    ...(options.include_raw ? { raw } : {}),
  };
}

export function normalizeLusopayPayments(rawRecords: unknown[], options: NormalizePaymentOptions = {}): NormalizedPayment[] {
  return rawRecords.map((record) => normalizeLusopayPayment(record, options));
}

export function filterPayments(payments: NormalizedPayment[], filters: {
  status?: string;
  payment_method?: string;
  order_id?: string;
}) {
  // Filtros simples em memória porque a API nem sempre expõe todos os filtros desejados.
  return payments
    .filter((payment) => !filters.status || payment.payment_status === normalizePaymentStatus(filters.status))
    .filter((payment) => !filters.payment_method || payment.payment_method === normalizePaymentMethod(filters.payment_method))
    .filter((payment) => !filters.order_id || String(payment.order_id ?? '') === String(filters.order_id))
    .sort((a, b) => Date.parse(b.created_at || '1970-01-01') - Date.parse(a.created_at || '1970-01-01'));
}

export function summarizePayments(payments: NormalizedPayment[]) {
  // Resumo usado por ferramentas de reporting e por respostas mais legíveis para o dono da loja.
  const by_method: Record<string, number> = {};
  for (const payment of payments) {
    const method = payment.payment_method || 'unknown';
    by_method[method] = (by_method[method] || 0) + Number(payment.amount || 0);
  }
  const count = (status: PaymentStatus) => payments.filter((payment) => payment.payment_status === status).length;
  return {
    total_received: payments
      .filter((payment) => payment.payment_status === 'payment_paid')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    paid_count: count('payment_paid'),
    pending_count: count('payment_pending'),
    cancelled_count: count('payment_cancelled'),
    failed_count: count('payment_failed'),
    by_method,
  };
}
