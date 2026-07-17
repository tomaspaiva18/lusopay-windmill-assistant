import { main as obterPagamentoPorOrderId } from './obter_pagamento_por_order_id.ts';

// Ferramenta orientada ao dono da loja: traduz estado técnico em próxima acção.

export async function main(order_id: string, merchant_id?: string, include_raw = false) {
  const result = await obterPagamentoPorOrderId(order_id, merchant_id, include_raw);
  if (!result.found) {
    return {
      ...result,
      next_action: 'Confirma se o order_id está correto ou cria um Pay by Link para esta encomenda.',
    };
  }

  const payment = result.payment as { payment_status?: string; payment_link?: string | null };
  const state = payment.payment_status || result.state || 'unknown';
  // Mantém recomendações simples para que o agente consiga responder em linguagem natural.
  const next_action =
    state === 'link_created'
      ? 'Enviar payment_link ao cliente ou aguardar que o cliente abra/pague o link.'
      : state === 'payment_pending'
        ? 'Aguardar confirmação de pagamento ou contactar o cliente se estiver pendente há muito tempo.'
        : state === 'payment_paid'
          ? 'Validar encomenda na loja e avançar com fulfillment.'
          : state === 'payment_cancelled' || state === 'payment_failed' || state === 'expired'
            ? 'Criar novo link ou pedir ao cliente para tentar outro método.'
            : 'Rever manualmente no painel LusoPay.';

  return {
    ...result,
    state,
    next_action,
    summary: `Estado atual da encomenda ${order_id}: ${state}.`,
  };
}
