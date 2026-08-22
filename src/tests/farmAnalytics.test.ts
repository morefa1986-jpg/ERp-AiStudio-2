import { describe, expect, it } from 'vitest';
import { buildFarmAnalytics } from '../utils/farmAnalytics';
import type { FeedingRecord, Hall, Pond, WaterQualityLog } from '../types';

const now = new Date('2026-08-22T12:00:00.000Z');

const halls: Hall[] = [
  { id: 'hall-1', number: '1', name: 'Hall 1', description: '', pondCount: 2, totalBiomassKg: 0, totalFishCount: 0, isActive: true },
  { id: 'hall-2', number: '2', name: 'Hall 2', description: '', pondCount: 1, totalBiomassKg: 0, totalFishCount: 0, isActive: true },
];

function pond(id: string, hallId: string, fishCount: number, biomassKg: number, fcr: number): Pond {
  return {
    id,
    number: id,
    name: id,
    hallId,
    capacityCubicMeters: 100,
    fishCount,
    speciesId: 'sp-1',
    biomassKg,
    averageWeightKg: fishCount > 0 ? biomassKg / fishCount : 0,
    lastFeedingKg: 0,
    lastFeedingTime: '',
    feedingStatus: 'ACTIVE',
    fcr,
    dailyMortalityCount: 0,
    waterTemperature: 16,
    dissolvedOxygen: 7,
    ph: 7.4,
    ammonia: 0.01,
    nitrite: 0.05,
    lastBiometryDate: '',
    criticalAlerts: [],
  };
}

function waterLog(id: string, pondId: string, timestamp: string, overrides: Partial<WaterQualityLog> = {}): WaterQualityLog {
  return {
    id,
    pondId,
    pondName: pondId,
    hallName: 'Hall',
    timestamp,
    temperature: 16,
    dissolvedOxygen: 7,
    ph: 7.4,
    ammonia: 0.01,
    nitrite: 0.05,
    sensorStatus: 'VALID',
    severity: 'INFO',
    operator: 'test',
    ...overrides,
  };
}

function feeding(id: string, pondId: string, kg: number): FeedingRecord {
  return {
    id,
    pondId,
    pondName: pondId,
    hallName: 'Hall',
    speciesName: 'Species',
    biomassKg: 100,
    recommendedAmountKg: kg,
    actualAmountKg: kg,
    unit: 'kg',
    feedTypeSku: 'feed',
    feedTypeName: 'Feed',
    waterTemperature: 16,
    dissolvedOxygen: 7,
    telemetryTimestamp: now.toISOString(),
    feedingStatus: 'ACTIVE',
    operatorName: 'test',
    timestamp: now.toISOString(),
  };
}

describe('farm analytics aggregation engine', () => {
  it('uses weighted averages instead of averaging pond averages', () => {
    const result = buildFarmAnalytics({
      ponds: [pond('p1', 'hall-1', 100, 1000, 1), pond('p2', 'hall-1', 10, 1000, 2)],
      halls,
      feedingRecords: [],
      mortalityRecords: [],
      waterLogs: [],
      treatments: [],
      inventory: [],
      proformas: [],
      now,
    });

    expect(result.averageWeightKg).toBeCloseTo(18.182, 3);
    expect(result.weightedFcr).toBeCloseTo(1.5, 3);
  });

  it('aggregates only selected halls and ponds', () => {
    const result = buildFarmAnalytics({
      ponds: [pond('p1', 'hall-1', 100, 1000, 1), pond('p2', 'hall-1', 10, 100, 1), pond('p3', 'hall-2', 50, 500, 1)],
      halls,
      selectedHallIds: ['hall-2'],
      selectedPondIds: ['p2'],
      feedingRecords: [feeding('f1', 'p1', 10), feeding('f2', 'p2', 20), feeding('f3', 'p3', 30)],
      mortalityRecords: [],
      waterLogs: [],
      treatments: [],
      inventory: [],
      proformas: [],
      now,
    });

    expect(result.scopedPonds.map((row) => row.id).sort()).toEqual(['p2', 'p3']);
    expect(result.totalBiomassKg).toBe(600);
    expect(result.periodFeedKg).toBe(50);
  });

  it('does not trust stale, missing, or unsafe telemetry', () => {
    const result = buildFarmAnalytics({
      ponds: [pond('p1', 'hall-1', 100, 1000, 1), pond('p2', 'hall-1', 100, 1000, 1), pond('p3', 'hall-2', 100, 1000, 1)],
      halls,
      feedingRecords: [],
      mortalityRecords: [],
      waterLogs: [
        waterLog('w1', 'p1', now.toISOString()),
        waterLog('w2', 'p2', '2026-08-21T00:00:00.000Z'),
        waterLog('w3', 'p3', now.toISOString(), { dissolvedOxygen: 3.5 }),
      ],
      treatments: [],
      inventory: [],
      proformas: [],
      now,
    });

    expect(result.trustedTelemetryPondsCount).toBe(2);
    expect(result.waterCriticalPondsCount).toBe(2);
    expect(result.minDO).toBe(3.5);
  });
});
