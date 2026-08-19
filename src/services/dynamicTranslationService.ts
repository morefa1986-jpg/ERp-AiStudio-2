/**
 * Fathi Aqua Super ERP - Runtime Dynamic AI Translation Service
 * 
 * Manages presentation-only dynamic text translation via Gemini without
 * ever mutating the original underlying database entities.
 */

export type FieldPrivacyCategory = 'AI_TRANSLATABLE' | 'AI_RESTRICTED' | 'AI_NEVER_SEND';

export type TranslationStatus =
  | 'idle'
  | 'loading'
  | 'translated'
  | 'cached'
  | 'failed'
  | 'offline';

export interface DynamicTranslationRequest {
  recordId?: string;
  text: string;
  sourceLocale?: string;
  targetLocale: string;
  contentType?: string;
  fieldName?: string;
  forceRefresh?: boolean;
}

export interface DynamicTranslationResult {
  translatedText: string;
  sourceLocale: string;
  targetLocale: string;
  status: TranslationStatus;
  isCached: boolean;
  fromOfflineFallback?: boolean;
  error?: string;
  latencyMs?: number;
}

export interface TranslationMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  failures: number;
  avgLatencyMs: number;
  savedCharacters: number;
}

// Blocked field patterns that MUST NEVER be sent to AI
const NEVER_SEND_PATTERNS = [
  /password/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /secret/i,
  /credential/i,
  /privatekey/i,
  /creditcard/i,
  /auth/i,
];

// Patterns that do not require translation (IDs, codes, numbers)
const NON_TRANSLATABLE_PATTERNS = [
  /^P-\d+$/i, // Pond codes
  /^COLD-[A-Z]-\d+$/i, // Cold storage codes
  /^INV-\d+$/i, // Invoice numbers
  /^SANAD-\d+$/i, // Journal numbers
  /^FEED-[A-Z0-9.-]+$/i, // SKU
  /^\+?\d[\d\s-]{6,}$/, // Phone numbers
  /^[\w.-]+@[\w.-]+\.\w+$/, // Emails
  /^https?:\/\//i, // URLs
  /^\d+(\.\d+)?(\s*(kg|g|mg\/L|°C|%|ppt|ppm))?$/i, // Pure numeric / units
];

class DynamicTranslationService {
  private memoryCache = new Map<string, { translatedText: string; timestamp: number; sourceLocale: string; targetLocale: string }>();
  private inFlightRequests = new Map<string, Promise<DynamicTranslationResult>>();
  private storageKey = 'fathi_dynamic_trans_cache_v1';
  private modelVersion = 'gemini-2.5-flash-v1';
  private cacheTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 days cache validity

  private metrics: TranslationMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    failures: 0,
    avgLatencyMs: 0,
    savedCharacters: 0,
  };

  private isEnabled: boolean = true;

  constructor() {
    this.loadPersistentCache();
  }

  /**
   * Classify whether a field is safe for AI dynamic translation
   */
  public classifyField(fieldName?: string): FieldPrivacyCategory {
    if (!fieldName) return 'AI_TRANSLATABLE';
    for (const pattern of NEVER_SEND_PATTERNS) {
      if (pattern.test(fieldName)) {
        return 'AI_NEVER_SEND';
      }
    }
    if (/salary|payroll|balance|confidential/i.test(fieldName)) {
      return 'AI_RESTRICTED';
    }
    return 'AI_TRANSLATABLE';
  }

  /**
   * Lightweight source language detector
   */
  public detectSourceLocale(text: string): string {
    if (!text || typeof text !== 'string') return 'en';
    const clean = text.trim();

    // Check for Persian specific characters (گ چ پ ژ)
    if (/[\u06AF\u0686\u067E\u0698]/.test(clean)) return 'fa';
    // General Arabic/Persian Unicode range
    if (/[\u0600-\u06FF]/.test(clean)) return 'fa';
    // Cyrillic (Russian)
    if (/[\u0400-\u04FF]/.test(clean)) return 'ru';
    // German specific characters (ä ö ü ß)
    if (/[äöüßÄÖÜ]/.test(clean)) return 'de';
    // French specific characters (é è à ç ù â ê î ô û)
    if (/[éèàçùâêîôûëïü]/.test(clean)) return 'fr';
    // Spanish specific characters (ñ á é í ó ú ¿ ¡)
    if (/[ñáéíóú¿¡]/.test(clean)) return 'es';

    return 'en';
  }

  /**
   * Generate robust cryptographic-style hash string for cache key
   */
  private generateContentHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Build unique cache key incorporating content identity, hash, locales, and model version
   */
  private buildCacheKey(text: string, sourceLocale: string, targetLocale: string, recordId?: string): string {
    const textHash = this.generateContentHash(text);
    return `trans:${recordId || 'anon'}:${sourceLocale}:${targetLocale}:${textHash}:${this.modelVersion}`;
  }

  /**
   * Load cached entries from local storage into memory
   */
  private loadPersistentCache(): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const raw = window.localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const now = Date.now();
          Object.entries(parsed).forEach(([key, val]: [string, any]) => {
            if (val && val.timestamp && now - val.timestamp < this.cacheTtlMs) {
              this.memoryCache.set(key, val);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[DynamicTranslationService] Could not load persistent cache:', e);
    }
  }

  /**
   * Save current cache to local storage
   */
  private persistCache(): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const obj: Record<string, any> = {};
        let count = 0;
        // Keep last 1000 items in localStorage
        for (const [k, v] of this.memoryCache.entries()) {
          if (count++ > 1000) break;
          obj[k] = v;
        }
        window.localStorage.setItem(this.storageKey, JSON.stringify(obj));
      }
    } catch (e) {
      console.warn('[DynamicTranslationService] Could not persist cache:', e);
    }
  }

  /**
   * Invalidate translation cache for a specific record or text
   */
  public invalidateRecordCache(recordId: string): void {
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.includes(`:${recordId}:`)) {
        this.memoryCache.delete(key);
      }
    }
    this.persistCache();
  }

  /**
   * Check if string is a code, ID, or raw measurement that must NOT be translated
   */
  public isNonTranslatable(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length <= 1) return true;
    for (const pattern of NON_TRANSLATABLE_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }
    return false;
  }

  /**
   * Centralized Dynamic Translation Method
   */
  public async translateText(req: DynamicTranslationRequest): Promise<DynamicTranslationResult> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    const rawText = req.text || '';
    if (!rawText.trim()) {
      return {
        translatedText: rawText,
        sourceLocale: req.sourceLocale || 'en',
        targetLocale: req.targetLocale,
        status: 'idle',
        isCached: false,
      };
    }

    // 1. Security Check: Never send sensitive/secret fields
    const privacy = this.classifyField(req.fieldName);
    if (privacy === 'AI_NEVER_SEND') {
      console.warn(`[DynamicTranslationService] Security block: Refusing to translate sensitive field '${req.fieldName}'`);
      return {
        translatedText: rawText,
        sourceLocale: req.sourceLocale || 'en',
        targetLocale: req.targetLocale,
        status: 'failed',
        isCached: false,
        error: 'FIELD_SECURITY_RESTRICTED',
      };
    }

    // 2. Non-translatable format check (IDs, SKUs, numbers, codes)
    if (this.isNonTranslatable(rawText)) {
      return {
        translatedText: rawText,
        sourceLocale: req.sourceLocale || 'en',
        targetLocale: req.targetLocale,
        status: 'idle',
        isCached: true,
      };
    }

    // 3. Determine Source Locale
    const sourceLocale = req.sourceLocale || this.detectSourceLocale(rawText);
    const targetLocale = req.targetLocale;

    // 4. If Source equals Target, no translation needed
    if (sourceLocale === targetLocale) {
      return {
        translatedText: rawText,
        sourceLocale,
        targetLocale,
        status: 'idle',
        isCached: true,
      };
    }

    // 5. If Translation is disabled globally, return original
    if (!this.isEnabled) {
      return {
        translatedText: rawText,
        sourceLocale,
        targetLocale,
        status: 'idle',
        isCached: false,
      };
    }

    const cacheKey = this.buildCacheKey(rawText, sourceLocale, targetLocale, req.recordId);

    // 6. Memory & LocalStorage Cache Check
    if (!req.forceRefresh && this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      this.metrics.cacheHits++;
      this.metrics.savedCharacters += rawText.length;
      return {
        translatedText: cached.translatedText,
        sourceLocale,
        targetLocale,
        status: 'cached',
        isCached: true,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }

    this.metrics.cacheMisses++;

    // 7. In-flight Request Deduplication
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    // 8. Execute Translation Request (with in-flight deduplication)
    const requestPromise = (async (): Promise<DynamicTranslationResult> => {
      try {
        this.metrics.apiCalls++;
        const response = await fetch('/api/ai/translate-dynamic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: rawText,
            sourceLocale,
            targetLocale,
            contentType: req.contentType || 'user_note',
          }),
        });

        const data = await response.json();
        const latency = Math.round(performance.now() - startTime);

        if (data.success && data.translations && data.translations.length > 0) {
          const item = data.translations[0];
          const translatedText = item.translatedText || rawText;

          // Save to Memory & Persistent Cache
          this.memoryCache.set(cacheKey, {
            translatedText,
            timestamp: Date.now(),
            sourceLocale,
            targetLocale,
          });
          this.persistCache();

          return {
            translatedText,
            sourceLocale,
            targetLocale,
            status: 'translated',
            isCached: false,
            fromOfflineFallback: Boolean(item.isOfflineFallback),
            latencyMs: latency,
          };
        } else {
          // Graceful fallback to original
          this.metrics.failures++;
          return {
            translatedText: rawText,
            sourceLocale,
            targetLocale,
            status: 'failed',
            isCached: false,
            error: data.error || 'Translation response empty',
            latencyMs: latency,
          };
        }
      } catch (err: any) {
        this.metrics.failures++;
        // Network or Offline Error: Gracefully fallback to original text without throwing
        return {
          translatedText: rawText,
          sourceLocale,
          targetLocale,
          status: 'offline',
          isCached: false,
          error: err?.message || 'Network offline or server unavailable',
          latencyMs: Math.round(performance.now() - startTime),
        };
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  public getMetrics(): TranslationMetrics {
    return { ...this.metrics };
  }

  public toggleTranslation(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public isTranslationEnabled(): boolean {
    return this.isEnabled;
  }

  public clearCache(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.removeItem(this.storageKey);
    }
  }
}

export const dynamicTranslationService = new DynamicTranslationService();
