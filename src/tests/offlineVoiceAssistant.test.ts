import { describe, expect, it } from 'vitest';
import { getSpeechRecognitionConstructor, normalizeVoiceTranscript, supportsLocalSpeechHint, voiceLocaleFor, type SpeechRecognitionLike } from '../services/offlineVoiceAssistant';

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
});
