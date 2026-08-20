import { describe, it, expect } from 'vitest';
import {
  calculateFeedingRecommendation,
  normalizeFeedAmountToKg,
  validateFeedingSubmission,
} from '../utils/feedingEngine';
import { FeedingRecord, InventoryItem, Pond, SturgeonSpecies, TreatmentRecord } from '../types';

const mockSpecies: SturgeonSpecies[] = [
  {
    id: 'sp_beluga',
    faName: 'فیل‌ماهی',
    enName: 'Beluga Sturgeon',
    scientificName: 'Huso huso',
    origin: 'Caspian Sea',
    geneticLine: 'Test Line',
    description: 'Test species',
    optimumTempMin: 14,
    optimumTempMax: 18.5,
    optimumDOMin: 6,
    optimumpHMin: 7,
    optimumpHMax: 8.2,
    standardFCR: 1.1,
    feedingProfileCoeff: 1,
    caviarMaturityYears: 10,
  },
];

const mockSafePond: Pond = {
  id: 'pond_1',
  number: 'P-001',
  name: 'استخر ۱',
  hallId: 'hall_1',
  capacityCubicMeters: 50,
  fishCount: 1000,
  speciesId: 'sp_beluga',
  biomassKg: 5000,
  averageWeightKg: 5,
  lastFeedingKg: 40,
  lastFeedingTime: new Date().toISOString(),
  feedingStatus: 'ACTIVE',
  fcr: 1.1,
  dailyMortalityCount: 0,
  waterTemperature: 16.5,
  dissolvedOxygen: 7.2,
  ph: 7.5,
  lastBiometryDate: '2026-08-01',
  criticalAlerts: [],
};

const mockInventory: InventoryItem[] = [
  {
    id: 'inv_feed_1',
    sku: 'FEED-GROW-4MM',
    name: 'پلت رشد خاویاری ۴ میلی‌متر',
    category: 'Feed (خوراک)',
    batchNumber: 'TEST-001',
    quantity: 500,
    unit: 'kg',
    purchasePricePerUnit: 120000,
    currency: 'IRR',
    supplierName: 'Feed Co',
    warehouseLocation: 'A-1',
    minimumStockThreshold: 100,
    reorderLevel: 200,
    status: 'Adequate',
  },
];

function makeSubmission(overrides: Partial<Omit<FeedingRecord, 'id' | 'timestamp'>> = {}): Omit<FeedingRecord, 'id' | 'timestamp'> {
  return {
    pondId: mockSafePond.id,
    pondName: mockSafePond.name,
    hallName: 'Hall 1',
    speciesName: 'Huso huso',
    biomassKg: mockSafePond.biomassKg,
    recommendedAmountKg: 45,
    actualAmountKg: 50,
    unit: 'kg',
    feedTypeSku: 'FEED-GROW-4MM',
    feedTypeName: mockInventory[0].name,
    waterTemperature: mockSafePond.waterTemperature,
    dissolvedOxygen: mockSafePond.dissolvedOxygen,
    feedingStatus: 'ACTIVE',
    operatorName: 'Ali Rezaei',
    ...overrides,
  };
}

describe('Feeding Engine - Domain Safety & Unit Normalization', () => {
  it('calculates a positive ration for safe pond conditions', () => {
    const result = calculateFeedingRecommendation(mockSafePond, mockSpecies);
    expect(result.isLocked).toBe(false);
    expect(result.recommendedKg).toBeCloseTo(45, 1);
  });

  it('locks and zeroes the recommendation when feeding is STOPPED', () => {
    const result = calculateFeedingRecommendation(
      { ...mockSafePond, feedingStatus: 'STOPPED', stopFeedingReason: 'Low Oxygen' },
      mockSpecies
    );
    expect(result.isLocked).toBe(true);
    expect(result.recommendedKg).toBe(0);
  });

  it('locks and zeroes the recommendation during an active treatment', () => {
    const activeTreatment: TreatmentRecord = {
      id: 'trt_active_1',
      pondId: mockSafePond.id,
      pondName: mockSafePond.name,
      speciesName: 'Huso huso',
      diagnosis: 'Test diagnosis',
      drugName: 'Formalin 20ppm',
      dose: 20,
      doseUnit: 'ppm',
      administrationMethod: 'Bath (حمام)',
      startDate: '2026-08-20',
      endDate: '2026-08-21',
      veterinarian: 'Vet',
      withdrawalPeriodDays: 1,
      withdrawalEndDate: '2026-08-22',
      status: 'ACTIVE',
      reminderActive: true,
    };
    const result = calculateFeedingRecommendation(
      { ...mockSafePond, activeTreatmentId: activeTreatment.id },
      mockSpecies,
      activeTreatment
    );
    expect(result.isLocked).toBe(true);
    expect(result.recommendedKg).toBe(0);
    expect(result.lockReason).toContain('Formalin 20ppm');
  });

  it('prohibits feeding when authoritative pond DO is below 4.0 mg/L', () => {
    const unsafePond = { ...mockSafePond, dissolvedOxygen: 3.4 };
    const result = calculateFeedingRecommendation(unsafePond, mockSpecies);
    expect(result.isLocked).toBe(true);
    expect(result.recommendedKg).toBe(0);

    const forgedSafeRequest = makeSubmission({ dissolvedOxygen: 9 });
    const submission = validateFeedingSubmission(forgedSafeRequest, unsafePond, mockInventory);
    expect(submission.success).toBe(false);
  });

  it('normalizes kg, grams and 250g cups consistently', () => {
    expect(normalizeFeedAmountToKg(1, 'kg')).toBe(1);
    expect(normalizeFeedAmountToKg(1000, 'gram')).toBe(1);
    expect(normalizeFeedAmountToKg(4, 'cup250g')).toBe(1);
  });

  it('rejects unknown feed SKU and insufficient stock', () => {
    const missing = validateFeedingSubmission(makeSubmission({ feedTypeSku: 'UNKNOWN' }), mockSafePond, mockInventory);
    expect(missing.success).toBe(false);

    const excessive = validateFeedingSubmission(makeSubmission({ actualAmountKg: 600 }), mockSafePond, mockInventory);
    expect(excessive.success).toBe(false);
    expect(excessive.error).toContain('موجودی ناکافی');
  });
});
