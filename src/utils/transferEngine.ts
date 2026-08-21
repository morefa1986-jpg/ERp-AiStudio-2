import { FishTransfer, LarvalBatch, NurseryTank, Pond } from '../types';
import { nextId } from './id';

export interface FishTransferInput extends Omit<FishTransfer, 'id' | 'status'> {}

export interface TransferResult {
  success: boolean;
  error?: string;
  updatedPonds?: Pond[];
  updatedNurseryTanks?: NurseryTank[];
  updatedLarvae?: LarvalBatch[];
  newTransfer?: FishTransfer;
}

interface SourceLedger {
  type: FishTransferInput['sourceType'];
  id: string;
  count: number;
  biomassKg: number;
  speciesId?: string;
  pond?: Pond;
  tank?: NurseryTank;
  batch?: LarvalBatch;
}

function finiteNonNegative(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function closeEnough(left: number, right: number, tolerance = 0.05): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function validateTransferNumbers(transferData: FishTransferInput, source: SourceLedger): { ok: boolean; error?: string; biomass?: number } {
  if (!Number.isInteger(transferData.fishCount) || transferData.fishCount <= 0) {
    return { ok: false, error: 'تعداد ماهیان انتقال باید یک عدد صحیح مثبت باشد.' };
  }
  if (transferData.fishCount > source.count) {
    return { ok: false, error: `تعداد درخواستی (${transferData.fishCount}) بیشتر از موجودی مبدا (${source.count}) است.` };
  }
  if (!Number.isFinite(transferData.averageWeightKg) || transferData.averageWeightKg <= 0) {
    return { ok: false, error: 'میانگین وزن انتقال باید عدد مثبت معتبر باشد.' };
  }

  const biomass = Number((transferData.fishCount * transferData.averageWeightKg).toFixed(2));
  if (!finiteNonNegative(source.biomassKg) || !Number.isFinite(biomass) || biomass <= 0 || biomass > source.biomassKg + 0.01) {
    return { ok: false, error: 'بیومس انتقالی با موجودی معتبر مبدا سازگار نیست.' };
  }
  if (!Number.isFinite(transferData.totalBiomassKg) || transferData.totalBiomassKg <= 0 || !closeEnough(transferData.totalBiomassKg, biomass)) {
    return { ok: false, error: 'بیومس اعلام‌شده با تعداد و میانگین وزن انتقال سازگار نیست.' };
  }
  return { ok: true, biomass };
}

function resolveSource(input: FishTransferInput, ponds: Pond[], nurseryTanks: NurseryTank[], larvae: LarvalBatch[]): { source?: SourceLedger; error?: string } {
  if (input.sourceType === 'Pond') {
    const pond = ponds.find((item) => item.id === input.sourceId);
    if (!pond) return { error: 'استخر مبدا یافت نشد.' };
    return { source: { type: 'Pond', id: pond.id, count: pond.fishCount, biomassKg: pond.biomassKg, speciesId: pond.speciesId, pond } };
  }

  if (input.sourceType === 'Nursery') {
    const tank = nurseryTanks.find((item) => item.id === input.sourceId);
    if (!tank) return { error: 'مخزن نرسری مبدا یافت نشد.' };
    if (!Number.isInteger(tank.fishCount) || tank.fishCount < 0 || !finiteNonNegative(tank.totalBiomassGrams)) {
      return { error: 'موجودی مخزن نرسری نامعتبر است.' };
    }
    const batch = tank.currentBatchId ? larvae.find((item) => item.id === tank.currentBatchId) : undefined;
    if (tank.currentBatchId && !batch) return { error: 'دفترچه بچ نرسری مبدا یافت نشد.' };
    if (batch && (batch.larvalCount !== tank.fishCount || !finiteNonNegative(batch.totalBiomassKg) || !closeEnough(batch.totalBiomassKg || 0, tank.totalBiomassGrams / 1000))) {
      return { error: 'موجودی مخزن نرسری با دفترچه بچ سازگار نیست.' };
    }
    return {
      source: {
        type: 'Nursery', id: tank.id, count: tank.fishCount, biomassKg: tank.totalBiomassGrams / 1000,
        speciesId: batch?.speciesId || tank.speciesId || input.speciesId, tank, batch,
      },
    };
  }

  const batch = larvae.find((item) => item.id === input.sourceId);
  if (!batch) return { error: 'بچ لارو مبدا یافت نشد.' };
  if (batch.currentTankId || batch.status === 'Nursery Rearing') return { error: 'این بچ در حال حاضر در نرسری است و منبع Hatchery محسوب نمی‌شود.' };
  if (!Number.isInteger(batch.larvalCount) || batch.larvalCount <= 0 || !finiteNonNegative(batch.totalBiomassKg) || (batch.totalBiomassKg || 0) <= 0) {
    return { error: 'بچ لارو مبدا باید دفترچه تعداد و بیومس معتبر داشته باشد.' };
  }
  return { source: { type: 'Hatchery', id: batch.id, count: batch.larvalCount, biomassKg: batch.totalBiomassKg || 0, speciesId: batch.speciesId || input.speciesId, batch } };
}

function validateDestinationSpecies(input: FishTransferInput, source: SourceLedger, destination: Pond): string | undefined {
  const speciesId = source.speciesId || input.speciesId;
  if (!speciesId) return 'گونه ماهی انتقالی ثبت نشده است.';
  if (destination.speciesId !== speciesId && !destination.speciesMix?.some((mix) => mix.speciesId === speciesId)) {
    return 'گونه ماهی انتقالی با گونه ثبت‌شده استخر مقصد سازگار نیست.';
  }
  return undefined;
}

function emptyNurseryDestination(tank: NurseryTank, source: SourceLedger): string | undefined {
  if (source.type === 'Nursery' && tank.id === source.id) return 'استخر/مخزن مبدا و مقصد نمی‌توانند یکسان باشند.';
  if (tank.status === 'Cleaning') return 'مخزن مقصد در وضعیت شست‌وشو است.';
  if (tank.fishCount !== 0 || tank.totalBiomassGrams !== 0 || tank.currentBatchId) return 'برای جلوگیری از اختلاط زیستی، مخزن مقصد باید خالی باشد.';
  if (tank.speciesId && source.speciesId && tank.speciesId !== source.speciesId) return 'گونه ماهی با گونه ثبت‌شده مخزن مقصد سازگار نیست.';
  return undefined;
}

/**
 * Applies a live-stock transfer only when both source and destination ledgers
 * can be changed in the same returned state transition. Unsupported external
 * destinations fail closed instead of silently destroying biomass.
 */
export function executeAtomicFishTransfer(
  transferData: FishTransferInput,
  ponds: Pond[],
  nurseryTanks: NurseryTank[] = [],
  larvae: LarvalBatch[] = [],
): TransferResult {
  const sourceResult = resolveSource(transferData, ponds, nurseryTanks, larvae);
  if (!sourceResult.source) return { success: false, error: sourceResult.error };
  const source = sourceResult.source;
  const validation = validateTransferNumbers(transferData, source);
  if (!validation.ok || validation.biomass === undefined) return { success: false, error: validation.error };
  const transferBiomass = validation.biomass;

  const destinationPond = transferData.destinationType === 'Pond' ? ponds.find((item) => item.id === transferData.destinationId) : undefined;
  const destinationTank = transferData.destinationType === 'Nursery' ? nurseryTanks.find((item) => item.id === transferData.destinationId) : undefined;
  if (transferData.destinationType === 'Pond') {
    if (!destinationPond) return { success: false, error: 'استخر مقصد یافت نشد.' };
    if (source.type === 'Pond' && destinationPond.id === source.id) return { success: false, error: 'استخر مبدا و مقصد نمی‌توانند یکسان باشند.' };
    const speciesError = validateDestinationSpecies(transferData, source, destinationPond);
    if (speciesError) return { success: false, error: speciesError };
  } else if (transferData.destinationType === 'Nursery') {
    if (!destinationTank) return { success: false, error: 'مخزن نرسری مقصد یافت نشد.' };
    const destinationError = emptyNurseryDestination(destinationTank, source);
    if (destinationError) return { success: false, error: destinationError };
  } else {
    return { success: false, error: 'مقصد خارجی باید از گردش‌کار اتمیک مقصد ثبت شود تا تعداد و بیومس از بین نرود.' };
  }

  const isWholeBatch = transferData.fishCount === source.count && closeEnough(transferBiomass, source.biomassKg);
  if (source.type === 'Hatchery' && !isWholeBatch) {
    return { success: false, error: 'انتقال جزئی از بچ Hatchery پشتیبانی نمی‌شود؛ ابتدا بچ را به دفترچه نرسری منتقل کنید.' };
  }
  if (source.type === 'Nursery' && transferData.destinationType === 'Nursery' && !isWholeBatch) {
    return { success: false, error: 'انتقال جزئی بین مخازن نرسری بدون دفترچه چندمخزنه مجاز نیست.' };
  }

  const newTransfer: FishTransfer = { ...transferData, id: nextId('trf'), totalBiomassKg: transferBiomass, status: 'COMPLETED' };
  let updatedPonds = ponds;
  let updatedNurseryTanks = nurseryTanks;
  let updatedLarvae = larvae;

  if (source.pond) {
    const newCount = source.pond.fishCount - transferData.fishCount;
    const newBiomass = Number(Math.max(0, source.pond.biomassKg - transferBiomass).toFixed(2));
    updatedPonds = updatedPonds.map((pond) => pond.id === source.pond?.id
      ? { ...pond, fishCount: newCount, biomassKg: newBiomass, averageWeightKg: newCount > 0 ? Number((newBiomass / newCount).toFixed(3)) : 0, lastTransferDate: transferData.date }
      : pond);
  }

  if (destinationPond) {
    const newCount = destinationPond.fishCount + transferData.fishCount;
    const newBiomass = Number((destinationPond.biomassKg + transferBiomass).toFixed(2));
    updatedPonds = updatedPonds.map((pond) => pond.id === destinationPond?.id
      ? { ...pond, fishCount: newCount, biomassKg: newBiomass, averageWeightKg: newCount > 0 ? Number((newBiomass / newCount).toFixed(3)) : 0, lastTransferDate: transferData.date }
      : pond);
  }

  if (source.tank) {
    const remainingCount = source.tank.fishCount - transferData.fishCount;
    const remainingBiomassGrams = Number(Math.max(0, source.tank.totalBiomassGrams - transferBiomass * 1000).toFixed(3));
    updatedNurseryTanks = updatedNurseryTanks.map((tank) => tank.id === source.tank?.id
      ? { ...tank, fishCount: remainingCount, totalBiomassGrams: remainingBiomassGrams, avgWeightGrams: remainingCount > 0 ? Number((remainingBiomassGrams / remainingCount).toFixed(3)) : 0, currentBatchId: remainingCount > 0 ? tank.currentBatchId : undefined, status: remainingCount > 0 ? 'Active' : 'Empty' }
      : tank);
  }

  if (destinationTank) {
    const biomassGrams = Number((transferBiomass * 1000).toFixed(3));
    const linkedBatchId = source.type === 'Hatchery' ? source.batch?.id : source.type === 'Nursery' ? source.batch?.id : undefined;
    updatedNurseryTanks = updatedNurseryTanks.map((tank) => tank.id === destinationTank?.id
      ? { ...tank, speciesId: source.speciesId || transferData.speciesId, currentBatchId: linkedBatchId, fishCount: transferData.fishCount, totalBiomassGrams: biomassGrams, avgWeightGrams: Number((biomassGrams / transferData.fishCount).toFixed(3)), status: 'Active' }
      : tank);
  }

  if (source.batch) {
    if (source.type === 'Hatchery') {
      updatedLarvae = updatedLarvae.map((batch) => batch.id === source.batch?.id
        ? {
          ...batch,
          larvalCount: destinationTank ? transferData.fishCount : 0,
          totalBiomassKg: destinationTank ? transferBiomass : 0,
          currentTankId: destinationTank?.id,
          status: destinationTank ? 'Nursery Rearing' : 'Transferred',
          destination: destinationTank ? 'Nursery' : 'Fingerling Pond',
        }
        : batch);
    } else if (source.type === 'Nursery' && destinationPond) {
      const remainingCount = source.batch.larvalCount - transferData.fishCount;
      const remainingBiomass = Number(Math.max(0, (source.batch.totalBiomassKg || 0) - transferBiomass).toFixed(3));
      updatedLarvae = updatedLarvae.map((batch) => batch.id === source.batch?.id
        ? { ...batch, larvalCount: remainingCount, totalBiomassKg: remainingBiomass, currentTankId: remainingCount > 0 ? source.tank?.id : undefined, status: remainingCount > 0 ? 'Nursery Rearing' : 'Transferred', destination: remainingCount > 0 ? 'Nursery' : 'Fingerling Pond' }
        : batch);
    } else if (source.type === 'Nursery' && destinationTank) {
      updatedLarvae = updatedLarvae.map((batch) => batch.id === source.batch?.id
        ? { ...batch, currentTankId: destinationTank.id, status: 'Nursery Rearing', destination: 'Nursery' }
        : batch);
    }
  }

  if (source.type === 'Pond' && destinationPond) {
    const initialCount = source.count + destinationPond.fishCount;
    const initialBiomass = Number((source.biomassKg + destinationPond.biomassKg).toFixed(2));
    const finalSource = updatedPonds.find((pond) => pond.id === source.id)!;
    const finalDestination = updatedPonds.find((pond) => pond.id === destinationPond.id)!;
    if (finalSource.fishCount + finalDestination.fishCount !== initialCount || !closeEnough(finalSource.biomassKg + finalDestination.biomassKg, initialBiomass)) {
      return { success: false, error: 'قانون بقای تعداد یا بیومس در انتقال داخلی نقض شد.' };
    }
  }

  return { success: true, newTransfer, updatedPonds, updatedNurseryTanks, updatedLarvae };
}
