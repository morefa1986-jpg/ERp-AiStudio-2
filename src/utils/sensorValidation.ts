/**
 * Fathi Aqua Super ERP - Sensor Validation Engine
 * Implements strict numeric range validation, null/undefined/NaN handling,
 * sensor connectivity status checks, and stale data detection.
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
  staleTelemetry: boolean;
}

// Biological and physical parameter boundaries for Sturgeon (Acipenseridae)
export const SENSOR_BOUNDS = {
  DISSOLVED_OXYGEN: {
    ABSOLUTE_MIN: 0.1,
    CRITICAL_FEEDING_MIN: 4.0, // Hard limit: No feeding below 4.0 mg/L
    WARNING_MIN: 5.5,
    OPTIMAL_MIN: 6.5,
    OPTIMAL_MAX: 12.0,
    PHYSICAL_MAX: 25.0, // Hyper-oxygenation upper limit
  },
  TEMPERATURE: {
    LETHAL_MIN: 3.0, // Feeding completely ceases below 4.0°C
    FEEDING_MIN: 4.0,
    OPTIMAL_MIN: 14.0,
    OPTIMAL_MAX: 19.5,
    FEEDING_MAX: 25.0, // Feeding ceases above 25.0°C due to oxygen stress
    LETHAL_MAX: 29.0,
  },
  PH: {
    MIN: 6.0,
    OPTIMAL_MIN: 6.8,
    OPTIMAL_MAX: 8.2,
    MAX: 9.0,
  },
  AMMONIA_NH3: {
    SAFE_MAX: 0.02, // mg/L un-ionized ammonia
    CRITICAL_MAX: 0.05,
  },
  NITRITE_NO2: {
    SAFE_MAX: 0.2, // mg/L
    CRITICAL_MAX: 0.5,
  },
  MAX_SENSOR_AGE_HOURS: 6, // Telemetry older than 6 hours is marked STALE
};

/**
 * Validate individual Dissolved Oxygen reading
 */
export function validateDissolvedOxygen(
  rawDO: number | null | undefined,
  timestamp?: string
): SensorValidationResult {
  const errors: string[] = [];

  if (rawDO === null || rawDO === undefined || Number.isNaN(Number(rawDO))) {
    return {
      isValid: false,
      status: 'SENSOR_FAULT',
      sanitizedValue: 0,
      message: 'سنسور اکسیژن محلول متصل نیست یا مقداری ارسال نکرده است (Null/NaN).',
      errors: ['DO_VALUE_MISSING'],
    };
  }

  const value = Number(rawDO);

  if (value <= 0) {
    return {
      isValid: false,
      status: 'SENSOR_FAULT',
      sanitizedValue: 0,
      message: 'مقدار اکسیژن صفر یا منفی است (خطای قطعی سنسور یا شرایط خفگی مرگبار).',
      errors: ['DO_ZERO_OR_NEGATIVE'],
    };
  }

  if (value > SENSOR_BOUNDS.DISSOLVED_OXYGEN.PHYSICAL_MAX) {
    return {
      isValid: false,
      status: 'SENSOR_FAULT',
      sanitizedValue: value,
      message: `مقدار اکسیژن (${value} mg/L) بالاتر از حداکثر ظرفیت فیزیکی است. سنسور نیاز به کالیبراسیون دارد.`,
      errors: ['DO_ABOVE_PHYSICAL_MAX'],
    };
  }

  // Check timestamp staleness
  if (timestamp) {
    const ageHours = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
    if (ageHours > SENSOR_BOUNDS.MAX_SENSOR_AGE_HOURS) {
      return {
        isValid: false,
        status: 'STALE',
        sanitizedValue: value,
        message: `داده سنسور اکسیژن قدیمی است (${Math.round(ageHours)} ساعت قبل). نیاز به پایش مجدد.`,
        errors: ['DO_DATA_STALE'],
      };
    }
  }

  if (value < SENSOR_BOUNDS.DISSOLVED_OXYGEN.CRITICAL_FEEDING_MIN) {
    return {
      isValid: true,
      status: 'CRITICAL',
      sanitizedValue: value,
      message: `اکسیژن کمتر از حد بحرانی ${SENSOR_BOUNDS.DISSOLVED_OXYGEN.CRITICAL_FEEDING_MIN} mg/L است (${value} mg/L). تغذیه ممنوع است!`,
      errors: ['DO_BELOW_FEEDING_THRESHOLD'],
    };
  }

  if (value < SENSOR_BOUNDS.DISSOLVED_OXYGEN.WARNING_MIN) {
    return {
      isValid: true,
      status: 'WARNING',
      sanitizedValue: value,
      message: `اکسیژن در محدوده هشدار است (${value} mg/L).`,
      errors: [],
    };
  }

  return {
    isValid: true,
    status: 'VALID',
    sanitizedValue: value,
    errors: [],
  };
}

/**
 * Validate individual Water Temperature reading
 */
export function validateWaterTemperature(
  rawTemp: number | null | undefined,
  timestamp?: string
): SensorValidationResult {
  const errors: string[] = [];

  if (rawTemp === null || rawTemp === undefined || Number.isNaN(Number(rawTemp))) {
    return {
      isValid: false,
      status: 'SENSOR_FAULT',
      sanitizedValue: 0,
      message: 'سنسور دماسنج متصل نیست یا مقداری ارسال نکرده است.',
      errors: ['TEMP_VALUE_MISSING'],
    };
  }

  const value = Number(rawTemp);

  if (value < -1.0 || value > 40.0) {
    return {
      isValid: false,
      status: 'SENSOR_FAULT',
      sanitizedValue: value,
      message: `دمای آب (${value}°C) خارج از محدوده فیزیکی است.`,
      errors: ['TEMP_OUT_OF_PHYSICAL_RANGE'],
    };
  }

  if (value < SENSOR_BOUNDS.TEMPERATURE.FEEDING_MIN) {
    return {
      isValid: true,
      status: 'CRITICAL',
      sanitizedValue: value,
      message: `دمای آب (${value}°C) کمتر از ۴ درجه است؛ متابولیسم و هضم تاس‌ماهیان متوقف است. تغذیه ممنوع!`,
      errors: ['TEMP_BELOW_METABOLIC_MIN'],
    };
  }

  if (value > SENSOR_BOUNDS.TEMPERATURE.FEEDING_MAX) {
    return {
      isValid: true,
      status: 'CRITICAL',
      sanitizedValue: value,
      message: `دمای آب (${value}°C) بالاتر از ۲۵ درجه است؛ ریسک استرس دمایی و افت شدید اکسیژن. تغذیه ممنوع!`,
      errors: ['TEMP_ABOVE_SAFETY_MAX'],
    };
  }

  return {
    isValid: true,
    status: 'VALID',
    sanitizedValue: value,
    errors: [],
  };
}

/**
 * Comprehensive Water Safety Evaluation for Feeding Engine
 */
export function assessWaterSafetyForFeeding(params: PondWaterParams): WaterSafetyAssessment {
  const doResult = validateDissolvedOxygen(params.dissolvedOxygen, params.timestamp);
  const tempResult = validateWaterTemperature(params.waterTemperature, params.timestamp);

  let isSafeForFeeding = true;
  let isCriticalAlert = false;
  let feedingProhibitionReason: string | undefined = undefined;

  // Rule 1: Sensor must be valid and operational
  if (!doResult.isValid) {
    isSafeForFeeding = false;
    isCriticalAlert = true;
    feedingProhibitionReason = `خطای سنسور اکسیژن: ${doResult.message}`;
  } else if (!tempResult.isValid) {
    isSafeForFeeding = false;
    isCriticalAlert = true;
    feedingProhibitionReason = `خطای سنسور دما: ${tempResult.message}`;
  } else if (doResult.status === 'STALE') {
    isSafeForFeeding = false;
    feedingProhibitionReason = `داده‌های پایش اکسیژن منقضی است (${doResult.message}).`;
  } else if (doResult.status === 'CRITICAL' || doResult.sanitizedValue < SENSOR_BOUNDS.DISSOLVED_OXYGEN.CRITICAL_FEEDING_MIN) {
    // Rule 2: DO MUST NOT be < 4.0 mg/L
    isSafeForFeeding = false;
    isCriticalAlert = true;
    feedingProhibitionReason = `اکسیژن محلول (${doResult.sanitizedValue} mg/L) کمتر از حد مجاز ۴.۰ mg/L است.`;
  } else if (tempResult.status === 'CRITICAL') {
    // Rule 3: Temperature within metabolic limits
    isSafeForFeeding = false;
    isCriticalAlert = true;
    feedingProhibitionReason = `دمای آب (${tempResult.sanitizedValue}°C) خارج از محدوده ایمن تغذیه (۴ الی ۲۵ درجه) است.`;
  }

  return {
    isSafeForFeeding,
    isCriticalAlert,
    feedingProhibitionReason,
    doStatus: doResult,
    tempStatus: tempResult,
    staleTelemetry: doResult.status === 'STALE' || tempResult.status === 'STALE',
  };
}
