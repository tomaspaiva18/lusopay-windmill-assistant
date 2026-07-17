import * as wmill from 'windmill-client';
import type { McpServerConfig } from './config.js';
import type { MerchantSession } from './auth.js';

// Adaptador mínimo entre MCP e Windmill.
// As ferramentas MCP chamam scripts Windmill e injectam sempre o merchant_id autenticado.

export class WindmillScriptClient {
  constructor(private readonly config: McpServerConfig) {
    process.env.WM_WORKSPACE = config.windmillWorkspace;
    wmill.setClient(config.windmillToken, config.windmillBaseUrl);
  }

  async run<T = unknown>(path: string, session: MerchantSession, args: Record<string, unknown> = {}): Promise<T> {
    // O input manual do cliente não decide o merchant_id; vem da sessão autenticada.
    const result = await wmill.runScriptByPath(path, {
      ...args,
      merchant_id: session.merchant_id,
    });
    return result as T;
  }
}
