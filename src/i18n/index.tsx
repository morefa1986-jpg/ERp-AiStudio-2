import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fa } from './fa';
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { ru } from './ru';
import { ar } from './ar';
import { LanguageCode, LanguageMeta, TextDirection } from '../types';
import { getLocaleTag, formatCurrencyValue } from '../utils/currencyFormatter';

export const LANGUAGES: LanguageMeta[] = [
  {
    code: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    dir: 'rtl',
    flag: '🇮🇷',
    defaultCurrency: 'IRR',
    calendar: 'jalali',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    flag: '🇬🇧',
    defaultCurrency: 'USD',
    calendar: 'gregorian',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    dir: 'ltr',
    flag: '🇩🇪',
    defaultCurrency: 'EUR',
    calendar: 'gregorian',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    dir: 'ltr',
    flag: '🇫🇷',
    defaultCurrency: 'EUR',
    calendar: 'gregorian',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    dir: 'ltr',
    flag: '🇪🇸',
    defaultCurrency: 'EUR',
    calendar: 'gregorian',
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    dir: 'ltr',
    flag: '🇷🇺',
    defaultCurrency: 'RUB',
    calendar: 'gregorian',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    flag: '🇸🇦',
    defaultCurrency: 'SAR',
    calendar: 'hijri',
  },
];

const DICTIONARIES: Record<LanguageCode, any> = {
  fa,
  en,
  de,
  fr,
  es,
  ru,
  ar,
};

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  dir: TextDirection;
  meta: LanguageMeta;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  formatDate: (dateInput: string | Date | number) => string;
  formatTime: (dateInput: string | Date | number) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectInitialLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem('fathi_aqua_lang') as LanguageCode;
    if (saved && DICTIONARIES[saved]) return saved;

    const browserLang = navigator.language || (navigator as any).userLanguage || '';
    const code = browserLang.toLowerCase().slice(0, 2);

    if (code === 'fa') return 'fa';
    if (code === 'de') return 'de';
    if (code === 'fr') return 'fr';
    if (code === 'es') return 'es';
    if (code === 'ru') return 'ru';
    if (code === 'ar') return 'ar';
    if (code === 'en') return 'en';
  } catch (e) {
    // fallback
  }
  return 'fa'; // Default as requested in PRD
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(detectInitialLanguage);

  const meta = useMemo(() => {
    return LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  }, [language]);

  const setLanguage = (lang: LanguageCode) => {
    if (DICTIONARIES[lang]) {
      setLanguageState(lang);
      try {
        localStorage.setItem('fathi_aqua_lang', lang);
      } catch (e) {}
    }
  };

  useEffect(() => {
    document.documentElement.dir = meta.dir;
    document.documentElement.lang = language;
  }, [meta.dir, language]);

  const t = (keyPath: string, params?: Record<string, string | number>): string => {
    const dict = DICTIONARIES[language] || DICTIONARIES.fa;
    const fallbackDict = DICTIONARIES.en || DICTIONARIES.fa;

    const keys = keyPath.split('.');
    let value: any = dict;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined) {
      // Try fallback to English
      let fallbackValue: any = fallbackDict;
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object' && k in fallbackValue) {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue !== undefined ? fallbackValue : keyPath;
    }

    if (typeof value === 'string' && params) {
      return Object.entries(params).reduce((acc, [k, v]) => {
        return acc.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }, value);
    }

    return typeof value === 'string' ? value : keyPath;
  };

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
    try {
      const locale = getLocaleTag(language);
      return new Intl.NumberFormat(locale, options).format(num);
    } catch (e) {
      return num.toLocaleString();
    }
  };

  const formatCurrency = (amount: number, currencyCode?: string): string => {
    const curr = currencyCode || (language === 'fa' ? 'IRR' : meta.defaultCurrency);
    return formatCurrencyValue(amount, curr, language, formatNumber);
  };

  const formatDate = (dateInput: string | Date | number): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    try {
      if (language === 'fa') {
        return new Intl.DateTimeFormat('fa-IR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(d);
      }
      if (language === 'ar') {
        return new Intl.DateTimeFormat('ar-SA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(d);
      }
      const locale = getLocaleTag(language);
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch (e) {
      return d.toLocaleDateString();
    }
  };

  const formatTime = (dateInput: string | Date | number): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    try {
      const locale = getLocaleTag(language);
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch (e) {
      return d.toLocaleTimeString();
    }
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        dir: meta.dir,
        meta,
        t,
        formatNumber,
        formatCurrency,
        formatDate,
        formatTime,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
