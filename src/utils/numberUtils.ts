/**
 * Fathi Aqua Super ERP - Numeric Input & Precision Utilities
 * Solves leading zeroes, blank field typing, NaN protection, and locale precision.
 */

/**
 * Safely parse a user numeric input string without converting blank to 0 prematurely,
 * preventing '0123' leading zero bugs and NaN crashes.
 */
export function sanitizeNumericInput(
  rawInput: string | number,
  options?: {
    allowNegative?: boolean;
    min?: number;
    max?: number;
    decimalPlaces?: number;
    defaultValue?: number;
  }
): { rawString: string; numericValue: number; isValid: boolean } {
  const allowNegative = options?.allowNegative ?? false;
  const min = options?.min;
  const max = options?.max;
  const defaultValue = options?.defaultValue ?? 0;

  if (typeof rawInput === 'number') {
    if (Number.isNaN(rawInput) || !Number.isFinite(rawInput)) {
      return { rawString: String(defaultValue), numericValue: defaultValue, isValid: false };
    }
    return { rawString: String(rawInput), numericValue: rawInput, isValid: true };
  }

  const str = String(rawInput).trim();

  // If user clears the input, allow empty string representation for fluid typing
  if (str === '' || str === '-') {
    return {
      rawString: str,
      numericValue: defaultValue,
      isValid: false,
    };
  }

  // Replace Persian / Arabic digits with standard ASCII digits
  const westernizedStr = str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/٫/g, '.');

  const parsed = Number(westernizedStr);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return {
      rawString: str,
      numericValue: defaultValue,
      isValid: false,
    };
  }

  if (!allowNegative && parsed < 0) {
    return {
      rawString: '0',
      numericValue: 0,
      isValid: false,
    };
  }

  if (min !== undefined && parsed < min) {
    return {
      rawString: String(min),
      numericValue: min,
      isValid: false,
    };
  }

  if (max !== undefined && parsed > max) {
    return {
      rawString: String(max),
      numericValue: max,
      isValid: false,
    };
  }

  let finalNum = parsed;
  if (options?.decimalPlaces !== undefined) {
    finalNum = Number(parsed.toFixed(options.decimalPlaces));
  }

  return {
    rawString: westernizedStr,
    numericValue: finalNum,
    isValid: true,
  };
}

/**
 * Format float to fixed decimal without trailing zero clutter when whole
 */
export function formatPrecision(value: number, maxDecimals: number = 2): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '0';
  return Number(value.toFixed(maxDecimals)).toLocaleString('en-US');
}
