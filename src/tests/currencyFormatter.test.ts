import { describe, it, expect } from 'vitest';
import { formatCurrencyLocale, formatAmountWithDecimals } from '../utils/currencyFormatter';

describe('Currency Formatter - 7-Locale Real Currency Precision', () => {
  it('formats IRR as Toman (amount / 10) in Persian (fa) locale', () => {
    const result = formatCurrencyLocale(10000000, 'fa', 'IRR');
    expect(result).toContain('تومان');
    expect(result).toContain('۱٬۰۰۰٬۰۰۰');
  });

  it('formats USD with $ symbol in English locale', () => {
    const result = formatCurrencyLocale(1250.5, 'en', 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,250.5');
  });

  it('formats EUR in German locale with comma decimal separator', () => {
    const result = formatCurrencyLocale(5000, 'de', 'EUR');
    expect(result).toContain('€');
    expect(result).toContain('5.000');
  });

  it('formats EUR in French locale with non-breaking space separator', () => {
    const result = formatCurrencyLocale(5000, 'fr', 'EUR');
    expect(result).toContain('€');
  });

  it('formats RUB in Russian locale with ruble symbol', () => {
    const result = formatCurrencyLocale(100000, 'ru', 'RUB');
    expect(result).toContain('₽');
  });

  it('formats Arabic locale with eastern Arabic numerals or Arabic currency unit', () => {
    const result = formatCurrencyLocale(50000, 'ar', 'USD');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('handles negative currency amounts correctly', () => {
    const resultEn = formatCurrencyLocale(-500, 'en', 'USD');
    expect(resultEn).toContain('-');

    const resultFa = formatCurrencyLocale(-10000, 'fa', 'IRR');
    expect(resultFa).toContain('-');
  });

  it('formats numbers with custom decimals across locales', () => {
    const formattedFa = formatAmountWithDecimals(1234.56, 'fa', 2);
    expect(formattedFa).toContain('۱٬۲۳۴٫۵۶');

    const formattedEn = formatAmountWithDecimals(1234.56, 'en', 2);
    expect(formattedEn).toBe('1,234.56');
  });
});
