const SENSITIVE_KEYS = [
  'authorization',
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
];

export function redactSensitiveData<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveData(item)) as T;
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      return value
        .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
        .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]') as T;
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitiveKey) => normalizedKey.includes(sensitiveKey))) {
        return [key, '[REDACTED]'];
      }
      return [key, redactSensitiveData(nestedValue)];
    }),
  ) as T;
}

export function jsonText(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(redactSensitiveData(data), null, 2),
      },
    ],
  };
}

export function errorText(message: string): { isError: true; content: Array<{ type: 'text'; text: string }> } {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  };
}
