import { Pond, FishTransfer } from '../types';

export interface FishTransferInput extends Omit<FishTransfer, 'id' | 'status'> {}

export interface TransferResult {
  success: boolean;
  error?: string;
  updatedPonds?: Pond[];
  newTransfer?: FishTransfer;
}

/**
 * Validates and executes an atomic fish transfer between ponds.
 * Guaranteed conservation of total fish count and total biomass.
 */
export function executeAtomicFishTransfer(
  transferData: FishTransferInput,
  ponds: Pond[]
): TransferResult {
  const sourcePond = ponds.find((p) => p.id === transferData.sourceId);
  const destPond = ponds.find((p) => p.id === transferData.destinationId);

  if (!sourcePond) return { success: false, error: 'استخر مبدا یافت نشد.' };
  if (!destPond) return { success: false, error: 'استخر مقصد یافت نشد.' };
  if (sourcePond.id === destPond.id) {
    return { success: false, error: 'استخر مبدا و مقصد نمی‌توانند یکسان باشند.' };
  }

  // Number validation
  if (!Number.isFinite(transferData.fishCount) || transferData.fishCount <= 0 || !Number.isInteger(transferData.fishCount)) {
    return { success: false, error: 'تعداد ماهیان انتقال باید یک عدد صحیح مثبت و معتبر باشد.' };
  }

  if (!Number.isFinite(transferData.averageWeightKg) || transferData.averageWeightKg <= 0) {
    return { success: false, error: 'میانگین وزن ماهیان انتقال باید یک عدد مثبت معتبر باشد.' };
  }

  if (sourcePond.fishCount < transferData.fishCount) {
    return {
      success: false,
      error: `تعداد ماهیان درخواستی (${transferData.fishCount}) بیشتر از موجودی استخر مبدا (${sourcePond.fishCount}) است.`,
    };
  }

  const transferBiomass = Number((transferData.fishCount * transferData.averageWeightKg).toFixed(2));
  if (!Number.isFinite(transferBiomass) || transferBiomass <= 0) {
    return { success: false, error: 'بیومس انتقالی نامعتبر است.' };
  }

  if (transferBiomass > sourcePond.biomassKg + 0.01) {
    return {
      success: false,
      error: `بیومس درخواستی برای انتقال (${transferBiomass} kg) بیشتر از بیومس کل استخر مبدا (${sourcePond.biomassKg} kg) است.`,
    };
  }

  const initialTotalCount = sourcePond.fishCount + destPond.fishCount;
  const initialTotalBiomass = sourcePond.biomassKg + destPond.biomassKg;

  // Compute updated source pond
  const sourceNewCount = sourcePond.fishCount - transferData.fishCount;
  const sourceNewBiomass = Math.max(0, Number((sourcePond.biomassKg - transferBiomass).toFixed(2)));
  const sourceNewAvg = sourceNewCount > 0 ? Number((sourceNewBiomass / sourceNewCount).toFixed(2)) : 0;

  // Compute updated destination pond
  const destNewCount = destPond.fishCount + transferData.fishCount;
  const destNewBiomass = Number((destPond.biomassKg + transferBiomass).toFixed(2));
  const destNewAvg = destNewCount > 0 ? Number((destNewBiomass / destNewCount).toFixed(2)) : transferData.averageWeightKg;

  // Strict Conservation Check
  const finalTotalCount = sourceNewCount + destNewCount;
  const finalTotalBiomass = Number((sourceNewBiomass + destNewBiomass).toFixed(2));

  if (finalTotalCount !== initialTotalCount) {
    return { success: false, error: 'خطای سیستمی: قانون بقای تعداد ماهیان در انتقال نقض شد.' };
  }

  if (Math.abs(finalTotalBiomass - Number(initialTotalBiomass.toFixed(2))) > 0.05) {
    return { success: false, error: 'خطای سیستمی: قانون بقای جرم بیومس در انتقال نقض شد.' };
  }

  const newTransfer: FishTransfer = {
    ...transferData,
    id: 'trf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    totalBiomassKg: transferBiomass,
    status: 'COMPLETED',
  };

  const updatedPonds = ponds.map((p) => {
    if (p.id === sourcePond.id) {
      return {
        ...p,
        fishCount: sourceNewCount,
        biomassKg: sourceNewBiomass,
        averageWeightKg: sourceNewAvg,
        lastTransferDate: transferData.date,
      };
    }
    if (p.id === destPond.id) {
      return {
        ...p,
        fishCount: destNewCount,
        biomassKg: destNewBiomass,
        averageWeightKg: destNewAvg,
        lastTransferDate: transferData.date,
      };
    }
    return p;
  });

  return {
    success: true,
    updatedPonds,
    newTransfer,
  };
}
