import type { MerchantContext } from './types.ts';
import { validateDateRange } from './date_utils.ts';
import { LusopayApiError } from './errors.ts';

export type FetchTransactionsParams = {
  start_date?: string;
  end_date?: string;
};

export function getLusopayBaseUrl(context: MerchantContext): string {
  return context.lusopay.environment === 'prod'
    ? 'https://app.lusopay.com:8443/web/api'
    : 'https://dev.lusopay.com:8444/web_dev/api';
}

function encodeBasicAuth(username: string, password: string): string {
  const raw = `${username}:${password}`;
  const btoaFn = (globalThis as unknown as { btoa?: (value: string) => string }).btoa;
  if (btoaFn) return btoaFn(raw);
  const buffer = (globalThis as unknown as { Buffer?: { from: (value: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (buffer) return buffer.from(raw).toString('base64');
  throw new LusopayApiError('Runtime sem encoder base64 disponível');
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
    throw new LusopayApiError(`Erro HTTP da LusoPay: ${response.status}`, response.status);
  }

  const body = await response.json();
  if (!Array.isArray(body)) {
    throw new LusopayApiError('Resposta inválida: listagem LusoPay não é um array');
  }
  return body;
}

export function fetchTransactionsByPeriod(context: MerchantContext, startDate: string, endDate: string) {
  return fetchTransactions(context, { start_date: startDate, end_date: endDate });
}

