import { Pond, SturgeonSpecies, TreatmentRecord, FeedingRecord, InventoryItem } from '../types';
import { assessWaterSafetyForFeeding } from './sensorValidation';

export interface FeedingRecommendationResult {
  recommendedKg: number;
  isLocked: boolean;
  lockReason?: string;
  waterSafety?: {
    isSafe: boolean;
    doStatus: string;
    tempStatus: string;
  };
}

/**
 * Normalizes any feed unit to standard kilograms (kg).
 * Rule: 1 kg = 1000 g = 4 cups (1 cup = 250 g = 0.25 kg)
 */
export function normalizeFeedAmountToKg(amount: number, unit: 'kg' | 'g' | 'cup' | 'ton' | 'bag_25kg' | string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  
  if (unit === 'g' || unit === 'gram') {
    return Number((amount / 1000).toFixed(4));
  }
  if (unit === 'cup') {
    return Number((amount * 0.25).toFixed(4));
  }
  if (unit === 'ton' || unit === 't') {
    return Number((amount * 1000).toFixed(4));
  }
  if (unit === 'bag_25kg') {
    return Number((amount * 25).toFixed(4));
  }
  return Number(amount.toFixed(4));
}

/**
 * Calculates recommended feed for a pond based on temperature, DO, biomass, and health status.
 */
export function calculateFeedingRecommendation(
  pond: Pond | undefined,
  speciesList: SturgeonSpecies[],
  activeTreatment?: TreatmentRecord
): FeedingRecommendationResult {
  if (!pond) {
    return { recommendedKg: 0, isLocked: true, lockReason: 'استخر یافت نشد.' };
  }

  // 1. Explicit Feeding Status Check
  if (pond.feedingStatus === 'STOPPED') {
    return {
      recommendedKg: 0,
      isLocked: true,
      lockReason: `تغذیه این استخر قطع است (${pond.stopFeedingReason || 'توقف دستی'}: ${pond.stopFeedingDetails || ''})`,
    };
  }

  // 2. Active Medical Treatment Check
  if (pond.activeTreatmentId || (activeTreatment && activeTreatment.status === 'ACTIVE')) {
    const medName = activeTreatment?.drugName || 'دارودرمانی فعال';
    return {
      recommendedKg: 0,
      isLocked: true,
      lockReason: `استخر تحت درمان دارویی فعال (${medName}) قرار دارد و تغذیه طبق پروتکل دامپزشکی ممنوع است.`,
    };
  }

  // 3. Strict Sensor Data Validation Assessment
  const safetyAssessment = assessWaterSafetyForFeeding({
    dissolvedOxygen: pond.dissolvedOxygen,
    waterTemperature: pond.waterTemperature,
    ph: pond.ph,
  });

  if (!safetyAssessment.isSafeForFeeding) {
    return {
      recommendedKg: 0,
      isLocked: true,
      lockReason: safetyAssessment.feedingProhibitionReason || 'شرایط کیفیت آب برای تغذیه ناامن است.',
      waterSafety: {
        isSafe: false,
        doStatus: safetyAssessment.doStatus.status,
        tempStatus: safetyAssessment.tempStatus.status,
      },
    };
  }

  // 4. Mathematical Ration Computation
  const sp = speciesList.find((s) => s.id === pond.speciesId);
  const coeff = sp ? sp.feedingProfileCoeff : 1.0;

  let tempFactor = 1.0;
  if (pond.waterTemperature >= 14 && pond.waterTemperature <= 18.5) {
    tempFactor = 1.0;
  } else if (pond.waterTemperature < 14) {
    tempFactor = Math.max(0.4, pond.waterTemperature / 14);
  } else {
    tempFactor = Math.max(0.6, 1.0 - (pond.waterTemperature - 18.5) * 0.08);
  }

  const baseRate = 0.009 * coeff * tempFactor; // ~0.9% of body weight
  const recommendedKg = Number((pond.biomassKg * baseRate).toFixed(2));

  return {
    recommendedKg: Math.max(0, recommendedKg),
    isLocked: false,
    waterSafety: {
      isSafe: true,
      doStatus: safetyAssessment.doStatus.status,
      tempStatus: safetyAssessment.tempStatus.status,
    },
  };
}

/**
 * Validates domain rules before registering a feeding event.
 */
export function validateFeedingSubmission(
  recordData: Omit<FeedingRecord, 'id' | 'timestamp'>,
  pond: Pond | undefined,
  inventory: InventoryItem[]
): { success: boolean; error?: string; normalizedAmountKg: number; feedItem?: InventoryItem } {
  if (!pond) {
    return { success: false, error: 'استخر یافت نشد.', normalizedAmountKg: 0 };
  }

  if (pond.feedingStatus === 'STOPPED') {
    return {
      success: false,
      error: 'ثبت خوراک غیرمجاز است: وضعیت استخر قطع غذا (STOPPED) است.',
      normalizedAmountKg: 0,
    };
  }

  if (!Number.isFinite(recordData.dissolvedOxygen) || recordData.dissolvedOxygen < 4.0) {
    return {
      success: false,
      error: `ثبت خوراک غیرمجاز است: میزان اکسیژن (${recordData.dissolvedOxygen} mg/L) کمتر از ۴.۰ است.`,
      normalizedAmountKg: 0,
    };
  }

  const normalizedKg = normalizeFeedAmountToKg(recordData.actualAmountKg, recordData.unit);
  if (normalizedKg <= 0) {
    return {
      success: false,
      error: 'مقدار خوراک مصرفی باید بزرگتر از صفر باشد.',
      normalizedAmountKg: 0,
    };
  }

  const feedItem = inventory.find((i) => i.sku === recordData.feedTypeSku || i.category.includes('Feed'));
  if (feedItem) {
    if (feedItem.quantity < normalizedKg) {
      return {
        success: false,
        error: `موجودی ناکافی: موجودی خوراک (${feedItem.name}) در انبار ${feedItem.quantity} kg است اما مقدار درخواست‌شده ${normalizedKg} kg می‌باشد.`,
        normalizedAmountKg: normalizedKg,
        feedItem,
      };
    }
  }

  return {
    success: true,
    normalizedAmountKg: normalizedKg,
    feedItem,
  };
}
