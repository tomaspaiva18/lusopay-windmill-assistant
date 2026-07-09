export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

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
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.replace(/Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/i, 'Authorization: Basic [redacted]'),
    };
  }
  return { name: 'UnknownError', message: 'Erro desconhecido' };
}

