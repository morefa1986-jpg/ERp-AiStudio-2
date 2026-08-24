import { AttendanceRecord, Employee, PayrollRecord } from '../types';
import { nextId } from './id';

export interface PayrollPolicy {
  payrollMonth: string;
  standardMonthlyHours: number;
  overtimeMultiplier: number;
  socialSecurityRatePercent: number;
  incomeTaxRatePercent: number;
  shiftBonusFlat: number;
  hardshipAllowanceFlat: number;
  loanDeductionFlat: number;
}

export const DEFAULT_PAYROLL_POLICY: Omit<PayrollPolicy, 'payrollMonth'> = {
  standardMonthlyHours: 240,
  overtimeMultiplier: 1.4,
  socialSecurityRatePercent: 0,
  incomeTaxRatePercent: 0,
  shiftBonusFlat: 0,
  hardshipAllowanceFlat: 0,
  loanDeductionFlat: 0,
};

export function validatePayrollPolicy(policy: PayrollPolicy): { ok: boolean; error?: string } {
  if (!/^\d{4}-\d{2}$/.test(policy.payrollMonth)) return { ok: false, error: 'PAYROLL_MONTH_INVALID' };
  if (!Number.isFinite(policy.standardMonthlyHours) || policy.standardMonthlyHours <= 0) return { ok: false, error: 'PAYROLL_STANDARD_HOURS_INVALID' };
  if (!Number.isFinite(policy.overtimeMultiplier) || policy.overtimeMultiplier < 1 || policy.overtimeMultiplier > 5) return { ok: false, error: 'PAYROLL_OVERTIME_MULTIPLIER_INVALID' };
  for (const key of ['socialSecurityRatePercent', 'incomeTaxRatePercent'] as const) {
    if (!Number.isFinite(policy[key]) || policy[key] < 0 || policy[key] > 100) return { ok: false, error: `PAYROLL_RATE_INVALID:${key}` };
  }
  for (const key of ['shiftBonusFlat', 'hardshipAllowanceFlat', 'loanDeductionFlat'] as const) {
    if (!Number.isFinite(policy[key]) || policy[key] < 0) return { ok: false, error: `PAYROLL_AMOUNT_INVALID:${key}` };
  }
  return { ok: true };
}

function roundMoney(value: number): number { return Number(Math.max(0, value).toFixed(0)); }

export function calculatePayrollForEmployee(employee: Employee, attendance: AttendanceRecord[], policy: PayrollPolicy): PayrollRecord {
  const validation = validatePayrollPolicy(policy);
  if (!validation.ok) throw new Error(validation.error);
  const employeeAttendance = attendance.filter((row) => row.employeeId === employee.id && row.date.startsWith(policy.payrollMonth));
  const overtimeHours = employeeAttendance.reduce((sum, row) => sum + Number(row.overtimeHours || 0), 0);
  const hourlyRate = Number(employee.baseSalary) / policy.standardMonthlyHours;
  const overtimePay = roundMoney(overtimeHours * hourlyRate * policy.overtimeMultiplier);
  const shiftBonus = roundMoney(policy.shiftBonusFlat);
  const hardshipAllowance = roundMoney(policy.hardshipAllowanceFlat);
  const grossSalary = roundMoney(Number(employee.baseSalary) + overtimePay + shiftBonus + hardshipAllowance);
  const socialSecurityInsurance = roundMoney(grossSalary * (policy.socialSecurityRatePercent / 100));
  const incomeTax = roundMoney(grossSalary * (policy.incomeTaxRatePercent / 100));
  const loanDeduction = roundMoney(policy.loanDeductionFlat);
  const deductions = socialSecurityInsurance + incomeTax + loanDeduction;
  return {
    id: nextId('pay'),
    payrollMonth: policy.payrollMonth,
    employeeId: employee.id,
    employeeName: employee.fullName,
    department: employee.department,
    baseSalary: employee.baseSalary,
    overtimePay,
    shiftBonus,
    hardshipAllowance,
    grossSalary,
    socialSecurityInsurance,
    incomeTax,
    loanDeduction,
    netPay: roundMoney(grossSalary - deductions),
    currency: employee.currency,
    paymentStatus: 'Calculated',
  };
}

export function generatePayrollDrafts(employees: Employee[], attendance: AttendanceRecord[], policy: PayrollPolicy): PayrollRecord[] {
  const validation = validatePayrollPolicy(policy);
  if (!validation.ok) throw new Error(validation.error);
  return employees.filter((employee) => employee.status === 'Active').map((employee) => calculatePayrollForEmployee(employee, attendance, policy));
}
