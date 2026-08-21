import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dynamicTranslationService } from '../services/dynamicTranslationService';

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  };
}

function installBrowserSession(token = 'fathi_sec_test_token') {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  sessionStorage.setItem('fathi_aqua_session_token', token);
  (globalThis as any).window = { localStorage, sessionStorage };
  return { localStorage, sessionStorage };
}

describe('Runtime dynamic translation safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installBrowserSession();
    dynamicTranslationService.clearCache();
    dynamicTranslationService.toggleTranslation(false);
  });

  it('is opt-in and never calls an AI endpoint by default', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const original = 'کاهش اکسیژن باعث تلفات شد';
    const result = await dynamicTranslationService.translateText({ text: original, sourceLocale: 'fa', targetLocale: 'en', fieldName: 'description' });
    expect(result.translatedText).toBe(original);
    expect(result.status).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('translates only after explicit opt-in and preserves original source data', async () => {
    dynamicTranslationService.toggleTranslation(true);
    const originalRecord = { id: 'mortality-1022', description: 'کاهش اکسیژن باعث تلفات شد', contentLocale: 'fa' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, translations: [{ translatedText: 'Oxygen drop caused mortality' }] }),
    } as Response);

    const result = await dynamicTranslationService.translateText({
      recordId: originalRecord.id,
      text: originalRecord.description,
      sourceLocale: originalRecord.contentLocale,
      targetLocale: 'en',
      fieldName: 'description',
    });

    expect(result.translatedText).toBe('Oxygen drop caused mortality');
    expect(result.status).toBe('translated');
    expect(originalRecord.description).toBe('کاهش اکسیژن باعث تلفات شد');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ headers: expect.objectContaining({ Authorization: 'Bearer fathi_sec_test_token' }) });
  });

  it('reuses the session cache and avoids a second API call', async () => {
    dynamicTranslationService.toggleTranslation(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, translations: [{ translatedText: 'Mortality caused by low oxygen' }] }),
    } as Response);
    const request = { text: 'تلفات ناشی از افت اکسیژن', sourceLocale: 'fa', targetLocale: 'en', fieldName: 'reason' };
    const first = await dynamicTranslationService.translateText(request);
    const second = await dynamicTranslationService.translateText(request);
    expect(first.isCached).toBe(false);
    expect(second.status).toBe('cached');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks secret and restricted financial/personnel fields before network access', async () => {
    dynamicTranslationService.toggleTranslation(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const password = await dynamicTranslationService.translateText({ text: 'secret', targetLocale: 'en', fieldName: 'user_password' });
    const salary = await dynamicTranslationService.translateText({ text: 'حقوق کارمند', targetLocale: 'en', fieldName: 'salary' });
    const iban = await dynamicTranslationService.translateText({ text: 'IR123456', targetLocale: 'en', fieldName: 'iban' });
    expect(password.error).toBe('FIELD_SECURITY_RESTRICTED');
    expect(salary.error).toBe('FIELD_AI_RESTRICTED');
    expect(iban.error).toBe('FIELD_AI_RESTRICTED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not translate IDs, SKUs or measurements', async () => {
    dynamicTranslationService.toggleTranslation(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const text of ['P-101', 'FEED-EXT-4.5MM', '7.2 mg/L']) {
      const result = await dynamicTranslationService.translateText({ text, sourceLocale: 'fa', targetLocale: 'en' });
      expect(result.translatedText).toBe(text);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('distinguishes common Persian and Arabic script examples', () => {
    expect(dynamicTranslationService.detectSourceLocale('پرورش ماهیان خاویاری')).toBe('fa');
    expect(dynamicTranslationService.detectSourceLocale('إدارة تربية الأسماك')).toBe('ar');
    expect(dynamicTranslationService.detectSourceLocale('Русский текст')).toBe('ru');
  });

  it('falls back to original text on network or quota failures', async () => {
    dynamicTranslationService.toggleTranslation(true);
    const original = 'یادداشت روزانه استخر';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));
    const networkResult = await dynamicTranslationService.translateText({ text: original, sourceLocale: 'fa', targetLocale: 'de', fieldName: 'notes' });
    expect(networkResult.translatedText).toBe(original);
    expect(networkResult.status).toBe('offline');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ success: false, error: 'quota exhausted' }),
    } as Response);
    const quotaResult = await dynamicTranslationService.translateText({ text: `${original} ۲`, sourceLocale: 'fa', targetLocale: 'de', fieldName: 'notes' });
    expect(quotaResult.translatedText).toBe(`${original} ۲`);
    expect(quotaResult.status).toBe('offline');
  });
});
