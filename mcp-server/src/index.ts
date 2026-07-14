#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { authenticateMerchant } from './auth.js';
import { loadConfig } from './config.js';
import { WindmillScriptClient } from './windmill.js';
import { registerTools } from './tools.js';

async function main() {
  const config = loadConfig();
  const session = await authenticateMerchant(config);
  const windmill = new WindmillScriptClient(config);

  const server = new McpServer({
    name: 'lusopay-mcp-server',
    version: '1.0.0',
  });

  registerTools(server, { config, windmill, session });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[lusopay-mcp-server] ${message}`);
  process.exit(1);
});
