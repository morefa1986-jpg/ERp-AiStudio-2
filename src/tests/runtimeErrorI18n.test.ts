import { describe, expect, it } from 'vitest';
import { errorMessageKeys, errorMessagesFor, translateErrorCode } from '../i18n/errorMessages';
import { LanguageCode } from '../types';

describe('Runtime error i18n coverage', () => {
  const languages: LanguageCode[] = ['fa', 'en', 'de', 'fr', 'es', 'ru', 'ar'];

  it('translates production runtime error codes for all seven locales', () => {
    const keys = errorMessageKeys();
    expect(keys).toContain('AUTH_REQUIRED');
    expect(keys).toContain('FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED');
    for (const language of languages) {
      const messages = errorMessagesFor(language);
      for (const key of keys) {
        expect(messages[key], `${language} missing ${key}`).toBeTruthy();
        expect(messages[key]).not.toBe(key);
      }
    }
  });

  it('normalizes parameterized error codes and never leaks raw keys when translated', () => {
    expect(translateErrorCode('FX_RATE_INVALID:USD_IRR', 'de')).toBe('Der Wechselkurs ist ungültig.');
    expect(translateErrorCode('AUTH_REQUIRED', 'fa')).not.toBe('AUTH_REQUIRED');
  });
});
