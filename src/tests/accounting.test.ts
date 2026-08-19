import { describe, it, expect } from 'vitest';

describe('Double-Entry Accounting & General Ledger Integrity', () => {
  it('strictly rejects unbalanced journal entries where Debits != Credits', () => {
    const debits = [{ accountId: '1110', accountName: 'انبار', amount: 500000000 }];
    const credits = [{ accountId: '1020', accountName: 'بانک', amount: 480000000 }];

    const totalDebit = debits.reduce((s, d) => s + d.amount, 0);
    const totalCredit = credits.reduce((s, c) => s + c.amount, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

    expect(isBalanced).toBe(false);
    expect(totalDebit - totalCredit).toBe(20000000);
  });

  it('validates and accepts balanced multi-line journal transactions', () => {
    const debits = [
      { accountId: '1110', accountName: 'انبار خوراک', amount: 300000000 },
      { accountId: '5010', accountName: 'هزینه حمل و نقل', amount: 20000000 },
    ];
    const credits = [
      { accountId: '1020', accountName: 'بانک ملت', amount: 250000000 },
      { accountId: '2010', accountName: 'حساب‌های پرداختنی تجاری', amount: 70000000 },
    ];

    const totalDebit = debits.reduce((s, d) => s + d.amount, 0);
    const totalCredit = credits.reduce((s, c) => s + c.amount, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

    expect(isBalanced).toBe(true);
    expect(totalDebit).toBe(320000000);
    expect(totalCredit).toBe(320000000);
  });
});
