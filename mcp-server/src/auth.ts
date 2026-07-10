import type { McpServerConfig } from './config.js';

export type Permission =
  | 'payments:read'
  | 'customers:read'
  | 'reconciliation:read';

export type MerchantSession = {
  merchant_id: string;
  merchant_name?: string;
  permissions: Permission[];
};

type StaticMerchantRecord = {
  merchant_id: string;
  merchant_name?: string;
  permissions?: Permission[];
};

const ALL_READ_PERMISSIONS: Permission[] = ['payments:read', 'customers:read', 'reconciliation:read'];

function parseStaticMerchants(rawJson: string | undefined): Record<string, StaticMerchantRecord> {
  if (!rawJson) return {};
  const parsed = JSON.parse(rawJson) as unknown;
  if (Array.isArray(parsed)) {
    return Object.fromEntries(
      parsed.map((entry) => {
        const item = entry as StaticMerchantRecord & { token?: string };
        if (!item.token) throw new Error('Each LUSOPAY_MCP_MERCHANTS_JSON array item must include token');
        return [item.token, item];
      }),
    );
  }
  return parsed as Record<string, StaticMerchantRecord>;
}

async function introspectToken(config: McpServerConfig, token: string): Promise<MerchantSession | null> {
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
  const record = merchants[token];

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
  if (!session.permissions.includes(permission)) {
    throw new Error(`Merchant is missing required permission: ${permission}`);
  }
}
