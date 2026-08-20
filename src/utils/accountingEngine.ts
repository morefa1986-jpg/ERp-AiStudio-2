import { Account, JournalEntry } from '../types';

export interface JournalInput extends Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'> {}

export interface AccountingPostingResult {
  success: boolean;
  error?: string;
  newEntry?: JournalEntry;
  updatedAccounts?: Account[];
}

/**
 * Double-Entry Accounting Core Engine.
 * Validates balance (Sum Debits === Sum Credits), account existence, positive amounts,
 * and properly aggregates multiple debit/credit lines for identical accounts.
 */
export function validateAndExecuteJournalEntry(
  entryData: JournalInput,
  accounts: Account[],
  existingJournals: JournalEntry[] = []
): AccountingPostingResult {
  if (!entryData.debits || entryData.debits.length === 0 || !entryData.credits || entryData.credits.length === 0) {
    return { success: false, error: 'سند حسابداری باید حداقل شامل یک ردیف بدهکار و یک ردیف بستانکار باشد.' };
  }

  // Validate all debit lines
  for (const d of entryData.debits) {
    if (!Number.isFinite(d.amount) || d.amount <= 0) {
      return { success: false, error: `مبلغ ردیف بدهکار (${d.accountName || d.accountId}) باید یک عدد مثبت معتبر باشد.` };
    }
    const acc = accounts.find((a) => a.id === d.accountId);
    if (!acc) {
      return { success: false, error: `حساب معین بدهکار با شناسه ${d.accountId} در سرفصل حساب‌ها یافت نشد.` };
    }
  }

  // Validate all credit lines
  for (const c of entryData.credits) {
    if (!Number.isFinite(c.amount) || c.amount <= 0) {
      return { success: false, error: `مبلغ ردیف بستانکار (${c.accountName || c.accountId}) باید یک عدد مثبت معتبر باشد.` };
    }
    const acc = accounts.find((a) => a.id === c.accountId);
    if (!acc) {
      return { success: false, error: `حساب معین بستانکار با شناسه ${c.accountId} در سرفصل حساب‌ها یافت نشد.` };
    }
  }

  const totalDebit = Number(entryData.debits.reduce((sum, d) => sum + d.amount, 0).toFixed(2));
  const totalCredit = Number(entryData.credits.reduce((sum, c) => sum + c.amount, 0).toFixed(2));

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `عدم توازن سند دوبل: جمع بدهکار (${totalDebit.toLocaleString()}) با جمع بستانکار (${totalCredit.toLocaleString()}) برابر نیست! اختلاف: ${Math.abs(totalDebit - totalCredit).toLocaleString()}`,
    };
  }

  const newEntry: JournalEntry = {
    ...entryData,
    id: 'jnl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    entryNumber: 'SANAD-' + Date.now().toString().slice(-6),
    totalDebit,
    totalCredit,
    isBalanced: true,
    createdAt: new Date().toISOString(),
  };

  // Correct aggregation for all debit and credit lines per account
  const updatedAccounts = accounts.map((acc) => {
    const totalDebitForAcc = entryData.debits
      .filter((d) => d.accountId === acc.id)
      .reduce((sum, d) => sum + d.amount, 0);

    const totalCreditForAcc = entryData.credits
      .filter((c) => c.accountId === acc.id)
      .reduce((sum, c) => sum + c.amount, 0);

    const netChange = totalDebitForAcc - totalCreditForAcc;

    return {
      ...acc,
      balance: acc.balance + netChange,
    };
  });

  return {
    success: true,
    newEntry,
    updatedAccounts,
  };
}
