import { describe, it, expect } from 'vitest';
import {
  validateDissolvedOxygen,
  validateWaterTemperature,
  SENSOR_BOUNDS,
} from '../utils/sensorValidation';

describe('Sensor Validation & Telemetry Engine', () => {
  it('detects physically impossible hyper-oxygenation (> 25.0 mg/L)', () => {
    const res = validateDissolvedOxygen(32.0);
    expect(res.isValid).toBe(false);
    expect(res.status).toBe('SENSOR_FAULT');
    expect(res.errors).toContain('DO_ABOVE_PHYSICAL_MAX');
  });

  it('marks telemetry older than 6 hours as STALE', () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    const res = validateDissolvedOxygen(7.5, sevenHoursAgo);
    expect(res.isValid).toBe(false);
    expect(res.status).toBe('STALE');
    expect(res.errors).toContain('DO_DATA_STALE');
  });

  it('accepts fresh telemetry within acceptable time window', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const res = validateDissolvedOxygen(7.5, tenMinutesAgo);
    expect(res.isValid).toBe(true);
    expect(res.status).toBe('VALID');
  });

  it('validates water temperature within physiological ranges', () => {
    const valid = validateWaterTemperature(17.2, new Date().toISOString());
    expect(valid.isValid).toBe(true);
    expect(valid.status).toBe('VALID');
    expect(valid.sanitizedValue).toBe(17.2);

    const missingTimestamp = validateWaterTemperature(17.2);
    expect(missingTimestamp.isValid).toBe(false);
    expect(missingTimestamp.errors).toContain('TEMP_TIMESTAMP_MISSING');

    const outOfRange = validateWaterTemperature(45.0);
    expect(outOfRange.isValid).toBe(false);
    expect(outOfRange.status).toBe('SENSOR_FAULT');
  });
});
