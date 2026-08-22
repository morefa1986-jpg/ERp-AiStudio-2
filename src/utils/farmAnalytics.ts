import type {
  BiometricSession,
  FeedingRecord,
  Hall,
  InventoryItem,
  MortalityRecord,
  Pond,
  ProformaInvoice,
  TreatmentRecord,
  WaterQualityLog,
} from '../types';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

export interface FarmAnalyticsInput {
  ponds: Pond[];
  halls: Hall[];
  feedingRecords: FeedingRecord[];
  mortalityRecords: MortalityRecord[];
  waterLogs: WaterQualityLog[];
  treatments: TreatmentRecord[];
  inventory: InventoryItem[];
  proformas: ProformaInvoice[];
  biometricSessions?: BiometricSession[];
  selectedHallIds?: string[];
  selectedPondIds?: string[];
  period?: AnalyticsPeriod;
  now?: Date;
}

export interface FeedBucket {
  start: number;
  end: number;
  feedKg: number;
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

export interface PondAnalyticsRow {
  pond: Pond;
  hall?: Hall;
  latestWaterLog?: WaterQualityLog;
  hasTrustedTelemetry: boolean;
  isWaterCritical: boolean;
  criticalReason?: string;
}

export interface HallAnalyticsRow {
  hall: Hall;
  pondCount: number;
  fishCount: number;
  biomassKg: number;
  averageWeightKg: number | null;
  feedKg: number;
  mortalityCount: number;
  mortalityRatePct: number;
  weightedFcr: number | null;
  criticalPonds: number;
}

export interface FarmAnalyticsResult {
  startTime: number;
  endTime: number;
  scopedPonds: Pond[];
  scopedHalls: Hall[];
  pondRows: PondAnalyticsRow[];
  hallRows: HallAnalyticsRow[];
  totalBiomassKg: number;
  totalFishCount: number;
  averageWeightKg: number | null;
  periodFeedKg: number;
  periodBiomassGainKg: number;
  periodFcr: number | null;
  weightedFcr: number | null;
  mortalityCount: number;
  mortalityBiomassKg: number;
  mortalityRatePct: number;
  stoppedPondsCount: number;
  activeTreatmentsCount: number;
  trustedTelemetryPondsCount: number;
  waterCriticalPondsCount: number;
  avgDO: number | null;
  minDO: number | null;
  avgTemp: number | null;
  avgPh: number | null;
  feedReserveKg: number;
  salesByCurrency: CurrencyTotal[];
  feedBuckets: FeedBucket[];
}

const HOUR_MS = 3_600_000;
const SENSOR_MAX_AGE_HOURS = 6;

export function analyticsPeriodStart(period: AnalyticsPeriod, now = new Date()): number {
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setTime(now.getTime() - 7 * 86_400_000);
  if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  if (period === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return start.getTime();
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sum(values: number[]): number {
  return Number(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0).toFixed(3));
}

function within(timestamp: string, startTime: number, endTime: number): boolean {
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) && time >= startTime && time <= endTime;
}

function latestWaterLog(pondId: string, waterLogs: WaterQualityLog[], endTime: number): WaterQualityLog | undefined {
  return waterLogs
    .filter((log) => log.pondId === pondId && new Date(log.timestamp).getTime() <= endTime)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
}

function assessWaterLog(log: WaterQualityLog | undefined, endTime: number): Pick<PondAnalyticsRow, 'hasTrustedTelemetry' | 'isWaterCritical' | 'criticalReason'> {
  if (!log) return { hasTrustedTelemetry: false, isWaterCritical: true, criticalReason: 'TELEMETRY_MISSING' };
  const timestamp = new Date(log.timestamp).getTime();
  if (!Number.isFinite(timestamp)) return { hasTrustedTelemetry: false, isWaterCritical: true, criticalReason: 'TELEMETRY_TIMESTAMP_INVALID' };
  const ageHours = (endTime - timestamp) / HOUR_MS;
  if (ageHours < -0.25 || ageHours > SENSOR_MAX_AGE_HOURS) return { hasTrustedTelemetry: false, isWaterCritical: true, criticalReason: 'TELEMETRY_STALE' };
  if (['INVALID', 'OFFLINE', 'STALE'].includes(log.sensorStatus)) return { hasTrustedTelemetry: false, isWaterCritical: true, criticalReason: `SENSOR_${log.sensorStatus}` };

  const coreValid = finite(log.dissolvedOxygen) && log.dissolvedOxygen > 0
    && finite(log.temperature)
    && finite(log.ph) && log.ph > 0 && log.ph <= 14;
  if (!coreValid) return { hasTrustedTelemetry: false, isWaterCritical: true, criticalReason: 'TELEMETRY_INVALID' };

  if (log.dissolvedOxygen < 4) return { hasTrustedTelemetry: true, isWaterCritical: true, criticalReason: 'DO_UNSAFE' };
  if (log.temperature < 4 || log.temperature > 25) return { hasTrustedTelemetry: true, isWaterCritical: true, criticalReason: 'TEMP_UNSAFE' };
  if (log.ph < 6 || log.ph > 9) return { hasTrustedTelemetry: true, isWaterCritical: true, criticalReason: 'PH_UNSAFE' };
  if (!finite(log.ammonia) || log.ammonia > 0.02) return { hasTrustedTelemetry: true, isWaterCritical: true, criticalReason: 'NH3_UNSAFE_OR_MISSING' };
  if (!finite(log.nitrite) || log.nitrite > 0.2) return { hasTrustedTelemetry: true, isWaterCritical: true, criticalReason: 'NO2_UNSAFE_OR_MISSING' };

  return { hasTrustedTelemetry: true, isWaterCritical: false };
}

function scopedPonds(ponds: Pond[], selectedHallIds: string[] = [], selectedPondIds: string[] = []): Pond[] {
  const hallSet = new Set(selectedHallIds);
  const pondSet = new Set(selectedPondIds);
  if (hallSet.size === 0 && pondSet.size === 0) return ponds;
  return ponds.filter((pond) => hallSet.has(pond.hallId) || pondSet.has(pond.id));
}

function weightedFcr(ponds: Pond[]): number | null {
  const candidates = ponds.filter((pond) => finite(pond.fcr) && pond.fcr > 0 && finite(pond.biomassKg) && pond.biomassKg > 0);
  const denominator = sum(candidates.map((pond) => pond.biomassKg));
  if (denominator <= 0) return null;
  return Number((candidates.reduce((total, pond) => total + pond.fcr * pond.biomassKg, 0) / denominator).toFixed(3));
}

function biomassGainKg(sessions: BiometricSession[], pondIds: Set<string>, startTime: number, endTime: number): number {
  const byPond = new Map<string, BiometricSession[]>();
  for (const session of sessions) {
    const time = new Date(session.date).getTime();
    if (!pondIds.has(session.pondId) || !Number.isFinite(time) || time > endTime) continue;
    const list = byPond.get(session.pondId) || [];
    list.push(session);
    byPond.set(session.pondId, list);
  }

  let gain = 0;
  for (const sessionsForPond of byPond.values()) {
    const sorted = sessionsForPond.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const baseline = [...sorted].reverse().find((session) => new Date(session.date).getTime() < startTime) || sorted.find((session) => new Date(session.date).getTime() >= startTime);
    const latest = [...sorted].reverse().find((session) => new Date(session.date).getTime() <= endTime);
    if (!baseline || !latest || baseline.id === latest.id) continue;
    const delta = latest.estimatedBiomassKg - baseline.estimatedBiomassKg;
    if (Number.isFinite(delta) && delta > 0) gain += delta;
  }
  return Number(gain.toFixed(3));
}

function feedBuckets(records: FeedingRecord[], startTime: number, endTime: number, bucketCount = 7): FeedBucket[] {
  const duration = Math.max(1, endTime - startTime);
  const bucketSize = duration / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: startTime + bucketSize * index,
    end: startTime + bucketSize * (index + 1),
    feedKg: 0,
  }));
  for (const record of records) {
    const time = new Date(record.timestamp).getTime();
    if (!Number.isFinite(time)) continue;
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((time - startTime) / bucketSize)));
    buckets[index].feedKg = Number((buckets[index].feedKg + record.actualAmountKg).toFixed(3));
  }
  return buckets;
}

function calculateSalesByCurrency(proformas: ProformaInvoice[], startTime: number, endTime: number): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const row of proformas) {
    if (!row.fulfilledAt || row.status === 'Cancelled' || !within(row.date, startTime, endTime)) continue;
    totals.set(row.currency, Number(((totals.get(row.currency) || 0) + row.grandTotal).toFixed(2)));
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
}

export function buildFarmAnalytics(input: FarmAnalyticsInput): FarmAnalyticsResult {
  const period = input.period || 'week';
  const endTime = input.now?.getTime() ?? Date.now();
  const startTime = analyticsPeriodStart(period, input.now || new Date(endTime));
  const selectedPonds = scopedPonds(input.ponds, input.selectedHallIds, input.selectedPondIds);
  const pondIds = new Set(selectedPonds.map((pond) => pond.id));
  const scopedHallIds = new Set(selectedPonds.map((pond) => pond.hallId));
  const selectedHalls = input.halls.filter((hall) => scopedHallIds.has(hall.id));
  const periodFeedingRecords = input.feedingRecords.filter((row) => pondIds.has(row.pondId) && within(row.timestamp, startTime, endTime));
  const periodMortalityRecords = input.mortalityRecords.filter((row) => pondIds.has(row.pondId) && within(row.timestamp, startTime, endTime));
  const pondRows = selectedPonds.map((pond) => {
    const latest = latestWaterLog(pond.id, input.waterLogs, endTime);
    return {
      pond,
      hall: input.halls.find((hall) => hall.id === pond.hallId),
      latestWaterLog: latest,
      ...assessWaterLog(latest, endTime),
    };
  });

  const totalBiomassKg = sum(selectedPonds.map((pond) => pond.biomassKg));
  const totalFishCount = sum(selectedPonds.map((pond) => pond.fishCount));
  const mortalityCount = sum(periodMortalityRecords.map((row) => row.count));
  const mortalityBiomassKg = sum(periodMortalityRecords.map((row) => row.estimatedWeightKg));
  const periodFeedKg = sum(periodFeedingRecords.map((row) => row.actualAmountKg));
  const periodBiomassGainKg = biomassGainKg(input.biometricSessions || [], pondIds, startTime, endTime);
  const periodFcr = periodBiomassGainKg > 0 ? Number((periodFeedKg / periodBiomassGainKg).toFixed(3)) : null;
  const trustedTelemetry = pondRows.filter((row) => row.hasTrustedTelemetry && row.latestWaterLog);
  const feedReserveKg = sum(input.inventory
    .filter((row) => row.category.includes('Feed'))
    .map((row) => row.unit === 'gram' ? row.quantity / 1000 : row.unit === 'kg' ? row.quantity : 0));

  const hallRows = selectedHalls.map((hall) => {
    const hallPonds = selectedPonds.filter((pond) => pond.hallId === hall.id);
    const hallPondIds = new Set(hallPonds.map((pond) => pond.id));
    const hallMortality = periodMortalityRecords.filter((row) => hallPondIds.has(row.pondId));
    const hallMortalityCount = sum(hallMortality.map((row) => row.count));
    const hallFish = sum(hallPonds.map((pond) => pond.fishCount));
    const hallBiomass = sum(hallPonds.map((pond) => pond.biomassKg));
    const hallRowsForWater = pondRows.filter((row) => row.pond.hallId === hall.id);
    return {
      hall,
      pondCount: hallPonds.length,
      fishCount: hallFish,
      biomassKg: hallBiomass,
      averageWeightKg: hallFish > 0 ? Number((hallBiomass / hallFish).toFixed(3)) : null,
      feedKg: sum(periodFeedingRecords.filter((row) => hallPondIds.has(row.pondId)).map((row) => row.actualAmountKg)),
      mortalityCount: hallMortalityCount,
      mortalityRatePct: hallFish + hallMortalityCount > 0 ? Number(((hallMortalityCount / (hallFish + hallMortalityCount)) * 100).toFixed(3)) : 0,
      weightedFcr: weightedFcr(hallPonds),
      criticalPonds: hallRowsForWater.filter((row) => row.isWaterCritical || row.pond.feedingStatus === 'STOPPED').length,
    };
  });

  return {
    startTime,
    endTime,
    scopedPonds: selectedPonds,
    scopedHalls: selectedHalls,
    pondRows,
    hallRows,
    totalBiomassKg,
    totalFishCount,
    averageWeightKg: totalFishCount > 0 ? Number((totalBiomassKg / totalFishCount).toFixed(3)) : null,
    periodFeedKg,
    periodBiomassGainKg,
    periodFcr,
    weightedFcr: weightedFcr(selectedPonds),
    mortalityCount,
    mortalityBiomassKg,
    mortalityRatePct: totalFishCount + mortalityCount > 0 ? Number(((mortalityCount / (totalFishCount + mortalityCount)) * 100).toFixed(3)) : 0,
    stoppedPondsCount: selectedPonds.filter((pond) => pond.feedingStatus === 'STOPPED').length,
    activeTreatmentsCount: input.treatments.filter((row) => pondIds.has(row.pondId) && row.status === 'ACTIVE').length,
    trustedTelemetryPondsCount: trustedTelemetry.length,
    waterCriticalPondsCount: pondRows.filter((row) => row.isWaterCritical).length,
    avgDO: trustedTelemetry.length ? Number((sum(trustedTelemetry.map((row) => row.latestWaterLog?.dissolvedOxygen || 0)) / trustedTelemetry.length).toFixed(3)) : null,
    minDO: trustedTelemetry.length ? Math.min(...trustedTelemetry.map((row) => row.latestWaterLog?.dissolvedOxygen || 0)) : null,
    avgTemp: trustedTelemetry.length ? Number((sum(trustedTelemetry.map((row) => row.latestWaterLog?.temperature || 0)) / trustedTelemetry.length).toFixed(3)) : null,
    avgPh: trustedTelemetry.length ? Number((sum(trustedTelemetry.map((row) => row.latestWaterLog?.ph || 0)) / trustedTelemetry.length).toFixed(3)) : null,
    feedReserveKg,
    salesByCurrency: calculateSalesByCurrency(input.proformas, startTime, endTime),
    feedBuckets: feedBuckets(periodFeedingRecords, startTime, endTime),
  };
}
