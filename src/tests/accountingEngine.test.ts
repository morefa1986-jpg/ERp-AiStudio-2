import { describe, it, expect } from 'vitest';
import { validateAndExecuteJournalEntry } from '../utils/accountingEngine';
import { Account, JournalEntry } from '../types';

describe('Accounting Engine - Double Entry & Compound Ledger', () => {
  const initialAccounts: Account[] = [
    {
      id: 'acc_cash',
      code: '1010',
      name: 'موجودی نقد و بانک',
      type: 'Asset',
      balance: 100000000,
      description: 'حساب جاری ریالی',
    },
    {
      id: 'acc_sales',
      code: '4010',
      name: 'درآمد فروش خاویار و گوشت',
      type: 'Revenue',
      balance: 500000000,
      description: 'فروش تجاری',
    },
    {
      id: 'acc_feed_exp',
      code: '5010',
      name: 'هزینه خوراک و مکمل آبزیان',
      type: 'Expense',
      balance: 200000000,
      description: 'هزینه جاری تغذیه',
    },
  ];

  it('successfully records balanced double-entry transaction and updates accounts', () => {
    const balancedEntry = {
      date: '2026-03-30',
      description: 'خرید نقدی مکمل تغذیه',
      referenceNumber: 'INV-2026-01',
      operator: 'Accountant',
      debits: [{ accountId: 'acc_feed_exp', accountName: 'هزینه خوراک', amount: 50000000 }],
      credits: [{ accountId: 'acc_cash', accountName: 'موجودی نقد', amount: 50000000 }],
    };

    const result = validateAndExecuteJournalEntry(balancedEntry, initialAccounts, []);
    expect(result.success).toBe(true);
    expect(result.newEntry).toBeDefined();
    expect(result.newEntry!.isBalanced).toBe(true);
    expect(result.newEntry!.totalDebit).toBe(50000000);
    expect(result.newEntry!.totalCredit).toBe(50000000);

    const updatedCash = result.updatedAccounts!.find((a) => a.id === 'acc_cash')!;
    const updatedFeedExp = result.updatedAccounts!.find((a) => a.id === 'acc_feed_exp')!;

    expect(updatedCash.balance).toBe(50000000); // 100m - 50m
    expect(updatedFeedExp.balance).toBe(250000000); // 200m + 50m
  });

  it('rejects unbalanced journal entries where TotalDebit !== TotalCredit', () => {
    const unbalancedEntry = {
      date: '2026-03-30',
      description: 'ثبت نامتوازن',
      referenceNumber: 'INV-ERR',
      operator: 'Accountant',
      debits: [{ accountId: 'acc_feed_exp', accountName: 'هزینه خوراک', amount: 50000000 }],
      credits: [{ accountId: 'acc_cash', accountName: 'موجودی نقد', amount: 40000000 }], // Diff 10m
    };

    const result = validateAndExecuteJournalEntry(unbalancedEntry, initialAccounts, []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('عدم توازن سند دوبل');
  });

  it('properly aggregates compound entries with multiple debits or credits to the same account', () => {
    const compoundEntry = {
      date: '2026-03-30',
      description: 'فروش ترکیبی و هزینه حمل',
      referenceNumber: 'INV-COMP',
      operator: 'Accountant',
      debits: [
        { accountId: 'acc_cash', accountName: 'نقد قسط اول', amount: 30000000 },
        { accountId: 'acc_cash', accountName: 'نقد قسط دوم', amount: 20000000 },
      ],
      credits: [
        { accountId: 'acc_sales', accountName: 'درآمد کل', amount: 50000000 },
      ],
    };

    const result = validateAndExecuteJournalEntry(compoundEntry, initialAccounts, []);
    expect(result.success).toBe(true);

    const updatedCash = result.updatedAccounts!.find((a) => a.id === 'acc_cash')!;
    // Initial 100m + 30m + 20m = 150m
    expect(updatedCash.balance).toBe(150000000);
  });
});
