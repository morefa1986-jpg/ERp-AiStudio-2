import type {} from './index';

export type OperationalStockSex = 'Female' | 'Male' | 'Unknown';

declare module './index' {
  interface FishTransfer {
    stockSex?: OperationalStockSex;
    chipNumbers?: string[];
  }

  interface MortalityRecord {
    stockSex?: OperationalStockSex;
    chipNumbers?: string[];
  }

  interface BiometricSession {
    stockSex?: OperationalStockSex;
  }
}

export {};
