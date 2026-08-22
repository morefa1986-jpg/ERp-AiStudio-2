import { Account, JournalEntry } from '../types';
import { nextId, nextReference } from './id';

export interface JournalInput extends Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'> {}

export interface AccountingPostingResult {
  success: boolean;
  error?: string;
  newEntry?: JournalEntry;
  updatedAccounts?: Account[];
}

export interface FxConversionInput {
  date: string;
  description: string;
  sourceAccountId: string;
  targetAccountId: string;
  sourceAmount: number;
  sourceToTargetRate: number;
  referenceId?: string;
  approvedBy?: string;
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

export function validateAndExecuteFxConversion(
  input: FxConversionInput,
  accounts: Account[],
  existingJournals: JournalEntry[] = []
): AccountingPostingResult {
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) {
    return { success: false, error: 'FX_DATE_INVALID' };
  }
  if (!input.description?.trim()) {
    return { success: false, error: 'FX_DESCRIPTION_REQUIRED' };
  }
  if (!Number.isFinite(input.sourceAmount) || input.sourceAmount <= 0) {
    return { success: false, error: 'FX_SOURCE_AMOUNT_INVALID' };
  }
  if (!Number.isFinite(input.sourceToTargetRate) || input.sourceToTargetRate <= 0) {
    return { success: false, error: 'FX_RATE_INVALID' };
  }
  if (input.referenceId && existingJournals.some((journal) => journal.referenceType === 'FX' && journal.referenceId === input.referenceId)) {
    return { success: false, error: 'FX_REFERENCE_DUPLICATE' };
  }

  const source = accounts.find((account) => account.id === input.sourceAccountId);
  const target = accounts.find((account) => account.id === input.targetAccountId);
  if (!source || !target) return { success: false, error: 'FX_ACCOUNT_NOT_FOUND' };
  if (source.id === target.id) return { success: false, error: 'FX_ACCOUNTS_MUST_DIFFER' };
  if (source.currency === target.currency) return { success: false, error: 'FX_CURRENCIES_MUST_DIFFER' };
  if (!source.type.startsWith('Asset') || !target.type.startsWith('Asset')) {
    return { success: false, error: 'FX_ONLY_ASSET_ACCOUNTS' };
  }
  if (source.balance < input.sourceAmount) {
    return { success: false, error: 'FX_SOURCE_BALANCE_INSUFFICIENT' };
  }

  const sourceAmount = Number(input.sourceAmount.toFixed(2));
  const targetAmount = Number((sourceAmount * input.sourceToTargetRate).toFixed(2));
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { success: false, error: 'FX_TARGET_AMOUNT_INVALID' };
  }

  const newEntry: JournalEntry = {
    id: nextId('jnl'),
    entryNumber: nextReference('FX'),
    date: input.date,
    description: input.description.trim(),
    referenceType: 'FX',
    referenceId: input.referenceId,
    debits: [{ accountId: target.id, accountName: target.faName || target.name, amount: targetAmount }],
    credits: [{ accountId: source.id, accountName: source.faName || source.name, amount: sourceAmount }],
    totalDebit: targetAmount,
    totalCredit: sourceAmount,
    isBalanced: true,
    approvedBy: input.approvedBy,
    createdAt: new Date().toISOString(),
    isFxConversion: true,
    fx: {
      sourceAccountId: source.id,
      targetAccountId: target.id,
      sourceCurrency: source.currency,
      targetCurrency: target.currency,
      sourceAmount,
      targetAmount,
      sourceToTargetRate: input.sourceToTargetRate,
    },
  };

  const updatedAccounts = accounts.map((account) => {
    if (account.id === source.id) return { ...account, balance: Number((account.balance - sourceAmount).toFixed(2)) };
    if (account.id === target.id) return { ...account, balance: Number((account.balance + targetAmount).toFixed(2)) };
    return account;
  });

  return { success: true, newEntry, updatedAccounts };
}
