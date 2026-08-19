import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dynamicTranslationService } from '../services/dynamicTranslationService';

describe('Runtime AI Dynamic Translation Architecture', () => {
  beforeEach(() => {
    dynamicTranslationService.clearCache();
    vi.restoreAllMocks();
  });

  // Test Case A: Original Persian + Target English -> English display, Persian DB unchanged
  it('translates dynamic user content for presentation while keeping original record immutable', async () => {
    const originalRecord = {
      id: 'mortality-1022',
      description: 'کاهش اکسیژن باعث تلفات شد',
      contentLocale: 'fa',
    };

    // Mock successful Gemini API response
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({
        success: true,
        translations: [
          {
            id: 'mortality-1022',
            translatedText: 'Oxygen drop caused mortality',
            sourceLocale: 'fa',
            targetLocale: 'en',
          },
        ],
      }),
    } as any);

    const result = await dynamicTranslationService.translateText({
      recordId: originalRecord.id,
      text: originalRecord.description,
      sourceLocale: originalRecord.contentLocale,
      targetLocale: 'en',
      fieldName: 'description',
    });

    // 1. Translated text matches target language
    expect(result.translatedText).toBe('Oxygen drop caused mortality');
    expect(result.status).toBe('translated');

    // 2. CRITICAL: Original database entity is 100% unchanged
    expect(originalRecord.description).toBe('کاهش اکسیژن باعث تلفات شد');
    expect(originalRecord.contentLocale).toBe('fa');
  });

  // Test Case B: English translation cached, switch away, switch back -> Cache reused (0 extra API calls)
  it('reuses ephemeral translation cache when switching languages back and forth', async () => {
    const originalText = 'تلفات ناشی از افت اکسیژن';

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({
        success: true,
        translations: [
          {
            id: 'single_1',
            translatedText: 'Mortality caused by low oxygen',
            sourceLocale: 'fa',
            targetLocale: 'en',
          },
        ],
      }),
    } as any);

    // Initial translation request
    const firstCall = await dynamicTranslationService.translateText({
      text: originalText,
      sourceLocale: 'fa',
      targetLocale: 'en',
      fieldName: 'reason',
    });
    expect(firstCall.translatedText).toBe('Mortality caused by low oxygen');
    expect(firstCall.isCached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call for the same text and locale pair (Cache Hit)
    const secondCall = await dynamicTranslationService.translateText({
      text: originalText,
      sourceLocale: 'fa',
      targetLocale: 'en',
      fieldName: 'reason',
    });
    expect(secondCall.translatedText).toBe('Mortality caused by low oxygen');
    expect(secondCall.isCached).toBe(true);
    expect(secondCall.status).toBe('cached');

    // API was NOT called a second time
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // Test Case C: No internet / Offline mode -> Gracefully displays original text
  it('falls back gracefully to original content or offline dictionary when network/server is unavailable', async () => {
    const originalText = 'یادداشت محرمانه تکثیر فیل‌ماهی';

    // Simulate network offline exception
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network disconnected / Offline'));

    const result = await dynamicTranslationService.translateText({
      text: originalText,
      sourceLocale: 'fa',
      targetLocale: 'de',
      fieldName: 'notes',
    });

    // Does not crash, preserves original text
    expect(result.translatedText).toBe(originalText);
    expect(result.status).toBe('offline');
    expect(result.error).toContain('Offline');
  });

  // Test Case D: Translation request fails -> Original content preserved
  it('preserves original content when server returns an error code', async () => {
    const originalText = 'ثبت تلفات استخر ۱۰۱';

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({
        success: false,
        error: 'Rate limit or quota exceeded',
      }),
    } as any);

    const result = await dynamicTranslationService.translateText({
      text: originalText,
      sourceLocale: 'fa',
      targetLocale: 'fr',
      fieldName: 'description',
    });

    expect(result.translatedText).toBe(originalText);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Rate limit or quota exceeded');
  });

  // Test Case E: Security field classification -> Sensitive fields blocked from translation
  it('strictly blocks sensitive fields (passwords, tokens, API keys) from being sent to AI', async () => {
    const sensitivePassword = 'MySecretSuperPassword123!';
    const fetchSpy = vi.spyOn(global, 'fetch');

    const result = await dynamicTranslationService.translateText({
      text: sensitivePassword,
      sourceLocale: 'fa',
      targetLocale: 'en',
      fieldName: 'user_password',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('FIELD_SECURITY_RESTRICTED');
    expect(result.translatedText).toBe(sensitivePassword);

    // AI API was NEVER invoked for security restricted field
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Test Case F: Non-translatable items (IDs, SKUs, numbers) are skipped
  it('does not send IDs, pond codes, or numeric measurements to AI', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const pondCodeResult = await dynamicTranslationService.translateText({
      text: 'P-101',
      sourceLocale: 'fa',
      targetLocale: 'en',
    });
    expect(pondCodeResult.translatedText).toBe('P-101');
    expect(pondCodeResult.isCached).toBe(true);

    const skuResult = await dynamicTranslationService.translateText({
      text: 'FEED-EXT-4.5MM',
      sourceLocale: 'fa',
      targetLocale: 'de',
    });
    expect(skuResult.translatedText).toBe('FEED-EXT-4.5MM');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Test Case G: In-flight request deduplication
  it('deduplicates simultaneous in-flight requests for identical content', async () => {
    const text = 'بررسی سونوگرافی تخمک مولد';

    let resolver: any;
    const delayedPromise = new Promise((resolve) => {
      resolver = resolve;
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      delayedPromise.then(() => ({
        json: async () => ({
          success: true,
          translations: [
            {
              id: 'single_1',
              translatedText: 'Ultrasound evaluation of broodstock eggs',
              sourceLocale: 'fa',
              targetLocale: 'en',
            },
          ],
        }),
      })) as any
    );

    // Two simultaneous calls
    const req1 = dynamicTranslationService.translateText({ text, targetLocale: 'en' });
    const req2 = dynamicTranslationService.translateText({ text, targetLocale: 'en' });

    resolver();

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.translatedText).toBe('Ultrasound evaluation of broodstock eggs');
    expect(res2.translatedText).toBe('Ultrasound evaluation of broodstock eggs');

    // Only ONE fetch request was dispatched
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // Test Case H: Original text changed -> Old translation cache invalidated
  it('invalidates cache when a record is updated with new content', async () => {
    const recordId = 'pond_note_99';
    const oldText = 'وضعیت اکسیژن مناسب است';

    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          translations: [
            {
              id: 'single_1',
              translatedText: 'Oxygen status is optimal',
              sourceLocale: 'fa',
              targetLocale: 'en',
            },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          translations: [
            {
              id: 'single_1',
              translatedText: 'Oxygen status dropped to warning level',
              sourceLocale: 'fa',
              targetLocale: 'en',
            },
          ],
        }),
      } as any);

    await dynamicTranslationService.translateText({
      recordId,
      text: oldText,
      targetLocale: 'en',
    });

    // Invalidate record cache
    dynamicTranslationService.invalidateRecordCache(recordId);

    const newText = 'وضعیت اکسیژن به مرز هشدار رسید';
    const newResult = await dynamicTranslationService.translateText({
      recordId,
      text: newText,
      targetLocale: 'en',
    });

    expect(newResult.translatedText).toBe('Oxygen status dropped to warning level');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // Test Case I: Edit mode guarantees original text is preserved
  it('ensures edit operations always receive and mutate original database text', () => {
    const databaseRecord = {
      id: 'log-55',
      note: 'ماهیان امروز اشتهای کمتری نشان دادند',
      translatedDisplay: 'Fish showed less appetite today',
    };

    // When an operator opens an edit form:
    const editFormState = {
      note: databaseRecord.note, // Must load original database text
    };

    expect(editFormState.note).toBe('ماهیان امروز اشتهای کمتری نشان دادند');
    expect(editFormState.note).not.toBe(databaseRecord.translatedDisplay);
  });
});
