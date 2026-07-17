import type { MerchantContext, MerchantRegistryRecord } from './types.ts';
import { ValidationError } from './errors.ts';
import * as wmill from 'windmill-client';

// Resolve a configuração do merchant em runtime.
// Para SaaS, o caminho principal é o registry multi-merchant.
// Para desenvolvimento, mantém fallback para variáveis globais antigas.

type EnvReader = { get?: (key: string) => string | undefined };
const DEFAULT_WINDMILL_USER = 'tomaspaiva';

function readEnv(key: string): string | undefined {
  const deno = (globalThis as unknown as { Deno?: { env?: EnvReader } }).Deno;
  const denoValue = deno?.env?.get?.(key);
  if (denoValue !== undefined) return denoValue;

  const processLike = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  return processLike?.env?.[key];
}

function environmentFrom(value: string | undefined): 'test' | 'prod' {
  return value === 'prod' ? 'prod' : 'test';
}

async function readWindmillVariable(path: string): Promise<string | undefined> {
  try {
    const value = await wmill.getVariable(path);
    return value || undefined;
  } catch {
    return undefined;
  }
}

function defaultVariablePaths(key: string) {
  const configuredPrefix = readEnv('LUSOPAY_VARIABLE_PREFIX');
  const windmillUser = readEnv('WM_USERNAME') || readEnv('WMILL_USERNAME') || DEFAULT_WINDMILL_USER;
  return [
    configuredPrefix ? `${configuredPrefix.replace(/\/$/, '')}/${key}` : undefined,
    `u/${windmillUser}/${key}`,
    `u/${DEFAULT_WINDMILL_USER}/${key}`,
    `f/lusopay/${key}`,
  ].filter((path): path is string => Boolean(path));
}

async function readConfigValue(key: string): Promise<string | undefined> {
  // Permite correr o mesmo código localmente, no Windmill e em MCP sem mudar imports.
  const envValue = readEnv(key);
  if (envValue !== undefined && envValue !== '') return envValue;

  for (const path of defaultVariablePaths(key)) {
    const value = await readWindmillVariable(path);
    if (value !== undefined && value !== '') return value;
  }

  return undefined;
}

function normalizeMerchantRecord(raw: any, fallbackMerchantId?: string): MerchantRegistryRecord {
  return {
    merchant_id: String(raw?.merchant_id || fallbackMerchantId || ''),
    merchant_name: String(raw?.merchant_name || raw?.name || 'Loja'),
    active: raw?.active !== false,
    lusopay: {
      pid: String(raw?.lusopay?.pid || raw?.lusopay_pid || raw?.pid || ''),
      username: String(raw?.lusopay?.username || raw?.lusopay_username || raw?.username || ''),
      password: String(raw?.lusopay?.password || raw?.lusopay_password || raw?.password || ''),
      environment: environmentFrom(raw?.lusopay?.environment || raw?.lusopay_env || raw?.environment),
    },
    store: raw?.store || { platform: 'mock' },
  };
}

function parseMerchantRegistry(raw: string | undefined): MerchantRegistryRecord[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => normalizeMerchantRecord(entry));
  }
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([merchantId, entry]) =>
      normalizeMerchantRecord(entry, merchantId),
    );
  }
  return [];
}

async function readMerchantRegistry(): Promise<MerchantRegistryRecord[]> {
  // LUSOPAY_MERCHANTS_JSON deve ser guardado como secret em produção.
  const envRegistry = readEnv('LUSOPAY_MERCHANTS_JSON');
  if (envRegistry) return parseMerchantRegistry(envRegistry);

  const explicitPath = readEnv('LUSOPAY_MERCHANTS_VARIABLE_PATH');
  const candidatePaths = [
    explicitPath,
    ...defaultVariablePaths('LUSOPAY_MERCHANTS_JSON'),
  ].filter((path): path is string => Boolean(path));

  for (const path of candidatePaths) {
    const raw = await readWindmillVariable(path);
    if (raw) return parseMerchantRegistry(raw);
  }

  return [];
}

async function findMerchantInRegistry(merchantId?: string): Promise<MerchantContext | null> {
  const registry = await readMerchantRegistry();
  if (!registry.length) return null;

  const selected = merchantId
    ? registry.find((merchant) => merchant.merchant_id === merchantId)
    : registry[0];

  if (!selected || selected.active === false) return null;
  validateMerchantContext(selected);
  return selected;
}

async function getFallbackMerchantContext(merchantId?: string): Promise<MerchantContext> {
  // Fallback V1: útil para desenvolvimento local e testes simples.
  const merchantIdValue = await readConfigValue('MERCHANT_ID');
  const merchantName = await readConfigValue('MERCHANT_NAME');
  const lusopayPid = await readConfigValue('LUSOPAY_PID');
  const lusopayUsername = await readConfigValue('LUSOPAY_USERNAME');
  const lusopayPassword = await readConfigValue('LUSOPAY_PASSWORD');
  const lusopayEnv = await readConfigValue('LUSOPAY_ENV');

  const context: MerchantContext = {
    merchant_id: merchantId || merchantIdValue || 'demo-store',
    merchant_name: merchantName || 'Loja Demo',
    lusopay: {
      pid: lusopayPid || '',
      username: lusopayUsername || '',
      password: lusopayPassword || '',
      environment: environmentFrom(lusopayEnv),
    },
    store: {
      platform: 'mock',
    },
  };

  validateMerchantContext(context);
  return context;
}

export async function getMerchantContext(merchantId?: string): Promise<MerchantContext> {
  // SaaS: tenta primeiro obter credenciais isoladas por merchant_id.
  const registryContext = await findMerchantInRegistry(merchantId);
  if (registryContext) return registryContext;

  return getFallbackMerchantContext(merchantId);
}

export function validateMerchantContext(context: MerchantContext): void {
  // Falha cedo se faltar configuração crítica; evita chamadas à LusoPay com credenciais vazias.
  if (!context.merchant_id) throw new ValidationError('merchant_id ausente');
  if (!context.lusopay.pid) throw new ValidationError('LUSOPAY_PID ausente');
  if (!context.lusopay.username) throw new ValidationError('LUSOPAY_USERNAME ausente');
  if (!context.lusopay.password) throw new ValidationError('LUSOPAY_PASSWORD ausente');
}

export async function getLusopayConfig(merchantId?: string) {
  return (await getMerchantContext(merchantId)).lusopay;
}

export async function getStoreConfig(merchantId?: string) {
  return (await getMerchantContext(merchantId)).store;
}
