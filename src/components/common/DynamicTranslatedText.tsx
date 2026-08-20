import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useDynamicTranslation } from '../../hooks/useDynamicTranslation';
import { Sparkles, Copy, Check, Info, Globe2 } from 'lucide-react';

export interface DynamicTranslatedTextProps {
  text: string;
  sourceLocale?: string;
  targetLocale?: string;
  recordId?: string;
  fieldName?: string;
  contentType?: string;
  className?: string;
  showIndicator?: boolean;
  inline?: boolean;
}

export const DynamicTranslatedText: React.FC<DynamicTranslatedTextProps> = ({
  text,
  sourceLocale,
  targetLocale,
  recordId,
  fieldName,
  contentType,
  className = '',
  showIndicator = false,
  inline = false,
}) => {
  const { t } = useI18n();
  const {
    translatedText,
    originalText,
    status,
    isTranslating,
    isCached,
    isOfflineFallback,
  } = useDynamicTranslation({
    text,
    sourceLocale,
    targetLocale,
    recordId,
    fieldName,
    contentType,
  });

  const [copied, setCopied] = useState<boolean>(false);
  const [showOriginalTooltip, setShowOriginalTooltip] = useState<boolean>(false);

  const isActuallyTranslated =
    status === 'translated' || (status === 'cached' && translatedText !== originalText);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper className={`relative group/trans ${className}`}>
      {/* Loading state indicator */}
      {isTranslating && (
        <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400/80 mr-1.5 ml-1.5 animate-pulse">
          <Sparkles className="w-3 h-3 animate-spin" />
          <span className="opacity-75">{t('dynamicTrans.translating')}</span>
        </span>
      )}

      {/* Escaped safe text output */}
      <span className={isTranslating ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {translatedText}
      </span>

      {/* Optional Subtle AI Translation indicator badge */}
      {showIndicator && isActuallyTranslated && (
        <span
          className="inline-flex items-center gap-1 mx-1.5 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 cursor-help"
          title={t('dynamicTrans.aiBadgeTitle', { original: originalText })}
          onMouseEnter={() => setShowOriginalTooltip(true)}
          onMouseLeave={() => setShowOriginalTooltip(false)}
        >
          <Sparkles className="w-2.5 h-2.5" />
          AI
        </span>
      )}

      {/* Offline indicator if fallback was used */}
      {isOfflineFallback && (
        <span
          className="inline-flex items-center gap-1 mx-1.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700"
          title={t('dynamicTrans.offlineBadgeTitle')}
        >
          <Globe2 className="w-2.5 h-2.5" />
          Offline
        </span>
      )}

      {/* Hover actions: Copy translated text & peek original */}
      {isActuallyTranslated && (
        <span className="inline-flex items-center gap-1 opacity-0 group-hover/trans:opacity-100 transition-opacity ml-1.5 mr-1.5">
          <button
            type="button"
            onClick={handleCopy}
            title={t('dynamicTrans.copyTitle')}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </span>
      )}

      {/* Original text tooltip when hovering */}
      {showOriginalTooltip && (
        <div className="absolute bottom-full mb-1 left-0 z-50 p-2 text-xs bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-slate-300 max-w-xs whitespace-normal pointer-events-none animate-fadeIn">
          <div className="text-[10px] text-slate-500 font-bold mb-0.5">{t('dynamicTrans.originalTextLabel')}</div>
          <div>{originalText}</div>
        </div>
      )}
    </Wrapper>
  );
};
