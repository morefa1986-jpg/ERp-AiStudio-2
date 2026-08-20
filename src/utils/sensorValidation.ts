/**
 * Fathi Aqua Super ERP - Sensor Validation Engine
 * Strict numeric/range validation plus stale-data protection for feeding decisions.
 */

export interface SensorReading {
  value: number | null | undefined;
  unit: string;
  timestamp?: string;
  sensorId?: string;
  sensorStatus?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'CALIBRATION_REQUIRED';
}

export interface SensorValidationResult {
  isValid: boolean;
  status: 'VALID' | 'WARNING' | 'CRITICAL' | 'STALE' | 'SENSOR_FAULT' | 'DISCONNECTED';
  sanitizedValue: number;
  message?: string;
  errors: string[];
}

export interface PondWaterParams {
  dissolvedOxygen: number | null | undefined;
  waterTemperature: number | null | undefined;
  ph?: number | null | undefined;
  ammonia?: number | null | undefined;
  nitrite?: number | null | undefined;
  timestamp?: string;
}

export interface WaterSafetyAssessment {
  isSafeForFeeding: boolean;
  isCriticalAlert: boolean;
  feedingProhibitionReason?: string;
  doStatus: SensorValidationResult;
  tempStatus: SensorValidationResult;
  phStatus?: SensorValidationResult;
  ammoniaStatus?: SensorValidationResult;
  nitriteStatus?: SensorValidationResult;
  staleTelemetry: boolean;
}

export const SENSOR_BOUNDS = {
  DISSOLVED_OXYGEN: { ABSOLUTE_MIN: 0.1, CRITICAL_FEEDING_MIN: 4.0, WARNING_MIN: 5.5, OPTIMAL_MIN: 6.5, OPTIMAL_MAX: 12.0, PHYSICAL_MAX: 25.0 },
  TEMPERATURE: { LETHAL_MIN: 3.0, FEEDING_MIN: 4.0, OPTIMAL_MIN: 14.0, OPTIMAL_MAX: 19.5, FEEDING_MAX: 25.0, LETHAL_MAX: 29.0 },
  PH: { MIN: 6.0, OPTIMAL_MIN: 6.8, OPTIMAL_MAX: 8.2, MAX: 9.0 },
  AMMONIA_NH3: { SAFE_MAX: 0.02, CRITICAL_MAX: 0.05 },
  NITRITE_NO2: { SAFE_MAX: 0.2, CRITICAL_MAX: 0.5 },
  MAX_SENSOR_AGE_HOURS: 6,
};

function staleResult(value: number, timestamp: string | undefined, code: string, label: string): SensorValidationResult | null {
  if (!timestamp) return null;
  const ts = new Date(timestamp).getTime();
  if (!Number.isFinite(ts)) {
    return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: `زمان ثبت ${label} نامعتبر است.`, errors: [`${code}_TIMESTAMP_INVALID`] };
  }
  const ageHours = (Date.now() - ts) / 3_600_000;
  if (ageHours < -0.25) {
    return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: `زمان ثبت ${label} در آینده است.`, errors: [`${code}_TIMESTAMP_FUTURE`] };
  }
  if (ageHours > SENSOR_BOUNDS.MAX_SENSOR_AGE_HOURS) {
    return { isValid: false, status: 'STALE', sanitizedValue: value, message: `داده ${label} قدیمی است (${Math.round(ageHours)} ساعت قبل).`, errors: [`${code}_DATA_STALE`] };
  }
  return null;
}

function numericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function validateDissolvedOxygen(rawDO: number | null | undefined, timestamp?: string): SensorValidationResult {
  const value = numericValue(rawDO);
  if (value === null) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: 'مقدار اکسیژن محلول نامعتبر یا موجود نیست.', errors: ['DO_VALUE_MISSING'] };
  if (value <= 0) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: 'مقدار اکسیژن صفر یا منفی است.', errors: ['DO_ZERO_OR_NEGATIVE'] };
  if (value > SENSOR_BOUNDS.DISSOLVED_OXYGEN.PHYSICAL_MAX) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: `اکسیژن ${value} mg/L خارج از محدوده فیزیکی است.`, errors: ['DO_ABOVE_PHYSICAL_MAX'] };
  const stale = staleResult(value, timestamp, 'DO', 'اکسیژن');
  if (stale) return stale;
  if (value < SENSOR_BOUNDS.DISSOLVED_OXYGEN.CRITICAL_FEEDING_MIN) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: `اکسیژن ${value} mg/L کمتر از حد مجاز تغذیه است.`, errors: ['DO_BELOW_FEEDING_THRESHOLD'] };
  if (value < SENSOR_BOUNDS.DISSOLVED_OXYGEN.WARNING_MIN) return { isValid: true, status: 'WARNING', sanitizedValue: value, message: `اکسیژن ${value} mg/L در محدوده هشدار است.`, errors: [] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

export function validateWaterTemperature(rawTemp: number | null | undefined, timestamp?: string): SensorValidationResult {
  const value = numericValue(rawTemp);
  if (value === null) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: 'مقدار دمای آب نامعتبر یا موجود نیست.', errors: ['TEMP_VALUE_MISSING'] };
  if (value < -1 || value > 40) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: `دمای ${value}°C خارج از محدوده فیزیکی است.`, errors: ['TEMP_OUT_OF_PHYSICAL_RANGE'] };
  const stale = staleResult(value, timestamp, 'TEMP', 'دما');
  if (stale) return stale;
  if (value < SENSOR_BOUNDS.TEMPERATURE.FEEDING_MIN) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: `دمای ${value}°C پایین‌تر از محدوده ایمن تغذیه است.`, errors: ['TEMP_BELOW_METABOLIC_MIN'] };
  if (value > SENSOR_BOUNDS.TEMPERATURE.FEEDING_MAX) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: `دمای ${value}°C بالاتر از محدوده ایمن تغذیه است.`, errors: ['TEMP_ABOVE_SAFETY_MAX'] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

export function validatePh(rawPh: number | null | undefined, timestamp?: string): SensorValidationResult {
  const value = numericValue(rawPh);
  if (value === null) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: 'مقدار pH نامعتبر یا موجود نیست.', errors: ['PH_VALUE_MISSING'] };
  if (value <= 0 || value > 14) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: `pH ${value} خارج از محدوده فیزیکی است.`, errors: ['PH_OUT_OF_PHYSICAL_RANGE'] };
  const stale = staleResult(value, timestamp, 'PH', 'pH');
  if (stale) return stale;
  if (value < SENSOR_BOUNDS.PH.MIN || value > SENSOR_BOUNDS.PH.MAX) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: `pH ${value} خارج از محدوده ایمن ${SENSOR_BOUNDS.PH.MIN}-${SENSOR_BOUNDS.PH.MAX} است.`, errors: ['PH_UNSAFE'] };
  if (value < SENSOR_BOUNDS.PH.OPTIMAL_MIN || value > SENSOR_BOUNDS.PH.OPTIMAL_MAX) return { isValid: true, status: 'WARNING', sanitizedValue: value, message: `pH ${value} خارج از محدوده بهینه است.`, errors: [] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

function validateChemical(raw: number | null | undefined, safeMax: number, criticalMax: number, code: string, label: string, timestamp?: string): SensorValidationResult | undefined {
  if (raw === null || raw === undefined) return undefined;
  const value = numericValue(raw);
  if (value === null || value < 0) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: `${label} نامعتبر است.`, errors: [`${code}_INVALID`] };
  const stale = staleResult(value, timestamp, code, label);
  if (stale) return stale;
  if (value >= criticalMax) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: `${label} در محدوده بحرانی است.`, errors: [`${code}_CRITICAL`] };
  if (value > safeMax) return { isValid: true, status: 'WARNING', sanitizedValue: value, message: `${label} بالاتر از محدوده ایمن است.`, errors: [`${code}_WARNING`] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

export function assessWaterSafetyForFeeding(params: PondWaterParams): WaterSafetyAssessment {
  const doStatus = validateDissolvedOxygen(params.dissolvedOxygen, params.timestamp);
  const tempStatus = validateWaterTemperature(params.waterTemperature, params.timestamp);
  const phStatus = params.ph === undefined ? undefined : validatePh(params.ph, params.timestamp);
  const ammoniaStatus = validateChemical(params.ammonia, SENSOR_BOUNDS.AMMONIA_NH3.SAFE_MAX, SENSOR_BOUNDS.AMMONIA_NH3.CRITICAL_MAX, 'NH3', 'آمونیاک', params.timestamp);
  const nitriteStatus = validateChemical(params.nitrite, SENSOR_BOUNDS.NITRITE_NO2.SAFE_MAX, SENSOR_BOUNDS.NITRITE_NO2.CRITICAL_MAX, 'NO2', 'نیتریت', params.timestamp);
  const statuses = [doStatus, tempStatus, phStatus, ammoniaStatus, nitriteStatus].filter(Boolean) as SensorValidationResult[];
  const invalid = statuses.find((s) => !s.isValid || s.status === 'STALE' || s.status === 'SENSOR_FAULT' || s.status === 'DISCONNECTED');
  const critical = statuses.find((s) => s.status === 'CRITICAL');

  let feedingProhibitionReason: string | undefined;
  if (invalid) feedingProhibitionReason = invalid.message || 'داده سنسور نامعتبر یا منقضی است.';
  else if (critical) feedingProhibitionReason = critical.message || 'یکی از پارامترهای آب در محدوده بحرانی است.';

  return {
    isSafeForFeeding: !invalid && !critical,
    isCriticalAlert: Boolean(invalid || critical),
    feedingProhibitionReason,
    doStatus,
    tempStatus,
    phStatus,
    ammoniaStatus,
    nitriteStatus,
    staleTelemetry: statuses.some((s) => s.status === 'STALE'),
  };
}
