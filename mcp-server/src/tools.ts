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

  registerWindmillTool(server, runtime, {
    name: 'comparar_pagamentos_loja_lusopay',
    title: 'Comparar loja com LusoPay',
    description: 'Compara pagamentos da loja com pagamentos LusoPay e devolve divergências em JSON.',
    permission: 'reconciliation:read',
    inputSchema: {
      start_date: requiredDate,
      end_date: requiredDate,
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/reconciliation/comparar_pagamentos_loja_lusopay', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'obter_cliente',
    title: 'Obter cliente',
    description: 'Obtém dados de cliente na interface de loja. Na V1 usa mock/store adapter.',
    permission: 'customers:read',
    inputSchema: {
      customer_identifier: z.string().min(1).describe('ID, email ou identificador do cliente.'),
    },
    handler: (args) => runtime.windmill.run('f/customers/obter_cliente', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'resumo_cliente',
    title: 'Resumo de cliente',
    description: 'Gera resumo de atividade de um cliente.',
    permission: 'customers:read',
    inputSchema: {
      customer_identifier: z.string().min(1).describe('ID, email ou identificador do cliente.'),
      period_days: z.number().int().positive().max(365).optional().default(30),
    },
    handler: (args) => runtime.windmill.run('f/customers/resumo_cliente', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'listar_encomendas_cliente',
    title: 'Listar encomendas de cliente',
    description: 'Lista encomendas de um cliente na loja.',
    permission: 'customers:read',
    inputSchema: {
      customer_identifier: z.string().min(1).describe('ID, email ou identificador do cliente.'),
      start_date: optionalDate,
      end_date: optionalDate,
      limit: z.number().int().positive().max(200).optional().default(50),
    },
    handler: (args) => runtime.windmill.run('f/customers/listar_encomendas_cliente', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'clientes_mais_ativos',
    title: 'Clientes mais ativos',
    description: 'Lista clientes mais ativos por número de encomendas ou total gasto.',
    permission: 'customers:read',
    inputSchema: {
      start_date: requiredDate,
      end_date: requiredDate,
      sort_by: z.enum(['orders_count', 'total_spent']).optional().default('total_spent'),
      limit: z.number().int().positive().max(100).optional().default(10),
    },
    handler: (args) => runtime.windmill.run('f/customers/clientes_mais_ativos', runtime.session, args),
  });

  registerWindmillTool(server, runtime, {
    name: 'clientes_com_pagamentos_pendentes',
    title: 'Clientes com pagamentos pendentes',
    description: 'Lista clientes com encomendas/pagamentos pendentes.',
    permission: 'customers:read',
    inputSchema: {
      older_than_days: z.number().int().positive().max(365).optional(),
      limit: z.number().int().positive().max(100).optional().default(20),
    },
    handler: (args) => runtime.windmill.run('f/customers/clientes_com_pagamentos_pendentes', runtime.session, args),
  });
}
