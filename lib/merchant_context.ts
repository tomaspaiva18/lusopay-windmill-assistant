import type { MerchantContext } from './types.ts';
import { ValidationError } from './errors.ts';
import * as wmill from 'windmill-client';

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

async function readConfigValue(key: string): Promise<string | undefined> {
  const envValue = readEnv(key);
  if (envValue !== undefined && envValue !== '') return envValue;

  const configuredPrefix = readEnv('LUSOPAY_VARIABLE_PREFIX');
  const windmillUser = readEnv('WM_USERNAME') || readEnv('WMILL_USERNAME') || DEFAULT_WINDMILL_USER;
  const candidatePaths = [
    configuredPrefix ? `${configuredPrefix.replace(/\/$/, '')}/${key}` : undefined,
    `u/${windmillUser}/${key}`,
    `u/${DEFAULT_WINDMILL_USER}/${key}`,
    `f/lusopay/${key}`,
  ].filter((path): path is string => Boolean(path));

  for (const path of candidatePaths) {
    const value = await readWindmillVariable(path);
    if (value !== undefined && value !== '') return value;
  }

  return undefined;
}

export async function getMerchantContext(merchantId?: string): Promise<MerchantContext> {
  // V1: only default merchant. TODO: replace with DB/Resource lookup by merchantId.
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

export function validateMerchantContext(context: MerchantContext): void {
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
