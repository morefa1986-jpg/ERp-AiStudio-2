import { getStoredSessionToken } from '../context/AuthContext';

export interface MedicineLotRecord {
  id: string; medicineName: string; lotNumber: string; expiryDate: string; supplier: string;
  receivedQuantity: number; unit: string; isActive: boolean; administeredQuantity: number; remainingQuantity: number;
}

export interface MedicineAdministrationRecord {
  id: string; treatmentId: string; pondId: string; lotId: string; medicineName: string; lotNumber: string;
  quantityRecorded: number; unit: string; timestamp: string; recordedBy: string; notes: string; withdrawalEndDate?: string;
}

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'MEDICINE_LEDGER_REQUEST_FAILED');
  return payload as T;
}

export async function listMedicineLots(): Promise<MedicineLotRecord[]> {
  const payload = await request<{ success: true; lots: MedicineLotRecord[] }>('/api/medicine/lots');
  return payload.lots || [];
}

export async function createMedicineLot(input: { medicineName: string; lotNumber: string; expiryDate: string; supplier: string; receivedQuantity: number; unit: string }): Promise<MedicineLotRecord> {
  const payload = await request<{ success: true; lot: MedicineLotRecord }>('/api/medicine/lots', { method: 'POST', body: JSON.stringify(input) });
  return payload.lot;
}

export async function setMedicineLotActive(id: string, isActive: boolean): Promise<MedicineLotRecord> {
  const payload = await request<{ success: true; lot: MedicineLotRecord }>(`/api/medicine/lots/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
  return payload.lot;
}

export async function listMedicineAdministrations(): Promise<MedicineAdministrationRecord[]> {
  const payload = await request<{ success: true; administrations: MedicineAdministrationRecord[] }>('/api/medicine/administrations');
  return payload.administrations || [];
}

export async function recordMedicineAdministration(input: { treatmentId: string; lotId: string; quantityRecorded: number; unit: string; notes?: string }): Promise<MedicineAdministrationRecord> {
  const payload = await request<{ success: true; administration: MedicineAdministrationRecord }>('/api/medicine/administrations', { method: 'POST', body: JSON.stringify({ ...input, timestamp: new Date().toISOString() }) });
  return payload.administration;
}
