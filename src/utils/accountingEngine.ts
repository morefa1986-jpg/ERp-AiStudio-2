import { Account, JournalEntry } from '../types';
import { nextId, nextReference } from './id';

export interface JournalInput extends Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'> {}

export interface AccountingPostingResult {
  success: boolean;
  error?: string;
  newEntry?: JournalEntry;
  updatedAccounts?: Account[];
}

function isDebitNormal(account: Account): boolean {
  return account.type.startsWith('Asset') || account.type.startsWith('Expense');
}

function balanceDelta(account: Account, debit: number, credit: number): number {
  return isDebitNormal(account) ? debit - credit : credit - debit;
}

export function validateAndExecuteJournalEntry(
  entryData: JournalInput,
  accounts: Account[],
  existingJournals: JournalEntry[] = []
): AccountingPostingResult {
  if (!entryData.debits?.length || !entryData.credits?.length) {
    return { success: false, error: 'سند باید حداقل یک ردیف بدهکار و یک ردیف بستانکار داشته باشد.' };
  }
  if (!entryData.date || Number.isNaN(new Date(entryData.date).getTime())) {
    return { success: false, error: 'تاریخ سند نامعتبر است.' };
  }
  if (!entryData.description?.trim()) {
    return { success: false, error: 'شرح سند الزامی است.' };
  }
  if (entryData.referenceId && existingJournals.some((journal) => journal.referenceType === entryData.referenceType && journal.referenceId === entryData.referenceId)) {
    return { success: false, error: 'سند با این مرجع قبلاً ثبت شده است.' };
  }

  const allLines = [...entryData.debits, ...entryData.credits];
  const lineAccounts = new Map<string, Account>();
  for (const line of allLines) {
    if (!Number.isFinite(line.amount) || line.amount <= 0) {
      return { success: false, error: `مبلغ ردیف ${line.accountName || line.accountId} باید عدد مثبت معتبر باشد.` };
    }
    const account = accounts.find((item) => item.id === line.accountId);
    if (!account) return { success: false, error: `حساب ${line.accountId} یافت نشد.` };
    lineAccounts.set(account.id, account);
  }

  const currencies = new Set(Array.from(lineAccounts.values()).map((account) => account.currency));
  if (currencies.size > 1) {
    return { success: false, error: 'ثبت یک سند با حساب‌های دارای ارز متفاوت مجاز نیست؛ ابتدا تبدیل ارز ثبت شود.' };
  }

  const totalDebit = Number(entryData.debits.reduce((sum, line) => sum + line.amount, 0).toFixed(2));
  const totalCredit = Number(entryData.credits.reduce((sum, line) => sum + line.amount, 0).toFixed(2));
  if (!Number.isFinite(totalDebit) || !Number.isFinite(totalCredit) || Math.abs(totalDebit - totalCredit) > 0.01) {
    return { success: false, error: `عدم توازن سند دوبل: بدهکار ${totalDebit.toLocaleString()} و بستانکار ${totalCredit.toLocaleString()} است.` };
  }

  const newEntry: JournalEntry = {
    ...entryData,
    id: nextId('jnl'),
    entryNumber: nextReference('SANAD'),
    totalDebit,
    totalCredit,
    isBalanced: true,
    createdAt: new Date().toISOString(),
  };

  const updatedAccounts = accounts.map((account) => {
    const debit = entryData.debits.filter((line) => line.accountId === account.id).reduce((sum, line) => sum + line.amount, 0);
    const credit = entryData.credits.filter((line) => line.accountId === account.id).reduce((sum, line) => sum + line.amount, 0);
    if (!debit && !credit) return account;
    const nextBalance = Number((account.balance + balanceDelta(account, debit, credit)).toFixed(2));
    if (!Number.isFinite(nextBalance)) return account;
    return { ...account, balance: nextBalance };
  });

  return { success: true, newEntry, updatedAccounts };
}
