import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createHash } from 'node:crypto';

async function listTools(envOverrides) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['mcp-server/dist/index.js'],
    env: {
      ...process.env,
      WINDMILL_BASE_URL: 'https://example.invalid',
      WINDMILL_WORKSPACE: 'lusopay-mcp-server',
      WINDMILL_TOKEN: 'test-token',
      MERCHANT_ID: 'DEMO_STORE',
      ...envOverrides,
    },
    stderr: 'pipe',
    cwd: process.cwd(),
  });

  const client = new Client({
    name: 'lusopay-mcp-smoke-test',
    version: '1.0.0',
  });

  await client.connect(transport);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((tool) => tool.name).sort();
}

async function assertServerFails(label, envOverrides) {
  try {
    await listTools(envOverrides);
  } catch {
    return;
  }
  throw new Error(`${label}: expected MCP server to reject credentials`);
}

function assertExact(label, actualTools, expectedTools) {
  const actual = new Set(actualTools);
  for (const toolName of expectedTools) {
    if (!actual.has(toolName)) throw new Error(`${label}: missing MCP tool: ${toolName}`);
  }

  for (const toolName of actual) {
    if (!expectedTools.includes(toolName)) throw new Error(`${label}: unexpected MCP tool exposed: ${toolName}`);
  }
}

const readTools = [
  'acompanhar_pagamento',
  'consultar_pagamento',
  'detetar_links_expirados',
  'detetar_pagamentos_pendentes_antigos',
  'listar_pagamentos',
  'listar_pagamentos_cancelados',
  'listar_pagamentos_falhados',
  'listar_pagamentos_pendentes',
  'obter_pagamento_por_order_id',
  'pagamentos_confirmados',
  'resumo_mensal_pagamentos',
  'resumo_pagamentos',
];

const writeTools = [
  ...readTools,
  'criar_link_pagamento',
].sort();

const readOnly = await listTools({
  LUSOPAY_MCP_AUTH_MODE: 'static',
  LUSOPAY_MCP_ACCESS_TOKEN: 'read-token',
  LUSOPAY_MCP_MERCHANTS_JSON: JSON.stringify({
    'read-token': {
      merchant_id: 'DEMO_STORE',
      permissions: ['payments:read'],
    },
  }),
});
assertExact('read-only', readOnly, readTools);

const readWrite = await listTools({
  LUSOPAY_MCP_AUTH_MODE: 'static',
  LUSOPAY_MCP_ACCESS_TOKEN: 'write-token',
  LUSOPAY_MCP_MERCHANTS_JSON: JSON.stringify({
    'write-token': {
      merchant_id: 'DEMO_STORE',
      permissions: ['payments:read', 'payments:write'],
    },
  }),
});
assertExact('read-write', readWrite, writeTools);

const hashedToken = 'hashed-token';
const hashedReadOnly = await listTools({
  LUSOPAY_MCP_AUTH_MODE: 'static',
  LUSOPAY_MCP_ACCESS_TOKEN: hashedToken,
  LUSOPAY_MCP_MERCHANTS_JSON: JSON.stringify([
    {
      token_hash: createHash('sha256').update(hashedToken).digest('hex'),
      merchant_id: 'DEMO_STORE',
      permissions: ['payments:read'],
      expires_at: '2999-01-01T00:00:00Z',
    },
  ]),
});
assertExact('hashed-read-only', hashedReadOnly, readTools);

await assertServerFails('expired-token', {
  LUSOPAY_MCP_AUTH_MODE: 'static',
  LUSOPAY_MCP_ACCESS_TOKEN: 'expired-token',
  LUSOPAY_MCP_MERCHANTS_JSON: JSON.stringify([
    {
      token_hash: createHash('sha256').update('expired-token').digest('hex'),
      merchant_id: 'DEMO_STORE',
      permissions: ['payments:read'],
      expires_at: '2000-01-01T00:00:00Z',
    },
  ]),
});

console.log(`MCP smoke test ok: read=${readOnly.length}, read_write=${readWrite.length}, hashed_read=${hashedReadOnly.length}`);
