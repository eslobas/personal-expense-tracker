import type { SubscriptionFrequency } from '@/api/types';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const currency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

/** 1234.5 → "1234,50 €" (pt-PT). */
export function formatCurrency(value: number): string {
  return currency.format(value);
}

/** (11, 2026) → "novembro de 2026" */
export function formatMonthYear(month: number, year: number): string {
  return `${MONTHS[month - 1]} de ${year}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "2026-11-05" → "5 de novembro de 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * The API serialises MySQL DATE columns as full ISO timestamps
 * (e.g. "2026-11-04T23:00:00.000Z" for 5 Nov in UTC+1). Convert them back to a
 * local calendar date so the day never shifts by one.
 */
export function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : toISODate(parsed);
}

/** Strict YYYY-MM-DD check that also rejects impossible dates like 2026-02-30. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Parses a user-typed amount, accepting both "12,50" and "12.50".
 * Returns null for anything that is not a positive number with ≤ 2 decimals.
 */
export function parseAmount(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 ? value : null;
}

/** Monthly-equivalent cost of a recurring payment. */
export function monthlyCost(amount: number, frequency: SubscriptionFrequency): number {
  switch (frequency) {
    case 'semanal':
      return (amount * 52) / 12;
    case 'anual':
      return amount / 12;
    default:
      return amount;
  }
}

export function shiftMonth(month: number, year: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}
