import { FishTransfer, LarvalBatch, NurseryTank, Pond } from '../types';
import type { OperationalStockSex } from '../types/operationalStock';
import { addPondStock, consumePondStock, resolvePondStockGroup } from './pondStockLedger';
import { nextId } from './id';

export interface FishTransferInput extends Omit<FishTransfer, 'id' | 'status'> {
  stockSex?: OperationalStockSex;
  chipNumbers?: string[];
}

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
  stockSex: OperationalStockSex;
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
    return { ok: false, error: `تعداد درخواستی (${transferData.fishCount}) بیشتر از موجودی گروه مبدا (${source.count}) است.` };
  }
  if (!Number.isFinite(transferData.averageWeightKg) || transferData.averageWeightKg <= 0) {
    return { ok: false, error: 'میانگین وزن انتقال باید عدد مثبت معتبر باشد.' };
  }

  const biomass = Number((transferData.fishCount * transferData.averageWeightKg).toFixed(3));
  if (!finiteNonNegative(source.biomassKg) || !Number.isFinite(biomass) || biomass <= 0 || biomass > source.biomassKg + 0.05) {
    return { ok: false, error: 'بیومس انتقالی با موجودی گروه مبدا سازگار نیست.' };
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
    const stock = resolvePondStockGroup(pond, input.speciesId, input.stockSex);
    if (!stock.ok || !stock.group) {
      return { error: stock.error === 'STOCK_GROUP_SEX_REQUIRED' ? 'برای استخر مختلط، جنس گروه ماهی مبدا باید مشخص شود.' : 'گروه گونه/جنس مبدا در دفتر موجودی استخر یافت نشد.' };
    }
    return {
      source: {
        type: 'Pond', id: pond.id, count: stock.group.count,
        biomassKg: Number((stock.group.count * stock.group.averageWeightKg).toFixed(6)),
        speciesId: stock.group.speciesId, stockSex: stock.group.sex, pond,
      },
    };
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
        speciesId: batch?.speciesId || tank.speciesId || input.speciesId, stockSex: input.stockSex || 'Unknown', tank, batch,
      },
    };
  }

  const batch = larvae.find((item) => item.id === input.sourceId);
  if (!batch) return { error: 'بچ لارو مبدا یافت نشد.' };
  if (batch.currentTankId || batch.status === 'Nursery Rearing') return { error: 'این بچ در حال حاضر در نرسری است و منبع Hatchery محسوب نمی‌شود.' };
  if (!Number.isInteger(batch.larvalCount) || batch.larvalCount <= 0 || !finiteNonNegative(batch.totalBiomassKg) || (batch.totalBiomassKg || 0) <= 0) {
    return { error: 'بچ لارو مبدا باید دفترچه تعداد و بیومس معتبر داشته باشد.' };
  }
  return { source: { type: 'Hatchery', id: batch.id, count: batch.larvalCount, biomassKg: batch.totalBiomassKg || 0, speciesId: batch.speciesId || input.speciesId, stockSex: input.stockSex || 'Unknown', batch } };
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
 * can be changed in the same returned state transition. Pond transfers also
 * conserve species/sex stock groups and registered chip identities.
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
  if (!source.speciesId || source.speciesId !== transferData.speciesId) return { success: false, error: 'گونه انتقال با گروه موجودی مبدا سازگار نیست.' };
  const validation = validateTransferNumbers(transferData, source);
  if (!validation.ok || validation.biomass === undefined) return { success: false, error: validation.error };
  const transferBiomass = validation.biomass;

  const destinationPond = transferData.destinationType === 'Pond' ? ponds.find((item) => item.id === transferData.destinationId) : undefined;
  const destinationTank = transferData.destinationType === 'Nursery' ? nurseryTanks.find((item) => item.id === transferData.destinationId) : undefined;
  if (transferData.destinationType === 'Pond') {
    if (!destinationPond) return { success: false, error: 'استخر مقصد یافت نشد.' };
    if (source.type === 'Pond' && destinationPond.id === source.id) return { success: false, error: 'استخر مبدا و مقصد نمی‌توانند یکسان باشند.' };
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

  const normalizedTransfer: FishTransferInput = { ...transferData, stockSex: source.stockSex, chipNumbers: transferData.chipNumbers || [] };
  const newTransfer: FishTransfer = { ...normalizedTransfer, id: nextId('trf'), totalBiomassKg: transferBiomass, status: 'COMPLETED' };
  let updatedPonds = ponds;
  let updatedNurseryTanks = nurseryTanks;
  let updatedLarvae = larvae;

  if (source.pond) {
    const consumed = consumePondStock(source.pond, {
      speciesId: source.speciesId!, sex: source.stockSex, count: transferData.fishCount,
      biomassKg: transferBiomass, chipNumbers: normalizedTransfer.chipNumbers,
    });
    if (!consumed.ok || !consumed.pond) return { success: false, error: consumed.error || 'دفتر موجودی گروه مبدا به‌روزرسانی نشد.' };
    updatedPonds = updatedPonds.map((pond) => pond.id === source.pond?.id ? { ...consumed.pond!, lastTransferDate: transferData.date } : pond);
  }

  if (destinationPond) {
    const currentDestination = updatedPonds.find((pond) => pond.id === destinationPond.id) || destinationPond;
    const added = addPondStock(currentDestination, {
      speciesId: source.speciesId!, sex: source.stockSex, count: transferData.fishCount,
      biomassKg: transferBiomass, chipNumbers: normalizedTransfer.chipNumbers,
    });
    if (!added.ok || !added.pond) return { success: false, error: added.error || 'دفتر موجودی گروه مقصد به‌روزرسانی نشد.' };
    updatedPonds = updatedPonds.map((pond) => pond.id === destinationPond.id ? { ...added.pond!, lastTransferDate: transferData.date } : pond);
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

  if (source.type === 'Pond' && source.pond && destinationPond) {
    const initialCount = source.pond.fishCount + destinationPond.fishCount;
    const initialBiomass = Number((source.pond.biomassKg + destinationPond.biomassKg).toFixed(3));
    const finalSource = updatedPonds.find((pond) => pond.id === source.id)!;
    const finalDestination = updatedPonds.find((pond) => pond.id === destinationPond.id)!;
    if (finalSource.fishCount + finalDestination.fishCount !== initialCount || !closeEnough(finalSource.biomassKg + finalDestination.biomassKg, initialBiomass)) {
      return { success: false, error: 'قانون بقای تعداد یا بیومس در انتقال داخلی نقض شد.' };
    }
  }

  return { success: true, newTransfer, updatedPonds, updatedNurseryTanks, updatedLarvae };
}
