import { describe, expect, it } from 'vitest';
import { Account, JournalEntry } from '../types';
import { validateAndExecuteFxConversion, validateAndExecuteJournalEntry } from '../utils/accountingEngine';

const accounts: Account[] = [
  { id: 'acc_cash', code: '1010', name: 'Cash', faName: 'نقد و بانک', type: 'Asset (دارایی)', balance: 100_000_000, currency: 'IRR' },
  { id: 'acc_sales', code: '4010', name: 'Sales', faName: 'درآمد فروش', type: 'Revenue (درآمد)', balance: 500_000_000, currency: 'IRR' },
  { id: 'acc_feed', code: '5010', name: 'Feed Expense', faName: 'هزینه خوراک', type: 'Expense (هزینه)', balance: 200_000_000, currency: 'IRR' },
  { id: 'acc_usd_bank', code: '1020', name: 'USD Bank', faName: 'بانک دلاری', type: 'Asset (دارایی)', balance: 1_000, currency: 'USD' },
];

function entry(overrides: Partial<Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'>> = {}): Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'> {
  return {
    date: '2026-08-20',
    description: 'خرید نقدی خوراک',
    referenceType: 'Purchase',
    referenceId: 'PO-001',
    debits: [{ accountId: 'acc_feed', accountName: 'هزینه خوراک', amount: 50_000_000 }],
    credits: [{ accountId: 'acc_cash', accountName: 'نقد و بانک', amount: 50_000_000 }],
    totalDebit: 0,
    totalCredit: 0,
    approvedBy: 'Accountant',
    ...overrides,
  };
}

describe('Accounting Engine - double-entry ledger', () => {
  it('posts a balanced expense transaction using normal account balance direction', () => {
    const result = validateAndExecuteJournalEntry(entry(), accounts, []);
    expect(result.success).toBe(true);
    expect(result.newEntry?.totalDebit).toBe(50_000_000);
    expect(result.newEntry?.totalCredit).toBe(50_000_000);
    expect(result.updatedAccounts?.find((account) => account.id === 'acc_feed')?.balance).toBe(250_000_000);
    expect(result.updatedAccounts?.find((account) => account.id === 'acc_cash')?.balance).toBe(50_000_000);
  });

  it('increases revenue on credit and aggregates repeated lines for the same account', () => {
    const result = validateAndExecuteJournalEntry(entry({
      description: 'فروش نقدی ترکیبی',
      referenceType: 'Sales',
      referenceId: 'SALE-001',
      debits: [
        { accountId: 'acc_cash', accountName: 'نقد قسط اول', amount: 30_000_000 },
        { accountId: 'acc_cash', accountName: 'نقد قسط دوم', amount: 20_000_000 },
      ],
      credits: [{ accountId: 'acc_sales', accountName: 'درآمد فروش', amount: 50_000_000 }],
    }), accounts, []);
    expect(result.success).toBe(true);
    expect(result.updatedAccounts?.find((account) => account.id === 'acc_cash')?.balance).toBe(150_000_000);
    expect(result.updatedAccounts?.find((account) => account.id === 'acc_sales')?.balance).toBe(550_000_000);
  });

  it('rejects unbalanced, invalid amount, unknown account and duplicate reference entries', () => {
    expect(validateAndExecuteJournalEntry(entry({ credits: [{ accountId: 'acc_cash', accountName: 'Cash', amount: 40_000_000 }] }), accounts).success).toBe(false);
    expect(validateAndExecuteJournalEntry(entry({ debits: [{ accountId: 'acc_feed', accountName: 'Feed', amount: Number.NaN }] }), accounts).success).toBe(false);
    expect(validateAndExecuteJournalEntry(entry({ debits: [{ accountId: 'missing', accountName: 'Missing', amount: 50_000_000 }] }), accounts).success).toBe(false);

    const existing: JournalEntry[] = [{
      ...entry(), id: 'jnl_existing', entryNumber: 'SANAD-1', createdAt: '2026-08-20T10:00:00Z', isBalanced: true, totalDebit: 50_000_000, totalCredit: 50_000_000,
    }];
    expect(validateAndExecuteJournalEntry(entry(), accounts, existing).success).toBe(false);
  });

  it('posts explicit FX conversion journals without directly summing currencies', () => {
    const result = validateAndExecuteFxConversion({
      date: '2026-08-20',
      description: 'تبدیل دلار به ریال برای تنخواه',
      sourceAccountId: 'acc_usd_bank',
      targetAccountId: 'acc_cash',
      sourceAmount: 100,
      sourceToTargetRate: 620_000,
      referenceId: 'FX-001',
      approvedBy: 'Accountant',
    }, accounts, []);

    expect(result.success).toBe(true);
    expect(result.newEntry?.referenceType).toBe('FX');
    expect(result.newEntry?.isFxConversion).toBe(true);
    expect(result.newEntry?.fx).toMatchObject({ sourceCurrency: 'USD', targetCurrency: 'IRR', sourceAmount: 100, targetAmount: 62_000_000 });
    expect(result.updatedAccounts?.find((account) => account.id === 'acc_usd_bank')?.balance).toBe(900);
    expect(result.updatedAccounts?.find((account) => account.id === 'acc_cash')?.balance).toBe(162_000_000);
  });

  it('rejects FX conversion without an explicit valid rate or enough source balance', () => {
    expect(validateAndExecuteFxConversion({
      date: '2026-08-20',
      description: 'Invalid rate',
      sourceAccountId: 'acc_usd_bank',
      targetAccountId: 'acc_cash',
      sourceAmount: 100,
      sourceToTargetRate: 0,
    }, accounts).success).toBe(false);
    expect(validateAndExecuteFxConversion({
      date: '2026-08-20',
      description: 'Too much source',
      sourceAccountId: 'acc_usd_bank',
      targetAccountId: 'acc_cash',
      sourceAmount: 2_000,
      sourceToTargetRate: 620_000,
    }, accounts).error).toBe('FX_SOURCE_BALANCE_INSUFFICIENT');
  });
});
