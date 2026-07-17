import type { McpServerConfig } from './config.js';
import { createHash } from 'node:crypto';

// Autenticação do MCP Server.
// Em desenvolvimento pode usar tokens estáticos; em produção deve usar introspection.

export type Permission =
  | 'payments:read'
  | 'payments:write'
  | 'payments:reconcile'
  | 'customers:read'
  | 'reconciliation:read'
  | 'admin:debug';

export type MerchantSession = {
  merchant_id: string;
  merchant_name?: string;
  permissions: Permission[];
};

type StaticMerchantRecord = {
  merchant_id: string;
  merchant_name?: string;
  permissions?: Permission[];
  token_hash?: string;
  label?: string;
  expires_at?: string;
  active?: boolean;
};

const ALL_READ_PERMISSIONS: Permission[] = ['payments:read', 'customers:read', 'reconciliation:read'];

function parseStaticMerchants(rawJson: string | undefined): Record<string, StaticMerchantRecord> {
  // Modo simples para desenvolvimento: token -> merchant/permissões.
  if (!rawJson) return {};
  const parsed = JSON.parse(rawJson) as unknown;
  if (Array.isArray(parsed)) {
    return Object.fromEntries(
      parsed.map((entry, index) => {
        const item = entry as StaticMerchantRecord & { token?: string };
        if (!item.token && !item.token_hash) {
          throw new Error('Each LUSOPAY_MCP_MERCHANTS_JSON array item must include token or token_hash');
        }
        return [item.token || `token_hash:${item.token_hash || index}`, item];
      }),
    );
  }
  return parsed as Record<string, StaticMerchantRecord>;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isRecordUsable(record: StaticMerchantRecord | undefined): record is StaticMerchantRecord {
  if (!record || record.active === false) return false;
  if (!record.expires_at) return true;
  const expiresAt = Date.parse(record.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function findStaticMerchantByToken(
  merchants: Record<string, StaticMerchantRecord>,
  token: string,
): StaticMerchantRecord | undefined {
  // Compatibilidade V1: chave do objecto ainda pode ser o token em claro.
  const legacyRecord = merchants[token];
  if (isRecordUsable(legacyRecord)) return legacyRecord;

  // Modo SaaS/piloto: guardar apenas SHA-256 do token no mapping.
  const tokenHash = hashToken(token);
  return Object.values(merchants).find((record) =>
    isRecordUsable(record) && record.token_hash === tokenHash
  );
}

async function introspectToken(config: McpServerConfig, token: string): Promise<MerchantSession | null> {
  // Modo recomendado para produção: validar token num serviço central da LusoPay.
  if (!config.authIntrospectionUrl) throw new Error('LUSOPAY_AUTH_INTROSPECTION_URL is required for introspection auth');

  const response = await fetch(config.authIntrospectionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.authServiceToken ? { Authorization: `Bearer ${config.authServiceToken}` } : {}),
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) throw new Error(`Auth introspection failed with status ${response.status}`);
  const body = await response.json() as {
    active?: boolean;
    merchant_id?: string;
    merchant_name?: string;
    permissions?: Permission[];
  };

  if (!body.active || !body.merchant_id) return null;
  return {
    merchant_id: body.merchant_id,
    merchant_name: body.merchant_name,
    permissions: body.permissions?.length ? body.permissions : ALL_READ_PERMISSIONS,
  };
}

export async function authenticateMerchant(config: McpServerConfig): Promise<MerchantSession> {
  // A sessão resultante é sempre propagada para os scripts Windmill via merchant_id.
  if (config.authMode === 'disabled') {
    return {
      merchant_id: config.defaultMerchantId,
      merchant_name: 'Development merchant',
      permissions: ALL_READ_PERMISSIONS,
    };
  }

  const token = config.accessToken;
  if (!token) throw new Error('Missing LUSOPAY_MCP_ACCESS_TOKEN. Configure the MCP client with a merchant access token.');

  if (config.authMode === 'introspection') {
    const session = await introspectToken(config, token);
    if (!session) throw new Error('Invalid or inactive merchant token');
    return session;
  }

  const merchants = parseStaticMerchants(config.staticMerchantsJson);
  const record = findStaticMerchantByToken(merchants, token);

  if (record) {
    return {
      merchant_id: record.merchant_id,
      merchant_name: record.merchant_name,
      permissions: record.permissions?.length ? record.permissions : ALL_READ_PERMISSIONS,
    };
  }

  if (!config.staticMerchantsJson) {
    return {
      merchant_id: config.defaultMerchantId,
      merchant_name: 'Development merchant',
      permissions: ALL_READ_PERMISSIONS,
    };
  }

  throw new Error('Invalid merchant token');
}

export function requirePermission(session: MerchantSession, permission: Permission): void {
  // Defesa adicional: mesmo que a tool apareça por engano, a execução valida permissões.
  if (!session.permissions.includes(permission)) {
    throw new Error(`Merchant is missing required permission: ${permission}`);
  }
}

export function hasPermission(session: MerchantSession, permission: Permission): boolean {
  return session.permissions.includes(permission);
}
