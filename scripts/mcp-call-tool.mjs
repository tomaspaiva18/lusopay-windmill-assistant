import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const [toolName = 'listar_pagamentos', rawArgs = '{"status":"paid","include_raw":false}'] = process.argv.slice(2);

let args;
try {
  args = JSON.parse(rawArgs);
} catch (error) {
  throw new Error(`Second argument must be JSON. Received: ${rawArgs}`);
}

const requiredEnv = [
  'WINDMILL_BASE_URL',
  'WINDMILL_WORKSPACE',
  'WINDMILL_TOKEN',
  'LUSOPAY_MCP_AUTH_MODE',
  'LUSOPAY_MCP_ACCESS_TOKEN',
];

const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['mcp-server/dist/index.js'],
  env: process.env,
  stderr: 'inherit',
  cwd: process.cwd(),
});

const client = new Client({
  name: 'lusopay-mcp-tool-test',
  version: '1.0.0',
});

await client.connect(transport);
const result = await client.callTool({
  name: toolName,
  arguments: args,
});
await client.close();

console.log(JSON.stringify(result, null, 2));
