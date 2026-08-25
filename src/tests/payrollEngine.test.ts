import { describe, expect, it } from 'vitest';
import { AttendanceRecord, Employee } from '../types';
import { generatePayrollDrafts, validatePayrollPolicy } from '../utils/payrollEngine';

const employee: Employee = {
  id: 'emp-1', employeeCode: 'E-1', fullName: 'Operator One', role: 'Technician', department: 'Production & Halls',
  phone: '', nationalId: '', contractType: 'Full-time', hireDate: '2026-01-01', baseSalary: 240_000_000,
  currency: 'IRR', bankAccount: '', emergencyContact: '', status: 'Active',
};

const attendance: AttendanceRecord[] = [{
  id: 'att-1', employeeId: 'emp-1', employeeName: 'Operator One', date: '2026-08-10',
  clockInTime: '2026-08-10T03:30:00.000Z', clockOutTime: '2026-08-10T15:30:00.000Z',
  shift: 'Morning (07:00 - 15:00)', regularHours: 8, overtimeHours: 4, status: 'Present',
}];

describe('configurable payroll engine', () => {
  it('uses policy values instead of hard-coded legal/tax assumptions', () => {
    const [row] = generatePayrollDrafts([employee], attendance, {
      payrollMonth: '2026-08',
      standardMonthlyHours: 200,
      overtimeMultiplier: 2,
      socialSecurityRatePercent: 7,
      incomeTaxRatePercent: 10,
      shiftBonusFlat: 5_000_000,
      hardshipAllowanceFlat: 3_000_000,
      loanDeductionFlat: 1_000_000,
    });
    expect(row.overtimePay).toBe(9_600_000);
    expect(row.grossSalary).toBe(257_600_000);
    expect(row.socialSecurityInsurance).toBe(18_032_000);
    expect(row.incomeTax).toBe(25_760_000);
    expect(row.loanDeduction).toBe(1_000_000);
    expect(row.netPay).toBe(212_808_000);
  });

  it('rejects unsafe or nonsensical policy values', () => {
    expect(validatePayrollPolicy({ payrollMonth: '2026-08', standardMonthlyHours: 0, overtimeMultiplier: 1.4, socialSecurityRatePercent: 0, incomeTaxRatePercent: 0, shiftBonusFlat: 0, hardshipAllowanceFlat: 0, loanDeductionFlat: 0 }).ok).toBe(false);
    expect(validatePayrollPolicy({ payrollMonth: '2026-8', standardMonthlyHours: 240, overtimeMultiplier: 1.4, socialSecurityRatePercent: 0, incomeTaxRatePercent: 0, shiftBonusFlat: 0, hardshipAllowanceFlat: 0, loanDeductionFlat: 0 }).ok).toBe(false);
    expect(validatePayrollPolicy({ payrollMonth: '2026-08', standardMonthlyHours: 240, overtimeMultiplier: 1.4, socialSecurityRatePercent: 120, incomeTaxRatePercent: 0, shiftBonusFlat: 0, hardshipAllowanceFlat: 0, loanDeductionFlat: 0 }).ok).toBe(false);
  });
});
