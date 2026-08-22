import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useI18n } from '../../i18n';
import { isSmartEditableTarget } from '../../utils/smartInputFocus';
import {
  getSpeechRecognitionConstructor,
  insertTranscriptIntoField,
  normalizeVoiceTranscript,
  supportsLocalSpeechHint,
  voiceLocaleFor,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from '../../services/offlineVoiceAssistant';

type VoiceStatus = 'ready' | 'listening' | 'unsupported' | 'inserted' | 'noTarget' | 'error';

export const OfflineVoiceAssistant: React.FC = () => {
  const { t, language, dir } = useI18n();
  const [status, setStatus] = useState<VoiceStatus>('ready');
  const [transcript, setTranscript] = useState('');
  const [localHint, setLocalHint] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isSmartEditableTarget(event.target)) lastFieldRef.current = event.target;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setStatus(getSpeechRecognitionConstructor(window) ? 'ready' : 'unsupported');
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus('ready');
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const Recognition = getSpeechRecognitionConstructor(window);
    if (!Recognition) {
      setStatus('unsupported');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = voiceLocaleFor(language);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    if (supportsLocalSpeechHint(recognition)) {
      recognition.processLocally = true;
      setLocalHint(true);
    } else {
      setLocalHint(false);
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const result = event.results[event.resultIndex];
      const raw = result?.[0]?.transcript || result?.item?.(0)?.transcript || '';
      const clean = normalizeVoiceTranscript(raw);
      setTranscript(clean);
      setStatus(insertTranscriptIntoField(lastFieldRef.current, clean) ? 'inserted' : 'noTarget');
    };
    recognition.onerror = () => setStatus('error');
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((current) => current === 'listening' ? 'ready' : current);
    };

    recognitionRef.current = recognition;
    setStatus('listening');
    recognition.start();
  };

  const isListening = status === 'listening';
  const message = status === 'unsupported'
    ? t('voiceAssistant.unsupported')
    : status === 'listening'
      ? t('voiceAssistant.listening')
      : status === 'inserted'
        ? t('voiceAssistant.inserted')
        : status === 'noTarget'
          ? t('voiceAssistant.noTarget')
          : status === 'error'
            ? t('voiceAssistant.error')
            : t('voiceAssistant.ready');

  return (
    <div className={`fixed bottom-4 ${dir === 'rtl' ? 'left-4' : 'right-4'} z-50 max-w-[290px]`}>
      <div className="bg-[#121214]/95 border border-[#27272A] shadow-2xl rounded-2xl p-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={isListening ? t('voiceAssistant.stop') : t('voiceAssistant.start')}
            onPointerDown={(event) => event.preventDefault()}
            onClick={isListening ? stopListening : startListening}
            disabled={status === 'unsupported'}
            className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
              isListening
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : status === 'unsupported'
                  ? 'bg-[#18181B] text-[#52525B] border-[#27272A] cursor-not-allowed'
                  : 'bg-[#D4AF37] text-black border-[#D4AF37]'
            }`}
          >
            {status === 'unsupported' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">{t('voiceAssistant.title')}</div>
            <div className="text-[10px] text-[#A1A1AA] leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-[#71717A] leading-relaxed">
          {localHint ? t('voiceAssistant.localHint') : t('voiceAssistant.subtitle')}
        </div>
        {transcript && (
          <div className="mt-2 rounded-lg bg-[#18181B] border border-[#27272A] px-2 py-1.5 text-[10px] text-[#D4D4D8] line-clamp-2">
            {t('voiceAssistant.transcript')}: {transcript}
          </div>
        )}
      </div>
    </div>
  );
};
