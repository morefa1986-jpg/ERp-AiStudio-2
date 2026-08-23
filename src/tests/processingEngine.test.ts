import { describe, expect, it } from 'vitest';
import { ColdStoragePallet, Pond } from '../types';
import { executeAtomicProcessing } from '../utils/processingEngine';

const pond: Pond = {
  id: 'pond_source', number: 'P-1', name: 'Source', hallId: 'hall_1', capacityCubicMeters: 100,
  fishCount: 100, speciesId: 'sp_1', biomassKg: 1000, averageWeightKg: 10, lastFeedingKg: 0,
  lastFeedingTime: '', feedingStatus: 'ACTIVE', fcr: 1, dailyMortalityCount: 0, waterTemperature: 16,
  dissolvedOxygen: 7, ph: 7.4, lastBiometryDate: '', criticalAlerts: [],
};

const baseInput = {
  batchCode: 'PROC-001', date: '2026-08-21', outputExpiryDate: '2026-12-31', sourcePondId: pond.id, sourcePondName: pond.name,
  speciesName: 'Test species', fishCount: 10, liveBiomassKg: 100, caviarYieldKg: 10,
  caviarGrade: 'Classic Baerii' as const, filletMeatYieldKg: 60, smokedMeatYieldKg: 20,
  byProductAndWasteKg: 10, operatorName: 'Operator', qualityScore: 90,
  citesPermitNumber: 'CITES-1', status: 'Stored In Cold Room' as const,
};

describe('atomic processing conservation', () => {
  it('decreases live stock and creates traceable output lots with explicit expiry', () => {
    const result = executeAtomicProcessing(baseInput, [pond], [] as ColdStoragePallet[], 'txn_test');
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('txn_test');
    expect(result.ponds?.[0]).toMatchObject({ fishCount: 90, biomassKg: 900 });
    expect(result.batch?.outputLotIds).toHaveLength(3);
    expect(result.coldStorage?.reduce((sum, lot) => sum + lot.weightKg, 0)).toBe(90);
    expect(result.coldStorage?.every((lot) => lot.expiryDate === '2026-12-31')).toBe(true);
    expect(result.coldStorage?.some((lot) => lot.sku?.startsWith('CAV-PROC-001'))).toBe(true);
  });

  it('rejects output mismatch and insufficient source stock without changing input arrays', () => {
    expect(executeAtomicProcessing({ ...baseInput, byProductAndWasteKg: 1 }, [pond], []).success).toBe(false);
    expect(executeAtomicProcessing({ ...baseInput, fishCount: 101 }, [pond], []).success).toBe(false);
    expect(pond.fishCount).toBe(100);
    expect(pond.biomassKg).toBe(1000);
  });

  it('fails closed for active treatment and invalid expiry/QC', () => {
    expect(executeAtomicProcessing(baseInput, [{ ...pond, activeTreatmentId: 'trt_1' }], []).success).toBe(false);
    expect(executeAtomicProcessing({ ...baseInput, outputExpiryDate: '2026-08-20' }, [pond], []).success).toBe(false);
    expect(executeAtomicProcessing({ ...baseInput, qualityScore: 101 }, [pond], []).success).toBe(false);
    expect(executeAtomicProcessing({ ...baseInput, speciesName: '' }, [pond], []).success).toBe(false);
  });
});
