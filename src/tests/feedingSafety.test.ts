import { describe, it, expect } from 'vitest';
import {
  assessWaterSafetyForFeeding,
  SENSOR_MAX_AGE_MINUTES,
  validateDissolvedOxygen,
} from '../utils/sensorValidation';

describe('Feeding Safety Engine & Water Quality Rules', () => {
  const fresh = new Date().toISOString();
  const safeWater = { dissolvedOxygen: 6.8, waterTemperature: 16.5, ph: 7.4, ammonia: 0.01, nitrite: 0.05 };

  it('strictly blocks feeding when Dissolved Oxygen is below 4.0 mg/L', () => {
    const safety = assessWaterSafetyForFeeding({ ...safeWater, dissolvedOxygen: 3.8, timestamp: fresh });
    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.isCriticalAlert).toBe(true);
    expect(safety.feedingProhibitionReason).toContain('کمتر از حد مجاز');
    expect(safety.doStatus.status).toBe('CRITICAL');
  });

  it('allows feeding when all authoritative parameters are safe and fresh', () => {
    const safety = assessWaterSafetyForFeeding({ ...safeWater, timestamp: fresh });
    expect(safety.isSafeForFeeding).toBe(true);
    expect(safety.isCriticalAlert).toBe(false);
    expect(safety.feedingProhibitionReason).toBeUndefined();
    expect(safety.doStatus.status).toBe('VALID');
  });

  it('fails closed when telemetry is older than 15 minutes', () => {
    expect(SENSOR_MAX_AGE_MINUTES).toBe(15);
    const staleTimestamp = new Date(Date.now() - 16 * 60_000).toISOString();
    const safety = assessWaterSafetyForFeeding({ ...safeWater, timestamp: staleTimestamp, sensorStatus: 'VALID' });
    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.staleTelemetry).toBe(true);
    expect(safety.doStatus.status).toBe('STALE');
  });

  it('blocks feeding when water temperature is below metabolic threshold (< 4.0°C)', () => {
    const safety = assessWaterSafetyForFeeding({ ...safeWater, waterTemperature: 2.5, timestamp: fresh });
    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.isCriticalAlert).toBe(true);
    expect(safety.tempStatus.status).toBe('CRITICAL');
  });

  it('blocks feeding when water temperature exceeds safety limit (> 25.0°C)', () => {
    const safety = assessWaterSafetyForFeeding({ ...safeWater, waterTemperature: 26.5, timestamp: fresh });
    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.isCriticalAlert).toBe(true);
    expect(safety.tempStatus.status).toBe('CRITICAL');
  });

  it('handles disconnected / null / NaN sensors as sensor faults and blocks feeding', () => {
    const nullDOSafety = assessWaterSafetyForFeeding({ dissolvedOxygen: null as any, waterTemperature: 16.0 });
    expect(nullDOSafety.isSafeForFeeding).toBe(false);
    expect(nullDOSafety.doStatus.status).toBe('SENSOR_FAULT');

    const nanTempSafety = assessWaterSafetyForFeeding({ dissolvedOxygen: 7.2, waterTemperature: NaN });
    expect(nanTempSafety.isSafeForFeeding).toBe(false);
    expect(nanTempSafety.tempStatus.status).toBe('SENSOR_FAULT');
  });

  it('detects zero DO as sensor fault', () => {
    const zeroDO = validateDissolvedOxygen(0);
    expect(zeroDO.isValid).toBe(false);
    expect(zeroDO.status).toBe('SENSOR_FAULT');
  });
});
