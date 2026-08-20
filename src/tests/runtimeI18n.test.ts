import { describe, expect, it } from 'vitest';
import { RUNTIME_LOCALES, runtimeMessage, runtimeUnitLabel, runtimeValueLabel } from '../i18n/runtimeMessages';
import { assessWaterSafetyForFeeding } from '../utils/sensorValidation';
import { calculateFeedingRecommendation } from '../utils/feedingEngine';
import type { LanguageCode, Pond } from '../types';

const pond = {
  id: 'p1', number: 'P-1', name: 'Pond 1', hallId: 'h1', speciesId: 's1', fishCount: 100,
  biomassKg: 100, averageWeightKg: 1, capacityM3: 10, capacityCubicMeters: 10,
  waterTemperature: 16, dissolvedOxygen: 7, ph: 7.4, feedingStatus: 'STOPPED',
  dailyMortalityCount: 0, lastBiometryDate: '2026-08-01', lastFeedingKg: 0,
  lastFeedingTime: '', fcr: 0, criticalAlerts: [],
} as unknown as Pond;

describe('Runtime i18n safety and domain labels', () => {
  it('ships runtime messages for all seven locales', () => {
    expect(RUNTIME_LOCALES).toEqual(['fa', 'en', 'de', 'fr', 'es', 'ru', 'ar']);
    RUNTIME_LOCALES.forEach((lang) => {
      expect(runtimeMessage(lang, 'feeding.pondNotFound').length).toBeGreaterThan(3);
      expect(runtimeMessage(lang, 'sensor.waterCritical').length).toBeGreaterThan(3);
      expect(runtimeValueLabel(lang, 'CRITICAL').length).toBeGreaterThan(2);
      expect(runtimeUnitLabel(lang, 'cup250g').length).toBeGreaterThan(1);
    });
  });

  it('does not fall back to Persian for foreign feeding errors', () => {
    const faReason = calculateFeedingRecommendation(pond, [], undefined, 'fa').lockReason;
    (['en', 'de', 'fr', 'es', 'ru', 'ar'] as LanguageCode[]).forEach((lang) => {
      const reason = calculateFeedingRecommendation(pond, [], undefined, lang).lockReason;
      expect(reason).toBeTruthy();
      expect(reason).not.toBe(faReason);
    });
  });

  it('localizes critical water-safety messages using the requested locale', () => {
    const fa = assessWaterSafetyForFeeding({ dissolvedOxygen: 3.2, waterTemperature: 16, ph: 7.2, language: 'fa' });
    const en = assessWaterSafetyForFeeding({ dissolvedOxygen: 3.2, waterTemperature: 16, ph: 7.2, language: 'en' });
    const de = assessWaterSafetyForFeeding({ dissolvedOxygen: 3.2, waterTemperature: 16, ph: 7.2, language: 'de' });
    expect(fa.isSafeForFeeding).toBe(false);
    expect(en.feedingProhibitionReason).toContain('feeding threshold');
    expect(de.feedingProhibitionReason).toContain('Fütterungsgrenze');
    expect(en.feedingProhibitionReason).not.toBe(fa.feedingProhibitionReason);
  });
});
