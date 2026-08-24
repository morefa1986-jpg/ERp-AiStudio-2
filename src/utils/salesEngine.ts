import { ColdStoragePallet, ProformaInvoice } from '../types';
import { nextId } from './id';

export interface SaleFulfillmentResult {
  success: boolean;
  error?: string;
  coldStorage?: ColdStoragePallet[];
  fulfilledAt?: string;
  transactionId?: string;
}

interface SaleRequirement {
  sku: string;
  quantity: number;
  packaged: boolean;
  weightKg?: number;
}

function isPackagedUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase();
  return normalized.includes('can') || normalized.includes('قوطی') || normalized.includes('jar')
    || normalized.includes('piece') || normalized.includes('pcs') || normalized.includes('واحد');
}

function requirementForItem(item: ProformaInvoice['items'][number]): SaleRequirement | { error: string } {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) return { error: 'مقدار فروش باید مثبت باشد.' };
  const packaged = isPackagedUnit(item.unit);
  if (packaged && (!Number.isInteger(item.quantity) || item.quantity <= 0)) return { error: 'تعداد بسته‌های فروش باید عدد صحیح مثبت باشد.' };
  const normalizedUnit = item.unit.trim().toLowerCase();
  if (!packaged && normalizedUnit === 'kg') return { sku: item.sku, quantity: item.quantity, packaged, weightKg: item.quantity };
  if (!packaged && (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'گرم')) return { sku: item.sku, quantity: item.quantity, packaged, weightKg: item.quantity / 1000 };
  if (!packaged) return { error: `واحد فروش برای ${item.sku} پشتیبانی نمی‌شود.` };
  return { sku: item.sku, quantity: item.quantity, packaged };
}

function legacyLotSku(lot: ColdStoragePallet): string | null {
  const batch = String(lot.batchCode || '').trim();
  if (!batch) return null;
  if (lot.productType === 'Caviar (Cans/Jars)') return `CAV-${batch}`;
  if (lot.productType === 'Vacuumed Fillet') return `FIL-${batch}`;
  if (lot.productType === 'Smoked Sturgeon') return `SMK-${batch}`;
  if (lot.productType === 'Frozen Sturgeon Whole') return `WHOLE-${batch}`;
  return null;
}

export function saleLotMatchesSku(lot: ColdStoragePallet, sku: string): boolean {
  const requested = sku.trim().toUpperCase();
  if (!requested) return false;
  if (lot.sku?.trim()) return lot.sku.trim().toUpperCase() === requested;
  const derived = legacyLotSku(lot);
  return Boolean(derived && derived.toUpperCase() === requested);
}

function requirementsFor(proforma: ProformaInvoice): SaleRequirement[] | { error: string } {
  const requirements = new Map<string, SaleRequirement>();
  for (const item of proforma.items) {
    if (!item.sku.trim()) return { error: 'شناسه کالای فروش الزامی است.' };
    const requirement = requirementForItem(item);
    if ('error' in requirement) return requirement;
    const key = `${requirement.sku}\u0000${requirement.packaged ? 'packaged' : 'weight'}`;
    const existing = requirements.get(key);
    if (!existing) requirements.set(key, { ...requirement });
    else {
      existing.quantity += requirement.quantity;
      if (existing.weightKg !== undefined) existing.weightKg += requirement.weightKg || 0;
    }
  }
  return [...requirements.values()];
}

function availableAt(lot: ColdStoragePallet, timestamp: number): boolean {
  const expiry = new Date(lot.expiryDate).getTime();
  const entered = new Date(lot.entryDate).getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(entered)) return false;
  if (entered > timestamp || expiry < timestamp) return false;
  if (lot.status === 'Pending Dispatch') return false;
  if ((lot as ColdStoragePallet & { qualityHold?: boolean }).qualityHold) return false;
  return Number(lot.unitsCount || 0) > 0 || Number(lot.weightKg || 0) > 0.001;
}

export function fulfillProforma(
  proforma: ProformaInvoice,
  coldStorage: ColdStoragePallet[],
  fulfilledAt = new Date().toISOString(),
): SaleFulfillmentResult {
  if (proforma.fulfilledAt || proforma.fulfillmentTransactionId) return { success: false, error: 'PROFORMA_ALREADY_FULFILLED' };
  const fulfillmentTime = new Date(fulfilledAt).getTime();
  if (!Number.isFinite(fulfillmentTime)) return { success: false, error: 'FULFILLMENT_TIME_INVALID' };
  const requirements = requirementsFor(proforma);
  if ('error' in requirements) return { success: false, error: requirements.error };

  const updated = coldStorage.map((lot) => ({ ...lot }));
  for (const requirement of requirements) {
    const matchingLots = updated.filter((lot) => saleLotMatchesSku(lot, requirement.sku));
    if (!matchingLots.length) return { success: false, error: `کالای فروش ${requirement.sku} در سردخانه یافت نشد.` };
    const lots = matchingLots.filter((lot) => availableAt(lot, fulfillmentTime));
    if (!lots.length) return { success: false, error: `هیچ لات معتبر و منقضی‌نشده‌ای برای ${requirement.sku} قابل ارسال نیست.` };

    if (requirement.packaged) {
      let remainingUnits = requirement.quantity;
      for (const lot of lots) {
        if (remainingUnits <= 0) break;
        if (!Number.isInteger(lot.unitsCount) || lot.unitsCount < 0 || !Number.isFinite(lot.weightKg) || lot.weightKg < 0) return { success: false, error: 'موجودی بسته‌بندی سردخانه نامعتبر است.' };
        const take = Math.min(lot.unitsCount, remainingUnits);
        if (take <= 0) continue;
        const unitWeightKg = lot.unitsCount > 0 ? lot.weightKg / lot.unitsCount : 0;
        lot.unitsCount -= take;
        lot.weightKg = Number(Math.max(0, lot.weightKg - unitWeightKg * take).toFixed(3));
        lot.status = lot.unitsCount === 0 && lot.weightKg <= 0.001 ? 'Pending Dispatch' : lot.status;
        remainingUnits -= take;
      }
      if (remainingUnits > 0) return { success: false, error: `موجودی بسته‌بندی معتبر ${requirement.sku} کافی نیست.` };
    } else {
      let remainingWeight = requirement.weightKg || 0;
      for (const lot of lots) {
        if (remainingWeight <= 0) break;
        if (!Number.isFinite(lot.weightKg) || lot.weightKg < 0) return { success: false, error: 'وزن موجودی سردخانه نامعتبر است.' };
        const take = Math.min(lot.weightKg, remainingWeight);
        lot.weightKg = Number((lot.weightKg - take).toFixed(3));
        lot.status = lot.weightKg <= 0.001 ? 'Pending Dispatch' : lot.status;
        remainingWeight = Number((remainingWeight - take).toFixed(3));
      }
      if (remainingWeight > 0.05) return { success: false, error: `وزن موجودی معتبر ${requirement.sku} کافی نیست.` };
    }
  }

  return { success: true, coldStorage: updated, fulfilledAt, transactionId: nextId('sale') };
}

export function validateSaleFulfillmentConservation(
  before: ColdStoragePallet[],
  after: ColdStoragePallet[],
  proforma: ProformaInvoice,
): { ok: boolean; error?: string } {
  const requirements = requirementsFor(proforma);
  if ('error' in requirements) return { ok: false, error: requirements.error };
  for (const requirement of requirements) {
    const beforeLots = before.filter((lot) => saleLotMatchesSku(lot, requirement.sku));
    const afterLots = after.filter((lot) => saleLotMatchesSku(lot, requirement.sku));
    if (!beforeLots.length || beforeLots.length !== afterLots.length) return { ok: false, error: 'SALE_STORAGE_REFERENCE_INVALID' };
    const beforeUnits = beforeLots.reduce((sum, lot) => sum + Number(lot.unitsCount || 0), 0);
    const afterUnits = afterLots.reduce((sum, lot) => sum + Number(lot.unitsCount || 0), 0);
    const beforeWeight = beforeLots.reduce((sum, lot) => sum + Number(lot.weightKg || 0), 0);
    const afterWeight = afterLots.reduce((sum, lot) => sum + Number(lot.weightKg || 0), 0);
    if (requirement.packaged) {
      if (beforeUnits - afterUnits !== requirement.quantity || beforeWeight + 0.05 < afterWeight) return { ok: false, error: 'SALE_PACKAGED_CONSERVATION_FAILED' };
    } else if (Math.abs((beforeWeight - afterWeight) - (requirement.weightKg || 0)) > 0.05) {
      return { ok: false, error: 'SALE_WEIGHT_CONSERVATION_FAILED' };
    }
  }
  return { ok: true };
}
