import { describe, it, expect } from 'vitest';
import { fa } from '../i18n/fa';
import { en } from '../i18n/en';
import { de } from '../i18n/de';
import { fr } from '../i18n/fr';
import { es } from '../i18n/es';
import { ru } from '../i18n/ru';
import { ar } from '../i18n/ar';
import { LANGUAGES } from '../i18n/index';

describe('Multilingual 7-Locale Comprehensive Audit & Parity Suite', () => {
  const allDictionaries = [
    { code: 'fa', dict: fa, dir: 'rtl' },
    { code: 'en', dict: en, dir: 'ltr' },
    { code: 'de', dict: de, dir: 'ltr' },
    { code: 'fr', dict: fr, dir: 'ltr' },
    { code: 'es', dict: es, dir: 'ltr' },
    { code: 'ru', dict: ru, dir: 'ltr' },
    { code: 'ar', dict: ar, dir: 'rtl' },
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

  it('guarantees 100% dictionary section parity across all 7 locales', () => {
    const requiredSections: (keyof typeof fa)[] = [
      'nav',
      'dashboard',
      'pond',
      'feeding',
      'waterQuality',
      'biometrics',
      'hatchery',
      'processing',
      'warehouse',
      'salesCrm',
      'accounting',
      'securityAudit',
      'backupRestore',
      'platform',
      'auth',
      'ai',
    ];

    allDictionaries.forEach(({ code, dict }) => {
      requiredSections.forEach((section) => {
        expect(dict[section], `Locale ${code} missing section ${section}`).toBeDefined();
        expect(typeof dict[section], `Locale ${code} section ${section} must be an object`).toBe('object');
      });
    });
  });

  it('guarantees complete navigation key parity across all 7 locales', () => {
    const navKeys = Object.keys(fa.nav);
    allDictionaries.forEach(({ code, dict }) => {
      navKeys.forEach((key) => {
        const value = (dict.nav as Record<string, string>)[key];
        expect(value, `Locale ${code} is missing nav key: ${key}`).toBeDefined();
        expect(typeof value, `Locale ${code} nav key ${key} must be non-empty string`).toBe('string');
        expect(value.length, `Locale ${code} nav key ${key} should not be empty`).toBeGreaterThan(0);
      });
    });
  });

  it('guarantees complete dashboard key parity across all 7 locales', () => {
    const dashboardKeys = Object.keys(fa.dashboard);
    allDictionaries.forEach(({ code, dict }) => {
      dashboardKeys.forEach((key) => {
        const value = (dict.dashboard as Record<string, string>)[key];
        expect(value, `Locale ${code} is missing dashboard key: ${key}`).toBeDefined();
        expect(typeof value).toBe('string');
      });
    });
  });

  it('guarantees complete accounting key parity across all 7 locales', () => {
    const accountingKeys = Object.keys(fa.accounting);
    allDictionaries.forEach(({ code, dict }) => {
      accountingKeys.forEach((key) => {
        const value = (dict.accounting as Record<string, string>)[key];
        expect(value, `Locale ${code} is missing accounting key: ${key}`).toBeDefined();
        expect(typeof value).toBe('string');
      });
    });
  });

  it('guarantees complete feeding key parity across all 7 locales', () => {
    const feedingKeys = Object.keys(fa.feeding);
    allDictionaries.forEach(({ code, dict }) => {
      feedingKeys.forEach((key) => {
        const value = (dict.feeding as Record<string, string>)[key];
        expect(value, `Locale ${code} is missing feeding key: ${key}`).toBeDefined();
        expect(typeof value).toBe('string');
      });
    });
  });

  it('validates common actions and status strings are defined', () => {
    const commonKeys: (keyof typeof fa)[] = [
      'appName',
      'appSlogan',
      'tagline',
      'online',
      'offline',
      'lanMode',
      'searchPlaceholder',
      'save',
      'cancel',
      'delete',
      'edit',
      'create',
      'confirm',
      'back',
      'close',
      'exportPdf',
      'exportExcel',
      'print',
      'status',
      'actions',
      'date',
      'time',
      'notes',
      'details',
      'refresh',
      'systemStatus',
      'loading',
      'noData',
      'emptyTable',
      'all',
      'filter',
      'search',
      'active',
      'inactive',
      'success',
      'error',
      'kg',
      'gram',
      'unit',
      'mgL',
      'celsius',
      'ppt',
    ];

    allDictionaries.forEach(({ code, dict }) => {
      commonKeys.forEach((key) => {
        const val = dict[key];
        expect(val, `Locale ${code} is missing common key: ${key}`).toBeDefined();
        expect(typeof val).toBe('string');
      });
    });
  });
});
