import type { MerchantContext } from './types.ts';
import { ValidationError } from './errors.ts';

type EnvReader = { get?: (key: string) => string | undefined };

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

export async function getMerchantContext(merchantId?: string): Promise<MerchantContext> {
  // V1: only default merchant. TODO: replace with DB/Resource lookup by merchantId.
  const context: MerchantContext = {
    merchant_id: merchantId || readEnv('MERCHANT_ID') || 'demo-store',
    merchant_name: readEnv('MERCHANT_NAME') || 'Loja Demo',
    lusopay: {
      pid: readEnv('LUSOPAY_PID') || '',
      username: readEnv('LUSOPAY_USERNAME') || '',
      password: readEnv('LUSOPAY_PASSWORD') || '',
      environment: environmentFrom(readEnv('LUSOPAY_ENV')),
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

