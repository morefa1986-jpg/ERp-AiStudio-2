import { describe, expect, it } from 'vitest';
import { ColdStoragePallet, ProformaInvoice } from '../types';
import { fulfillProforma, validateSaleFulfillmentConservation } from '../utils/salesEngine';

const lot: ColdStoragePallet = {
  id: 'lot-1', sku: 'CAV-BEL-50G', slotCode: 'C-1', temperatureC: -2.8,
  productType: 'Caviar (Cans/Jars)', batchCode: 'B-1', weightKg: 10, unitsCount: 200,
  packagingUnit: '50g can', entryDate: '2026-08-21', expiryDate: '2027-08-21', status: 'Stored',
};

const proforma: ProformaInvoice = {
  id: 'pi-1', invoiceNumber: 'PI-1', customerId: 'c-1', customerName: 'Customer', customerCompany: 'Company', customerCountry: 'DE',
  date: '2026-08-21', expiryDate: '2026-09-21', stage: 'Proforma (پیش‌فاکتور)',
  items: [{ id: 'item-1', productName: 'Caviar', sku: 'CAV-BEL-50G', quantity: 40, unit: 'can', unitPrice: 100, taxPercent: 0, discount: 0, total: 4000 }],
  subtotal: 4000, taxTotal: 0, discountTotal: 0, grandTotal: 4000, currency: 'EUR', paymentTerms: 'prepaid', deliveryTerms: 'pickup', citesPermitRequired: true, status: 'Sent',
};

const fulfillmentTime = '2026-08-23T10:00:00.000Z';

describe('sale fulfillment conservation', () => {
  it('atomically consumes packaged cold-storage units and weight', () => {
    const result = fulfillProforma(proforma, [lot], fulfillmentTime);
    expect(result.success).toBe(true);
    expect(result.transactionId).toBeTruthy();
    expect(result.coldStorage?.[0]).toMatchObject({ unitsCount: 160, weightKg: 8 });
    expect(validateSaleFulfillmentConservation([lot], result.coldStorage || [], proforma).ok).toBe(true);
  });

  it('rejects a sale that exceeds available packaged stock', () => {
    const result = fulfillProforma({ ...proforma, items: [{ ...proforma.items[0], quantity: 201 }] }, [lot], fulfillmentTime);
    expect(result.success).toBe(false);
    expect(result.error).toContain('موجودی بسته‌بندی معتبر');
  });

  it('aggregates duplicate SKU lines before consuming stock', () => {
    const result = fulfillProforma({ ...proforma, items: [
      { ...proforma.items[0], quantity: 20 },
      { ...proforma.items[0], id: 'item-2', quantity: 30 },
    ] }, [lot], fulfillmentTime);
    expect(result.success).toBe(true);
    expect(result.coldStorage?.[0]).toMatchObject({ unitsCount: 150, weightKg: 7.5 });
  });

  it('fails closed for expired, future-entry and already-dispatched lots', () => {
    expect(fulfillProforma(proforma, [{ ...lot, expiryDate: '2026-08-22' }], fulfillmentTime).success).toBe(false);
    expect(fulfillProforma(proforma, [{ ...lot, entryDate: '2026-08-24' }], fulfillmentTime).success).toBe(false);
    expect(fulfillProforma(proforma, [{ ...lot, status: 'Pending Dispatch' }], fulfillmentTime).success).toBe(false);
  });
});
