import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServerConfig } from './config.js';
import type { MerchantSession, Permission } from './auth.js';
import { hasPermission, requirePermission } from './auth.js';
import type { WindmillScriptClient } from './windmill.js';
import { errorText, jsonText } from './security.js';

// Registo das ferramentas MCP expostas aos agentes.
// Cada tool aponta para um script Windmill e declara permissões mínimas.

type ToolRuntime = {
  config: McpServerConfig;
  windmill: WindmillScriptClient;
  session: MerchantSession;
};

type ToolHandler<TArgs extends Record<string, unknown>> = (args: TArgs) => Promise<unknown>;

const optionalDate = z.string().optional().describe('Opcional. Usar formato YYYY-MM-DD.');
const requiredDate = z.string().min(1).describe('Data em formato YYYY-MM-DD.');
const includeRaw = z.boolean().optional().default(false).describe('Devolver resposta raw da LusoPay. Usar apenas para debugging.');

function registerTool<TArgs extends Record<string, unknown>>(
  server: McpServer,
  runtime: ToolRuntime,
  config: {
    name: string;
    title: string;
    description: string;
    permission: Permission;
    inputSchema: Record<string, z.ZodTypeAny>;
    readOnly?: boolean;
    handler: ToolHandler<TArgs>;
  },
) {
  // Se o merchant não tiver permissão, a ferramenta nem sequer é anunciada ao cliente MCP.
  if (!hasPermission(runtime.session, config.permission)) return;

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: {
        readOnlyHint: config.readOnly ?? true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        // Validação defensiva antes de chamar o Windmill.
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
  registerTool(server, runtime, {
    name: 'criar_link_pagamento',
    title: 'Dono da loja: criar Pay by Link',
    description: 'Cria/prepara um Pay by Link LusoPay usando as regras das extensões Moodle/OpenCart: offline_engine.php com payload data em base64. Requer payments:write.',
    permission: 'payments:write',
    readOnly: false,
    inputSchema: {
      amount: z.number().positive().describe('Valor do pagamento.'),
      currency: z.string().optional().default('EUR').describe('Moeda. Apenas EUR é suportado nesta fase.'),
      description: z.string().min(1).describe('Descrição apresentada no pagamento.'),
      order_id: z.string().min(1).describe('Identificador único da encomenda.'),
      customer_name: z.string().min(1).describe('Nome do cliente.'),
      customer_email: z.string().email().describe('Email do cliente.'),
      return_url: z.string().url().describe('URL para onde o cliente regressa após o pagamento.'),
      website_url: z.string().url().describe('URL base/site da loja. Campo W usado pela LusoPay.'),
      country: z.string().optional().default('PT').describe('País de faturação em ISO-2. Por defeito: PT.'),
      language: z.string().optional().default('pt_PT').describe('Idioma LusoPay/offline_engine. Por defeito: pt_PT.'),
      payment_methods: z.array(z.string()).optional().default(['P0']).describe('Métodos LusoPay. P0 significa todos.'),
      dry_run: z.boolean().optional().default(true).describe('Por defeito true: prepara payload sem criar link real. Usar false para executar POST.'),
    },
    handler: (args) => runtime.windmill.run('f/lusopay/criar_link_pagamento', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'listar_pagamentos',
    title: 'Dono da loja: listar pagamentos',
    description: 'Lista pagamentos da LusoPay com filtros opcionais de data, estado, método e order_id.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      status: z.enum(['paid', 'pending', 'cancelled', 'failed', 'payment_paid', 'payment_pending', 'payment_cancelled', 'payment_failed', 'link_created', 'expired', 'unknown']).optional(),
      payment_method: z.string().optional(),
      order_id: z.string().optional(),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_pagamentos', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'obter_pagamento_por_order_id',
    title: 'Dono da loja: obter pagamento por order_id',
    description: 'Consulta um pagamento da LusoPay pelo identificador da encomenda/order_id.',
    permission: 'payments:read',
    inputSchema: {
      order_id: z.string().min(1).describe('Identificador da encomenda na loja/LusoPay.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/obter_pagamento_por_order_id', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'consultar_pagamento',
    title: 'Dono da loja: consultar pagamento',
    description: 'Consulta um pagamento da LusoPay pelo order_id. Alias orientado a linguagem natural.',
    permission: 'payments:read',
    inputSchema: {
      order_id: z.string().min(1).describe('Identificador da encomenda/order_id.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/obter_pagamento_por_order_id', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'acompanhar_pagamento',
    title: 'Dono da loja: acompanhar pagamento',
    description: 'Acompanha o ciclo de um pagamento por order_id. Usa LusoPay e, se necessário, o registry local de links criados.',
    permission: 'payments:read',
    inputSchema: {
      order_id: z.string().min(1).describe('Identificador da encomenda/order_id.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/acompanhar_pagamento', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'listar_pagamentos_pendentes',
    title: 'Dono da loja: listar pagamentos pendentes',
    description: 'Lista apenas pagamentos pendentes na LusoPay.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_pagamentos_pendentes', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'pagamentos_confirmados',
    title: 'Dono da loja: pagamentos confirmados',
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

  registerTool(server, runtime, {
    name: 'listar_pagamentos_cancelados',
    title: 'Dono da loja: pagamentos cancelados',
    description: 'Lista pagamentos cancelados na LusoPay.',
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
      status: 'cancelled',
    }),
  });

  registerTool(server, runtime, {
    name: 'listar_pagamentos_falhados',
    title: 'Dono da loja: pagamentos falhados',
    description: 'Lista pagamentos falhados/recusados na LusoPay.',
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
      status: 'failed',
    }),
  });

  registerTool(server, runtime, {
    name: 'detetar_pagamentos_pendentes_antigos',
    title: 'Dono da loja: detetar pendentes antigos',
    description: 'Lista pagamentos pendentes há mais de X horas. Útil para alertas operacionais.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      older_than_hours: z.number().positive().optional().default(72).describe('Idade mínima em horas. Por defeito: 72.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_pagamentos_pendentes', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'detetar_links_expirados',
    title: 'Dono da loja: detetar links expirados',
    description: 'Lista Pay by Links expirados/inativos, inferidos por estado do link ou data de expiração.',
    permission: 'payments:read',
    inputSchema: {
      start_date: optionalDate,
      end_date: optionalDate,
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/listar_links_expirados', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'resumo_pagamentos',
    title: 'Dono da loja: resumo de pagamentos',
    description: 'Gera resumo de pagamentos por período, estado e método.',
    permission: 'payments:read',
    inputSchema: {
      start_date: requiredDate,
      end_date: requiredDate,
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/resumo_pagamentos', runtime.session, args),
  });

  registerTool(server, runtime, {
    name: 'resumo_mensal_pagamentos',
    title: 'Dono da loja: resumo mensal de pagamentos',
    description: 'Gera resumo de pagamentos para um mês específico no formato YYYY-MM.',
    permission: 'payments:read',
    inputSchema: {
      month: z.string().regex(/^\d{4}-\d{2}$/).describe('Mês em formato YYYY-MM, por exemplo 2026-07.'),
      include_raw: includeRaw,
    },
    handler: (args) => runtime.windmill.run('f/lusopay/resumo_mensal_pagamentos', runtime.session, args),
  });
}
