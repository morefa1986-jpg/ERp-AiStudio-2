import { describe, expect, it } from 'vitest';
import { buildPayrollJournalDraft } from '../utils/payrollAccounting';
import { Account, PayrollRecord } from '../types';

const accounts: Account[] = [
  { id: 'expense', code: '5020', name: 'Payroll & Wages Expense', faName: 'هزینه حقوق و دستمزد پرسنل', type: 'Expense (هزینه)', balance: 0, currency: 'IRR' },
  { id: 'payable', code: '2010', name: 'Accounts Payable', faName: 'حساب‌های پرداختنی تجاری', type: 'Liability (بدهی)', balance: 0, currency: 'IRR' },
  { id: 'usd_expense', code: '5021', name: 'Payroll & Wages Expense', faName: 'Payroll USD', type: 'Expense (هزینه)', balance: 0, currency: 'USD' },
];

function payroll(id: string, netPay: number, currency = 'IRR'): PayrollRecord {
  return {
    id,
    payrollMonth: '2026-08',
    employeeId: `emp_${id}`,
    employeeName: `Employee ${id}`,
    department: 'Production & Halls',
    baseSalary: netPay,
    overtimePay: 0,
    shiftBonus: 0,
    hardshipAllowance: 0,
    grossSalary: netPay,
    socialSecurityInsurance: 0,
    incomeTax: 0,
    loanDeduction: 0,
    netPay,
    currency,
    paymentStatus: 'Calculated',
  };
}

describe('payrollAccounting', () => {
  it('creates a balanced payroll accrual draft from payroll rows', () => {
    const result = buildPayrollJournalDraft({ payrolls: [payroll('1', 100), payroll('2', 250)], accounts, payrollMonth: '2026-08', currency: 'IRR', approvedBy: 'Chief Accountant' });
    expect(result.success).toBe(true);
    expect(result.draft?.totalDebit).toBe(350);
    expect(result.draft?.totalCredit).toBe(350);
    expect(result.draft?.debits[0].accountId).toBe('expense');
    expect(result.draft?.credits[0].accountId).toBe('payable');
    expect(result.draft?.referenceType).toBe('Payroll');
  });

  it('fails closed when same-currency liability account is missing', () => {
    const result = buildPayrollJournalDraft({ payrolls: [payroll('usd', 100, 'USD')], accounts, payrollMonth: '2026-08', currency: 'USD' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('PAYROLL_ACCOUNTS_NOT_CONFIGURED');
  });
});
