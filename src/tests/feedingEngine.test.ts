import { describe, it, expect } from 'vitest';
import { calculateFeedingRecommendation, normalizeFeedAmountToKg, validateFeedingSubmission } from '../utils/feedingEngine';
import { Pond, SturgeonSpecies, InventoryItem } from '../types';

describe('Feeding Engine - Domain Safety & Unit Normalization', () => {
  const mockSpecies: SturgeonSpecies[] = [
    {
      id: 'sp_beluga',
      nameFa: 'فیل‌ماهی',
      nameEn: 'Beluga Sturgeon',
      scientificName: 'Huso huso',
      feedingProfileCoeff: 1.0,
      optimalTempMin: 14,
      optimalTempMax: 20,
      criticalDoThreshold: 4.0,
      harvestAgeMonths: 48,
    },
  ];

  const mockSafePond: Pond = {
    id: 'pond_1',
    hallId: 'hall_1',
    name: 'استخر ۱',
    speciesId: 'sp_beluga',
    fishCount: 1000,
    biomassKg: 5000,
    averageWeightKg: 5.0,
    waterVolumeM3: 50,
    dissolvedOxygen: 7.2,
    waterTemperature: 16.5,
    ph: 7.5,
    feedingStatus: 'NORMAL',
    fcr: 1.1,
  };

  const mockInventory: InventoryItem[] = [
    {
      id: 'inv_feed_1',
      name: 'پلت رشد خاویاری ۴ میلی‌متر',
      category: 'Feed (خوراک)',
      sku: 'FEED-GROW-4MM',
      quantity: 500,
      unit: 'kg',
      minimumStockThreshold: 100,
      purchasePricePerUnit: 1200000,
      warehouseLocation: 'انبار خوراک A',
      supplier: 'Feed Co',
      status: 'Adequate',
    },
  ];

  it('calculates optimal recommended ration for safe pond conditions', () => {
    const result = calculateFeedingRecommendation(mockSafePond, mockSpecies);
    expect(result.isLocked).toBe(false);
    expect(result.recommendedKg).toBeGreaterThan(0);
    // Base rate ~0.009 * 5000 = 45 kg
    expect(result.recommendedKg).toBeCloseTo(45.0, 1);
  });

  it('strictly locks and zeroes recommendation if pond feedingStatus is STOPPED', () => {
    const stoppedPond: Pond = {
      ...mockSafePond,
      feedingStatus: 'STOPPED',
      stopFeedingReason: 'DO < 4.0 mg/L',
    };
    const result = calculateFeedingRecommendation(stoppedPond, mockSpecies);
    expect(result.isLocked).toBe(true);
    expect(result.recommendedKg).toBe(0);
  });

  it('strictly locks and zeroes recommendation if active veterinary treatment is present', () => {
    const treatedPond: Pond = {
      ...mockSafePond,
      activeTreatmentId: 'trt_active_1',
    };
    const activeTreatment = {
      id: 'trt_active_1',
      medicineName: 'Formalin 20ppm',
      status: 'Active' as const,
    };
    const result = calculateFeedingRecommendation(treatedPond, mockSpecies, activeTreatment);
    expect(result.isLocked).toBe(true);
    expect(result.recommendedKg).toBe(0);
    expect(result.lockReason).toContain('Formalin 20ppm');
  });

  it('strictly prohibits feeding when dissolved oxygen is below 4.0 mg/L', () => {
    const hypoxicPond: Pond = {
      ...mockSafePond,
      dissolvedOxygen: 3.4,
    };
    const result = calculateFeedingRecommendation(hypoxicPond, mockSpecies);
    expect(result.isLocked).toBe(true);
    expect(result.recommendedKg).toBe(0);
  });

  it('correctly normalizes different measurement units into kilograms', () => {
    expect(normalizeFeedAmountToKg(500, 'g')).toBe(0.5);
    expect(normalizeFeedAmountToKg(25, 'kg')).toBe(25);
    expect(normalizeFeedAmountToKg(2, 'ton')).toBe(2000);
    expect(normalizeFeedAmountToKg(2, 'bag_25kg')).toBe(50);
  });

  it('validates feeding submission against inventory stock', () => {
    const validSubmission = {
      pondId: 'pond_1',
      feedTypeSku: 'FEED-GROW-4MM',
      actualAmountKg: 50,
      unit: 'kg' as const,
      dissolvedOxygen: 7.0,
      waterTemperature: 16.0,
      operatorName: 'Ali Rezaei',
    };

    const validResult = validateFeedingSubmission(validSubmission, mockSafePond, mockInventory);
    expect(validResult.success).toBe(true);
    expect(validResult.normalizedAmountKg).toBe(50);

    const excessiveSubmission = {
      ...validSubmission,
      actualAmountKg: 600, // inventory is only 500
    };
    const excessiveResult = validateFeedingSubmission(excessiveSubmission, mockSafePond, mockInventory);
    expect(excessiveResult.success).toBe(false);
    expect(excessiveResult.error).toContain('موجودی ناکافی');
  });
});
