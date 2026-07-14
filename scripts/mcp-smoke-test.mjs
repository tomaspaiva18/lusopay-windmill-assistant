import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const env = {
  ...process.env,
  WINDMILL_BASE_URL: 'https://example.invalid',
  WINDMILL_WORKSPACE: 'lusopay-mcp-server',
  WINDMILL_TOKEN: 'test-token',
  LUSOPAY_MCP_AUTH_MODE: 'disabled',
  MERCHANT_ID: 'DEMO_STORE',
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['mcp-server/dist/index.js'],
  env,
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

const expectedTools = [
  'listar_pagamentos',
  'obter_pagamento_por_order_id',
  'consultar_pagamento',
  'listar_pagamentos_pendentes',
  'pagamentos_confirmados',
  'resumo_pagamentos',
];

const toolNames = new Set(tools.map((tool) => tool.name));
for (const toolName of expectedTools) {
  if (!toolNames.has(toolName)) throw new Error(`Missing MCP tool: ${toolName}`);
}

for (const toolName of toolNames) {
  if (!expectedTools.includes(toolName)) throw new Error(`Unexpected MCP tool exposed: ${toolName}`);
}

console.log(`MCP smoke test ok: ${tools.length} LusoPay API tools exposed`);
