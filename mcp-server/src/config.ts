export type McpServerConfig = {
  windmillBaseUrl: string;
  windmillWorkspace: string;
  windmillToken: string;
  authMode: 'static' | 'introspection' | 'disabled';
  accessToken?: string;
  staticMerchantsJson?: string;
  authIntrospectionUrl?: string;
  authServiceToken?: string;
  defaultMerchantId: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig(): McpServerConfig {
  return {
    windmillBaseUrl: requireEnv('WINDMILL_BASE_URL'),
    windmillWorkspace: requireEnv('WINDMILL_WORKSPACE'),
    windmillToken: requireEnv('WINDMILL_TOKEN'),
    authMode: (readEnv('LUSOPAY_MCP_AUTH_MODE') as McpServerConfig['authMode']) || 'static',
    accessToken: readEnv('LUSOPAY_MCP_ACCESS_TOKEN'),
    staticMerchantsJson: readEnv('LUSOPAY_MCP_MERCHANTS_JSON'),
    authIntrospectionUrl: readEnv('LUSOPAY_AUTH_INTROSPECTION_URL'),
    authServiceToken: readEnv('LUSOPAY_AUTH_SERVICE_TOKEN'),
    defaultMerchantId: readEnv('MERCHANT_ID') || 'DEMO_STORE',
  };
}
