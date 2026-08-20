import { describe, it, expect } from 'vitest';
import {
  assessWaterSafetyForFeeding,
  validateDissolvedOxygen,
} from '../utils/sensorValidation';

describe('Feeding Safety Engine & Water Quality Rules', () => {
  it('strictly blocks feeding when Dissolved Oxygen is below 4.0 mg/L', () => {
    const safety = assessWaterSafetyForFeeding({
      dissolvedOxygen: 3.8,
      waterTemperature: 16.5,
      ph: 7.5,
    });

    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.isCriticalAlert).toBe(true);
    expect(safety.feedingProhibitionReason).toContain('کمتر از حد مجاز');
    expect(safety.doStatus.status).toBe('CRITICAL');
  });

  it('allows feeding when DO is safe (>= 4.0 mg/L) and temperature is optimal', () => {
    const safety = assessWaterSafetyForFeeding({
      dissolvedOxygen: 6.8,
      waterTemperature: 16.5,
      ph: 7.4,
    });

    expect(safety.isSafeForFeeding).toBe(true);
    expect(safety.isCriticalAlert).toBe(false);
    expect(safety.feedingProhibitionReason).toBeUndefined();
    expect(safety.doStatus.status).toBe('VALID');
  });

  it('blocks feeding when water temperature is below metabolic threshold (< 4.0°C)', () => {
    const safety = assessWaterSafetyForFeeding({
      dissolvedOxygen: 8.0,
      waterTemperature: 2.5,
      ph: 7.2,
    });

    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.isCriticalAlert).toBe(true);
    expect(safety.feedingProhibitionReason).toContain('محدوده ایمن تغذیه');
    expect(safety.tempStatus.status).toBe('CRITICAL');
  });

  it('blocks feeding when water temperature exceeds safety limit (> 25.0°C)', () => {
    const safety = assessWaterSafetyForFeeding({
      dissolvedOxygen: 6.0,
      waterTemperature: 26.5,
      ph: 7.2,
    });

    expect(safety.isSafeForFeeding).toBe(false);
    expect(safety.isCriticalAlert).toBe(true);
    expect(safety.tempStatus.status).toBe('CRITICAL');
  });

  it('handles disconnected / null / NaN sensors as sensor faults and blocks feeding', () => {
    const nullDOSafety = assessWaterSafetyForFeeding({
      dissolvedOxygen: null as any,
      waterTemperature: 16.0,
    });
    expect(nullDOSafety.isSafeForFeeding).toBe(false);
    expect(nullDOSafety.doStatus.status).toBe('SENSOR_FAULT');

    const nanTempSafety = assessWaterSafetyForFeeding({
      dissolvedOxygen: 7.2,
      waterTemperature: NaN,
    });
    expect(nanTempSafety.isSafeForFeeding).toBe(false);
    expect(nanTempSafety.tempStatus.status).toBe('SENSOR_FAULT');
  });

  it('detects zero DO as lethal emergency or sensor disconnected fault', () => {
    const zeroDO = validateDissolvedOxygen(0);
    expect(zeroDO.isValid).toBe(false);
    expect(zeroDO.status).toBe('SENSOR_FAULT');
  });
});
