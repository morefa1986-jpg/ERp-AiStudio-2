import { describe, expect, it } from 'vitest';
import type { ColdStoragePallet, ProcessingBatch, ProformaInvoice } from '../types';
import { fulfillProforma } from '../utils/salesEngine';
import { validateStateMutation } from '../utils/stateIntegrity';

function emptyState() {
  return {
    halls: [], ponds: [], species: [], feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [],
    treatments: [], transfers: [], broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [],
    inventory: [], inventoryTxs: [], labSamples: [], processingBatches: [], coldStorage: [], customers: [], proformas: [],
    accounts: [], journals: [], employees: [], attendance: [], payrolls: [], equipment: [], socialPosts: [], auditLogs: [], backups: [],
  };
}

function processing(citesPermitNumber?: string): ProcessingBatch {
  return {
    id: 'proc-a', batchCode: 'PROC-A', date: '2026-08-01', sourcePondId: 'pond-source', sourcePondName: 'Source', speciesName: 'Beluga',
    fishCount: 10, liveBiomassKg: 100, caviarYieldKg: 10, caviarYieldPercent: 10, caviarGrade: 'Imperial Beluga (50g/100g)',
    filletMeatYieldKg: 60, filletYieldPercent: 60, smokedMeatYieldKg: 20, byProductAndWasteKg: 10, operatorName: 'operator',
    qualityScore: 95, citesPermitNumber, status: 'Stored In Cold Room', outputLotIds: ['lot-a'], transactionId: 'txn-proc-a',
  };
}

function lot(id = 'lot-a', processingBatchId = 'proc-a'): ColdStoragePallet {
  return {
    id, sku: 'CAV-PROC-A', processingBatchId, slotCode: `A-${id}`, temperatureC: -2.5, productType: 'Caviar (Cans/Jars)', batchCode: 'PROC-A',
    weightKg: 0.5, unitsCount: 10, packagingUnit: '50g can', entryDate: '2026-08-01', expiryDate: '2027-08-01', status: 'Stored',
  };
}

function proforma(itemOverrides: Record<string, unknown> = {}, invoiceOverrides: Record<string, unknown> = {}): ProformaInvoice {
  return {
    id: 'prof-a', invoiceNumber: 'PI-A', customerId: 'cust-export', customerName: 'Export Customer', customerCompany: 'Exporter', customerCountry: 'UAE',
    date: '2026-08-10', expiryDate: '2026-09-10', stage: 'Invoice Issued (صدور فاکتور)',
    items: [{ id: 'line-a', productName: 'Caviar PROC-A', sku: 'CAV-PROC-A', coldStorageLotId: 'lot-a', processingBatchId: 'proc-a', quantity: 2, unit: '50g can', unitPrice: 100, taxPercent: 0, discount: 0, total: 200, ...itemOverrides }],
    subtotal: 200, taxTotal: 0, discountTotal: 0, grandTotal: 200, currency: 'USD', paymentTerms: '', deliveryTerms: '', citesPermitRequired: true, status: 'Sent',
    ...invoiceOverrides,
  } as ProformaInvoice;
}

function base(citesPermitNumber?: string) {
  const state = emptyState();
  state.processingBatches = [processing(citesPermitNumber)] as any[];
  state.coldStorage = [lot()] as any[];
  state.customers = [{
    id: 'cust-export', name: 'Export Customer', companyName: 'Exporter', category: 'Export Luxury Distributor', phone: '', email: 'e@example.test',
    country: 'UAE', city: 'Dubai', address: '', outstandingBalance: 0, currency: 'USD', totalOrdersCount: 0, totalSpent: 0, status: 'Regular', notes: '', createdAt: '2026-01-01T00:00:00Z',
  }] as any[];
  state.proformas = [proforma()] as any[];
  return state;
}

function fulfilledState(previous: ReturnType<typeof base>, invoice: ProformaInvoice) {
  const result = fulfillProforma(invoice, previous.coldStorage as ColdStoragePallet[], '2026-08-20T10:00:00Z');
  expect(result.success).toBe(true);
  const nextInvoice: ProformaInvoice = {
    ...invoice,
    stage: 'Dispatched / Delivery (تحویل)',
    fulfilledAt: result.fulfilledAt,
    fulfillmentTransactionId: result.transactionId,
  };
  return { ...previous, coldStorage: result.coldStorage!, proformas: [nextInvoice] };
}

describe('P0 sale line -> cold lot -> processing -> CITES traceability', () => {
  it('consumes only the immutable selected lot even when another lot has the same SKU', () => {
    const invoice = proforma();
    const lots = [lot('lot-a'), { ...lot('lot-b'), processingBatchId: 'proc-a' }];
    const result = fulfillProforma(invoice, lots, '2026-08-20T10:00:00Z');
    expect(result.success).toBe(true);
    expect(result.coldStorage?.find((row) => row.id === 'lot-a')?.unitsCount).toBe(8);
    expect(result.coldStorage?.find((row) => row.id === 'lot-b')?.unitsCount).toBe(10);
  });

  it('rejects dispatch when immutable cold-storage lot id is missing', () => {
    const previous = base('CITES-VALID-A');
    const legacyInvoice = proforma({ coldStorageLotId: undefined });
    previous.proformas = [legacyInvoice] as any[];
    const next = fulfilledState(previous, legacyInvoice);
    expect(validateStateMutation(previous, next, { module: 'sales', action: 'edit' })).toMatchObject({ ok: false, error: 'SALE_LOT_ID_REQUIRED' });
  });

  it('rejects a forged processing batch id even when SKU and lot id are valid', () => {
    const previous = base('CITES-VALID-A');
    const forged = proforma({ processingBatchId: 'proc-forged' });
    previous.proformas = [forged] as any[];
    const next = fulfilledState(previous, forged);
    expect(validateStateMutation(previous, next, { module: 'sales', action: 'edit' })).toMatchObject({ ok: false, error: 'SALE_PROCESSING_ORIGIN_MISMATCH' });
  });

  it('derives export-CITES requirement server-side even if client sets citesPermitRequired=false', () => {
    const previous = base(undefined);
    const malicious = proforma({}, { citesPermitRequired: false });
    previous.proformas = [malicious] as any[];
    const next = fulfilledState(previous, malicious);
    expect(validateStateMutation(previous, next, { module: 'sales', action: 'edit' })).toMatchObject({ ok: false, error: 'SALE_CITES_PERMIT_REQUIRED' });
  });

  it('accepts exact traceability and registered processing CITES for export caviar dispatch', () => {
    const previous = base('CITES-VALID-A');
    const invoice = proforma();
    previous.proformas = [invoice] as any[];
    const next = fulfilledState(previous, invoice);
    expect(validateStateMutation(previous, next, { module: 'sales', action: 'edit' })).toEqual({ ok: true });
  });
});
