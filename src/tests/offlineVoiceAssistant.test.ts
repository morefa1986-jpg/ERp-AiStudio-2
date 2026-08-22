import { describe, expect, it } from 'vitest';
import { getSpeechRecognitionConstructor, isMobileVoiceDevice, normalizeVoiceTranscript, supportsLocalSpeechHint, voiceLocaleFor, type SpeechRecognitionLike } from '../services/offlineVoiceAssistant';

describe('offline voice assistant service', () => {
  it('maps supported UI languages to speech locales', () => {
    expect(voiceLocaleFor('fa')).toBe('fa-IR');
    expect(voiceLocaleFor('en')).toBe('en-US');
    expect(voiceLocaleFor('ar')).toBe('ar-SA');
  });

  it('detects browser speech recognition without paid APIs', () => {
    class FakeRecognition {}
    expect(getSpeechRecognitionConstructor({ SpeechRecognition: FakeRecognition as never })).toBe(FakeRecognition);
    expect(getSpeechRecognitionConstructor({})).toBeNull();
  });

  it('normalizes transcripts and detects local processing support', () => {
    expect(normalizeVoiceTranscript('  ثبت   غذا   ۱۲ کیلو  ')).toBe('ثبت غذا ۱۲ کیلو');
    expect(supportsLocalSpeechHint({ processLocally: false } as SpeechRecognitionLike)).toBe(true);
    expect(supportsLocalSpeechHint({} as SpeechRecognitionLike)).toBe(false);
  });

  it('limits voice UI to iOS and Android mobile/tablet devices', () => {
    const mobileMatch = () => ({ matches: true }) as MediaQueryList;
    expect(isMobileVoiceDevice({
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 } as Navigator,
      matchMedia: mobileMatch,
    })).toBe(true);
    expect(isMobileVoiceDevice({
      navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet)', platform: 'Linux armv8l', maxTouchPoints: 5 } as Navigator,
      matchMedia: mobileMatch,
    })).toBe(true);
    expect(isMobileVoiceDevice({
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 } as Navigator,
      matchMedia: () => ({ matches: false }) as MediaQueryList,
    })).toBe(false);
  });
});
