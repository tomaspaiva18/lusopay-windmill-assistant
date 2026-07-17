export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Erros tipados ajudam o MCP/Windmill a distinguir validação, API LusoPay e loja.

export class LusopayApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LusopayApiError';
  }
}

export class StoreDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreDataError';
  }
}

export function sanitizeError(error: unknown) {
  // Normaliza erros antes de os devolver a clientes MCP.
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.replace(/Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/i, 'Authorization: Basic [redacted]'),
    };
  }
  return { name: 'UnknownError', message: 'Erro desconhecido' };
}

const sensitiveKeys = new Set([
  'password',
  'username',
  'authorization',
  'token',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'credentials',
]);

export function redactSensitiveData<T>(value: T): T {
  // Redige recursivamente dados sensíveis em logs, respostas de erro e auditoria.
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = sensitiveKeys.has(key.toLowerCase()) ? '[redacted]' : redactSensitiveData(nested);
    }
    return output as T;
  }

  if (typeof value === 'string') {
    return value
      .replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic [redacted]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]') as T;
  }

  return value;
}
