import { describe, expect, it } from 'vitest';
import { buildReceivablesAging, summarizeReceivables } from '../utils/receivablesAging';
import { ProformaInvoice } from '../types';

function invoice(overrides: Partial<ProformaInvoice>): ProformaInvoice {
  return {
    id: overrides.id || `p_${overrides.invoiceNumber || 'x'}`,
    invoiceNumber: overrides.invoiceNumber || 'PF-X',
    customerId: overrides.customerId || 'c1',
    customerName: overrides.customerName || 'Customer',
    customerCompany: overrides.customerCompany || 'Company',
    customerCountry: overrides.customerCountry || 'IR',
    date: overrides.date || '2026-01-01',
    expiryDate: overrides.expiryDate || '2026-01-31',
    stage: overrides.stage || 'Invoice Issued (صدور فاکتور)',
    items: overrides.items || [],
    subtotal: overrides.subtotal ?? overrides.grandTotal ?? 0,
    taxTotal: overrides.taxTotal || 0,
    discountTotal: overrides.discountTotal || 0,
    grandTotal: overrides.grandTotal ?? 0,
    currency: overrides.currency || 'USD',
    paymentTerms: overrides.paymentTerms || 'Net 30',
    deliveryTerms: overrides.deliveryTerms || 'EXW',
    citesPermitRequired: overrides.citesPermitRequired || false,
    status: overrides.status || 'Sent',
  };
}

describe('receivablesAging', () => {
  it('buckets unpaid invoices and excludes paid, closed, and cancelled invoices', () => {
    const rows = buildReceivablesAging([
      invoice({ invoiceNumber: 'PF-CURRENT', expiryDate: '2026-08-30', grandTotal: 100 }),
      invoice({ invoiceNumber: 'PF-30', expiryDate: '2026-08-01', grandTotal: 200 }),
      invoice({ invoiceNumber: 'PF-60', expiryDate: '2026-06-20', grandTotal: 300 }),
      invoice({ invoiceNumber: 'PF-90', expiryDate: '2026-05-30', grandTotal: 400 }),
      invoice({ invoiceNumber: 'PF-OLD', expiryDate: '2026-01-01', grandTotal: 500 }),
      invoice({ invoiceNumber: 'PF-PAID', stage: 'Payment Received (تسویه)', expiryDate: '2026-01-01', grandTotal: 999 }),
      invoice({ invoiceNumber: 'PF-CANCELLED', status: 'Cancelled', expiryDate: '2026-01-01', grandTotal: 999 }),
    ], '2026-08-24');

    expect(rows.map((row) => row.invoiceNumber)).not.toContain('PF-PAID');
    expect(rows.map((row) => row.invoiceNumber)).not.toContain('PF-CANCELLED');
    expect(rows.find((row) => row.invoiceNumber === 'PF-CURRENT')?.bucket).toBe('Not Due');
    expect(rows.find((row) => row.invoiceNumber === 'PF-30')?.bucket).toBe('1-30');
    expect(rows.find((row) => row.invoiceNumber === 'PF-60')?.bucket).toBe('31-60');
    expect(rows.find((row) => row.invoiceNumber === 'PF-90')?.bucket).toBe('61-90');
    expect(rows.find((row) => row.invoiceNumber === 'PF-OLD')?.bucket).toBe('90+');

    const summary = summarizeReceivables(rows);
    expect(summary['Not Due']).toBe(100);
    expect(summary['1-30']).toBe(200);
    expect(summary['31-60']).toBe(300);
    expect(summary['61-90']).toBe(400);
    expect(summary['90+']).toBe(500);
  });
});
