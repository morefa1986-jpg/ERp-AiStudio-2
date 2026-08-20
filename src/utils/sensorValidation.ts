/**
 * Fathi Aqua Super ERP - Sensor Validation Engine
 * Strict numeric/range validation plus stale-data protection for feeding decisions.
 */
import { LanguageCode } from '../types';
import { runtimeMessage, runtimeSensorLabel } from '../i18n/runtimeMessages';

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
  language?: LanguageCode;
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

function staleResult(value: number, timestamp: string | undefined, code: string, label: string, language: LanguageCode): SensorValidationResult | null {
  if (!timestamp) return null;
  const ts = new Date(timestamp).getTime();
  if (!Number.isFinite(ts)) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: runtimeMessage(language, 'sensor.timestampInvalid', { label }), errors: [`${code}_TIMESTAMP_INVALID`] };
  const ageHours = (Date.now() - ts) / 3_600_000;
  if (ageHours < -0.25) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: runtimeMessage(language, 'sensor.timestampFuture', { label }), errors: [`${code}_TIMESTAMP_FUTURE`] };
  if (ageHours > SENSOR_BOUNDS.MAX_SENSOR_AGE_HOURS) return { isValid: false, status: 'STALE', sanitizedValue: value, message: runtimeMessage(language, 'sensor.stale', { label, hours: Math.round(ageHours) }), errors: [`${code}_DATA_STALE`] };
  return null;
}

function numericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function validateDissolvedOxygen(rawDO: number | null | undefined, timestamp?: string, language: LanguageCode = 'fa'): SensorValidationResult {
  const label = runtimeSensorLabel(language, 'oxygen');
  const value = numericValue(rawDO);
  if (value === null) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: runtimeMessage(language, 'sensor.missing', { label }), errors: ['DO_VALUE_MISSING'] };
  if (value <= 0) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: runtimeMessage(language, 'sensor.zeroOrNegative', { label }), errors: ['DO_ZERO_OR_NEGATIVE'] };
  if (value > SENSOR_BOUNDS.DISSOLVED_OXYGEN.PHYSICAL_MAX) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: runtimeMessage(language, 'sensor.outOfPhysicalRange', { label, value, unit: ' mg/L' }), errors: ['DO_ABOVE_PHYSICAL_MAX'] };
  const stale = staleResult(value, timestamp, 'DO', label, language); if (stale) return stale;
  if (value < SENSOR_BOUNDS.DISSOLVED_OXYGEN.CRITICAL_FEEDING_MIN) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: runtimeMessage(language, 'sensor.belowFeedingThreshold', { label, value, unit: ' mg/L' }), errors: ['DO_BELOW_FEEDING_THRESHOLD'] };
  if (value < SENSOR_BOUNDS.DISSOLVED_OXYGEN.WARNING_MIN) return { isValid: true, status: 'WARNING', sanitizedValue: value, message: runtimeMessage(language, 'sensor.warningRange', { label, value, unit: ' mg/L' }), errors: [] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

export function validateWaterTemperature(rawTemp: number | null | undefined, timestamp?: string, language: LanguageCode = 'fa'): SensorValidationResult {
  const label = runtimeSensorLabel(language, 'temperature');
  const value = numericValue(rawTemp);
  if (value === null) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: runtimeMessage(language, 'sensor.missing', { label }), errors: ['TEMP_VALUE_MISSING'] };
  if (value < -1 || value > 40) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: runtimeMessage(language, 'sensor.outOfPhysicalRange', { label, value, unit: '°C' }), errors: ['TEMP_OUT_OF_PHYSICAL_RANGE'] };
  const stale = staleResult(value, timestamp, 'TEMP', label, language); if (stale) return stale;
  if (value < SENSOR_BOUNDS.TEMPERATURE.FEEDING_MIN) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: runtimeMessage(language, 'sensor.belowFeedingThreshold', { label, value, unit: '°C' }), errors: ['TEMP_BELOW_METABOLIC_MIN'] };
  if (value > SENSOR_BOUNDS.TEMPERATURE.FEEDING_MAX) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: runtimeMessage(language, 'sensor.aboveFeedingThreshold', { label, value, unit: '°C' }), errors: ['TEMP_ABOVE_SAFETY_MAX'] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

export function validatePh(rawPh: number | null | undefined, timestamp?: string, language: LanguageCode = 'fa'): SensorValidationResult {
  const label = runtimeSensorLabel(language, 'ph');
  const value = numericValue(rawPh);
  if (value === null) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: runtimeMessage(language, 'sensor.missing', { label }), errors: ['PH_VALUE_MISSING'] };
  if (value <= 0 || value > 14) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: value, message: runtimeMessage(language, 'sensor.outOfPhysicalRange', { label, value, unit: '' }), errors: ['PH_OUT_OF_PHYSICAL_RANGE'] };
  const stale = staleResult(value, timestamp, 'PH', label, language); if (stale) return stale;
  if (value < SENSOR_BOUNDS.PH.MIN || value > SENSOR_BOUNDS.PH.MAX) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: runtimeMessage(language, 'sensor.unsafeRange', { label, value, min: SENSOR_BOUNDS.PH.MIN, max: SENSOR_BOUNDS.PH.MAX }), errors: ['PH_UNSAFE'] };
  if (value < SENSOR_BOUNDS.PH.OPTIMAL_MIN || value > SENSOR_BOUNDS.PH.OPTIMAL_MAX) return { isValid: true, status: 'WARNING', sanitizedValue: value, message: runtimeMessage(language, 'sensor.outsideOptimal', { label, value }), errors: [] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

function validateChemical(raw: number | null | undefined, safeMax: number, criticalMax: number, code: string, label: string, timestamp: string | undefined, language: LanguageCode): SensorValidationResult | undefined {
  if (raw === null || raw === undefined) return undefined;
  const value = numericValue(raw);
  if (value === null || value < 0) return { isValid: false, status: 'SENSOR_FAULT', sanitizedValue: 0, message: runtimeMessage(language, 'sensor.chemicalInvalid', { label }), errors: [`${code}_INVALID`] };
  const stale = staleResult(value, timestamp, code, label, language); if (stale) return stale;
  if (value >= criticalMax) return { isValid: true, status: 'CRITICAL', sanitizedValue: value, message: runtimeMessage(language, 'sensor.chemicalCritical', { label }), errors: [`${code}_CRITICAL`] };
  if (value > safeMax) return { isValid: true, status: 'WARNING', sanitizedValue: value, message: runtimeMessage(language, 'sensor.chemicalWarning', { label }), errors: [`${code}_WARNING`] };
  return { isValid: true, status: 'VALID', sanitizedValue: value, errors: [] };
}

export function assessWaterSafetyForFeeding(params: PondWaterParams): WaterSafetyAssessment {
  const language = params.language || 'fa';
  const doStatus = validateDissolvedOxygen(params.dissolvedOxygen, params.timestamp, language);
  const tempStatus = validateWaterTemperature(params.waterTemperature, params.timestamp, language);
  const phStatus = params.ph === undefined ? undefined : validatePh(params.ph, params.timestamp, language);
  const ammoniaStatus = validateChemical(params.ammonia, SENSOR_BOUNDS.AMMONIA_NH3.SAFE_MAX, SENSOR_BOUNDS.AMMONIA_NH3.CRITICAL_MAX, 'NH3', runtimeSensorLabel(language, 'ammonia'), params.timestamp, language);
  const nitriteStatus = validateChemical(params.nitrite, SENSOR_BOUNDS.NITRITE_NO2.SAFE_MAX, SENSOR_BOUNDS.NITRITE_NO2.CRITICAL_MAX, 'NO2', runtimeSensorLabel(language, 'nitrite'), params.timestamp, language);
  const statuses = [doStatus, tempStatus, phStatus, ammoniaStatus, nitriteStatus].filter(Boolean) as SensorValidationResult[];
  const invalid = statuses.find((s) => !s.isValid || s.status === 'STALE' || s.status === 'SENSOR_FAULT' || s.status === 'DISCONNECTED');
  const critical = statuses.find((s) => s.status === 'CRITICAL');
  let feedingProhibitionReason: string | undefined;
  if (invalid) feedingProhibitionReason = invalid.message || runtimeMessage(language, 'sensor.invalidOrExpired');
  else if (critical) feedingProhibitionReason = critical.message || runtimeMessage(language, 'sensor.waterCritical');
  return { isSafeForFeeding: !invalid && !critical, isCriticalAlert: Boolean(invalid || critical), feedingProhibitionReason, doStatus, tempStatus, phStatus, ammoniaStatus, nitriteStatus, staleTelemetry: statuses.some((s) => s.status === 'STALE') };
}
