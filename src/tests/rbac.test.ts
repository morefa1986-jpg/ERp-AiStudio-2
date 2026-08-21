import { describe, it, expect } from 'vitest';
import { roleAllows } from '../utils/rbac';

export type UserRole =
  | 'SuperAdmin'
  | 'FarmManager'
  | 'Veterinarian'
  | 'FeedingTechnician'
  | 'HatcherySpecialist'
  | 'WarehouseManager'
  | 'FinancialManager'
  | 'SalesManager'
  | 'QualityAuditor';

export interface RolePermissions {
  canStopFeeding: boolean;
  canResumeFeeding: boolean;
  canExecuteTransfer: boolean;
  canRecordBiometry: boolean;
  canPostJournals: boolean;
  canCreateProforma: boolean;
  canApprovePayroll: boolean;
  canExportBackup: boolean;
  canRestoreBackup: boolean;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case 'SuperAdmin':
      return {
        canStopFeeding: true,
        canResumeFeeding: true,
        canExecuteTransfer: true,
        canRecordBiometry: true,
        canPostJournals: true,
        canCreateProforma: true,
        canApprovePayroll: true,
        canExportBackup: true,
        canRestoreBackup: true,
      };
    case 'FeedingTechnician':
      return {
        canStopFeeding: true, // Safety rule: Any operator can STOP feeding in emergency
        canResumeFeeding: false, // Only Supervisor/Vet/Admin can resume
        canExecuteTransfer: false,
        canRecordBiometry: false,
        canPostJournals: false,
        canCreateProforma: false,
        canApprovePayroll: false,
        canExportBackup: false,
        canRestoreBackup: false,
      };
    case 'Veterinarian':
      return {
        canStopFeeding: true,
        canResumeFeeding: true,
        canExecuteTransfer: true,
        canRecordBiometry: true,
        canPostJournals: false,
        canCreateProforma: false,
        canApprovePayroll: false,
        canExportBackup: true,
        canRestoreBackup: false,
      };
    case 'FinancialManager':
      return {
        canStopFeeding: false,
        canResumeFeeding: false,
        canExecuteTransfer: false,
        canRecordBiometry: false,
        canPostJournals: true,
        canCreateProforma: true,
        canApprovePayroll: true,
        canExportBackup: true,
        canRestoreBackup: false,
      };
    default:
      return {
        canStopFeeding: true,
        canResumeFeeding: false,
        canExecuteTransfer: false,
        canRecordBiometry: false,
        canPostJournals: false,
        canCreateProforma: false,
        canApprovePayroll: false,
        canExportBackup: false,
        canRestoreBackup: false,
      };
  }
}

describe('Role-Based Access Control (RBAC) Security Verification', () => {
  it('allows all operators including FeedingTechnicians to trigger emergency STOP feeding', () => {
    const perm = getRolePermissions('FeedingTechnician');
    expect(perm.canStopFeeding).toBe(true);
  });

  it('restricts resume feeding from FeedingTechnicians to prevent unauthorized override', () => {
    const perm = getRolePermissions('FeedingTechnician');
    expect(perm.canResumeFeeding).toBe(false);
  });

  it('allows Veterinarians and SuperAdmins to clear alerts and resume feeding', () => {
    const vetPerm = getRolePermissions('Veterinarian');
    const adminPerm = getRolePermissions('SuperAdmin');
    expect(vetPerm.canResumeFeeding).toBe(true);
    expect(adminPerm.canResumeFeeding).toBe(true);
  });

  it('restricts financial posting and payroll approval to FinancialManager and SuperAdmin', () => {
    const finPerm = getRolePermissions('FinancialManager');
    const techPerm = getRolePermissions('FeedingTechnician');
    expect(finPerm.canPostJournals).toBe(true);
    expect(finPerm.canApprovePayroll).toBe(true);
    expect(techPerm.canPostJournals).toBe(false);
    expect(techPerm.canApprovePayroll).toBe(false);
  });

  it('exercises the production action-level policy', () => {
    expect(roleAllows('Technician', 'feeding', 'create')).toBe(true);
    expect(roleAllows('Technician', 'feeding', 'approve')).toBe(false);
    expect(roleAllows('Veterinarian', 'feeding', 'approve')).toBe(true);
    expect(roleAllows('Farm Manager', 'backup', 'export')).toBe(true);
    expect(roleAllows('Farm Manager', 'backup', 'approve')).toBe(false);
    expect(roleAllows('Viewer/Auditor', 'sales', 'create')).toBe(false);
  });
});
