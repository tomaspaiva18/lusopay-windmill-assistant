import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';

const [toolName = 'listar_pagamentos', ...rawArgParts] = process.argv.slice(2);
const rawArgs = rawArgParts.length > 0 ? rawArgParts.join(' ') : '{"status":"paid","include_raw":false}';

function normalizeJsonArgument(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('@')) return fs.readFileSync(trimmed.slice(1), 'utf8');

  const quoteLooseObject = (input) => input
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*([A-Za-z_][A-Za-z0-9_/-]*)(\s*[,}])/g, (_match, bareValue, suffix) => {
      if (['true', 'false', 'null'].includes(bareValue)) return `:${bareValue}${suffix}`;
      return `:"${bareValue}"${suffix}`;
    });

  const candidates = [
    trimmed,
    trimmed.replaceAll('\\"', '"'),
    trimmed.replace(/^\^|\^$/g, '').replaceAll('\\^', '"').replaceAll('^', '"'),
    trimmed
      .replaceAll('\\{', '{')
      .replaceAll('\\}', '}')
      .replaceAll('\\^', '"')
      .replace(/^\^|\^$/g, ''),
    quoteLooseObject(trimmed),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next normalization.
    }
  }

  throw new Error(`Second argument must be JSON or @file.json. Received: ${value}`);
}

const args = normalizeJsonArgument(rawArgs);

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
