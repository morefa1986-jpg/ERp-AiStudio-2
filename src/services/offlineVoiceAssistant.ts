import type { LanguageCode } from '../types';

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultLike {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

type VoiceWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function getSpeechRecognitionConstructor(win: Partial<VoiceWindow> = window): SpeechRecognitionConstructor | null {
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function supportsLocalSpeechHint(recognition: SpeechRecognitionLike): boolean {
  return 'processLocally' in recognition;
}

export function voiceLocaleFor(language: LanguageCode): string {
  const locales: Record<LanguageCode, string> = {
    fa: 'fa-IR',
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    ru: 'ru-RU',
    ar: 'ar-SA',
  };
  return locales[language] || 'fa-IR';
}

export function normalizeVoiceTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function insertTranscriptIntoField(field: HTMLInputElement | HTMLTextAreaElement | null, transcript: string): boolean {
  const clean = normalizeVoiceTranscript(transcript);
  if (!field || !field.isConnected || !clean || field.disabled || field.readOnly) return false;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  field.setRangeText(clean, start, end, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.focus();
  return true;
}
