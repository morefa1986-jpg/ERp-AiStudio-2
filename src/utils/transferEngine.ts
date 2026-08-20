import { FishTransfer, Pond } from '../types';

export interface FishTransferInput extends Omit<FishTransfer, 'id' | 'status'> {}

export interface TransferResult {
  success: boolean;
  error?: string;
  updatedPonds?: Pond[];
  newTransfer?: FishTransfer;
}

function validateTransferNumbers(transferData: FishTransferInput, sourcePond: Pond): { ok: boolean; error?: string; biomass?: number } {
  if (!Number.isInteger(transferData.fishCount) || transferData.fishCount <= 0) {
    return { ok: false, error: 'تعداد ماهیان انتقال باید یک عدد صحیح مثبت باشد.' };
  }
  if (!Number.isFinite(transferData.averageWeightKg) || transferData.averageWeightKg <= 0) {
    return { ok: false, error: 'میانگین وزن انتقال باید عدد مثبت معتبر باشد.' };
  }
  if (transferData.fishCount > sourcePond.fishCount) {
    return { ok: false, error: `تعداد درخواستی (${transferData.fishCount}) بیشتر از موجودی مبدا (${sourcePond.fishCount}) است.` };
  }

  const biomass = Number((transferData.fishCount * transferData.averageWeightKg).toFixed(2));
  if (!Number.isFinite(biomass) || biomass <= 0) return { ok: false, error: 'بیومس انتقالی نامعتبر است.' };
  if (biomass > sourcePond.biomassKg + 0.01) {
    return { ok: false, error: `بیومس انتقالی (${biomass} kg) بیشتر از بیومس مبدا (${sourcePond.biomassKg} kg) است.` };
  }
  if (Number.isFinite(transferData.totalBiomassKg) && transferData.totalBiomassKg > 0 && Math.abs(transferData.totalBiomassKg - biomass) > 0.05) {
    return { ok: false, error: 'بیومس اعلام‌شده با تعداد و میانگین وزن انتقال سازگار نیست.' };
  }
  return { ok: true, biomass };
}

export function executeAtomicFishTransfer(transferData: FishTransferInput, ponds: Pond[]): TransferResult {
  if (transferData.sourceType !== 'Pond') {
    return { success: false, error: 'این موتور در حال حاضر منبع استخر را مدیریت می‌کند؛ انتقال Nursery/Hatchery باید از موجودی همان ماژول ثبت شود.' };
  }

  const sourcePond = ponds.find((pond) => pond.id === transferData.sourceId);
  if (!sourcePond) return { success: false, error: 'استخر مبدا یافت نشد.' };

  const validation = validateTransferNumbers(transferData, sourcePond);
  if (!validation.ok || validation.biomass === undefined) return { success: false, error: validation.error };
  const transferBiomass = validation.biomass;

  const sourceNewCount = sourcePond.fishCount - transferData.fishCount;
  const sourceNewBiomass = Number((sourcePond.biomassKg - transferBiomass).toFixed(2));
  if (sourceNewCount < 0 || sourceNewBiomass < -0.01) return { success: false, error: 'انتقال باعث موجودی منفی در مبدا می‌شود.' };
  const safeSourceBiomass = Math.max(0, sourceNewBiomass);
  const sourceNewAvg = sourceNewCount > 0 ? Number((safeSourceBiomass / sourceNewCount).toFixed(3)) : 0;

  const newTransfer: FishTransfer = {
    ...transferData,
    id: `trf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    totalBiomassKg: transferBiomass,
    status: 'COMPLETED',
  };

  // Internal pond-to-pond movement must conserve count and biomass exactly (within rounding tolerance).
  if (transferData.destinationType === 'Pond') {
    const destinationPond = ponds.find((pond) => pond.id === transferData.destinationId);
    if (!destinationPond) return { success: false, error: 'استخر مقصد یافت نشد.' };
    if (destinationPond.id === sourcePond.id) return { success: false, error: 'استخر مبدا و مقصد نمی‌توانند یکسان باشند.' };
    if (destinationPond.speciesId !== sourcePond.speciesId && !destinationPond.speciesMix?.some((mix) => mix.speciesId === sourcePond.speciesId)) {
      return { success: false, error: 'گونه ماهی انتقالی با گونه ثبت‌شده استخر مقصد سازگار نیست.' };
    }

    const initialCount = sourcePond.fishCount + destinationPond.fishCount;
    const initialBiomass = Number((sourcePond.biomassKg + destinationPond.biomassKg).toFixed(2));
    const destinationNewCount = destinationPond.fishCount + transferData.fishCount;
    const destinationNewBiomass = Number((destinationPond.biomassKg + transferBiomass).toFixed(2));
    const destinationNewAvg = destinationNewCount > 0 ? Number((destinationNewBiomass / destinationNewCount).toFixed(3)) : 0;

    const finalCount = sourceNewCount + destinationNewCount;
    const finalBiomass = Number((safeSourceBiomass + destinationNewBiomass).toFixed(2));
    if (finalCount !== initialCount || Math.abs(finalBiomass - initialBiomass) > 0.05) {
      return { success: false, error: 'قانون بقای تعداد یا بیومس در انتقال داخلی نقض شد.' };
    }

    return {
      success: true,
      newTransfer,
      updatedPonds: ponds.map((pond) => {
        if (pond.id === sourcePond.id) return { ...pond, fishCount: sourceNewCount, biomassKg: safeSourceBiomass, averageWeightKg: sourceNewAvg, lastTransferDate: transferData.date };
        if (pond.id === destinationPond.id) return { ...pond, fishCount: destinationNewCount, biomassKg: destinationNewBiomass, averageWeightKg: destinationNewAvg, lastTransferDate: transferData.date };
        return pond;
      }),
    };
  }

  // Processing, cold storage, sale and other external destinations remove stock from the live pond ledger and retain the transfer record as traceability evidence.
  const allowedExternal = ['Processing', 'Cold Storage', 'Sale', 'Nursery', 'Other'];
  if (!allowedExternal.includes(transferData.destinationType)) return { success: false, error: 'نوع مقصد انتقال پشتیبانی نمی‌شود.' };
  if (!transferData.destinationId?.trim() || !transferData.destinationName?.trim()) return { success: false, error: 'شناسه و نام مقصد الزامی است.' };

  return {
    success: true,
    newTransfer,
    updatedPonds: ponds.map((pond) => pond.id === sourcePond.id
      ? { ...pond, fishCount: sourceNewCount, biomassKg: safeSourceBiomass, averageWeightKg: sourceNewAvg, lastTransferDate: transferData.date }
      : pond),
  };
}
