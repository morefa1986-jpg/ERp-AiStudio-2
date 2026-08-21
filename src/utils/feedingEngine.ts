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

export interface AuthoritativeFeedingTelemetry {
  timestamp?: string;
  sensorStatus?: 'VALID' | 'STALE' | 'INVALID' | 'OFFLINE' | 'MANUAL';
  dissolvedOxygen?: number | null;
  waterTemperature?: number | null;
  ph?: number | null;
  ammonia?: number | null;
  nitrite?: number | null;
}

export function normalizeFeedAmountToKg(
  amount: number,
  unit: 'kg' | 'g' | 'gram' | 'cup' | 'cup250g' | 'ton' | 'bag_25kg' | string
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === 'g' || unit === 'gram') return Number((amount / 1000).toFixed(4));
  if (unit === 'cup' || unit === 'cup250g') return Number((amount * 0.25).toFixed(4));
  if (unit === 'ton' || unit === 't') return Number((amount * 1000).toFixed(4));
  if (unit === 'bag_25kg') return Number((amount * 25).toFixed(4));
  return Number(amount.toFixed(4));
}

/** Convert a normalized kilogram amount to the unit used by the inventory ledger. */
export function inventoryQuantityForFeedKg(item: InventoryItem, amountKg: number): number {
  if (!Number.isFinite(amountKg) || amountKg <= 0) return 0;
  if (item.unit === 'gram') return Number((amountKg * 1000).toFixed(4));
  if (item.unit === 'kg') return Number(amountKg.toFixed(4));
  return 0;
}

function validatePondSafety(pond: Pond, telemetry?: AuthoritativeFeedingTelemetry): { safe: boolean; error?: string; assessment: ReturnType<typeof assessWaterSafetyForFeeding> } {
  const assessment = assessWaterSafetyForFeeding({
    dissolvedOxygen: telemetry?.dissolvedOxygen ?? pond.dissolvedOxygen,
    waterTemperature: telemetry?.waterTemperature ?? pond.waterTemperature,
    ph: telemetry?.ph ?? pond.ph,
    ammonia: telemetry?.ammonia ?? pond.ammonia,
    nitrite: telemetry?.nitrite ?? pond.nitrite,
    timestamp: telemetry?.timestamp ?? pond.lastTelemetryTimestamp,
    sensorStatus: telemetry?.sensorStatus ?? pond.sensorQuality,
  });

  if (pond.feedingStatus === 'STOPPED') {
    return { safe: false, error: 'ثبت خوراک غیرمجاز است: وضعیت استخر STOPPED است.', assessment };
  }
  if (pond.activeTreatmentId) {
    return { safe: false, error: 'ثبت خوراک غیرمجاز است: استخر دارای درمان فعال است.', assessment };
  }
  if (pond.sensorQuality === 'INVALID' || pond.sensorQuality === 'STALE' || pond.sensorQuality === 'OFFLINE') {
    return { safe: false, error: 'ثبت خوراک غیرمجاز است: کیفیت سنسور معتبر نیست.', assessment };
  }
  if (!assessment.isSafeForFeeding) {
    return {
      safe: false,
      error: assessment.feedingProhibitionReason || 'شرایط کیفیت آب برای تغذیه ایمن نیست.',
      assessment,
    };
  }
  return { safe: true, assessment };
}

export function calculateFeedingRecommendation(
  pond: Pond | undefined,
  speciesList: SturgeonSpecies[],
  activeTreatment?: TreatmentRecord,
  telemetry?: AuthoritativeFeedingTelemetry,
): FeedingRecommendationResult {
  if (!pond) return { recommendedKg: 0, isLocked: true, lockReason: 'استخر یافت نشد.' };

  if (pond.feedingStatus === 'STOPPED') {
    return {
      recommendedKg: 0,
      isLocked: true,
      lockReason: `تغذیه این استخر قطع است (${pond.stopFeedingReason || 'توقف دستی'}: ${pond.stopFeedingDetails || ''})`,
    };
  }

  if (pond.activeTreatmentId || activeTreatment?.status === 'ACTIVE') {
    return {
      recommendedKg: 0,
      isLocked: true,
      lockReason: `استخر تحت درمان دارویی فعال (${activeTreatment?.drugName || 'دارودرمانی فعال'}) قرار دارد و تغذیه ممنوع است.`,
    };
  }

  const safety = validatePondSafety(pond, telemetry);
  if (!safety.safe) {
    return {
      recommendedKg: 0,
      isLocked: true,
      lockReason: safety.error,
      waterSafety: {
        isSafe: false,
        doStatus: safety.assessment.doStatus.status,
        tempStatus: safety.assessment.tempStatus.status,
      },
    };
  }

  const sp = speciesList.find((s) => s.id === pond.speciesId);
  const coeff = Number.isFinite(sp?.feedingProfileCoeff) ? Number(sp!.feedingProfileCoeff) : 1.0;
  let tempFactor = 1.0;
  if (pond.waterTemperature >= 14 && pond.waterTemperature <= 18.5) tempFactor = 1.0;
  else if (pond.waterTemperature < 14) tempFactor = Math.max(0.4, pond.waterTemperature / 14);
  else tempFactor = Math.max(0.6, 1.0 - (pond.waterTemperature - 18.5) * 0.08);

  const biomass = Number(pond.biomassKg);
  if (!Number.isFinite(biomass) || biomass <= 0) {
    return { recommendedKg: 0, isLocked: true, lockReason: 'بیوماس استخر نامعتبر است.' };
  }

  const recommendedKg = Number((biomass * 0.009 * coeff * tempFactor).toFixed(2));
  return {
    recommendedKg: Math.max(0, recommendedKg),
    isLocked: false,
    waterSafety: {
      isSafe: true,
      doStatus: safety.assessment.doStatus.status,
      tempStatus: safety.assessment.tempStatus.status,
    },
  };
}

export function validateFeedingSubmission(
  recordData: Omit<FeedingRecord, 'id' | 'timestamp'>,
  pond: Pond | undefined,
  inventory: InventoryItem[]
): { success: boolean; error?: string; normalizedAmountKg: number; feedItem?: InventoryItem } {
  if (!pond) return { success: false, error: 'استخر یافت نشد.', normalizedAmountKg: 0 };

  const acceptedUnits = new Set(['kg', 'g', 'gram', 'cup', 'cup250g', 'ton', 't', 'bag_25kg']);
  if (!acceptedUnits.has(String(recordData.unit))) return { success: false, error: 'واحد خوراک پشتیبانی نمی‌شود.', normalizedAmountKg: 0 };

  // Never trust telemetry copied from a request/form. Revalidate authoritative pond state here.
  const safety = validatePondSafety(pond);
  if (!safety.safe) return { success: false, error: safety.error, normalizedAmountKg: 0 };

  const normalizedKg = normalizeFeedAmountToKg(Number(recordData.actualAmountKg), recordData.unit);
  if (!Number.isFinite(normalizedKg) || normalizedKg <= 0) {
    return { success: false, error: 'مقدار خوراک مصرفی باید یک عدد معتبر بزرگتر از صفر باشد.', normalizedAmountKg: 0 };
  }

  const feedItem = inventory.find((i) => i.sku === recordData.feedTypeSku);
  if (!feedItem) {
    return { success: false, error: `خوراک با کد ${recordData.feedTypeSku} در انبار یافت نشد.`, normalizedAmountKg: normalizedKg };
  }
  if (!feedItem.category.includes('Feed')) {
    return { success: false, error: 'کالای انتخاب‌شده خوراک نیست.', normalizedAmountKg: normalizedKg, feedItem };
  }
  const requiredInventoryQuantity = inventoryQuantityForFeedKg(feedItem, normalizedKg);
  if (requiredInventoryQuantity <= 0) {
    return { success: false, error: 'واحد موجودی خوراک باید کیلوگرم یا گرم باشد.', normalizedAmountKg: normalizedKg, feedItem };
  }
  if (!Number.isFinite(feedItem.quantity) || feedItem.quantity < requiredInventoryQuantity) {
    return {
      success: false,
      error: `موجودی ناکافی: موجودی ${feedItem.name} برابر ${feedItem.quantity} ${feedItem.unit} و مقدار درخواست ${requiredInventoryQuantity} ${feedItem.unit} است.`,
      normalizedAmountKg: normalizedKg,
      feedItem,
    };
  }

  return { success: true, normalizedAmountKg: normalizedKg, feedItem };
}
