import { FeedingRecord, InventoryItem, LanguageCode, Pond, SturgeonSpecies, TreatmentRecord } from '../types';
import { runtimeMessage } from '../i18n/runtimeMessages';
import { assessWaterSafetyForFeeding } from './sensorValidation';

export interface FeedingRecommendationResult {
  recommendedKg: number;
  isLocked: boolean;
  lockReason?: string;
  waterSafety?: { isSafe: boolean; doStatus: string; tempStatus: string };
}

export function normalizeFeedAmountToKg(amount: number, unit: 'kg' | 'g' | 'gram' | 'cup' | 'cup250g' | 'ton' | 'bag_25kg' | string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === 'g' || unit === 'gram') return Number((amount / 1000).toFixed(4));
  if (unit === 'cup' || unit === 'cup250g') return Number((amount * 0.25).toFixed(4));
  if (unit === 'ton' || unit === 't') return Number((amount * 1000).toFixed(4));
  if (unit === 'bag_25kg') return Number((amount * 25).toFixed(4));
  return Number(amount.toFixed(4));
}

function validatePondSafety(pond: Pond, language: LanguageCode): { safe: boolean; error?: string; assessment: ReturnType<typeof assessWaterSafetyForFeeding> } {
  const assessment = assessWaterSafetyForFeeding({ dissolvedOxygen: pond.dissolvedOxygen, waterTemperature: pond.waterTemperature, ph: pond.ph, language });
  if (pond.feedingStatus === 'STOPPED') return { safe: false, error: runtimeMessage(language, 'feeding.stopped'), assessment };
  if (pond.activeTreatmentId) return { safe: false, error: runtimeMessage(language, 'feeding.activeTreatment', { drug: '-' }), assessment };
  if (!assessment.isSafeForFeeding) return { safe: false, error: assessment.feedingProhibitionReason || runtimeMessage(language, 'feeding.unsafeWater'), assessment };
  return { safe: true, assessment };
}

export function calculateFeedingRecommendation(
  pond: Pond | undefined,
  speciesList: SturgeonSpecies[],
  activeTreatment?: TreatmentRecord,
  language: LanguageCode = 'fa',
): FeedingRecommendationResult {
  if (!pond) return { recommendedKg: 0, isLocked: true, lockReason: runtimeMessage(language, 'feeding.pondNotFound') };
  if (pond.feedingStatus === 'STOPPED') return { recommendedKg: 0, isLocked: true, lockReason: runtimeMessage(language, 'feeding.stoppedReason', { reason: pond.stopFeedingReason || '-', details: pond.stopFeedingDetails || '-' }) };
  if (pond.activeTreatmentId || activeTreatment?.status === 'ACTIVE') return { recommendedKg: 0, isLocked: true, lockReason: runtimeMessage(language, 'feeding.activeTreatment', { drug: activeTreatment?.drugName || '-' }) };

  const safety = validatePondSafety(pond, language);
  if (!safety.safe) return { recommendedKg: 0, isLocked: true, lockReason: safety.error, waterSafety: { isSafe: false, doStatus: safety.assessment.doStatus.status, tempStatus: safety.assessment.tempStatus.status } };

  const sp = speciesList.find((s) => s.id === pond.speciesId);
  const coeff = Number.isFinite(sp?.feedingProfileCoeff) ? Number(sp!.feedingProfileCoeff) : 1.0;
  let tempFactor = 1.0;
  if (pond.waterTemperature >= 14 && pond.waterTemperature <= 18.5) tempFactor = 1.0;
  else if (pond.waterTemperature < 14) tempFactor = Math.max(0.4, pond.waterTemperature / 14);
  else tempFactor = Math.max(0.6, 1.0 - (pond.waterTemperature - 18.5) * 0.08);

  const biomass = Number(pond.biomassKg);
  if (!Number.isFinite(biomass) || biomass <= 0) return { recommendedKg: 0, isLocked: true, lockReason: runtimeMessage(language, 'feeding.invalidBiomass') };

  const recommendedKg = Number((biomass * 0.009 * coeff * tempFactor).toFixed(2));
  return { recommendedKg: Math.max(0, recommendedKg), isLocked: false, waterSafety: { isSafe: true, doStatus: safety.assessment.doStatus.status, tempStatus: safety.assessment.tempStatus.status } };
}

export function validateFeedingSubmission(
  recordData: Omit<FeedingRecord, 'id' | 'timestamp'>,
  pond: Pond | undefined,
  inventory: InventoryItem[],
  language: LanguageCode = 'fa',
): { success: boolean; error?: string; normalizedAmountKg: number; feedItem?: InventoryItem } {
  if (!pond) return { success: false, error: runtimeMessage(language, 'feeding.pondNotFound'), normalizedAmountKg: 0 };
  const safety = validatePondSafety(pond, language);
  if (!safety.safe) return { success: false, error: safety.error, normalizedAmountKg: 0 };

  const normalizedKg = normalizeFeedAmountToKg(Number(recordData.actualAmountKg), recordData.unit);
  if (!Number.isFinite(normalizedKg) || normalizedKg <= 0) return { success: false, error: runtimeMessage(language, 'feeding.invalidAmount'), normalizedAmountKg: 0 };

  const feedItem = inventory.find((i) => i.sku === recordData.feedTypeSku);
  if (!feedItem) return { success: false, error: runtimeMessage(language, 'feeding.feedNotFound', { sku: recordData.feedTypeSku }), normalizedAmountKg: normalizedKg };
  if (!feedItem.category.includes('Feed')) return { success: false, error: runtimeMessage(language, 'feeding.notFeedItem'), normalizedAmountKg: normalizedKg, feedItem };
  if (!Number.isFinite(feedItem.quantity) || feedItem.quantity < normalizedKg) return { success: false, error: runtimeMessage(language, 'feeding.stockShortage', { name: feedItem.name, stock: feedItem.quantity, requested: normalizedKg }), normalizedAmountKg: normalizedKg, feedItem };

  return { success: true, normalizedAmountKg: normalizedKg, feedItem };
}
