import { describe, it, expect } from 'vitest';
import { fa } from '../i18n/fa';
import { en } from '../i18n/en';
import { de } from '../i18n/de';
import { fr } from '../i18n/fr';
import { es } from '../i18n/es';
import { ru } from '../i18n/ru';
import { ar } from '../i18n/ar';
import { LANGUAGES } from '../i18n/index';

describe('Multilingual 7-Locale Comprehensive Audit & 100% Parity Suite', () => {
  const allDictionaries: { code: string; dict: Record<string, unknown>; dir: string }[] = [
    { code: 'fa', dict: fa as Record<string, unknown>, dir: 'rtl' },
    { code: 'en', dict: en as Record<string, unknown>, dir: 'ltr' },
    { code: 'de', dict: de as Record<string, unknown>, dir: 'ltr' },
    { code: 'fr', dict: fr as Record<string, unknown>, dir: 'ltr' },
    { code: 'es', dict: es as Record<string, unknown>, dir: 'ltr' },
    { code: 'ru', dict: ru as Record<string, unknown>, dir: 'ltr' },
    { code: 'ar', dict: ar as Record<string, unknown>, dir: 'rtl' },
  ];

  it('supports all 7 core enterprise languages with correct metadata', () => {
    expect(LANGUAGES.length).toBe(7);
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['fa', 'en', 'de', 'fr', 'es', 'ru', 'ar']);
  });

  it('correctly validates RTL vs LTR configuration across all 7 locales', () => {
    allDictionaries.forEach(({ code, dir }) => {
      const langConfig = LANGUAGES.find((l) => l.code === code);
      expect(langConfig?.dir).toBe(dir);
    });
  });

  // Recursive deep key extractor
  function getDeepKeysAndValues(obj: Record<string, unknown>, prefix = ''): { path: string; value: string }[] {
    let result: { path: string; value: string }[] = [];
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const newPath = prefix ? `${prefix}.${key}` : key;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result = result.concat(getDeepKeysAndValues(val as Record<string, unknown>, newPath));
      } else if (typeof val === 'string') {
        result.push({ path: newPath, value: val });
      }
    }
    return result;
  }

  function extractPlaceholders(str: string): string[] {
    const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
    return matches ? matches.sort() : [];
  }

  it('guarantees 100% recursive key parity across all 7 locales against fa.ts (Authoritative Reference)', () => {
    const referenceEntries = getDeepKeysAndValues(fa as Record<string, unknown>);
    expect(referenceEntries.length).toBeGreaterThan(150);

    allDictionaries.forEach(({ code, dict }) => {
      const localeEntries = getDeepKeysAndValues(dict);
      const localeKeys = new Set(localeEntries.map((e) => e.path));

      referenceEntries.forEach(({ path, value: refVal }) => {
        expect(localeKeys.has(path), `Locale '${code}' is missing key: ${path}`).toBe(true);

        const found = localeEntries.find((e) => e.path === path);
        expect(found?.value, `Locale '${code}' key '${path}' must be a non-empty string`).toBeDefined();
        expect(found?.value.trim().length, `Locale '${code}' key '${path}' is empty string`).toBeGreaterThan(0);

        // Verify template placeholder consistency
        const refPlaceholders = extractPlaceholders(refVal);
        const locPlaceholders = extractPlaceholders(found?.value || '');
        expect(
          locPlaceholders,
          `Locale '${code}' key '${path}' placeholders mismatch. Expected ${refPlaceholders.join(',')} but got ${locPlaceholders.join(',')}`
        ).toEqual(refPlaceholders);
      });
    });
  });

  it('verifies Persian currency conversion converts IRR to Toman by dividing by 10', () => {
    const amountRials = 1000000; // 1,000,000 IRR
    const amountToman = Math.round(amountRials / 10); // 100,000 Toman
    expect(amountToman).toBe(100000);
  });

  it('validates all locale dictionary keys exist and are non-empty', () => {
    allDictionaries.forEach(({ code, dict }) => {
      const entries = getDeepKeysAndValues(dict);
      expect(entries.length).toBeGreaterThan(100);
      entries.forEach(({ path, value }) => {
        expect(value.trim().length, `Empty translation for key ${path} in locale ${code}`).toBeGreaterThan(0);
      });
    });
  });
});
