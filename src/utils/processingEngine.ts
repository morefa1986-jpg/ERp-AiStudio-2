import { ColdStoragePallet, Pond, ProcessingBatch } from '../types';
import { nextId } from './id';

export type ProcessingInput = Omit<ProcessingBatch, 'id' | 'caviarYieldPercent' | 'filletYieldPercent' | 'outputLotIds' | 'transactionId'> & {
  outputExpiryDate?: string;
};

export interface ProcessingResult {
  success: boolean;
  error?: string;
  batch?: ProcessingBatch;
  ponds?: Pond[];
  coldStorage?: ColdStoragePallet[];
  transactionId?: string;
}

function validNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validDate(value: string | undefined): boolean {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

/**
 * Applies harvest, processing intake and output storage as one pure state transition.
 * The caller must commit all returned collections together. Active-treatment ponds
 * fail closed. The UI additionally checks completed-treatment withdrawal windows.
 */
export function executeAtomicProcessing(
  input: ProcessingInput,
  ponds: Pond[],
  coldStorage: ColdStoragePallet[],
  transactionId = nextId('txn'),
): ProcessingResult {
  const source = ponds.find((pond) => pond.id === input.sourcePondId);
  if (!source) return { success: false, error: 'استخر مبدا یافت نشد.' };
  if (source.activeTreatmentId) return { success: false, error: 'فرآوری از استخر دارای درمان فعال مجاز نیست.' };
  if (!input.speciesName?.trim()) return { success: false, error: 'گونه ماهی برای ردیابی بچ فرآوری الزامی است.' };
  if (!Number.isInteger(input.fishCount) || input.fishCount <= 0 || input.fishCount > source.fishCount) {
    return { success: false, error: 'تعداد ماهی فرآوری با موجودی زنده مبدا سازگار نیست.' };
  }
  if (!Number.isFinite(input.liveBiomassKg) || input.liveBiomassKg <= 0 || input.liveBiomassKg > source.biomassKg + 0.01) {
    return { success: false, error: 'وزن زنده فرآوری با بیومس مبدا سازگار نیست.' };
  }

  const outputs = [input.caviarYieldKg, input.filletMeatYieldKg, input.smokedMeatYieldKg, input.byProductAndWasteKg];
  if (outputs.some((value) => !validNonNegative(value))) return { success: false, error: 'خروجی‌های فرآوری باید اعداد غیرمنفی معتبر باشند.' };
  const outputTotal = Number(outputs.reduce((sum, value) => sum + value, 0).toFixed(3));
  if (Math.abs(outputTotal - input.liveBiomassKg) > 0.05) return { success: false, error: 'جمع خروجی‌های فرآوری باید با وزن زنده ورودی برابر باشد.' };
  if (!input.batchCode.trim() || !input.operatorName.trim() || !validDate(input.date)) return { success: false, error: 'کد بچ، تاریخ و اپراتور فرآوری الزامی است.' };
  if (!validDate(input.outputExpiryDate)) return { success: false, error: 'تاریخ انقضای خروجی فرآوری باید صریحاً ثبت شود.' };
  if (new Date(input.outputExpiryDate!).getTime() < new Date(input.date).getTime()) return { success: false, error: 'تاریخ انقضا نمی‌تواند قبل از تاریخ فرآوری باشد.' };
  if (!Number.isFinite(input.qualityScore) || input.qualityScore < 0 || input.qualityScore > 100) return { success: false, error: 'امتیاز کیفی باید بین صفر تا ۱۰۰ باشد.' };

  const newSourceCount = source.fishCount - input.fishCount;
  const newSourceBiomass = Number((source.biomassKg - input.liveBiomassKg).toFixed(2));
  const updatedPond: Pond = {
    ...source,
    fishCount: newSourceCount,
    biomassKg: Math.max(0, newSourceBiomass),
    averageWeightKg: newSourceCount > 0 ? Number((Math.max(0, newSourceBiomass) / newSourceCount).toFixed(3)) : 0,
    lastTransferDate: input.date,
  };

  const batchId = nextId('proc');
  const outputLotIds: string[] = [];
  const outputLots: ColdStoragePallet[] = [];
  const normalizedBatch = input.batchCode.trim().replace(/[^A-Za-z0-9_-]+/g, '-').toUpperCase();
  const addLot = (weightKg: number, productType: ColdStoragePallet['productType'], suffix: string) => {
    if (weightKg <= 0) return;
    const id = nextId('lot');
    const sku = productType === 'Caviar (Cans/Jars)' ? `CAV-${normalizedBatch}` : productType === 'Vacuumed Fillet' ? `FIL-${normalizedBatch}` : `SMK-${normalizedBatch}`;
    const unitsCount = productType === 'Caviar (Cans/Jars)' ? Math.floor(weightKg / 0.05) : 0;
    outputLotIds.push(id);
    outputLots.push({
      id,
      sku,
      processingBatchId: batchId,
      slotCode: `PENDING-${normalizedBatch}-${suffix}`,
      temperatureC: productType.includes('Caviar') ? -2.8 : -18,
      productType,
      batchCode: input.batchCode,
      weightKg: Number(weightKg.toFixed(3)),
      unitsCount,
      packagingUnit: productType === 'Caviar (Cans/Jars)' ? '50g can' : 'kg',
      entryDate: input.date,
      expiryDate: input.outputExpiryDate!,
      status: 'Stored',
    });
  };
  addLot(input.caviarYieldKg, 'Caviar (Cans/Jars)', 'CAV');
  addLot(input.filletMeatYieldKg, 'Vacuumed Fillet', 'FIL');
  addLot(input.smokedMeatYieldKg, 'Smoked Sturgeon', 'SMK');

  const { outputExpiryDate: _outputExpiryDate, ...batchInput } = input;
  const batch: ProcessingBatch = {
    ...batchInput,
    id: batchId,
    caviarYieldPercent: Number(((input.caviarYieldKg / input.liveBiomassKg) * 100).toFixed(2)),
    filletYieldPercent: Number(((input.filletMeatYieldKg / input.liveBiomassKg) * 100).toFixed(2)),
    outputLotIds,
    transactionId,
  };

  return { success: true, batch, ponds: ponds.map((pond) => pond.id === source.id ? updatedPond : pond), coldStorage: [...outputLots, ...coldStorage], transactionId };
}
