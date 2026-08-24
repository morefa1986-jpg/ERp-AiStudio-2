import { Account, JournalEntry, PayrollRecord } from '../types';

export interface PayrollJournalDraft {
  date: string;
  description: string;
  referenceType: JournalEntry['referenceType'];
  referenceId: string;
  debits: { accountId: string; accountName: string; amount: number }[];
  credits: { accountId: string; accountName: string; amount: number }[];
  totalDebit: number;
  totalCredit: number;
  approvedBy?: string;
}

function sameCurrencyAccounts(accounts: Account[], currency: string) {
  const expense = accounts.find((account) => account.currency === currency && account.type === 'Expense (هزینه)' && /payroll|wages|حقوق|دستمزد/i.test(`${account.name} ${account.faName}`));
  const payable = accounts.find((account) => account.currency === currency && account.type === 'Liability (بدهی)' && /payable|پرداختنی|بدهی/i.test(`${account.name} ${account.faName}`));
  return { expense, payable };
}

export function buildPayrollJournalDraft(input: { payrolls: PayrollRecord[]; accounts: Account[]; payrollMonth: string; currency: string; approvedBy?: string }): { success: boolean; error?: string; draft?: PayrollJournalDraft } {
  const selected = input.payrolls.filter((row) => row.payrollMonth === input.payrollMonth && row.currency === input.currency);
  if (!/^\d{4}-\d{2}$/.test(input.payrollMonth)) return { success: false, error: 'PAYROLL_MONTH_INVALID' };
  if (!selected.length) return { success: false, error: 'PAYROLL_ROWS_NOT_FOUND' };
  const amount = Number(selected.reduce((sum, row) => sum + row.netPay, 0).toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'PAYROLL_AMOUNT_INVALID' };
  const { expense, payable } = sameCurrencyAccounts(input.accounts, input.currency);
  if (!expense || !payable) return { success: false, error: 'PAYROLL_ACCOUNTS_NOT_CONFIGURED' };
  return {
    success: true,
    draft: {
      date: `${input.payrollMonth}-28`,
      description: `Payroll accrual for ${input.payrollMonth} (${selected.length} employees)`,
      referenceType: 'Payroll',
      referenceId: `payroll_${input.payrollMonth}_${input.currency}`,
      debits: [{ accountId: expense.id, accountName: expense.faName || expense.name, amount }],
      credits: [{ accountId: payable.id, accountName: payable.faName || payable.name, amount }],
      totalDebit: amount,
      totalCredit: amount,
      approvedBy: input.approvedBy,
    },
  };
}
