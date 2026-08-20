import { LanguageCode } from '../types';

export function getLocaleTag(lang: LanguageCode): string {
  switch (lang) {
    case 'fa':
      return 'fa-IR';
    case 'ar':
      return 'ar-SA';
    case 'de':
      return 'de-DE';
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'ru':
      return 'ru-RU';
    case 'en':
    default:
      return 'en-US';
  }
}

/**
 * Currency Formatter strictly preserving currency independence from UI language.
 *
 * Rules:
 * - Never converts IRR to USD or vice versa on language switch.
 * - In Persian (`fa`), `IRR` is displayed in Toman (amount / 10) with label `تومان`.
 * - In other languages (`en`, `de`, `fr`, etc.), `IRR` is displayed as the full amount with `IRR`.
 * - If currencyCode is explicitly `TOMAN`, it formats as Toman.
 * - Supports USD, EUR, negative values, zero, and decimals accurately.
 */
export function formatCurrencyValue(
  amount: number,
  currencyCode: string = 'IRR',
  language: LanguageCode = 'fa',
  formatNumberFn?: (num: number, options?: Intl.NumberFormatOptions) => string
): string {
  if (!Number.isFinite(amount)) return '0';

  const locale = getLocaleTag(language);
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatNum = (n: number, opts?: Intl.NumberFormatOptions): string => {
    if (formatNumberFn) return formatNumberFn(n, opts);
    try {
      return new Intl.NumberFormat(locale, opts).format(n);
    } catch {
      return n.toLocaleString();
    }
  };

  if (currencyCode === 'IRR') {
    if (language === 'fa') {
      const toman = Math.round(absAmount / 10);
      const sign = isNegative ? '-' : '';
      return `${sign}${formatNum(toman)} تومان`;
    }
    const sign = isNegative ? '-' : '';
    return `${sign}${formatNum(absAmount)} IRR`;
  }

  if (currencyCode === 'TOMAN') {
    const sign = isNegative ? '-' : '';
    if (language === 'fa' || language === 'ar') {
      return `${sign}${formatNum(absAmount)} تومان`;
    }
    return `${sign}${formatNum(absAmount)} Toman`;
  }

  // International currencies (USD, EUR, RUB, etc.)
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(absAmount);

    return isNegative ? `-${formatted}` : formatted;
  } catch (e) {
    const sign = isNegative ? '-' : '';
    return `${sign}${formatNum(absAmount)} ${currencyCode}`;
  }
}

export function formatCurrencyLocale(
  amount: number,
  language: LanguageCode = 'fa',
  currencyCode: string = 'IRR'
): string {
  return formatCurrencyValue(amount, currencyCode, language);
}

export function formatAmountWithDecimals(
  amount: number,
  language: LanguageCode = 'fa',
  decimals: number = 2
): string {
  const locale = getLocaleTag(language);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
