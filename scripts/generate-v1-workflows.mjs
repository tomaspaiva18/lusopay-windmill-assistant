import fs from 'node:fs';
import path from 'node:path';

const workflowsRoot = path.resolve('workflows');

function writeJson(relativePath, data) {
  const target = path.join(workflowsRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function executeTrigger(id, name, position, values) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.executeWorkflowTrigger',
    typeVersion: 1.1,
    position,
    parameters: {
      workflowInputs: {
        values
      }
    }
  };
}

function codeNode(id, name, position, jsCode) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: { jsCode }
  };
}

function executeWorkflowNode(id, name, position, cachedResultName, valueMap) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position,
    parameters: {
      workflowId: {
        __rl: true,
        value: '',
        mode: 'list',
        cachedResultName
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: valueMap,
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: { waitForSubWorkflow: true }
    }
  };
}

function workflow(id, name, nodes, connections) {
  return {
    id,
    name,
    active: false,
    settings: { executionOrder: 'v1', errorWorkflow: 'LSPERRLOG0000001' },
    nodes,
    connections
  };
}

const normalizeLusoPayCode = String.raw`
const p = $json;
if (!$env.LUSOPAY_OWNER_ID) throw new Error('CONFIG_ERROR: LUSOPAY_OWNER_ID não configurado');
const validDate = v => !v || /^\d{4}-\d{2}-\d{2}$/.test(String(v));
if (!validDate(p.start_date) || !validDate(p.end_date)) throw new Error('VALIDATION_ERROR: datas inválidas; usar YYYY-MM-DD');
if (p.start_date && p.end_date && p.start_date > p.end_date) throw new Error('VALIDATION_ERROR: start_date posterior a end_date');
const allowed = ['paid', 'pending', 'cancelled', 'canceled', 'failed', 'declined', 'refused', 'unknown'];
if (p.status && !allowed.includes(String(p.status))) throw new Error('VALIDATION_ERROR: status não reconhecido');
const minAmount = p.min_amount === undefined || p.min_amount === null || p.min_amount === '' ? null : Number(p.min_amount);
const maxAmount = p.max_amount === undefined || p.max_amount === null || p.max_amount === '' ? null : Number(p.max_amount);
if (minAmount !== null && !Number.isFinite(minAmount)) throw new Error('VALIDATION_ERROR: min_amount inválido');
if (maxAmount !== null && !Number.isFinite(maxAmount)) throw new Error('VALIDATION_ERROR: max_amount inválido');
if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) throw new Error('VALIDATION_ERROR: min_amount maior que max_amount');
const base = $env.LUSOPAY_BASE_URL + '/' + $env.LUSOPAY_OWNER_ID + '/records/transactions_pbl_api_v3';
const q = [];
if (p.start_date) q.push('creationPeriod=' + encodeURIComponent(p.start_date));
if (p.end_date) q.push('creationPeriod=' + encodeURIComponent(p.end_date));
return [{ json: { ...p, startedAt: Date.now(), requestUrl: base + (q.length ? '?' + q.join('&') : '') } }];
`.trim();

const normalizeLusoPayResponseCode = String.raw`
const req = $('Validar filtros e construir URL').first().json;
const response = $json;
const statusCode = Number(response.statusCode || 0);
let body = response.body ?? response;
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch { throw new Error('INVALID_RESPONSE: resposta LusoPay não é JSON válido'); }
}
if (statusCode === 401 || statusCode === 403) throw new Error('AUTH_ERROR: autenticação LusoPay recusada');
if (statusCode === 404) throw new Error('NOT_FOUND: endpoint ou PID LusoPay não encontrado');
if (statusCode >= 400) throw new Error('LUSOPAY_API_ERROR: HTTP ' + statusCode);
if (!Array.isArray(body)) throw new Error('INVALID_RESPONSE: listagem LusoPay não é um array');

function normalizeStatus(value) {
  const v = String(value || '').toLowerCase();
  if (['paid', 'pago', 'success', 'successful', 'confirmed'].includes(v)) return 'paid';
  if (['pending', 'pendente', 'created', 'waiting'].includes(v)) return 'pending';
  if (['cancelled', 'canceled', 'cancelado', 'canceled_by_user'].includes(v)) return 'cancelled';
  if (['failed', 'declined', 'refused', 'error', 'falhado', 'recusado'].includes(v)) return 'failed';
  return 'unknown';
}

function normalizeMethod(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('mbway') || v.includes('mb way')) return 'mbway';
  if (v.includes('multibanco') || v === 'mb' || v.includes('reference')) return 'multibanco';
  if (v.includes('card') || v.includes('visa') || v.includes('mastercard') || v.includes('cart')) return 'card';
  return value || null;
}

function first(...values) {
  return values.find(v => v !== undefined && v !== null && v !== '') ?? null;
}

const payments = body.map((r) => {
  const c = r.customValues || r.custom_values || {};
  const amountRaw = first(c.AMT, c.amount, c.paid_amount, r.amount);
  const statusRaw = first(c.PS, c.payment_status, c.status, r.status);
  const methodRaw = first(c.CPM, c.PYM, c.chosen_payment_method, c.payment_method, r.paymentMethod);
  const created = first(r.creationDate, r.createdAt, c.created_at, c.CD, c.creation_date);
  const paid = first(c.paid_at, c.payment_date, c.PD, r.paymentDate);
  return {
    order_id: first(c.OID, c.order_id, r.orderId),
    payment_status: normalizeStatus(statusRaw),
    amount: Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : 0,
    currency: first(c.CUR, c.currency, r.currency) || 'EUR',
    payment_method: normalizeMethod(methodRaw),
    created_at: created,
    paid_at: normalizeStatus(statusRaw) === 'paid' ? paid || created || null : null,
    raw_source: 'lusopay',
    raw: r
  };
});

const filtered = payments.filter((payment) => {
  if (req.status && payment.payment_status !== normalizeStatus(req.status)) return false;
  if (req.payment_method && String(payment.payment_method || '').toLowerCase() !== String(req.payment_method).toLowerCase()) return false;
  if (req.order_id && String(payment.order_id || '') !== String(req.order_id)) return false;
  if (req.min_amount !== undefined && req.min_amount !== null && req.min_amount !== '' && Number(payment.amount || 0) < Number(req.min_amount)) return false;
  if (req.max_amount !== undefined && req.max_amount !== null && req.max_amount !== '' && Number(payment.amount || 0) > Number(req.max_amount)) return false;
  return true;
}).sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
const limited = req.limit ? filtered.slice(0, Number(req.limit)) : filtered;

return [{
  json: {
    ok: true,
    count: limited.length,
    total_before_limit: filtered.length,
    payments: limited,
    filters: {
      start_date: req.start_date || null,
      end_date: req.end_date || null,
      status: req.status || null,
      payment_method: req.payment_method || null,
      order_id: req.order_id || null,
      min_amount: req.min_amount ?? null,
      max_amount: req.max_amount ?? null,
      limit: req.limit ?? null
    },
    log: {
      timestamp: new Date().toISOString(),
      tool: req._tool || 'listar_pagamentos',
      parameters: {
        start_date: req.start_date || null,
        end_date: req.end_date || null,
        status: req.status || null,
        payment_method: req.payment_method || null,
        order_id: req.order_id || null
      },
      duration_ms: Date.now() - req.startedAt,
      result: 'success',
      results_count: limited.length,
      error: null
    }
  }
}];
`.trim();

writeJson('adapters/lusopay_listar_pagamentos.adapter.json', workflow(
  'LSPADPLST0000001',
  'ADAPTER - LusoPay - Listar pagamentos V1',
  [
    executeTrigger('list-trigger', 'Entrada do adapter', [-620, 0], [
      { name: 'start_date', type: 'string' },
      { name: 'end_date', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'payment_method', type: 'string' },
      { name: 'order_id', type: 'string' },
      { name: 'min_amount', type: 'number' },
      { name: 'max_amount', type: 'number' },
      { name: 'limit', type: 'number' },
      { name: '_tool', type: 'string' }
    ]),
    codeNode('list-build-url', 'Validar filtros e construir URL', [-380, 0], normalizeLusoPayCode),
    {
      id: 'list-http',
      name: 'LusoPay GET transactions_pbl_api_v3',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [-120, 0],
      parameters: {
        url: '={{ $json.requestUrl }}',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBasicAuth',
        sendHeaders: true,
        headerParameters: { parameters: [{ name: 'Accept', value: 'application/json' }] },
        options: {
          timeout: 15000,
          response: { response: { fullResponse: true, neverError: true } }
        }
      },
      credentials: {
        httpBasicAuth: { id: 'REPLACE_AFTER_IMPORT', name: 'LusoPay Basic Auth' }
      }
    },
    codeNode('list-normalize', 'Normalizar pagamentos LusoPay', [160, 0], normalizeLusoPayResponseCode)
  ],
  {
    'Entrada do adapter': { main: [[{ node: 'Validar filtros e construir URL', type: 'main', index: 0 }]] },
    'Validar filtros e construir URL': { main: [[{ node: 'LusoPay GET transactions_pbl_api_v3', type: 'main', index: 0 }]] },
    'LusoPay GET transactions_pbl_api_v3': { main: [[{ node: 'Normalizar pagamentos LusoPay', type: 'main', index: 0 }]] }
  }
));

const mockLusoPayListCode = String.raw`
const p = $json;
const startedAt = Date.now();
const payments = [
  {
    order_id: '1001',
    payment_status: 'paid',
    amount: 29.9,
    currency: 'EUR',
    payment_method: 'mbway',
    created_at: '2026-07-01T10:02:00Z',
    paid_at: '2026-07-01T10:04:00Z',
    raw_source: 'lusopay_mock',
    raw: { id: 'lp_mock_1001' }
  },
  {
    order_id: '1002',
    payment_status: 'paid',
    amount: 54.5,
    currency: 'EUR',
    payment_method: 'multibanco',
    created_at: '2026-07-01T12:32:00Z',
    paid_at: '2026-07-01T13:10:00Z',
    raw_source: 'lusopay_mock',
    raw: { id: 'lp_mock_1002' }
  },
  {
    order_id: '1005',
    payment_status: 'pending',
    amount: 42,
    currency: 'EUR',
    payment_method: 'card',
    created_at: '2026-06-30T08:00:00Z',
    paid_at: null,
    raw_source: 'lusopay_mock',
    raw: { id: 'lp_mock_1005' }
  },
  {
    order_id: '1006',
    payment_status: 'failed',
    amount: 12,
    currency: 'EUR',
    payment_method: 'mbway',
    created_at: '2026-06-29T18:20:00Z',
    paid_at: null,
    raw_source: 'lusopay_mock',
    raw: { id: 'lp_mock_1006' }
  }
];

const filtered = payments
  .filter(payment => !p.start_date || String(payment.created_at).slice(0, 10) >= p.start_date)
  .filter(payment => !p.end_date || String(payment.created_at).slice(0, 10) <= p.end_date)
  .filter(payment => !p.status || payment.payment_status === p.status)
  .filter(payment => !p.payment_method || payment.payment_method === p.payment_method)
  .filter(payment => !p.order_id || String(payment.order_id) === String(p.order_id))
  .filter(payment => p.min_amount === undefined || p.min_amount === null || p.min_amount === '' || Number(payment.amount || 0) >= Number(p.min_amount))
  .filter(payment => p.max_amount === undefined || p.max_amount === null || p.max_amount === '' || Number(payment.amount || 0) <= Number(p.max_amount))
  .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
const limited = p.limit ? filtered.slice(0, Number(p.limit)) : filtered;

return [{
  json: {
    ok: true,
    mock: true,
    count: limited.length,
    total_before_limit: filtered.length,
    payments: limited,
    filters: {
      start_date: p.start_date || null,
      end_date: p.end_date || null,
      status: p.status || null,
      payment_method: p.payment_method || null,
      order_id: p.order_id || null,
      min_amount: p.min_amount ?? null,
      max_amount: p.max_amount ?? null,
      limit: p.limit ?? null
    },
    log: {
      timestamp: new Date().toISOString(),
      tool: p._tool || 'listar_pagamentos',
      parameters: {
        start_date: p.start_date || null,
        end_date: p.end_date || null,
        status: p.status || null,
        payment_method: p.payment_method || null,
        order_id: p.order_id || null
      },
      duration_ms: Date.now() - startedAt,
      result: 'mock_data',
      results_count: limited.length,
      error: null
    }
  }
}];
`.trim();

writeJson('adapters/lusopay_listar_pagamentos_mock.adapter.json', workflow(
  'LSPADPLSTMOCK001',
  'ADAPTER - LusoPay - Listar pagamentos MOCK V1',
  [
    executeTrigger('list-mock-trigger', 'Entrada do adapter', [-260, 0], [
      { name: 'start_date', type: 'string' },
      { name: 'end_date', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'payment_method', type: 'string' },
      { name: 'order_id', type: 'string' },
      { name: 'min_amount', type: 'number' },
      { name: 'max_amount', type: 'number' },
      { name: 'limit', type: 'number' },
      { name: '_tool', type: 'string' }
    ]),
    codeNode('list-mock-code', 'Mock pagamentos LusoPay', [0, 0], mockLusoPayListCode)
  ],
  {
    'Entrada do adapter': { main: [[{ node: 'Mock pagamentos LusoPay', type: 'main', index: 0 }]] }
  }
));

const mockOrdersCode = String.raw`
const p = $json;
const startedAt = Date.now();
function normalizeStatus(value) {
  const v = String(value || '').toLowerCase();
  if (['paid', 'completed', 'processing'].includes(v)) return 'paid';
  if (['pending', 'on-hold', 'awaiting_payment'].includes(v)) return 'pending';
  if (['cancelled', 'canceled'].includes(v)) return 'cancelled';
  if (['failed', 'refunded'].includes(v)) return 'failed';
  return 'unknown';
}
const orders = [
  { order_id: '1001', customer_id: 'c001', customer_name: 'João Silva', customer_email: 'joao@example.com', amount: 29.9, currency: 'EUR', store_status: 'paid', created_at: '2026-07-01T10:00:00Z', payment_method: 'mbway' },
  { order_id: '1002', customer_id: 'c002', customer_name: 'Maria Costa', customer_email: 'maria@example.com', amount: 54.5, currency: 'EUR', store_status: 'pending', created_at: '2026-07-01T12:30:00Z', payment_method: 'multibanco' },
  { order_id: '1003', customer_id: 'c001', customer_name: 'João Silva', customer_email: 'joao@example.com', amount: 15, currency: 'EUR', store_status: 'pending', created_at: '2026-06-28T09:15:00Z', payment_method: 'card' },
  { order_id: '1004', customer_id: 'c003', customer_name: 'Ana Martins', customer_email: 'ana@example.com', amount: 120, currency: 'EUR', store_status: 'paid', created_at: '2026-06-25T17:40:00Z', payment_method: 'card' }
];
const filtered = orders
  .filter(o => !p.start_date || o.created_at.slice(0, 10) >= p.start_date)
  .filter(o => !p.end_date || o.created_at.slice(0, 10) <= p.end_date)
  .filter(o => !p.status || normalizeStatus(o.store_status) === normalizeStatus(p.status))
  .map(o => ({ ...o, normalized_status: normalizeStatus(o.store_status), raw_source: 'store_mock' }));
return [{
  json: {
    ok: true,
    configured: false,
    provider: $env.STORE_ADAPTER_TYPE || 'mock',
    orders: filtered,
    payments: filtered.map(o => ({
      order_id: o.order_id,
      payment_status: o.normalized_status,
      amount: o.amount,
      currency: o.currency,
      payment_method: o.payment_method,
      created_at: o.created_at,
      paid_at: o.normalized_status === 'paid' ? o.created_at : null,
      raw_source: 'store_mock'
    })),
    log: {
      timestamp: new Date().toISOString(),
      tool: 'store_list_orders',
      parameters: { start_date: p.start_date || null, end_date: p.end_date || null, status: p.status || null },
      duration_ms: Date.now() - startedAt,
      result: 'mock_data',
      results_count: filtered.length,
      error: null
    }
  }
}];
`.trim();

writeJson('adapters/loja_listar_pagamentos.interface.json', workflow(
  'STRADPLST0000001',
  'INTERFACE - Loja - Listar encomendas/pagamentos V1',
  [
    executeTrigger('store-list-trigger', 'Entrada do adapter', [-260, 0], [
      { name: 'start_date', type: 'string' },
      { name: 'end_date', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'customer_identifier', type: 'string' },
      { name: 'limit', type: 'number' }
    ]),
    codeNode('store-list-contract', 'Mock/interface da loja', [0, 0], mockOrdersCode)
  ],
  { 'Entrada do adapter': { main: [[{ node: 'Mock/interface da loja', type: 'main', index: 0 }]] } }
));

const mockCustomersCode = String.raw`
const p = $json;
const startedAt = Date.now();
const identifier = String(p.customer_identifier || '').toLowerCase().trim();
if (!identifier) throw new Error('VALIDATION_ERROR: customer_identifier é obrigatório');
const customers = [
  { id: 'c001', name: 'João Silva', email: 'joao@example.com' },
  { id: 'c002', name: 'Maria Costa', email: 'maria@example.com' },
  { id: 'c003', name: 'Ana Martins', email: 'ana@example.com' }
];
const customer = customers.find(c =>
  c.id.toLowerCase() === identifier ||
  c.email.toLowerCase() === identifier ||
  c.name.toLowerCase().includes(identifier)
);
return [{
  json: {
    found: Boolean(customer),
    customer: customer || null,
    message: customer ? null : 'Cliente não encontrado na interface da loja.',
    log: {
      timestamp: new Date().toISOString(),
      tool: 'store_get_customer',
      parameters: { customer_identifier: p.customer_identifier },
      duration_ms: Date.now() - startedAt,
      result: customer ? 'success' : 'not_found',
      results_count: customer ? 1 : 0,
      error: customer ? null : 'customer_not_found'
    }
  }
}];
`.trim();

writeJson('adapters/loja_obter_cliente.interface.json', workflow(
  'STRADPCUS0000001',
  'INTERFACE - Loja - Obter cliente V1',
  [
    executeTrigger('store-customer-trigger', 'Entrada do adapter', [-260, 0], [
      { name: 'customer_identifier', type: 'string', required: true }
    ]),
    codeNode('store-customer-contract', 'Mock/interface de cliente', [0, 0], mockCustomersCode)
  ],
  { 'Entrada do adapter': { main: [[{ node: 'Mock/interface de cliente', type: 'main', index: 0 }]] } }
));

function toolWorkflow(fileName, id, name, inputValues, nodes, connections) {
  writeJson(`tools/${fileName}`, workflow(id, name, [
    executeTrigger('tool-trigger', 'Entrada MCP', [-520, 0], inputValues),
    ...nodes
  ], {
    'Entrada MCP': { main: [[{ node: nodes[0].name, type: 'main', index: 0 }]] },
    ...connections
  }));
}

const listInputs = [
  { name: 'start_date', type: 'string' },
  { name: 'end_date', type: 'string' },
  { name: 'status', type: 'string' },
  { name: 'payment_method', type: 'string' },
  { name: 'order_id', type: 'string' },
  { name: 'min_amount', type: 'number' },
  { name: 'max_amount', type: 'number' },
  { name: 'limit', type: 'number' }
];

toolWorkflow('listar_pagamentos.workflow.json', 'LSPTOOLLST000001', 'MCP Tool - listar_pagamentos', listInputs, [
  executeWorkflowNode('call-lusopay-list', 'Executar adapter LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    status: '={{ $json.status }}',
    payment_method: '={{ $json.payment_method }}',
    order_id: '={{ $json.order_id }}',
    min_amount: '={{ $json.min_amount }}',
    max_amount: '={{ $json.max_amount }}',
    limit: '={{ $json.limit }}',
    _tool: 'listar_pagamentos'
  })
], {});

toolWorkflow('obter_pagamento_por_order_id.workflow.json', 'LSPTOOLOID000001', 'MCP Tool - obter_pagamento_por_order_id', [
  { name: 'order_id', type: 'string', required: true }
], [
  executeWorkflowNode('call-lusopay-order', 'Pesquisar pagamento na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    order_id: '={{ $json.order_id }}',
    _tool: 'obter_pagamento_por_order_id'
  }),
  codeNode('select-order', 'Selecionar pagamento', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const result = $json;
const payment = (result.payments || [])[0];
if (!payment) {
  return [{ json: { found: false, order_id: String(input.order_id), message: 'Nenhum pagamento encontrado na LusoPay para este order_id.' } }];
}
return [{ json: {
  found: true,
  order_id: payment.order_id,
  status: payment.payment_status,
  amount: payment.amount,
  payment_method: payment.payment_method,
  created_at: payment.created_at,
  paid_at: payment.paid_at
}}];
`.trim())
], {
  'Pesquisar pagamento na LusoPay': { main: [[{ node: 'Selecionar pagamento', type: 'main', index: 0 }]] }
});

toolWorkflow('listar_pagamentos_pendentes.workflow.json', 'LSPTOOLPND000001', 'MCP Tool - listar_pagamentos_pendentes', [
  { name: 'start_date', type: 'string' },
  { name: 'end_date', type: 'string' },
  { name: 'older_than_hours', type: 'number' }
], [
  executeWorkflowNode('call-lusopay-pending', 'Listar pending na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    status: 'pending',
    _tool: 'listar_pagamentos_pendentes'
  }),
  codeNode('filter-pending-age', 'Filtrar pendentes antigos', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const olderThanHours = Number(input.older_than_hours || 0);
const cutoff = olderThanHours > 0 ? Date.now() - olderThanHours * 60 * 60 * 1000 : null;
const payments = ($json.payments || []).filter(p => !cutoff || (p.created_at && Date.parse(p.created_at) <= cutoff));
return [{ json: {
  ok: true,
  count: payments.length,
  total_pending: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
  older_than_hours: olderThanHours || null,
  payments
}}];
`.trim())
], {
  'Listar pending na LusoPay': { main: [[{ node: 'Filtrar pendentes antigos', type: 'main', index: 0 }]] }
});

toolWorkflow('resumo_pagamentos.workflow.json', 'LSPTOOLSUM000001', 'MCP Tool - resumo_pagamentos', [
  { name: 'start_date', type: 'string', required: true },
  { name: 'end_date', type: 'string', required: true }
], [
  executeWorkflowNode('call-lusopay-summary', 'Listar período na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    _tool: 'resumo_pagamentos'
  }),
  codeNode('build-summary', 'Calcular resumo', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const payments = $json.payments || [];
const byMethod = {};
for (const p of payments) byMethod[p.payment_method || 'unknown'] = (byMethod[p.payment_method || 'unknown'] || 0) + Number(p.amount || 0);
const count = status => payments.filter(p => p.payment_status === status).length;
return [{ json: {
  period: { start_date: input.start_date, end_date: input.end_date },
  total_received: payments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0),
  paid_count: count('paid'),
  pending_count: count('pending'),
  cancelled_count: count('cancelled'),
  failed_count: count('failed'),
  by_method: byMethod,
  log: { timestamp: new Date().toISOString(), tool: 'resumo_pagamentos', results_count: payments.length }
}}];
`.trim())
], {
  'Listar período na LusoPay': { main: [[{ node: 'Calcular resumo', type: 'main', index: 0 }]] }
});

toolWorkflow('comparar_pagamentos_loja_lusopay.workflow.json', 'LSPTOOLCMPV1001', 'MCP Tool - comparar_pagamentos_loja_lusopay', [
  { name: 'start_date', type: 'string', required: true },
  { name: 'end_date', type: 'string', required: true }
], [
  executeWorkflowNode('call-lusopay-compare', 'Buscar pagamentos LusoPay', [-220, -120], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    _tool: 'comparar_pagamentos_loja_lusopay'
  }),
  executeWorkflowNode('call-store-compare', 'Buscar pagamentos loja', [-220, 120], 'INTERFACE - Loja - Listar encomendas/pagamentos V1', {
    start_date: "={{ $('Entrada MCP').first().json.start_date }}",
    end_date: "={{ $('Entrada MCP').first().json.end_date }}"
  }),
  codeNode('compare-results', 'Comparar resultados', [120, 0], String.raw`
const luso = $('Buscar pagamentos LusoPay').first().json.payments || [];
const store = $('Buscar pagamentos loja').first().json.payments || [];
const lusoByOrder = new Map(luso.filter(p => p.order_id).map(p => [String(p.order_id), p]));
const storeByOrder = new Map(store.filter(p => p.order_id).map(p => [String(p.order_id), p]));
const issues = [];
let matched = 0;
for (const [orderId, lp] of lusoByOrder) {
  const sp = storeByOrder.get(orderId);
  if (!sp) { issues.push({ order_id: orderId, issue: 'only_in_lusopay', store_status: null, lusopay_status: lp.payment_status, store_amount: null, lusopay_amount: lp.amount }); continue; }
  matched++;
  if (sp.payment_status !== lp.payment_status) issues.push({ order_id: orderId, issue: 'status_mismatch', store_status: sp.payment_status, lusopay_status: lp.payment_status, store_amount: sp.amount, lusopay_amount: lp.amount });
  if (Number(sp.amount) !== Number(lp.amount)) issues.push({ order_id: orderId, issue: 'amount_mismatch', store_status: sp.payment_status, lusopay_status: lp.payment_status, store_amount: sp.amount, lusopay_amount: lp.amount });
}
for (const [orderId, sp] of storeByOrder) {
  if (!lusoByOrder.has(orderId)) issues.push({ order_id: orderId, issue: 'only_in_store', store_status: sp.payment_status, lusopay_status: null, store_amount: sp.amount, lusopay_amount: null });
}
return [{ json: {
  summary: {
    matched,
    only_in_lusopay: issues.filter(i => i.issue === 'only_in_lusopay').length,
    only_in_store: issues.filter(i => i.issue === 'only_in_store').length,
    status_mismatches: issues.filter(i => i.issue === 'status_mismatch').length,
    amount_mismatches: issues.filter(i => i.issue === 'amount_mismatch').length
  },
  issues
}}];
`.trim())
], {
  'Buscar pagamentos LusoPay': { main: [[{ node: 'Buscar pagamentos loja', type: 'main', index: 0 }]] },
  'Buscar pagamentos loja': { main: [[{ node: 'Comparar resultados', type: 'main', index: 0 }]] }
});

toolWorkflow('obter_cliente.workflow.json', 'LSPTOOLCUS000001', 'MCP Tool - obter_cliente', [
  { name: 'customer_identifier', type: 'string', required: true }
], [
  executeWorkflowNode('call-customer', 'Buscar cliente na loja', [-220, 0], 'INTERFACE - Loja - Obter cliente V1', {
    customer_identifier: '={{ $json.customer_identifier }}'
  })
], {});

toolWorkflow('listar_encomendas_cliente.workflow.json', 'LSPTOOLORDCUS01', 'MCP Tool - listar_encomendas_cliente', [
  { name: 'customer_identifier', type: 'string', required: true },
  { name: 'start_date', type: 'string' },
  { name: 'end_date', type: 'string' },
  { name: 'limit', type: 'number' }
], [
  executeWorkflowNode('call-customer-orders', 'Listar encomendas da loja', [-220, 0], 'INTERFACE - Loja - Listar encomendas/pagamentos V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    customer_identifier: '={{ $json.customer_identifier }}',
    limit: '={{ $json.limit }}'
  }),
  codeNode('filter-customer-orders', 'Filtrar por cliente', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const id = String(input.customer_identifier || '').toLowerCase();
let orders = $json.orders || [];
orders = orders.filter(o => [o.customer_id, o.customer_email, o.customer_name].some(v => String(v || '').toLowerCase().includes(id)));
const limit = Number(input.limit || 50);
return [{ json: { count: orders.slice(0, limit).length, orders: orders.slice(0, limit) } }];
`.trim())
], {
  'Listar encomendas da loja': { main: [[{ node: 'Filtrar por cliente', type: 'main', index: 0 }]] }
});

toolWorkflow('resumo_cliente.workflow.json', 'LSPTOOLCUSSUM01', 'MCP Tool - resumo_cliente', [
  { name: 'customer_identifier', type: 'string', required: true },
  { name: 'period_days', type: 'number' }
], [
  executeWorkflowNode('call-customer-summary', 'Buscar cliente', [-220, -100], 'INTERFACE - Loja - Obter cliente V1', {
    customer_identifier: '={{ $json.customer_identifier }}'
  }),
  executeWorkflowNode('call-orders-summary', 'Buscar encomendas', [-220, 120], 'INTERFACE - Loja - Listar encomendas/pagamentos V1', {}),
  codeNode('build-customer-summary', 'Calcular resumo do cliente', [120, 0], String.raw`
const input = $('Entrada MCP').first().json;
const customerResult = $('Buscar cliente').first().json;
if (!customerResult.found) return [{ json: { found: false, message: 'Cliente não encontrado.' } }];
const customer = customerResult.customer;
const days = Number(input.period_days || 30);
const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
const orders = ($('Buscar encomendas').first().json.orders || [])
  .filter(o => o.customer_id === customer.id && Date.parse(o.created_at) >= cutoff);
const count = status => orders.filter(o => o.normalized_status === status).length;
return [{ json: {
  customer,
  period_days: days,
  orders_count: orders.length,
  total_spent: orders.filter(o => o.normalized_status === 'paid').reduce((sum, o) => sum + Number(o.amount || 0), 0),
  paid_orders: count('paid'),
  pending_orders: count('pending'),
  cancelled_orders: count('cancelled'),
  last_order_date: orders.map(o => o.created_at).sort().at(-1) || null
}}];
`.trim())
], {
  'Buscar cliente': { main: [[{ node: 'Buscar encomendas', type: 'main', index: 0 }]] },
  'Buscar encomendas': { main: [[{ node: 'Calcular resumo do cliente', type: 'main', index: 0 }]] }
});

toolWorkflow('clientes_mais_ativos.workflow.json', 'LSPTOOLACTCUS01', 'MCP Tool - clientes_mais_ativos', [
  { name: 'start_date', type: 'string', required: true },
  { name: 'end_date', type: 'string', required: true },
  { name: 'sort_by', type: 'string' },
  { name: 'limit', type: 'number' }
], [
  executeWorkflowNode('call-active-orders', 'Buscar encomendas loja', [-220, 0], 'INTERFACE - Loja - Listar encomendas/pagamentos V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}'
  }),
  codeNode('rank-customers', 'Criar ranking', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const sortBy = ['orders_count', 'total_spent'].includes(input.sort_by) ? input.sort_by : 'total_spent';
const limit = Number(input.limit || 10);
const map = new Map();
for (const o of ($json.orders || [])) {
  const row = map.get(o.customer_id) || { id: o.customer_id, name: o.customer_name, email: o.customer_email, orders_count: 0, total_spent: 0 };
  row.orders_count++;
  row.total_spent += Number(o.amount || 0);
  map.set(o.customer_id, row);
}
const ranking = [...map.values()].sort((a, b) => Number(b[sortBy]) - Number(a[sortBy])).slice(0, limit);
return [{ json: { sort_by: sortBy, limit, ranking } }];
`.trim())
], {
  'Buscar encomendas loja': { main: [[{ node: 'Criar ranking', type: 'main', index: 0 }]] }
});

toolWorkflow('clientes_com_pagamentos_pendentes.workflow.json', 'LSPTOOLCUSPEND1', 'MCP Tool - clientes_com_pagamentos_pendentes', [
  { name: 'older_than_days', type: 'number' },
  { name: 'limit', type: 'number' }
], [
  executeWorkflowNode('call-pending-orders', 'Buscar pendentes loja', [-220, 0], 'INTERFACE - Loja - Listar encomendas/pagamentos V1', {
    status: 'pending'
  }),
  codeNode('group-pending-customers', 'Agrupar pendentes por cliente', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const olderThanDays = Number(input.older_than_days || 0);
const cutoff = olderThanDays > 0 ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000 : null;
const limit = Number(input.limit || 20);
const orders = ($json.orders || []).filter(o => o.normalized_status === 'pending' && (!cutoff || Date.parse(o.created_at) <= cutoff));
const map = new Map();
for (const o of orders) {
  const row = map.get(o.customer_id) || { id: o.customer_id, name: o.customer_name, email: o.customer_email, pending_orders: [], total_pending: 0 };
  row.pending_orders.push({ order_id: o.order_id, amount: o.amount, currency: o.currency, created_at: o.created_at });
  row.total_pending += Number(o.amount || 0);
  map.set(o.customer_id, row);
}
return [{ json: { count: map.size, customers: [...map.values()].slice(0, limit) } }];
`.trim())
], {
  'Buscar pendentes loja': { main: [[{ node: 'Agrupar pendentes por cliente', type: 'main', index: 0 }]] }
});

toolWorkflow('pagamentos_falhados.workflow.json', 'LSPTOOLFAILED01', 'MCP Tool - pagamentos_falhados', [
  { name: 'start_date', type: 'string' },
  { name: 'end_date', type: 'string' },
  { name: 'limit', type: 'number' }
], [
  executeWorkflowNode('call-failed-payments', 'Listar failed na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    status: 'failed',
    limit: '={{ $json.limit }}',
    _tool: 'pagamentos_falhados'
  }),
  codeNode('summarize-failed-payments', 'Resumo de falhados', [80, 0], String.raw`
const payments = $json.payments || [];
return [{ json: {
  ok: true,
  count: payments.length,
  total_failed_amount: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
  payments
}}];
`.trim())
], {
  'Listar failed na LusoPay': { main: [[{ node: 'Resumo de falhados', type: 'main', index: 0 }]] }
});

toolWorkflow('pagamentos_por_metodo.workflow.json', 'LSPTOOLMETHOD01', 'MCP Tool - pagamentos_por_metodo', [
  { name: 'start_date', type: 'string' },
  { name: 'end_date', type: 'string' },
  { name: 'payment_method', type: 'string', required: true },
  { name: 'status', type: 'string' },
  { name: 'limit', type: 'number' }
], [
  executeWorkflowNode('call-method-payments', 'Listar método na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    payment_method: '={{ $json.payment_method }}',
    status: '={{ $json.status }}',
    limit: '={{ $json.limit }}',
    _tool: 'pagamentos_por_metodo'
  }),
  codeNode('summarize-method-payments', 'Resumo por método', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const payments = $json.payments || [];
return [{ json: {
  ok: true,
  payment_method: input.payment_method,
  status: input.status || null,
  count: payments.length,
  total: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
  payments
}}];
`.trim())
], {
  'Listar método na LusoPay': { main: [[{ node: 'Resumo por método', type: 'main', index: 0 }]] }
});

toolWorkflow('pagamentos_por_valor.workflow.json', 'LSPTOOLAMOUNT01', 'MCP Tool - pagamentos_por_valor', [
  { name: 'start_date', type: 'string' },
  { name: 'end_date', type: 'string' },
  { name: 'min_amount', type: 'number' },
  { name: 'max_amount', type: 'number' },
  { name: 'status', type: 'string' },
  { name: 'limit', type: 'number' }
], [
  executeWorkflowNode('call-amount-payments', 'Listar por valor na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    min_amount: '={{ $json.min_amount }}',
    max_amount: '={{ $json.max_amount }}',
    status: '={{ $json.status }}',
    limit: '={{ $json.limit }}',
    _tool: 'pagamentos_por_valor'
  }),
  codeNode('summarize-amount-payments', 'Resumo por valor', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const payments = $json.payments || [];
return [{ json: {
  ok: true,
  min_amount: input.min_amount ?? null,
  max_amount: input.max_amount ?? null,
  status: input.status || null,
  count: payments.length,
  total: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
  payments
}}];
`.trim())
], {
  'Listar por valor na LusoPay': { main: [[{ node: 'Resumo por valor', type: 'main', index: 0 }]] }
});

toolWorkflow('relatorio_diario.workflow.json', 'LSPTOOLDAILY001', 'MCP Tool - relatorio_diario', [
  { name: 'date', type: 'string' }
], [
  executeWorkflowNode('call-daily-payments', 'Listar dia na LusoPay', [-220, 0], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.date || $now.toFormat("yyyy-MM-dd") }}',
    end_date: '={{ $json.date || $now.toFormat("yyyy-MM-dd") }}',
    _tool: 'relatorio_diario'
  }),
  codeNode('build-daily-report', 'Construir relatório diário', [80, 0], String.raw`
const input = $('Entrada MCP').first().json;
const date = input.date || new Date().toISOString().slice(0, 10);
const payments = $json.payments || [];
const byMethod = {};
for (const p of payments) {
  const method = p.payment_method || 'unknown';
  byMethod[method] = byMethod[method] || { count: 0, total: 0 };
  byMethod[method].count++;
  byMethod[method].total += Number(p.amount || 0);
}
const count = status => payments.filter(p => p.payment_status === status).length;
const paid = payments.filter(p => p.payment_status === 'paid');
const totalReceived = paid.reduce((sum, p) => sum + Number(p.amount || 0), 0);
return [{ json: {
  date,
  total_received: totalReceived,
  paid_count: count('paid'),
  pending_count: count('pending'),
  failed_count: count('failed'),
  cancelled_count: count('cancelled'),
  average_order_value: paid.length ? totalReceived / paid.length : 0,
  by_method: byMethod,
  payments
}}];
`.trim())
], {
  'Listar dia na LusoPay': { main: [[{ node: 'Construir relatório diário', type: 'main', index: 0 }]] }
});

toolWorkflow('pagamentos_pagos_lusopay_pendentes_loja.workflow.json', 'LSPTOOLPAIDPEND1', 'MCP Tool - pagamentos_pagos_lusopay_pendentes_loja', [
  { name: 'start_date', type: 'string', required: true },
  { name: 'end_date', type: 'string', required: true }
], [
  executeWorkflowNode('call-paid-lusopay', 'Buscar pagos LusoPay', [-220, -100], 'ADAPTER - LusoPay - Listar pagamentos MOCK V1', {
    start_date: '={{ $json.start_date }}',
    end_date: '={{ $json.end_date }}',
    status: 'paid',
    _tool: 'pagamentos_pagos_lusopay_pendentes_loja'
  }),
  executeWorkflowNode('call-store-for-paid', 'Buscar loja', [-220, 120], 'INTERFACE - Loja - Listar encomendas/pagamentos V1', {
    start_date: "={{ $('Entrada MCP').first().json.start_date }}",
    end_date: "={{ $('Entrada MCP').first().json.end_date }}"
  }),
  codeNode('find-paid-pending-store', 'Encontrar pagos pendentes na loja', [120, 0], String.raw`
const luso = $('Buscar pagos LusoPay').first().json.payments || [];
const store = $('Buscar loja').first().json.payments || [];
const storeByOrder = new Map(store.filter(p => p.order_id).map(p => [String(p.order_id), p]));
const issues = [];
for (const lp of luso) {
  const sp = storeByOrder.get(String(lp.order_id));
  if (!sp) continue;
  if (lp.payment_status === 'paid' && sp.payment_status === 'pending') {
    issues.push({
      order_id: lp.order_id,
      lusopay_status: lp.payment_status,
      store_status: sp.payment_status,
      amount: lp.amount,
      currency: lp.currency,
      payment_method: lp.payment_method,
      lusopay_paid_at: lp.paid_at,
      store_created_at: sp.created_at
    });
  }
}
return [{ json: {
  ok: true,
  count: issues.length,
  total_amount: issues.reduce((sum, issue) => sum + Number(issue.amount || 0), 0),
  issues
}}];
`.trim())
], {
  'Buscar pagos LusoPay': { main: [[{ node: 'Buscar loja', type: 'main', index: 0 }]] },
  'Buscar loja': { main: [[{ node: 'Encontrar pagos pendentes na loja', type: 'main', index: 0 }]] }
});

const toolDescriptions = [
  ['srv-list', 'listar_pagamentos', 'Lista pagamentos LusoPay com filtros por data, estado, método e order_id.', 'MCP Tool - listar_pagamentos', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    status: "={{ $fromAI('status', 'paid, pending, cancelled, failed ou unknown', 'string') }}",
    payment_method: "={{ $fromAI('payment_method', 'mbway, multibanco, card ou outro', 'string') }}",
    order_id: "={{ $fromAI('order_id', 'ID da encomenda', 'string') }}"
  }],
  ['srv-order', 'obter_pagamento_por_order_id', 'Consulta se uma encomenda específica foi paga na LusoPay.', 'MCP Tool - obter_pagamento_por_order_id', {
    order_id: "={{ $fromAI('order_id', 'ID da encomenda', 'string') }}"
  }],
  ['srv-pending', 'listar_pagamentos_pendentes', 'Lista pagamentos pendentes e pode filtrar pendentes antigos.', 'MCP Tool - listar_pagamentos_pendentes', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    older_than_hours: "={{ $fromAI('older_than_hours', 'Apenas pendentes mais antigos que X horas', 'number') }}"
  }],
  ['srv-summary', 'resumo_pagamentos', 'Cria resumo agregado de pagamentos num período.', 'MCP Tool - resumo_pagamentos', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}"
  }],
  ['srv-compare', 'comparar_pagamentos_loja_lusopay', 'Compara pagamentos LusoPay com pagamentos/encomendas da loja.', 'MCP Tool - comparar_pagamentos_loja_lusopay', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}"
  }],
  ['srv-customer', 'obter_cliente', 'Procura cliente por nome, email ou ID na interface da loja.', 'MCP Tool - obter_cliente', {
    customer_identifier: "={{ $fromAI('customer_identifier', 'Nome, email ou ID do cliente', 'string') }}"
  }],
  ['srv-customer-summary', 'resumo_cliente', 'Resume encomendas e gasto de um cliente num período em dias.', 'MCP Tool - resumo_cliente', {
    customer_identifier: "={{ $fromAI('customer_identifier', 'Nome, email ou ID do cliente', 'string') }}",
    period_days: "={{ $fromAI('period_days', 'Número de dias a analisar; por defeito 30', 'number', 30) }}"
  }],
  ['srv-customer-orders', 'listar_encomendas_cliente', 'Lista encomendas de um cliente num período.', 'MCP Tool - listar_encomendas_cliente', {
    customer_identifier: "={{ $fromAI('customer_identifier', 'Nome, email ou ID do cliente', 'string') }}",
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    limit: "={{ $fromAI('limit', 'Limite de resultados', 'number', 50) }}"
  }],
  ['srv-active', 'clientes_mais_ativos', 'Lista clientes com mais encomendas ou maior valor gasto.', 'MCP Tool - clientes_mais_ativos', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    sort_by: "={{ $fromAI('sort_by', 'orders_count ou total_spent', 'string', 'total_spent') }}",
    limit: "={{ $fromAI('limit', 'Limite de resultados', 'number', 10) }}"
  }],
  ['srv-customer-pending', 'clientes_com_pagamentos_pendentes', 'Lista clientes com pagamentos/encomendas pendentes.', 'MCP Tool - clientes_com_pagamentos_pendentes', {
    older_than_days: "={{ $fromAI('older_than_days', 'Apenas pendentes mais antigos que X dias', 'number') }}",
    limit: "={{ $fromAI('limit', 'Limite de clientes', 'number', 20) }}"
  }],
  ['srv-failed-payments', 'pagamentos_falhados', 'Lista pagamentos falhados num período.', 'MCP Tool - pagamentos_falhados', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    limit: "={{ $fromAI('limit', 'Limite de resultados', 'number', 50) }}"
  }],
  ['srv-payments-method', 'pagamentos_por_metodo', 'Resume pagamentos por método de pagamento, como mbway, multibanco ou card.', 'MCP Tool - pagamentos_por_metodo', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    payment_method: "={{ $fromAI('payment_method', 'mbway, multibanco, card ou outro', 'string') }}",
    status: "={{ $fromAI('status', 'paid, pending, cancelled, failed ou unknown', 'string') }}",
    limit: "={{ $fromAI('limit', 'Limite de resultados', 'number', 50) }}"
  }],
  ['srv-payments-amount', 'pagamentos_por_valor', 'Lista pagamentos por intervalo de valor.', 'MCP Tool - pagamentos_por_valor', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}",
    min_amount: "={{ $fromAI('min_amount', 'Valor mínimo', 'number') }}",
    max_amount: "={{ $fromAI('max_amount', 'Valor máximo', 'number') }}",
    status: "={{ $fromAI('status', 'paid, pending, cancelled, failed ou unknown', 'string') }}",
    limit: "={{ $fromAI('limit', 'Limite de resultados', 'number', 50) }}"
  }],
  ['srv-daily-report', 'relatorio_diario', 'Gera relatório diário de pagamentos.', 'MCP Tool - relatorio_diario', {
    date: "={{ $fromAI('date', 'Dia do relatório em YYYY-MM-DD; se omitido usa hoje', 'string') }}"
  }],
  ['srv-paid-pending-store', 'pagamentos_pagos_lusopay_pendentes_loja', 'Deteta pagamentos pagos na LusoPay que ainda estão pendentes na loja.', 'MCP Tool - pagamentos_pagos_lusopay_pendentes_loja', {
    start_date: "={{ $fromAI('start_date', 'Data inicial YYYY-MM-DD', 'string') }}",
    end_date: "={{ $fromAI('end_date', 'Data final YYYY-MM-DD', 'string') }}"
  }]
];

const serverNodes = [{
  id: 'mcp-trigger',
  name: 'LusoPay Assistente MCP',
  type: '@n8n/n8n-nodes-langchain.mcpTrigger',
  typeVersion: 2,
  position: [0, 0],
  parameters: {
    path: 'lusopay-assistente',
    authentication: 'bearerAuth'
  },
  credentials: {
    httpBearerAuth: { id: 'REPLACE_AFTER_IMPORT', name: 'LusoPay MCP Bearer Auth' }
  }
}];

const serverConnections = {};
toolDescriptions.forEach(([id, name, description, cachedResultName, value], index) => {
  const angle = (Math.PI * 2 * index) / toolDescriptions.length;
  serverNodes.push({
    id,
    name,
    type: '@n8n/n8n-nodes-langchain.toolWorkflow',
    typeVersion: 2.2,
    position: [Math.round(Math.cos(angle) * 520), Math.round(Math.sin(angle) * 320) + 420],
    parameters: {
      description,
      source: 'database',
      workflowId: { __rl: true, value: '', mode: 'list', cachedResultName },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value,
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      }
    }
  });
  serverConnections[name] = { ai_tool: [[{ node: 'LusoPay Assistente MCP', type: 'ai_tool', index: 0 }]] };
});

writeJson('server/lusopay_mcp_server.workflow.json', workflow(
  'LSPMCPSERVER0001',
  'LusoPay Assistente MCP Server V1',
  serverNodes,
  serverConnections
));

console.log('Generated V1 workflows.');
