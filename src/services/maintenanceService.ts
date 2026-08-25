import { getStoredSessionToken } from '../context/AuthContext';

export interface MaintenancePartUsage { name: string; quantity: number; unit: string; unitCost: number; }
export interface MaintenanceWorkOrder {
  id: string; code: string; equipmentId: string; equipmentCode: string; equipmentName: string;
  type: 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency'; priority: 'Low' | 'Normal' | 'High' | 'Critical';
  description: string; assignedTechnician: string; plannedDate: string; status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string; createdBy: string; startedAt?: string; completedAt?: string; completedBy?: string; cancellationReason?: string;
  failureReason?: string; resolution?: string; downtimeHours: number; laborCost: number; partsCost: number; totalCost: number; parts: MaintenancePartUsage[]; nextServiceDate?: string;
}
export interface MaintenanceEvent { id: string; workOrderId: string; eventType: 'CREATED' | 'STARTED' | 'COMPLETED' | 'CANCELLED'; timestamp: string; actor: string; notes: string; }

function headers(): HeadersInit { return { Authorization: `Bearer ${getStoredSessionToken() || ''}`, 'Content-Type': 'application/json' }; }
async function call(path: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>): Promise<any> {
  const response = await fetch(path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'MAINTENANCE_REQUEST_FAILED');
  return payload;
}
export async function listMaintenanceWorkOrders(): Promise<MaintenanceWorkOrder[]> { const payload = await call('/api/maintenance/work-orders'); return Array.isArray(payload.workOrders) ? payload.workOrders : []; }
export async function listMaintenanceEvents(id: string): Promise<MaintenanceEvent[]> { const payload = await call(`/api/maintenance/work-orders/${encodeURIComponent(id)}/events`); return Array.isArray(payload.events) ? payload.events : []; }
export const createMaintenanceWorkOrder = (input: Record<string, unknown>) => call('/api/maintenance/work-orders', 'POST', input);
export const startMaintenanceWorkOrder = (id: string) => call(`/api/maintenance/work-orders/${encodeURIComponent(id)}/start`, 'POST', {});
export const completeMaintenanceWorkOrder = (id: string, input: Record<string, unknown>) => call(`/api/maintenance/work-orders/${encodeURIComponent(id)}/complete`, 'POST', input);
export const cancelMaintenanceWorkOrder = (id: string, reason: string) => call(`/api/maintenance/work-orders/${encodeURIComponent(id)}/cancel`, 'POST', { reason });
