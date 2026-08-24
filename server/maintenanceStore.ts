import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';

export type MaintenanceWorkOrderType = 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency';
export type MaintenancePriority = 'Low' | 'Normal' | 'High' | 'Critical';
export type MaintenanceWorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface MaintenancePartUsage {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface MaintenanceWorkOrder {
  id: string;
  code: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  type: MaintenanceWorkOrderType;
  priority: MaintenancePriority;
  description: string;
  assignedTechnician: string;
  plannedDate: string;
  status: MaintenanceWorkOrderStatus;
  createdAt: string;
  createdBy: string;
  startedAt?: string;
  startedBy?: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  failureReason?: string;
  resolution?: string;
  downtimeHours: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  parts: MaintenancePartUsage[];
  nextServiceDate?: string;
}

export interface MaintenanceEvent {
  id: string;
  workOrderId: string;
  eventType: 'CREATED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
  timestamp: string;
  actor: string;
  notes: string;
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): any[]; get(...params: unknown[]): any; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'maintenanceStore.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function parseJson<T>(value: unknown, fallback: T): T { try { return JSON.parse(String(value)) as T; } catch { return fallback; } }

export class MaintenanceStore {
  private readonly db: SqliteDatabase;
  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS maintenance_work_orders (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        equipment_id TEXT NOT NULL,
        equipment_code TEXT NOT NULL,
        equipment_name TEXT NOT NULL,
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        planned_date TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_work_orders(equipment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_work_orders(status, planned_date ASC);
      CREATE TABLE IF NOT EXISTS maintenance_events (
        id TEXT PRIMARY KEY,
        work_order_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        notes TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_maintenance_events_order ON maintenance_events(work_order_id, timestamp DESC);
    `);
  }

  create(input: Omit<MaintenanceWorkOrder, 'id' | 'status' | 'createdAt' | 'downtimeHours' | 'laborCost' | 'partsCost' | 'totalCost' | 'parts'>): MaintenanceWorkOrder {
    const row: MaintenanceWorkOrder = {
      ...input,
      id: `mwo_${crypto.randomUUID()}`,
      code: clean(input.code, 100), equipmentId: clean(input.equipmentId, 160), equipmentCode: clean(input.equipmentCode, 100), equipmentName: clean(input.equipmentName, 200),
      description: clean(input.description, 2000), assignedTechnician: clean(input.assignedTechnician, 200), createdBy: clean(input.createdBy, 200),
      plannedDate: clean(input.plannedDate, 10), failureReason: clean(input.failureReason, 1000) || undefined,
      status: 'OPEN', createdAt: new Date().toISOString(), downtimeHours: 0, laborCost: 0, partsCost: 0, totalCost: 0, parts: [],
    };
    if (!row.code || !row.equipmentId || !row.equipmentCode || !row.equipmentName || !row.description || !row.createdBy || !/^\d{4}-\d{2}-\d{2}$/.test(row.plannedDate)) throw new Error('MAINTENANCE_FIELDS_INVALID');
    this.db.prepare('INSERT INTO maintenance_work_orders (id, code, equipment_id, equipment_code, equipment_name, type, priority, status, created_at, planned_date, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(row.id, row.code, row.equipmentId, row.equipmentCode, row.equipmentName, row.type, row.priority, row.status, row.createdAt, row.plannedDate, JSON.stringify(row));
    this.appendEvent(row.id, 'CREATED', row.createdBy, row.description);
    return row;
  }

  get(id: string): MaintenanceWorkOrder | null {
    const row = this.db.prepare('SELECT payload_json FROM maintenance_work_orders WHERE id = ?').get(clean(id, 160));
    return row ? parseJson<MaintenanceWorkOrder>(row.payload_json, null as any) : null;
  }

  list(limit = 500): MaintenanceWorkOrder[] {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    return this.db.prepare('SELECT payload_json FROM maintenance_work_orders ORDER BY created_at DESC, rowid DESC LIMIT ?').all(safeLimit)
      .flatMap((row) => { const parsed = parseJson<MaintenanceWorkOrder | null>(row.payload_json, null); return parsed ? [parsed] : []; });
  }

  start(id: string, actor: string): MaintenanceWorkOrder {
    const row = this.requireOpen(id);
    const next: MaintenanceWorkOrder = { ...row, status: 'IN_PROGRESS', startedAt: new Date().toISOString(), startedBy: clean(actor, 200) };
    this.save(next);
    this.appendEvent(next.id, 'STARTED', next.startedBy || actor, 'Work started');
    return next;
  }

  complete(id: string, input: { actor: string; resolution: string; downtimeHours: number; laborCost: number; parts: MaintenancePartUsage[]; nextServiceDate?: string }): MaintenanceWorkOrder {
    const row = this.get(id);
    if (!row) throw new Error('MAINTENANCE_WORK_ORDER_NOT_FOUND');
    if (row.status !== 'IN_PROGRESS') throw new Error('MAINTENANCE_NOT_IN_PROGRESS');
    const actor = clean(input.actor, 200); const resolution = clean(input.resolution, 2000);
    const downtimeHours = Number(input.downtimeHours); const laborCost = Number(input.laborCost);
    const parts = Array.isArray(input.parts) ? input.parts.map((part) => ({ name: clean(part.name, 200), quantity: Number(part.quantity), unit: clean(part.unit, 50), unitCost: Number(part.unitCost) })) : [];
    if (!actor || !resolution || !Number.isFinite(downtimeHours) || downtimeHours < 0 || !Number.isFinite(laborCost) || laborCost < 0 || parts.some((part) => !part.name || !part.unit || !Number.isFinite(part.quantity) || part.quantity <= 0 || !Number.isFinite(part.unitCost) || part.unitCost < 0)) throw new Error('MAINTENANCE_COMPLETION_INVALID');
    const partsCost = Number(parts.reduce((sum, part) => sum + part.quantity * part.unitCost, 0).toFixed(2));
    const nextServiceDate = clean(input.nextServiceDate, 10) || undefined;
    if (nextServiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextServiceDate)) throw new Error('MAINTENANCE_NEXT_SERVICE_DATE_INVALID');
    const next: MaintenanceWorkOrder = {
      ...row, status: 'COMPLETED', completedAt: new Date().toISOString(), completedBy: actor, resolution,
      downtimeHours: Number(downtimeHours.toFixed(2)), laborCost: Number(laborCost.toFixed(2)), partsCost,
      totalCost: Number((laborCost + partsCost).toFixed(2)), parts, nextServiceDate,
    };
    this.save(next);
    this.appendEvent(next.id, 'COMPLETED', actor, resolution);
    return next;
  }

  cancel(id: string, actorValue: string, reasonValue: string): MaintenanceWorkOrder {
    const row = this.get(id);
    if (!row) throw new Error('MAINTENANCE_WORK_ORDER_NOT_FOUND');
    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') throw new Error('MAINTENANCE_FINALIZED');
    const actor = clean(actorValue, 200); const reason = clean(reasonValue, 1000);
    if (!actor || !reason) throw new Error('MAINTENANCE_CANCELLATION_REASON_REQUIRED');
    const next: MaintenanceWorkOrder = { ...row, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelledBy: actor, cancellationReason: reason };
    this.save(next);
    this.appendEvent(next.id, 'CANCELLED', actor, reason);
    return next;
  }

  events(workOrderId: string, limit = 200): MaintenanceEvent[] {
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
    return this.db.prepare('SELECT payload_json FROM maintenance_events WHERE work_order_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?').all(clean(workOrderId, 160), safeLimit)
      .flatMap((row) => { const parsed = parseJson<MaintenanceEvent | null>(row.payload_json, null); return parsed ? [parsed] : []; });
  }

  private requireOpen(id: string): MaintenanceWorkOrder {
    const row = this.get(id);
    if (!row) throw new Error('MAINTENANCE_WORK_ORDER_NOT_FOUND');
    if (row.status !== 'OPEN') throw new Error('MAINTENANCE_NOT_OPEN');
    return row;
  }
  private save(row: MaintenanceWorkOrder): void {
    this.db.prepare('UPDATE maintenance_work_orders SET status = ?, planned_date = ?, payload_json = ? WHERE id = ?').run(row.status, row.plannedDate, JSON.stringify(row), row.id);
  }
  private appendEvent(workOrderId: string, eventType: MaintenanceEvent['eventType'], actor: string, notes: string): void {
    const event: MaintenanceEvent = { id: `mevt_${crypto.randomUUID()}`, workOrderId, eventType, timestamp: new Date().toISOString(), actor: clean(actor, 200), notes: clean(notes, 1500) };
    this.db.prepare('INSERT INTO maintenance_events (id, work_order_id, event_type, timestamp, actor, notes, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(event.id, event.workOrderId, event.eventType, event.timestamp, event.actor, event.notes, JSON.stringify(event));
  }
  close(): void { this.db.close(); }
}
