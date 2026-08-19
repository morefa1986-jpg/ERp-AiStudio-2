import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../i18n';
import {
  dynamicTranslationService,
  DynamicTranslationRequest,
  DynamicTranslationResult,
  TranslationStatus,
} from '../services/dynamicTranslationService';

export interface UseDynamicTranslationOptions {
  text: string;
  sourceLocale?: string;
  targetLocale?: string;
  contentType?: string;
  recordId?: string;
  fieldName?: string;
  enabled?: boolean;
}

export interface UseDynamicTranslationReturn {
  translatedText: string;
  originalText: string;
  displayLocale: string;
  status: TranslationStatus;
  isTranslating: boolean;
  isCached: boolean;
  isOfflineFallback: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

export function useDynamicTranslation({
  text,
  sourceLocale,
  targetLocale: explicitTargetLocale,
  contentType = 'user_note',
  recordId,
  fieldName,
  enabled = true,
}: UseDynamicTranslationOptions): UseDynamicTranslationReturn {
  const { language } = useI18n();
  const targetLocale = explicitTargetLocale || language;

  const [translatedText, setTranslatedText] = useState<string>(text);
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();

  // Stale translation prevention token
  const requestVersionRef = useRef<number>(0);
  const activeTargetLocaleRef = useRef<string>(targetLocale);
  activeTargetLocaleRef.current = targetLocale;

  const executeTranslation = useCallback(
    async (forceRefresh = false) => {
      const rawText = text || '';

      // If text is empty or translation is disabled
      if (!rawText.trim() || !enabled) {
        setTranslatedText(rawText);
        setStatus('idle');
        setIsCached(false);
        setError(undefined);
        return;
      }

      // Check if source matches target
      const resolvedSource = sourceLocale || dynamicTranslationService.detectSourceLocale(rawText);
      if (resolvedSource === targetLocale) {
        setTranslatedText(rawText);
        setStatus('idle');
        setIsCached(true);
        setError(undefined);
        return;
      }

      const currentVersion = ++requestVersionRef.current;
      setStatus('loading');
      setError(undefined);

      try {
        const result = await dynamicTranslationService.translateText({
          text: rawText,
          sourceLocale: resolvedSource,
          targetLocale,
          contentType,
          recordId,
          fieldName,
          forceRefresh,
        });

        // Abort check: verify this request is still for the active target locale and latest version
        if (
          currentVersion === requestVersionRef.current &&
          activeTargetLocaleRef.current === targetLocale
        ) {
          setTranslatedText(result.translatedText || rawText);
          setStatus(result.status);
          setIsCached(result.isCached);
          setIsOfflineFallback(Boolean(result.fromOfflineFallback));
          setError(result.error);
        }
      } catch (err: any) {
        if (currentVersion === requestVersionRef.current) {
          // Graceful fallback to original text on any unexpected error
          setTranslatedText(rawText);
          setStatus('failed');
          setError(err?.message || 'Translation error');
        }
      }
    },
    [text, sourceLocale, targetLocale, contentType, recordId, fieldName, enabled]
  );

  useEffect(() => {
    executeTranslation(false);
  }, [executeTranslation]);

  return {
    translatedText,
    originalText: text,
    displayLocale: targetLocale,
    status,
    isTranslating: status === 'loading',
    isCached,
    isOfflineFallback,
    error,
    refetch: () => executeTranslation(true),
  };
}
