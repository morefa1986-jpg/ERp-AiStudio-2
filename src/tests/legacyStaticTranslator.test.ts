import { describe, expect, it } from 'vitest';
import { buildLegacyStaticTranslationMap, translateLegacyStaticText } from '../i18n/legacyStaticTranslator';

describe('legacy static UI translator', () => {
  it('builds deterministic Persian-to-locale maps from matching dictionaries', () => {
    const map = buildLegacyStaticTranslationMap(
      { nav: { dashboard: 'داشبورد مرکزی', ponds: 'استخرها' }, save: 'ذخیره' },
      { nav: { dashboard: 'Central Dashboard', ponds: 'Ponds' }, save: 'Save' },
    );
    expect(map.get('داشبورد مرکزی')).toBe('Central Dashboard');
    expect(map.get('استخرها')).toBe('Ponds');
    expect(map.get('ذخیره')).toBe('Save');
  });

  it('replaces known hard-coded Persian substrings without AI or network calls', () => {
    const map = new Map([
      ['داشبورد مرکزی', 'Central Dashboard'],
      ['ذخیره', 'Save'],
    ]);
    expect(translateLegacyStaticText('باز کردن داشبورد مرکزی و ذخیره', map, 'en')).toBe('باز کردن Central Dashboard و Save');
  });

  it('preserves Persian source text in fa locale', () => {
    const map = new Map([['ذخیره', 'Save']]);
    expect(translateLegacyStaticText('ذخیره', map, 'fa')).toBe('ذخیره');
  });
});
