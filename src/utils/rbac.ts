import { PermissionAction, PermissionModule } from '../types';

export function roleAllows(role: string, module: PermissionModule, action: PermissionAction): boolean {
  if (role === 'Super Admin' || role === 'Farm Owner') return true;

  const viewLike = action === 'view' || action === 'export' || action === 'print';
  const operationalActions: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'export', 'print'];
  const canOperate = operationalActions.includes(action);

  switch (role) {
    case 'Farm Manager':
      return module !== 'users' && module !== 'settings' && !(module === 'backup' && action === 'approve') && action !== 'delete';
    case 'Hall Manager':
      return ['dashboard', 'halls', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers', 'reports'].includes(module) && canOperate;
    case 'Technician':
      return ['dashboard', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers'].includes(module) && ['view', 'create', 'edit'].includes(action);
    case 'Veterinarian':
      return (['dashboard', 'treatments', 'mortality', 'laboratory', 'biometrics', 'water_quality', 'reports'].includes(module) && canOperate)
        || (module === 'feeding' && ['view', 'create', 'approve', 'export', 'print'].includes(action));
    case 'Hatchery Manager':
      return ['dashboard', 'hatchery', 'nursery', 'biometrics', 'water_quality', 'laboratory', 'reports'].includes(module) && canOperate;
    case 'Laboratory':
      return ['dashboard', 'laboratory', 'water_quality', 'treatments', 'reports'].includes(module) && canOperate;
    case 'Feed Manager':
      return ['dashboard', 'feeding', 'feed_factory', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Warehouse Manager':
      return ['dashboard', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Processing Manager':
      return ['dashboard', 'processing', 'cold_storage', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Cold Storage Manager':
      return ['dashboard', 'cold_storage', 'warehouse', 'sales', 'reports'].includes(module) && canOperate;
    case 'Accountant':
      return ['dashboard', 'accounting', 'sales', 'hr', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Sales Manager':
    case 'CRM Operator':
      return ['dashboard', 'crm', 'sales', 'processing', 'cold_storage', 'media', 'reports'].includes(module) && canOperate;
    case 'HR Manager':
      return ['dashboard', 'hr', 'reports'].includes(module) && canOperate;
    case 'Media Manager':
      return ['dashboard', 'media', 'reports'].includes(module) && canOperate;
    case 'Viewer/Auditor':
      return viewLike;
    default:
      return false;
  }
}
