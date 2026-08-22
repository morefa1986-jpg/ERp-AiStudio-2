import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ar } from './ar';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fa } from './fa';
import { fr } from './fr';
import { ru } from './ru';
import { LanguageCode, LanguageMeta, TextDirection } from '../types';
import { formatCurrencyValue, getLocaleTag } from '../utils/currencyFormatter';
import { translateErrorCode } from './errorMessages';

export const LANGUAGES: LanguageMeta[] = [
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', dir: 'rtl', flag: '🇮🇷', defaultCurrency: 'IRR', calendar: 'jalali' },
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧', defaultCurrency: 'USD', calendar: 'gregorian' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪', defaultCurrency: 'EUR', calendar: 'gregorian' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷', defaultCurrency: 'EUR', calendar: 'gregorian' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸', defaultCurrency: 'EUR', calendar: 'gregorian' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', flag: '🇷🇺', defaultCurrency: 'RUB', calendar: 'gregorian' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦', defaultCurrency: 'SAR', calendar: 'hijri' },
];

const DICTIONARIES: Record<LanguageCode, any> = { fa, en, de, fr, es, ru, ar };

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  dir: TextDirection;
  meta: LanguageMeta;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  tError: (code: string) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  formatDate: (dateInput: string | Date | number) => string;
  formatTime: (dateInput: string | Date | number) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectInitialLanguage(): LanguageCode {
  try {
    const saved = sessionStorage.getItem('fathi_aqua_lang') as LanguageCode;
    if (saved && DICTIONARIES[saved]) return saved;
    const browserCode = (navigator.language || '').toLowerCase().slice(0, 2) as LanguageCode;
    if (DICTIONARIES[browserCode]) return browserCode;
  } catch {}
  return 'fa';
}

function resolveKey(dictionary: any, keyPath: string): unknown {
  return keyPath.split('.').reduce((value: any, key) => value && typeof value === 'object' && key in value ? value[key] : undefined, dictionary);
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(detectInitialLanguage);
  const meta = useMemo(() => LANGUAGES.find((item) => item.code === language) || LANGUAGES[0], [language]);

  const setLanguage = (lang: LanguageCode) => {
    if (!DICTIONARIES[lang]) return;
    setLanguageState(lang);
    try { sessionStorage.setItem('fathi_aqua_lang', lang); } catch {}
  };

  useEffect(() => {
    document.documentElement.dir = meta.dir;
    document.documentElement.lang = language;
  }, [language, meta.dir]);

  const t = (keyPath: string, params?: Record<string, string | number>): string => {
    let value = resolveKey(DICTIONARIES[language] || DICTIONARIES.fa, keyPath);
    if (value === undefined) value = resolveKey(DICTIONARIES.en, keyPath);
    if (typeof value !== 'string') return '—';
    if (!params) return value;
    return Object.entries(params).reduce((text, [key, replacement]) => text.replace(new RegExp(`{${key}}`, 'g'), String(replacement)), value);
  };

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
    if (!Number.isFinite(num)) return '0';
    try { return new Intl.NumberFormat(getLocaleTag(language), options).format(num); }
    catch { return String(num); }
  };

  // Currency is a property of the financial record, never of the selected UI language.
  // When a caller omits a currency code, the ERP's accounting base currency (IRR) is used.
  const formatCurrency = (amount: number, currencyCode: string = 'IRR'): string =>
    formatCurrencyValue(amount, currencyCode, language, formatNumber);

  const formatDate = (dateInput: string | Date | number): string => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return String(dateInput);
    try {
      return new Intl.DateTimeFormat(getLocaleTag(language), {
        year: 'numeric',
        month: language === 'fa' || language === 'ar' ? 'long' : 'short',
        day: 'numeric',
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  };

  const formatTime = (dateInput: string | Date | number): string => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    try { return new Intl.DateTimeFormat(getLocaleTag(language), { hour: '2-digit', minute: '2-digit' }).format(date); }
    catch { return date.toLocaleTimeString(); }
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, dir: meta.dir, meta, t, tError: (code: string) => translateErrorCode(code, language), formatNumber, formatCurrency, formatDate, formatTime }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
};
