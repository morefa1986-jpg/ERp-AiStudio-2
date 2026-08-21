/**
 * Runtime dynamic-content translation. Static UI i18n never depends on AI.
 * AI translation is opt-in, presentation-only and falls back to original text.
 */

export type FieldPrivacyCategory = 'AI_TRANSLATABLE' | 'AI_RESTRICTED' | 'AI_NEVER_SEND';
export type TranslationStatus = 'idle' | 'loading' | 'translated' | 'cached' | 'failed' | 'offline';

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

const NEVER_SEND_PATTERNS = [/password/i, /token/i, /apikey/i, /api_key/i, /secret/i, /credential/i, /privatekey/i, /creditcard/i, /auth/i];
const RESTRICTED_PATTERNS = [/salary/i, /payroll/i, /balance/i, /confidential/i, /bank/i, /iban/i, /accountnumber/i];
const NON_TRANSLATABLE_PATTERNS = [
  /^P-\d+$/i, /^COLD-[A-Z]-\d+$/i, /^INV-\d+$/i, /^SANAD-\d+$/i, /^FEED-[A-Z0-9.-]+$/i,
  /^\+?\d[\d\s-]{6,}$/, /^[\w.-]+@[\w.-]+\.\w+$/, /^https?:\/\//i,
  /^\d+(\.\d+)?(\s*(kg|g|mg\/L|°C|%|ppt|ppm))?$/i,
];

class DynamicTranslationService {
  private memoryCache = new Map<string, { translatedText: string; timestamp: number; sourceLocale: string; targetLocale: string }>();
  private inFlightRequests = new Map<string, Promise<DynamicTranslationResult>>();
  private storageKey = 'fathi_dynamic_trans_cache_session_v2';
  private settingKey = 'fathi_dynamic_translation_enabled';
  private modelVersion = 'optional-ai-v2';
  private cacheTtlMs = 24 * 60 * 60 * 1000;
  private metrics: TranslationMetrics = { totalRequests: 0, cacheHits: 0, cacheMisses: 0, apiCalls: 0, failures: 0, avgLatencyMs: 0, savedCharacters: 0 };
  private isEnabled = false;

  constructor() {
    try {
      this.isEnabled = typeof window !== 'undefined' && window.sessionStorage.getItem(this.settingKey) === 'true';
    } catch {
      this.isEnabled = false;
    }
    this.loadSessionCache();
  }

  public classifyField(fieldName?: string): FieldPrivacyCategory {
    if (!fieldName) return 'AI_TRANSLATABLE';
    if (NEVER_SEND_PATTERNS.some((p) => p.test(fieldName))) return 'AI_NEVER_SEND';
    if (RESTRICTED_PATTERNS.some((p) => p.test(fieldName))) return 'AI_RESTRICTED';
    return 'AI_TRANSLATABLE';
  }

  public detectSourceLocale(text: string): string {
    const clean = (text || '').trim();
    if (!clean) return 'en';
    if (/[\u06AF\u0686\u067E\u0698\u06CC\u06A9]/.test(clean)) return 'fa';
    // Arabic-specific letters/diacritics commonly absent from Persian prose.
    if (/[ةۀؤإأآئءى]|[ًٌٍَُِّْ]/.test(clean)) return 'ar';
    if (/[\u0600-\u06FF]/.test(clean)) return 'ar';
    if (/[\u0400-\u04FF]/.test(clean)) return 'ru';
    if (/[äöüßÄÖÜ]/.test(clean)) return 'de';
    if (/[éèàçùâêîôûëïü]/.test(clean)) return 'fr';
    if (/[ñáéíóú¿¡]/.test(clean)) return 'es';
    return 'en';
  }

  private generateContentHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

  private buildCacheKey(text: string, sourceLocale: string, targetLocale: string, recordId?: string): string {
    return `trans:${recordId || 'anon'}:${sourceLocale}:${targetLocale}:${this.generateContentHash(text)}:${this.modelVersion}`;
  }

  private loadSessionCache(): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      const raw = window.sessionStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const now = Date.now();
      Object.entries(parsed).forEach(([key, val]: [string, any]) => {
        if (val?.timestamp && now - val.timestamp < this.cacheTtlMs) this.memoryCache.set(key, val);
      });
    } catch {}
  }

  private persistSessionCache(): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      const obj: Record<string, unknown> = {};
      let count = 0;
      for (const [k, v] of this.memoryCache.entries()) { if (count++ >= 250) break; obj[k] = v; }
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch {}
  }

  public invalidateRecordCache(recordId: string): void {
    for (const key of Array.from(this.memoryCache.keys())) if (key.includes(`:${recordId}:`)) this.memoryCache.delete(key);
    this.persistSessionCache();
  }

  public isNonTranslatable(text: string): boolean {
    const trimmed = text.trim();
    return !trimmed || trimmed.length <= 1 || NON_TRANSLATABLE_PATTERNS.some((p) => p.test(trimmed));
  }

  public async translateText(req: DynamicTranslationRequest): Promise<DynamicTranslationResult> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.metrics.totalRequests++;
    const rawText = req.text || '';
    const targetLocale = req.targetLocale;
    const sourceLocale = req.sourceLocale || this.detectSourceLocale(rawText);
    const fallback = (status: TranslationStatus, error?: string): DynamicTranslationResult => ({ translatedText: rawText, sourceLocale, targetLocale, status, isCached: false, error });

    if (!rawText.trim()) return fallback('idle');
    const privacy = this.classifyField(req.fieldName);
    if (privacy !== 'AI_TRANSLATABLE') return fallback('failed', privacy === 'AI_NEVER_SEND' ? 'FIELD_SECURITY_RESTRICTED' : 'FIELD_AI_RESTRICTED');
    if (this.isNonTranslatable(rawText) || sourceLocale === targetLocale || !this.isEnabled) return fallback('idle');

    const cacheKey = this.buildCacheKey(rawText, sourceLocale, targetLocale, req.recordId);
    if (!req.forceRefresh && this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      this.metrics.cacheHits++;
      this.metrics.savedCharacters += rawText.length;
      return { translatedText: cached.translatedText, sourceLocale, targetLocale, status: 'cached', isCached: true };
    }
    this.metrics.cacheMisses++;
    if (this.inFlightRequests.has(cacheKey)) return this.inFlightRequests.get(cacheKey)!;

    const requestPromise = (async (): Promise<DynamicTranslationResult> => {
      try {
        const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('fathi_aqua_session_token') : null;
        if (!token || token.startsWith('lan_session_')) return fallback('offline', 'AI_REQUIRES_ONLINE_AUTHENTICATED_SESSION');
        this.metrics.apiCalls++;
        const response = await fetch('/api/ai/translate-dynamic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: rawText, sourceLocale, targetLocale, contentType: req.contentType || 'user_note' }),
        });
        const data = await response.json().catch(() => ({}));
        const latency = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
        if (!response.ok || !data.success || !data.translations?.length) {
          this.metrics.failures++;
          return { ...fallback(response.status === 402 || response.status === 429 ? 'offline' : 'failed', data.error || 'AI_UNAVAILABLE'), latencyMs: latency };
        }
        const translatedText = data.translations[0].translatedText || rawText;
        this.memoryCache.set(cacheKey, { translatedText, timestamp: Date.now(), sourceLocale, targetLocale });
        this.persistSessionCache();
        return { translatedText, sourceLocale, targetLocale, status: 'translated', isCached: false, fromOfflineFallback: Boolean(data.translations[0].isOfflineFallback), latencyMs: latency };
      } catch (err: any) {
        this.metrics.failures++;
        return fallback('offline', err?.message || 'AI_UNAVAILABLE');
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();
    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  public getMetrics(): TranslationMetrics { return { ...this.metrics }; }
  public toggleTranslation(enabled: boolean): void {
    this.isEnabled = enabled;
    try { if (typeof window !== 'undefined') window.sessionStorage.setItem(this.settingKey, String(enabled)); } catch {}
  }
  public isTranslationEnabled(): boolean { return this.isEnabled; }
  public clearCache(): void {
    this.memoryCache.clear();
    try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(this.storageKey); } catch {}
  }
}

export const dynamicTranslationService = new DynamicTranslationService();
