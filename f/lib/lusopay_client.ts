import type { MerchantContext } from './types.ts';
import { validateDateRange } from './date_utils.ts';
import { LusopayApiError, ValidationError, redactSensitiveData } from './errors.ts';

export type FetchTransactionsParams = {
  start_date?: string;
  end_date?: string;
};

export type CreatePayByLinkParams = {
  amount: number;
  currency?: string;
  description: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  return_url: string;
  website_url: string;
  country?: string;
  language?: string;
  payment_methods?: string[];
  dry_run?: boolean;
};

export function getLusopayBaseUrl(context: MerchantContext): string {
  return context.lusopay.environment === 'prod'
    ? 'https://app.lusopay.com:8443/web/api'
    : 'https://dev.lusopay.com:8444/web_dev/api';
}

export function getPayByLinkOfflineEngineUrl(context: MerchantContext): string {
  return context.lusopay.environment === 'prod'
    ? 'https://pay.lusopay.com/offline_engine.php'
    : 'https://pay.lusopay.com/paybylink_test/v3/offline_engine.php';
}

function encodeBase64(value: string): string {
  const buffer = (globalThis as unknown as {
    Buffer?: { from: (value: string, encoding?: string) => { toString: (encoding: string) => string } };
  }).Buffer;
  if (buffer) return buffer.from(value, 'utf8').toString('base64');

  const btoaFn = (globalThis as unknown as { btoa?: (value: string) => string }).btoa;
  if (btoaFn) return btoaFn(unescape(encodeURIComponent(value)));

  throw new LusopayApiError('Runtime sem encoder base64 disponível');
}

function encodeBasicAuth(username: string, password: string): string {
  return encodeBase64(`${username}:${password}`);
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('amount deve ser um número positivo');
  return amount.toFixed(2);
}

function assertRequiredString(value: string | undefined, field: string) {
  if (!value || value.trim() === '') throw new ValidationError(`${field} é obrigatório`);
  return value.trim();
}

function normalizePaymentMethods(methods?: string[]) {
  const normalized = (methods?.length ? methods : ['P0']).map((method) => method.trim().toUpperCase());
  for (const method of normalized) {
    if (!/^P(?:0|[1-9]|1[0-3])$/.test(method)) {
      throw new ValidationError(`payment_methods contém método inválido: ${method}`);
    }
  }
  return normalized;
}

export async function fetchTransactions(context: MerchantContext, params: FetchTransactionsParams = {}): Promise<unknown[]> {
  validateDateRange(params.start_date, params.end_date);

  const query = new URLSearchParams();
  if (params.start_date) query.append('creationPeriod', params.start_date);
  if (params.end_date) query.append('creationPeriod', params.end_date);

  const url =
    `${getLusopayBaseUrl(context)}/${encodeURIComponent(context.lusopay.pid)}` +
    `/records/transactions_pbl_api_v3${query.size ? `?${query.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${encodeBasicAuth(context.lusopay.username, context.lusopay.password)}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new LusopayApiError('Autenticação LusoPay recusada', response.status);
  }
  if (response.status === 404) {
    throw new LusopayApiError('Endpoint ou PID LusoPay não encontrado', response.status);
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(redactSensitiveData(await response.clone().json()));
    } catch {
      detail = await response.text().catch(() => '');
      detail = String(redactSensitiveData(detail)).slice(0, 300);
    }
    throw new LusopayApiError(`Erro HTTP da LusoPay: ${response.status}${detail ? ` ${detail}` : ''}`, response.status);
  }

  const body = await response.json();
  if (!Array.isArray(body)) {
    throw new LusopayApiError('Resposta inválida: listagem LusoPay não é um array');
  }
  return body;
}

export function buildPayByLinkPayload(context: MerchantContext, params: CreatePayByLinkParams) {
  const currency = (params.currency || 'EUR').toUpperCase();
  if (currency !== 'EUR') throw new ValidationError('currency deve ser EUR');

  const amount = formatAmount(params.amount);
  const orderId = assertRequiredString(params.order_id, 'order_id');
  const description = assertRequiredString(params.description, 'description');
  const customerName = assertRequiredString(params.customer_name, 'customer_name');
  const customerEmail = assertRequiredString(params.customer_email, 'customer_email');
  const returnUrl = assertRequiredString(params.return_url, 'return_url');
  const websiteUrl = assertRequiredString(params.website_url, 'website_url');

  const fields: Record<string, string> = {
    T: 'API',
    PID: context.lusopay.pid,
    L: params.language || 'pt_PT',
    CUR: currency,
    OID: orderId,
    OP: '1',
    AMT: amount,
    MSG: description,
    PN: customerName,
    PE: customerEmail,
    BCC: (params.country || 'PT').toUpperCase(),
    OL: 'true',
    PYM: normalizePaymentMethods(params.payment_methods).join('|'),
    UF: returnUrl,
    W: websiteUrl,
  };

  const querystring = new URLSearchParams(fields).toString();
  const data = encodeBase64(querystring);
  const checkoutUrl = getPayByLinkOfflineEngineUrl(context);

  return {
    checkout_url: checkoutUrl,
    fields,
    data,
    form: {
      method: 'POST',
      action: checkoutUrl,
      fields: { data },
    },
  };
}

function extractPaymentLinkFromHtml(context: MerchantContext, html: string): string | null {
  const cleanMatch = (value: string) => value.split(/&(?:quot|amp|lt|gt);|["'\s<>]/i)[0] || value;

  const absoluteMatch = html.match(/https:\/\/pay\.lusopay\.com\/(?:paybylink_test\/v3\/)?payment_form\.php\?data=[^"'\s<>]+/i);
  if (absoluteMatch?.[0]) return cleanMatch(absoluteMatch[0]);

  const relativeMatch = html.match(/(?:\.\/|\/)?payment_form\.php\?data=[^"'\s<>]+/i);
  if (!relativeMatch?.[0]) return null;

  const relative = cleanMatch(relativeMatch[0]).replace(/^\.\//, '');
  const base = relative.startsWith('/')
    ? 'https://pay.lusopay.com'
    : getPayByLinkOfflineEngineUrl(context).replace(/offline_engine\.php$/, '');

  return new URL(relative, base).toString();
}

export async function createPayByLink(context: MerchantContext, params: CreatePayByLinkParams) {
  const payload = buildPayByLinkPayload(context, params);
  if (params.dry_run !== false) {
    return {
      dry_run: true,
      payment_id: null,
      payment_link: null,
      estado: 'prepared',
      created_at: new Date().toISOString(),
      ...payload,
    };
  }

  const response = await fetch(payload.checkout_url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ data: payload.data }),
  });

  const location = response.headers.get('location');
  if (response.status >= 300 && response.status < 400 && location) {
    return {
      dry_run: false,
      payment_id: null,
      payment_link: location,
      estado: 'created',
      created_at: new Date().toISOString(),
      checkout_url: payload.checkout_url,
    };
  }

  if (response.ok) {
    const body = await response.text().catch(() => '');
    const paymentLink = extractPaymentLinkFromHtml(context, body);
    if (!paymentLink) {
      throw new LusopayApiError('Resposta da LusoPay não contém link de pagamento final', response.status);
    }

    return {
      dry_run: false,
      payment_id: null,
      payment_link: paymentLink,
      estado: 'created',
      created_at: new Date().toISOString(),
      checkout_url: payload.checkout_url,
    };
  }

  const detail = await response.text().catch(() => '');
  throw new LusopayApiError(`Erro ao criar Pay by Link: ${response.status}${detail ? ` ${detail.slice(0, 300)}` : ''}`, response.status);
}

export function fetchTransactionsByPeriod(context: MerchantContext, startDate: string, endDate: string) {
  return fetchTransactions(context, { start_date: startDate, end_date: endDate });
}
