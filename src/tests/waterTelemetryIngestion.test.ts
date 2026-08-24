import { describe, expect, it } from 'vitest';
import { DahirGatewayPoint } from '../../server/dahirGateway';
import { buildAuthoritativeWaterMutation, validateWaterTelemetryMappingInput, WaterTelemetryMapping } from '../../server/waterTelemetryIngestion';
import { validateStateMutation } from '../utils/stateIntegrity';

function baseState() {
  return {
    halls: [{ id: 'hall_1', number: 'H-1', name: 'Hall 1', pondCount: 1, totalBiomassKg: 100, totalFishCount: 100, isActive: true }],
    ponds: [{ id: 'pond_1', number: 'P-1', name: 'Pond 1', hallId: 'hall_1', capacityCubicMeters: 100, fishCount: 100, speciesId: 'sp_1', biomassKg: 100, averageWeightKg: 1, lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'STOPPED', fcr: 1.1, dailyMortalityCount: 0, waterTemperature: 16, dissolvedOxygen: 7, ph: 7.4, ammonia: 0.01, nitrite: 0.05, sensorQuality: 'OFFLINE', lastBiometryDate: '', criticalAlerts: [], isActive: true }],
    species: [{ id: 'sp_1', faName: 'test', enName: 'test', scientificName: 'test', optimumTempMin: 14, optimumTempMax: 19, optimumDOMin: 6, optimumpHMin: 6.8, optimumpHMax: 8.2, standardFCR: 1.1, feedingProfileCoeff: 1, caviarMaturityYears: 8 }],
    feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [], treatments: [], transfers: [], broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [], inventory: [], inventoryTxs: [], labSamples: [], processingBatches: [], coldStorage: [], customers: [], proformas: [], accounts: [], journals: [], employees: [], attendance: [], payrolls: [], equipment: [], socialPosts: [], auditLogs: [], backups: [],
  };
}

const mapping: WaterTelemetryMapping = {
  id: 'wtm_1', pondId: 'pond_1', deviceId: 'device-1', isActive: true,
  keys: { dissolvedOxygen: 'do', temperature: 'temp', ph: 'ph', ammonia: 'nh3', nitrite: 'no2' },
  createdAt: '2026-08-24T00:00:00.000Z', updatedAt: '2026-08-24T00:00:00.000Z',
};

function point(key: string, value: number, ts: number, isFresh = true): DahirGatewayPoint {
  return { key, value, numericValue: value, ts, timestamp: new Date(ts).toISOString(), ageMinutes: 1, isFresh };
}

function safePoints(now: number) {
  const ts = now - 60_000;
  return {
    do: point('do', 7.1, ts), temp: point('temp', 16.2, ts), ph: point('ph', 7.4, ts), nh3: point('nh3', 0.01, ts), no2: point('no2', 0.08, ts),
  };
}

describe('authoritative water telemetry ingestion', () => {
  it('requires a complete non-duplicated sensor key mapping', () => {
    expect(validateWaterTelemetryMappingInput({ pondId: 'pond_1', deviceId: 'device-1', keys: mapping.keys }).ok).toBe(true);
    expect(validateWaterTelemetryMappingInput({ pondId: 'pond_1', deviceId: 'device-1', keys: { ...mapping.keys, nitrite: 'nh3' } })).toMatchObject({ ok: false, error: 'WATER_MAPPING_KEYS_DUPLICATE' });
  });

  it('writes fresh physically valid telemetry as a VALID water ledger entry', () => {
    const now = Date.now();
    const previous = baseState();
    const result = buildAuthoritativeWaterMutation(previous, mapping, safePoints(now), 'E2E Operator', now);
    expect(result.ok).toBe(true);
    expect(result.log).toMatchObject({ pondId: 'pond_1', sensorStatus: 'VALID', severity: 'INFO', dissolvedOxygen: 7.1, temperature: 16.2, ph: 7.4 });
    expect(result.pond).toMatchObject({ sensorQuality: 'VALID', dissolvedOxygen: 7.1, waterTemperature: 16.2 });
    expect(validateStateMutation(previous, result.state!, { module: 'water_quality', action: 'create' }).ok).toBe(true);
  });

  it('records fresh critical water values as authoritative but stops feeding fail-closed', () => {
    const now = Date.now();
    const previous = baseState();
    previous.ponds[0].feedingStatus = 'ACTIVE';
    const points = safePoints(now);
    points.do = point('do', 3.2, now - 60_000);
    const result = buildAuthoritativeWaterMutation(previous, mapping, points, 'Sensor Gateway', now);
    expect(result.ok).toBe(true);
    expect(result.log).toMatchObject({ sensorStatus: 'VALID', severity: 'CRITICAL', dissolvedOxygen: 3.2 });
    expect(result.pond).toMatchObject({ feedingStatus: 'STOPPED', stopFeedingReason: 'Low Oxygen' });
    expect(validateStateMutation(previous, result.state!, { module: 'water_quality', action: 'create' }).ok).toBe(true);
  });

  it('rejects stale or unsynchronized telemetry before it can become authoritative', () => {
    const now = Date.now();
    const stale = safePoints(now);
    stale.temp = point('temp', 16, now - 20 * 60_000, false);
    expect(buildAuthoritativeWaterMutation(baseState(), mapping, stale, 'Sensor', now)).toMatchObject({ ok: false });

    const spread = safePoints(now);
    spread.ph = point('ph', 7.4, now - 5 * 60_000, true);
    expect(buildAuthoritativeWaterMutation(baseState(), mapping, spread, 'Sensor', now)).toMatchObject({ ok: false, error: 'WATER_TELEMETRY_POINTS_NOT_SYNCHRONIZED' });
  });

  it('rejects physically invalid fresh values rather than writing a VALID ledger row', () => {
    const now = Date.now();
    const invalid = safePoints(now);
    invalid.ph = point('ph', 15, now - 60_000);
    expect(buildAuthoritativeWaterMutation(baseState(), mapping, invalid, 'Sensor', now)).toMatchObject({ ok: false, error: 'WATER_TELEMETRY_NOT_AUTHORITATIVE' });
  });
});
