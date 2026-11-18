import {
  formatCurrency,
  formatMonthYear,
  isValidISODate,
  monthlyCost,
  normalizeDate,
  parseAmount,
  shiftMonth,
} from '../format';

describe('format helpers', () => {
  it.each([
    ['12,50', 12.5],
    ['12.5', 12.5],
    [' 1200 ', 1200],
    ['0,01', 0.01],
  ])('parseAmount(%p) → %p', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '0', '1,234', '12,345.6', '1e3'])('parseAmount(%p) → null', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('validates ISO dates including impossible calendar days', () => {
    expect(isValidISODate('2026-11-18')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('18/11/2026')).toBe(false);
  });

  it('keeps plain dates and converts timestamps to local dates', () => {
    expect(normalizeDate('2026-11-05')).toBe('2026-11-05');
    expect(normalizeDate(new Date(2026, 0, 31).toISOString())).toBe('2026-01-31');
  });

  it('formats euros and months in pt-PT', () => {
    expect(formatCurrency(1234.5).replace(/\s/g, ' ')).toBe('1234,50 €');
    expect(formatMonthYear(3, 2026)).toBe('março de 2026');
  });

  it('wraps months across years', () => {
    expect(shiftMonth(1, 2026, -1)).toEqual({ month: 12, year: 2025 });
    expect(shiftMonth(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
  });

  it('computes the monthly cost of recurring payments', () => {
    expect(monthlyCost(10, 'mensal')).toBe(10);
    expect(monthlyCost(120, 'anual')).toBe(10);
    expect(monthlyCost(3, 'semanal')).toBe(13);
  });
});
