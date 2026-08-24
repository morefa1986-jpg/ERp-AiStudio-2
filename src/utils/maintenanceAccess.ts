export type MaintenanceAction = 'view' | 'create' | 'edit' | 'approve';

export function maintenanceRoleAllows(role: string, action: MaintenanceAction): boolean {
  if (role === 'Super Admin' || role === 'Farm Owner' || role === 'Farm Manager') return true;
  if (role === 'Technician') return action !== 'approve';
  if (role === 'Viewer/Auditor') return action === 'view';
  return false;
}
