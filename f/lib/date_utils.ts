import { ValidationError } from './errors.ts';

// Utilitários de datas usados para filtrar e limitar consultas.
// A regra de 90 dias evita consultas demasiado pesadas à API.

const defaultMaxRangeDays = 90;

export function assertIsoDate(value: string | undefined, field: string): void {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} deve usar formato YYYY-MM-DD`);
  }
}

export function validateDateRange(startDate?: string, endDate?: string): void {
  // Valida formato, ordem cronológica e tamanho máximo do intervalo.
  assertIsoDate(startDate, 'start_date');
  assertIsoDate(endDate, 'end_date');
  if (startDate && endDate && startDate > endDate) {
    throw new ValidationError('start_date não pode ser posterior a end_date');
  }
  assertMaxDateRange(startDate, endDate);
}

export function assertMaxDateRange(startDate?: string, endDate?: string, maxDays = defaultMaxRangeDays): void {
  if (!startDate || !endDate) return;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  const days = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
  if (days > maxDays) {
    throw new ValidationError(`intervalo máximo permitido é ${maxDays} dias`);
  }
}

export function isWithinDateRange(date: string | null | undefined, startDate?: string, endDate?: string): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  if (startDate && day < startDate) return false;
  if (endDate && day > endDate) return false;
  return true;
}

export function isOlderThanHours(date: string | null | undefined, hours?: number): boolean {
  if (!hours || !date) return true;
  return Date.parse(date) <= Date.now() - hours * 60 * 60 * 1000;
}

export function isOlderThanDays(date: string | null | undefined, days?: number): boolean {
  if (!days || !date) return true;
  return Date.parse(date) <= Date.now() - days * 24 * 60 * 60 * 1000;
}
