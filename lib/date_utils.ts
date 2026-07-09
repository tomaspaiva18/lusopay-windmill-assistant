import { ValidationError } from './errors.ts';

export function assertIsoDate(value: string | undefined, field: string): void {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} deve usar formato YYYY-MM-DD`);
  }
}

export function validateDateRange(startDate?: string, endDate?: string): void {
  assertIsoDate(startDate, 'start_date');
  assertIsoDate(endDate, 'end_date');
  if (startDate && endDate && startDate > endDate) {
    throw new ValidationError('start_date não pode ser posterior a end_date');
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

