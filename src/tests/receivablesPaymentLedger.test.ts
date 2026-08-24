import { describe, expect, it } from 'vitest';
import { buildReceivablesAging, summarizeReceivables } from '../utils/receivablesAging';

const invoice = (patch: Record<string, unknown> = {}) => ({
  id: 'pf_1', invoiceNumber: 'PF-001', customerId: 'cust_1', customerName: 'Ali', customerCompany: 'Fathi Export', customerCountry: 'UAE',
  date: '2026-07-01', expiryDate: '2026-07-15', currency: 'USD', grandTotal: 1000,
  stage: 'Proforma (پیش‌فاکتور)', status: 'Active', items: [],
  ...patch,
} as any);

describe('receivables aging with payment ledger', () => {
  it('subtracts posted partial payments and ignores void/future/wrong-currency payments', () => {
    const rows = buildReceivablesAging([invoice()], '2026-08-24', [
      { id: 'pay_1', proformaId: 'pf_1', date: '2026-07-20', amount: 250, currency: 'USD', status: 'Posted' },
      { id: 'pay_2', invoiceNumber: 'PF-001', date: '2026-07-25', amount: 50, currency: 'USD', status: 'Voided' },
      { id: 'pay_3', invoiceNumber: 'PF-001', date: '2026-09-01', amount: 100, currency: 'USD', status: 'Posted' },
      { id: 'pay_4', invoiceNumber: 'PF-001', date: '2026-07-21', amount: 200, currency: 'IRR', status: 'Posted' },
    ] as any);
    expect(rows).toHaveLength(1);
    expect(rows[0].originalAmount).toBe(1000);
    expect(rows[0].paidAmount).toBe(250);
    expect(rows[0].amountDue).toBe(750);
    expect(rows[0].bucket).toBe('31-60');
    expect(summarizeReceivables(rows)['31-60']).toBe(750);
  });

  it('removes fully paid invoices from aging', () => {
    const rows = buildReceivablesAging([invoice()], '2026-08-24', [
      { id: 'pay_1', proformaId: 'pf_1', date: '2026-07-20', amount: 1000, currency: 'USD', status: 'Posted' },
    ] as any);
    expect(rows).toEqual([]);
  });
});
