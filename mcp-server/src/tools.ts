import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MerchantSession, Permission } from './auth.js';
import { requirePermission } from './auth.js';
import type { WindmillScriptClient } from './windmill.js';
import { errorText, jsonText } from './security.js';

type ToolRuntime = {
  windmill: WindmillScriptClient;
  session: MerchantSession;
};

type ToolHandler<TArgs extends Record<string, unknown>> = (args: TArgs) => Promise<unknown>;

const optionalDate = z.string().optional().describe('Opcional. Usar formato YYYY-MM-DD.');
const requiredDate = z.string().min(1).describe('Data em formato YYYY-MM-DD.');
const includeRaw = z.boolean().optional().default(false).describe('Devolver resposta raw da LusoPay. Usar só para debugging.');

function registerWindmillTool<TArgs extends Record<string, unknown>>(
  server: McpServer,
  runtime: ToolRuntime,
  config: {
    name: string;
    title: string;
    description: string;
    permission: Permission;
    inputSchema: Record<string, z.ZodTypeAny>;
    handler: ToolHandler<TArgs>;
  },
) {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        requirePermission(runtime.session, config.permission);
        const result = await config.handler(args as TArgs);
        return jsonText(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado';
        return errorText(message);
      }
    },
  );
}

export function registerTools(server: McpServer, runtime: ToolRuntime): void {
  registerWindmillTool(server, runtime, {
    name: 'listar_pagamentos',
    title: 'Listar pagamentos',
    description: 'Lista pagamentos da LusoPay com filtros opcionais de data, estado, método e order_id.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      status: z.enum(['paid', 'pending', 'cancelled', 'failed', 'unknown']).optional(),
      payment_method: z.string().optional(),
      order_id: z.string().optional(),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_pagamentos', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'obter_pagamento_por_order_id',
    title: 'Obter pagamento por order_id',
    description: 'Consulta um pagamento da LusoPay pelo identificador da encomenda/order_id.',
    permission: 'payments:read',
    inputSchema: {
      order_id: z.string().min(1).describe('Identificador da encomenda na loja/LusoPay.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/obter_pagamento_por_order_id', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'consultar_pagamento',
    title: 'Consultar pagamento',
    description: 'Consulta um pagamento da LusoPay pelo order_id. Alias orientado a linguagem natural.',
    permission: 'payments:read',
    inputSchema: {
      order_id: z.string().min(1).describe('Identificador da encomenda/order_id.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/obter_pagamento_por_order_id', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'listar_pagamentos_pendentes',
    title: 'Listar pagamentos pendentes',
    description: 'Lista apenas pagamentos pendentes na LusoPay.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_pagamentos_pendentes', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'pagamentos_confirmados',
    title: 'Pagamentos confirmados',
    description: 'Lista pagamentos confirmados/pagos na LusoPay.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      payment_method: z.string().optional(),
      order_id: z.string().optional(),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_pagamentos', runtime.session, {
      ...args,
      status: 'paid',
    }),
  });

  registerWindmillTool(server, runtime, {
    name: 'resumo_pagamentos',
    title: 'Resumo de pagamentos',
    description: 'Gera resumo de pagamentos por período, estado e método.',
    permission: 'payments:read',
    inputSchema: {
      start_date: requiredDate,
      end_date: requiredDate,
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/resumo_pagamentos', runtime.session, args),
  });
}
