import { getMerchantContext } from '../lib/merchant_context.ts';
import { fetchTransactions } from '../lib/lusopay_client.ts';
import { normalizeLusopayPayments, summarizePayments } from '../lib/payment_normalizer.ts';
import { appendAuditLog } from '../lib/payment_registry.ts';

// Relatório agregado para perguntas como “quanto recebi neste período?”.

export async function main(start_date: string, end_date: string, merchant_id?: string, include_raw = false) {
  const startedAt = Date.now();
  const merchant = await getMerchantContext(merchant_id);
  const raw = await fetchTransactions(merchant, { start_date, end_date });
  const payments = normalizeLusopayPayments(raw, { include_raw });
  const summary = summarizePayments(payments);

  await appendAuditLog(merchant, {
    tool: 'resumo_pagamentos',
    duration_ms: Date.now() - startedAt,
    result: `payments:${payments.length}`,
    inputs: { start_date, end_date, include_raw },
  });

  return {
    period: { start_date, end_date },
    total_payments: payments.length,
    ...summary,
    summary: `Entre ${start_date} e ${end_date}: ${summary.paid_count} pagos, ${summary.pending_count} pendentes, ${summary.cancelled_count} cancelados e ${summary.failed_count} falhados.`,
  };
}
