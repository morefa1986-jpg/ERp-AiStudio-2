import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredSessionToken, useAuth } from './AuthContext';
import {
  Account, AttendanceRecord, BackupSnapshot, BiometricSession, BroodstockFish, ColdStoragePallet, Customer,
  Employee, Equipment, FeedingRecord, FertilizationBatch, FishTransfer, FarmAuditLog, Hall, IncubatorUnit,
  InventoryItem, InventoryTransaction, JournalEntry, LabSample, LarvalBatch, MortalityRecord, NurseryTank,
  PayrollRecord, PermissionAction, PermissionModule, Pond, ProcessingBatch, ProformaInvoice, SocialMediaPost,
  SturgeonSpecies, TreatmentRecord, WaterQualityLog,
} from '../types';
import { manualSnapshotCapacityCubicMeters, PondManualSnapshotInput, PondSpeciesManualGroup } from '../types/pondSnapshot';
import { FarmSpeciesWithStatus, HallAdminInput, HallAdminPatch, PondAdminPatch, PondStructureAdminInput, SpeciesAdminInput } from '../types/farmStructure';
import {
  INITIAL_ACCOUNTS, INITIAL_BROODSTOCK, INITIAL_COLD_STORAGE, INITIAL_CUSTOMERS, INITIAL_EQUIPMENT,
  INITIAL_FERTILIZATIONS, INITIAL_HALLS, INITIAL_INCUBATORS, INITIAL_INVENTORY, INITIAL_INVENTORY_TXS,
  INITIAL_JOURNALS, INITIAL_LARVAE, INITIAL_PONDS, INITIAL_PROCESSING_BATCHES, INITIAL_PROFORMAS,
  INITIAL_SPECIES, INITIAL_EMPLOYEES,
} from '../data/initialData';
import { BACKUP_SCHEMA_VERSION, checksumBackupData, decryptBackupDocument, encryptBackupDocument, EncryptedBackupEnvelope, validateBackupDocument } from '../utils/backupEngine';
import { FxConversionInput, validateAndExecuteFxConversion, validateAndExecuteJournalEntry } from '../utils/accountingEngine';
import { calculateFeedingRecommendation, inventoryQuantityForFeedKg, validateFeedingSubmission } from '../utils/feedingEngine';
import { assessWaterSafetyForFeeding } from '../utils/sensorValidation';
import { executeAtomicFishTransfer } from '../utils/transferEngine';
import { executeAtomicProcessing } from '../utils/processingEngine';
import { fulfillProforma } from '../utils/salesEngine';
import { applyBiometryToPondStock, applyMortalityToPondStock } from '../utils/pondStockOperations';
import { nextId } from '../utils/id';

export interface FeedingRecommendationResult {
  recommendedKg: number;
  isLocked: boolean;
  lockReason?: string;
  waterSafety?: { isSafe: boolean; doStatus: string; tempStatus: string };
}

export interface OfflineSyncStatus {
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'PENDING_CHANGES' | 'ERROR';
  pendingChangesCount: number;
  lastSyncTimestamp: string;
}

interface FarmContextType {
  halls: Hall[]; ponds: Pond[]; species: SturgeonSpecies[]; feedingRecords: FeedingRecord[];
  biometricSessions: BiometricSession[]; waterLogs: WaterQualityLog[]; mortalityRecords: MortalityRecord[];
  treatments: TreatmentRecord[]; transfers: FishTransfer[]; broodstock: BroodstockFish[];
  fertilizations: FertilizationBatch[]; incubators: IncubatorUnit[]; larvae: LarvalBatch[]; nurseryTanks: NurseryTank[];
  inventory: InventoryItem[]; inventoryTxs: InventoryTransaction[]; labSamples: LabSample[];
  processingBatches: ProcessingBatch[]; coldStorage: ColdStoragePallet[]; customers: Customer[];
  proformas: ProformaInvoice[]; accounts: Account[]; journals: JournalEntry[]; employees: Employee[];
  attendance: AttendanceRecord[]; payrolls: PayrollRecord[]; equipment: Equipment[]; socialPosts: SocialMediaPost[];
  auditLogs: FarmAuditLog[]; backups: BackupSnapshot[]; syncStatus: OfflineSyncStatus;
  createHallStructure: (input: HallAdminInput) => { success: boolean; error?: string; id?: string };
  updateHallStructure: (hallId: string, patch: HallAdminPatch) => { success: boolean; error?: string };
  createPondStructure: (input: PondStructureAdminInput) => { success: boolean; error?: string; id?: string };
  updatePondStructure: (pondId: string, patch: PondAdminPatch) => { success: boolean; error?: string };
  createSpeciesDefinition: (input: SpeciesAdminInput) => { success: boolean; error?: string; id?: string };
  setSpeciesActive: (speciesId: string, isActive: boolean) => { success: boolean; error?: string };
  calculateRecommendedFeed: (pondId: string) => FeedingRecommendationResult;
  recordFeeding: (record: Omit<FeedingRecord, 'id' | 'timestamp'>) => { success: boolean; error?: string };
  stopPondFeeding: (pondId: string, reason: Pond['stopFeedingReason'], details: string, operator: string) => void;
  resumePondFeeding: (pondId: string, operator: string) => { success: boolean; error?: string };
  updatePondManualSnapshot: (pondId: string, input: PondManualSnapshotInput) => { success: boolean; error?: string };
  recordMortality: (record: Omit<MortalityRecord, 'id' | 'timestamp'>) => void;
  recordBiometry: (session: Omit<BiometricSession, 'id' | 'averageWeightKg' | 'minWeightKg' | 'maxWeightKg' | 'estimatedBiomassKg' | 'estimatedCount' | 'growthRateKgPerDay' | 'sgr'>) => void;
  recordWaterTest: (test: Omit<WaterQualityLog, 'id' | 'timestamp'>) => void;
  recordTreatment: (treatment: Omit<TreatmentRecord, 'id'>) => void;
  completeTreatment: (treatmentId: string) => { success: boolean; error?: string };
  executeAtomicTransfer: (transferData: Omit<FishTransfer, 'id' | 'status'>) => { success: boolean; error?: string };
  addInventoryTransaction: (tx: Omit<InventoryTransaction, 'id' | 'timestamp' | 'resultingQuantity'>) => void;
  createProcessingBatch: (batch: Omit<ProcessingBatch, 'id' | 'caviarYieldPercent' | 'filletYieldPercent'>) => { success: boolean; error?: string };
  createProformaInvoice: (proforma: Omit<ProformaInvoice, 'id' | 'subtotal' | 'grandTotal'>) => void;
  updateProformaStage: (id: string, newStage: ProformaInvoice['stage']) => void;
  createJournalEntry: (entry: Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'>) => { success: boolean; error?: string };
  createFxConversionJournalEntry: (entry: FxConversionInput) => { success: boolean; error?: string };
  clockAttendance: (employeeId: string, type: 'in' | 'out', shift: AttendanceRecord['shift']) => void;
  generateMonthlyPayroll: (monthString: string) => void;
  createAuditLog: (action: string, entity: string, entityId: string, details: string, beforeState?: string, afterState?: string, transactionId?: string) => void;
  createBackupSnapshot: (type?: BackupSnapshot['type']) => BackupSnapshot;
  createEncryptedBackup: (passphrase: string) => Promise<EncryptedBackupEnvelope>;
  restoreFromSnapshotJson: (jsonString: string, passphrase?: string) => Promise<{ success: boolean; message: string }>;
  addBroodstock: (fish: Omit<BroodstockFish, 'id'>) => void;
  recordFertilization: (fert: Omit<FertilizationBatch, 'id' | 'fertilizationTimestamp' | 'status'>) => void;
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt' | 'totalOrdersCount' | 'totalSpent' | 'outstandingBalance'>) => void;
  addSocialPost: (post: Omit<SocialMediaPost, 'id' | 'status'>) => void;
}

const FarmContext = createContext<FarmContextType | null>(null);
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const EMPTY_ARRAY = <T,>(): T[] => [];

function demoPonds(): Pond[] {
  return INITIAL_PONDS.map((pond) => pond.feedingStatus === 'ACTIVE'
    ? { ...pond, feedingStatus: 'STOPPED', stopFeedingReason: 'Manual Decision', stopFeedingDetails: 'داده نمایشی؛ تا ثبت تله‌متری معتبر تغذیه متوقف است.' }
    : { ...pond });
}

function inventoryStatus(item: InventoryItem, quantity: number): InventoryItem['status'] {
  if (item.expiryDate && new Date(item.expiryDate).getTime() < Date.now()) return 'Expired';
  if (quantity <= item.minimumStockThreshold) return 'Critical Low';
  if (quantity <= item.reorderLevel) return 'Low Stock';
  return 'Adequate';
}

function stripBackupData(snapshot: BackupSnapshot): BackupSnapshot {
  const { data: _data, ...metadata } = snapshot;
  return metadata;
}

function withHallTotals(currentHalls: Hall[], currentPonds: Pond[]): Hall[] {
  return currentHalls.map((hall) => {
    const hallPonds = currentPonds.filter((pond) => pond.hallId === hall.id);
    return {
      ...hall,
      pondCount: hallPonds.length,
      totalBiomassKg: Number(hallPonds.reduce((sum, pond) => sum + pond.biomassKg, 0).toFixed(2)),
      totalFishCount: hallPonds.reduce((sum, pond) => sum + pond.fishCount, 0),
    };
  });
}

function structureCapacity(input: PondStructureAdminInput | PondAdminPatch, fallback = 0): number {
  if (input.pondShape === 'Circular') {
    const diameter = Number(input.diameterMeters);
    const depth = Number(input.depthMeters);
    if (Number.isFinite(diameter) && diameter > 0 && Number.isFinite(depth) && depth > 0) return Number((Math.PI * Math.pow(diameter / 2, 2) * depth).toFixed(2));
  }
  if (input.pondShape === 'Rectangular' || input.pondShape === 'Raceway') {
    const length = Number(input.lengthMeters);
    const width = Number(input.widthMeters);
    const depth = Number(input.depthMeters);
    if (Number.isFinite(length) && length > 0 && Number.isFinite(width) && width > 0 && Number.isFinite(depth) && depth > 0) return Number((length * width * depth).toFixed(2));
  }
  const explicit = Number(input.capacityCubicMeters);
  return Number.isFinite(explicit) && explicit > 0 ? Number(explicit.toFixed(2)) : fallback;
}

type StateOperation = { module: PermissionModule; action: PermissionAction; entity?: string; entityId?: string; referenceId?: string; transactionId?: string };

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, hasPermission } = useAuth();
  const [halls, setHalls] = useState<Hall[]>(() => DEMO_MODE ? INITIAL_HALLS : EMPTY_ARRAY<Hall>());
  const [ponds, setPonds] = useState<Pond[]>(() => DEMO_MODE ? demoPonds() : EMPTY_ARRAY<Pond>());
  const [species, setSpecies] = useState<SturgeonSpecies[]>(() => DEMO_MODE ? INITIAL_SPECIES : EMPTY_ARRAY<SturgeonSpecies>());
  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>(EMPTY_ARRAY);
  const [biometricSessions, setBiometricSessions] = useState<BiometricSession[]>(EMPTY_ARRAY);
  const [waterLogs, setWaterLogs] = useState<WaterQualityLog[]>(EMPTY_ARRAY);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>(EMPTY_ARRAY);
  const [treatments, setTreatments] = useState<TreatmentRecord[]>(EMPTY_ARRAY);
  const [transfers, setTransfers] = useState<FishTransfer[]>(EMPTY_ARRAY);
  const [broodstock, setBroodstock] = useState<BroodstockFish[]>(() => DEMO_MODE ? INITIAL_BROODSTOCK : EMPTY_ARRAY<BroodstockFish>());
  const [fertilizations, setFertilizations] = useState<FertilizationBatch[]>(() => DEMO_MODE ? INITIAL_FERTILIZATIONS : EMPTY_ARRAY<FertilizationBatch>());
  const [incubators, setIncubators] = useState<IncubatorUnit[]>(() => DEMO_MODE ? INITIAL_INCUBATORS : EMPTY_ARRAY<IncubatorUnit>());
  const [larvae, setLarvae] = useState<LarvalBatch[]>(() => DEMO_MODE ? INITIAL_LARVAE : EMPTY_ARRAY<LarvalBatch>());
  const [nurseryTanks, setNurseryTanks] = useState<NurseryTank[]>(EMPTY_ARRAY);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => DEMO_MODE ? INITIAL_INVENTORY : EMPTY_ARRAY<InventoryItem>());
  const [inventoryTxs, setInventoryTxs] = useState<InventoryTransaction[]>(() => DEMO_MODE ? INITIAL_INVENTORY_TXS : EMPTY_ARRAY<InventoryTransaction>());
  const [labSamples, setLabSamples] = useState<LabSample[]>(EMPTY_ARRAY);
  const [processingBatches, setProcessingBatches] = useState<ProcessingBatch[]>(() => DEMO_MODE ? INITIAL_PROCESSING_BATCHES : EMPTY_ARRAY<ProcessingBatch>());
  const [coldStorage, setColdStorage] = useState<ColdStoragePallet[]>(() => DEMO_MODE ? INITIAL_COLD_STORAGE : EMPTY_ARRAY<ColdStoragePallet>());
  const [customers, setCustomers] = useState<Customer[]>(() => DEMO_MODE ? INITIAL_CUSTOMERS : EMPTY_ARRAY<Customer>());
  const [proformas, setProformas] = useState<ProformaInvoice[]>(() => DEMO_MODE ? INITIAL_PROFORMAS : EMPTY_ARRAY<ProformaInvoice>());
  const [accounts, setAccounts] = useState<Account[]>(() => DEMO_MODE ? INITIAL_ACCOUNTS : EMPTY_ARRAY<Account>());
  const [journals, setJournals] = useState<JournalEntry[]>(() => DEMO_MODE ? INITIAL_JOURNALS : EMPTY_ARRAY<JournalEntry>());
  const [employees, setEmployees] = useState<Employee[]>(() => DEMO_MODE ? INITIAL_EMPLOYEES : EMPTY_ARRAY<Employee>());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(EMPTY_ARRAY);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(EMPTY_ARRAY);
  const [equipment, setEquipment] = useState<Equipment[]>(() => DEMO_MODE ? INITIAL_EQUIPMENT : EMPTY_ARRAY<Equipment>());
  const [socialPosts, setSocialPosts] = useState<SocialMediaPost[]>(EMPTY_ARRAY);
  const [auditLogs, setAuditLogs] = useState<FarmAuditLog[]>(EMPTY_ARRAY);
  const [backups, setBackups] = useState<BackupSnapshot[]>(EMPTY_ARRAY);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({ status: 'OFFLINE', pendingChangesCount: 0, lastSyncTimestamp: '' });
  const [stateReady, setStateReady] = useState(false);
  const [serverVersion, setServerVersion] = useState<number | null>(null);
  const pendingOperations = useRef<StateOperation[]>([]);
  const persistenceInFlight = useRef(false);
  const conflictRetryCount = useRef(0);
  const [retryNonce, setRetryNonce] = useState(0);

  const stateData = useMemo<Record<string, unknown>>(() => ({
    halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers,
    broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples,
    processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls,
    equipment, socialPosts, auditLogs, backups: backups.map(stripBackupData),
  }), [halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups]);

  const applyState = (data: Record<string, unknown>, serverAudit: FarmAuditLog[] = []) => {
    const rows = <T,>(key: string): T[] => Array.isArray(data[key]) ? data[key] as T[] : [];
    const loadedWaterLogs = rows<WaterQualityLog>('waterLogs');
    const loadedPonds = rows<Pond>('ponds').map((pond) => {
      const latest = loadedWaterLogs.filter((log) => log.pondId === pond.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      return latest ? { ...pond, dissolvedOxygen: latest.dissolvedOxygen, waterTemperature: latest.temperature, ph: latest.ph, ammonia: latest.ammonia, nitrite: latest.nitrite, lastTelemetryTimestamp: latest.timestamp, sensorQuality: latest.sensorStatus } : pond;
    });
    setHalls(rows<Hall>('halls')); setPonds(loadedPonds); setSpecies(rows<SturgeonSpecies>('species'));
    setFeedingRecords(rows<FeedingRecord>('feedingRecords')); setBiometricSessions(rows<BiometricSession>('biometricSessions'));
    setWaterLogs(loadedWaterLogs); setMortalityRecords(rows<MortalityRecord>('mortalityRecords'));
    setTreatments(rows<TreatmentRecord>('treatments')); setTransfers(rows<FishTransfer>('transfers'));
    setBroodstock(rows<BroodstockFish>('broodstock')); setFertilizations(rows<FertilizationBatch>('fertilizations'));
    setIncubators(rows<IncubatorUnit>('incubators')); setLarvae(rows<LarvalBatch>('larvae')); setNurseryTanks(rows<NurseryTank>('nurseryTanks'));
    setInventory(rows<InventoryItem>('inventory')); setInventoryTxs(rows<InventoryTransaction>('inventoryTxs')); setLabSamples(rows<LabSample>('labSamples'));
    setProcessingBatches(rows<ProcessingBatch>('processingBatches')); setColdStorage(rows<ColdStoragePallet>('coldStorage'));
    setCustomers(rows<Customer>('customers')); setProformas(rows<ProformaInvoice>('proformas')); setAccounts(rows<Account>('accounts'));
    setJournals(rows<JournalEntry>('journals')); setEmployees(rows<Employee>('employees')); setAttendance(rows<AttendanceRecord>('attendance'));
    setPayrolls(rows<PayrollRecord>('payrolls')); setEquipment(rows<Equipment>('equipment')); setSocialPosts(rows<SocialMediaPost>('socialPosts'));
    const mappedServerAudit = serverAudit.map((log: any): FarmAuditLog => ({
      id: String(log.id), timestamp: String(log.timestamp), userId: String(log.userId || ''), userName: String(log.userName || log.userId || '—'),
      userRole: String(log.userRole || '—'), action: String(log.action || '—'), entity: String(log.entity || '—'), entityId: String(log.entityId || '—'),
      details: `${String(log.action || '—')} ${String(log.entity || '—')}`, beforeState: log.beforeState, afterState: log.afterState,
      referenceId: log.referenceId, transactionId: log.transactionId, ipAddress: log.ipAddress, deviceId: log.deviceId,
    }));
    setAuditLogs(mappedServerAudit.length ? mappedServerAudit : rows<FarmAuditLog>('auditLogs')); setBackups(rows<BackupSnapshot>('backups'));
  };

  useEffect(() => {
    let cancelled = false;
    setStateReady(false);
    if (!currentUser) {
      setServerVersion(null);
      pendingOperations.current = [];
      conflictRetryCount.current = 0;
      setSyncStatus({ status: 'OFFLINE', pendingChangesCount: 0, lastSyncTimestamp: '' });
      return () => { cancelled = true; };
    }
    const token = getStoredSessionToken();
    if (!token) return () => { cancelled = true; };
    const load = async () => {
      setSyncStatus((previous) => ({ ...previous, status: 'SYNCING' }));
      try {
        const response = await fetch('/api/state', { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || 'STATE_LOAD_FAILED');
        if (cancelled) return;
        if (payload.state?.data) {
          applyState(payload.state.data, Array.isArray(payload.auditLogs) ? payload.auditLogs : []);
          setServerVersion(Number(payload.state.version));
          setSyncStatus({ status: 'ONLINE', pendingChangesCount: pendingOperations.current.length, lastSyncTimestamp: new Date().toISOString() });
        } else {
          setServerVersion(null);
          pendingOperations.current.push({ module: 'settings', action: 'manage', entity: 'StateInitialization', entityId: 'state' });
          setSyncStatus({ status: 'PENDING_CHANGES', pendingChangesCount: pendingOperations.current.length, lastSyncTimestamp: '' });
        }
        setStateReady(true);
      } catch {
        if (!cancelled) {
          setStateReady(true);
          setSyncStatus((previous) => ({ ...previous, status: 'ERROR' }));
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!stateReady || !currentUser || pendingOperations.current.length === 0 || persistenceInFlight.current) return;
    const operation = pendingOperations.current[0];
    const token = getStoredSessionToken();
    if (!token) {
      setSyncStatus((previous) => ({ ...previous, status: 'OFFLINE', pendingChangesCount: pendingOperations.current.length }));
      return;
    }
    persistenceInFlight.current = true;
    setSyncStatus((previous) => ({ ...previous, status: 'SYNCING', pendingChangesCount: pendingOperations.current.length }));

    const persist = async () => {
      try {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: stateData, version: serverVersion, operation }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          conflictRetryCount.current += 1;
          if (conflictRetryCount.current > 3) {
            setSyncStatus((previous) => ({ ...previous, status: 'ERROR', pendingChangesCount: pendingOperations.current.length }));
            return;
          }
          const latestResponse = await fetch('/api/state', { headers: { Authorization: `Bearer ${token}` } });
          const latestPayload = await latestResponse.json().catch(() => ({}));
          if (!latestResponse.ok || !latestPayload.success || !latestPayload.state) {
            setSyncStatus((previous) => ({ ...previous, status: 'ERROR', pendingChangesCount: pendingOperations.current.length }));
            return;
          }
          setServerVersion(Number(latestPayload.state.version));
          setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: pendingOperations.current.length }));
          setRetryNonce((value) => value + 1);
          return;
        }
        if (!response.ok || !payload.success) {
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            setSyncStatus((previous) => ({ ...previous, status: 'ERROR', pendingChangesCount: pendingOperations.current.length }));
            return;
          }
          setSyncStatus((previous) => ({ ...previous, status: 'OFFLINE', pendingChangesCount: pendingOperations.current.length }));
          return;
        }
        pendingOperations.current.shift();
        conflictRetryCount.current = 0;
        setServerVersion(Number(payload.state.version));
        const remaining = pendingOperations.current.length;
        setSyncStatus({ status: remaining ? 'PENDING_CHANGES' : 'ONLINE', pendingChangesCount: remaining, lastSyncTimestamp: new Date().toISOString() });
        if (remaining) setRetryNonce((value) => value + 1);
      } catch {
        setSyncStatus((previous) => ({ ...previous, status: 'OFFLINE', pendingChangesCount: pendingOperations.current.length }));
      } finally {
        persistenceInFlight.current = false;
      }
    };
    void persist();
  }, [stateData, stateReady, currentUser?.id, serverVersion, retryNonce]);

  useEffect(() => {
    if (!currentUser) return;
    const retry = () => {
      if (!pendingOperations.current.length || persistenceInFlight.current) return;
      setRetryNonce((value) => value + 1);
      setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: pendingOperations.current.length }));
    };
    window.addEventListener('online', retry);
    const interval = window.setInterval(retry, 15_000);
    return () => { window.removeEventListener('online', retry); window.clearInterval(interval); };
  }, [currentUser?.id]);

  useEffect(() => {
    setHalls((previous) => withHallTotals(previous, ponds));
  }, [ponds]);

  const can = (module: PermissionModule, action: PermissionAction, scopeId?: string): boolean => stateReady && hasPermission(module, action, scopeId);
  const markLocalChange = (operation: StateOperation) => {
    pendingOperations.current.push(operation);
    if (pendingOperations.current.length > 1000) pendingOperations.current.splice(0, pendingOperations.current.length - 1000);
    conflictRetryCount.current = 0;
    setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: pendingOperations.current.length }));
    setRetryNonce((value) => value + 1);
  };
  const createAuditLog = (action: string, entity: string, entityId: string, details: string, beforeState?: string, afterState?: string, transactionId?: string) => {
    if (!currentUser) return;
    const log: FarmAuditLog = { id: nextId('audit'), timestamp: new Date().toISOString(), userId: currentUser.id, userName: currentUser.fullName, userRole: currentUser.role, action, entity, entityId, details, beforeState, afterState, transactionId };
    setAuditLogs((previous) => [log, ...previous].slice(0, 1000));
  };

  const createHallStructure = (input: HallAdminInput): { success: boolean; error?: string; id?: string } => {
    if (!can('settings', 'manage')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const number = input.number.trim();
    const name = input.name.trim();
    const description = input.description.trim();
    if (!number || !name) return { success: false, error: 'HALL_IDENTITY_REQUIRED' };
    if (halls.some((hall) => hall.number.trim().toLowerCase() === number.toLowerCase())) return { success: false, error: 'HALL_NUMBER_DUPLICATE' };
    const hall: Hall = { id: nextId('hall'), number, name, description, pondCount: 0, totalBiomassKg: 0, totalFishCount: 0, isActive: true };
    setHalls((previous) => [...previous, hall]);
    createAuditLog('CREATE', 'Hall', hall.id, `Farm hall ${hall.number} created`, undefined, JSON.stringify(hall));
    markLocalChange({ module: 'settings', action: 'manage', entity: 'Hall', entityId: hall.id, referenceId: hall.number });
    return { success: true, id: hall.id };
  };

  const updateHallStructure = (hallId: string, patch: HallAdminPatch): { success: boolean; error?: string } => {
    if (!can('settings', 'manage')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const hall = halls.find((item) => item.id === hallId);
    if (!hall) return { success: false, error: 'HALL_NOT_FOUND' };
    if (patch.isActive === false && ponds.some((pond) => pond.hallId === hallId && pond.fishCount > 0)) return { success: false, error: 'HALL_WITH_FISH_CANNOT_BE_DEACTIVATED' };
    const number = patch.number?.trim();
    if (number && halls.some((item) => item.id !== hallId && item.number.trim().toLowerCase() === number.toLowerCase())) return { success: false, error: 'HALL_NUMBER_DUPLICATE' };
    const updated: Hall = {
      ...hall,
      ...(number !== undefined ? { number } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.managerId !== undefined ? { managerId: patch.managerId || undefined } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    };
    if (!updated.number || !updated.name) return { success: false, error: 'HALL_IDENTITY_REQUIRED' };
    setHalls((previous) => previous.map((item) => item.id === hallId ? updated : item));
    createAuditLog('UPDATE', 'Hall', hallId, `Farm hall ${hall.number} updated`, JSON.stringify(hall), JSON.stringify(updated));
    markLocalChange({ module: 'settings', action: 'manage', entity: 'Hall', entityId: hallId, referenceId: updated.number });
    return { success: true };
  };

  const createPondStructure = (input: PondStructureAdminInput): { success: boolean; error?: string; id?: string } => {
    if (!can('settings', 'manage')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const hall = halls.find((item) => item.id === input.hallId && item.isActive);
    const speciesDefinition = species.find((item) => item.id === input.speciesId) as FarmSpeciesWithStatus | undefined;
    if (!hall) return { success: false, error: 'ACTIVE_HALL_REQUIRED' };
    if (!speciesDefinition || speciesDefinition.isActive === false) return { success: false, error: 'ACTIVE_SPECIES_REQUIRED' };
    const number = input.number.trim();
    const name = input.name.trim();
    if (!number || !name) return { success: false, error: 'POND_IDENTITY_REQUIRED' };
    if (ponds.some((pond) => pond.number.trim().toLowerCase() === number.toLowerCase())) return { success: false, error: 'POND_NUMBER_DUPLICATE' };
    const capacityCubicMeters = structureCapacity(input);
    if (!Number.isFinite(capacityCubicMeters) || capacityCubicMeters <= 0) return { success: false, error: 'POND_DIMENSIONS_OR_CAPACITY_REQUIRED' };
    const timestamp = new Date().toISOString();
    const pond = {
      id: nextId('pond'), number, name, hallId: hall.id, capacityCubicMeters, fishCount: 0, speciesId: speciesDefinition.id,
      biomassKg: 0, averageWeightKg: 0, lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'STOPPED' as const,
      stopFeedingReason: 'Manual Decision' as const, stopFeedingDetails: 'New pond awaiting initial stock snapshot and validated telemetry',
      stopFeedingTimestamp: timestamp, stopFeedingUser: currentUser?.fullName || 'Admin', fcr: speciesDefinition.standardFCR,
      dailyMortalityCount: 0, waterTemperature: 0, dissolvedOxygen: 0, ph: 7, sensorQuality: 'OFFLINE' as const,
      lastBiometryDate: '', criticalAlerts: ['Initial stock snapshot required'], notes: input.notes?.trim(),
      pondShape: input.pondShape, lengthMeters: input.lengthMeters, widthMeters: input.widthMeters,
      depthMeters: input.depthMeters, diameterMeters: input.diameterMeters,
    } as Pond;
    const nextPonds = [...ponds, pond];
    setPonds(nextPonds);
    setHalls((previous) => withHallTotals(previous, nextPonds));
    createAuditLog('CREATE', 'Pond', pond.id, `Pond ${pond.number} created in hall ${hall.number}`, undefined, JSON.stringify(pond));
    markLocalChange({ module: 'settings', action: 'manage', entity: 'Pond', entityId: pond.id, referenceId: pond.number });
    return { success: true, id: pond.id };
  };

  const updatePondStructure = (pondId: string, patch: PondAdminPatch): { success: boolean; error?: string } => {
    if (!can('settings', 'manage')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const pond = ponds.find((item) => item.id === pondId);
    if (!pond) return { success: false, error: 'POND_NOT_FOUND' };
    const nextHallId = patch.hallId ?? pond.hallId;
    const nextSpeciesId = patch.speciesId ?? pond.speciesId;
    if (pond.fishCount > 0 && (nextHallId !== pond.hallId || nextSpeciesId !== pond.speciesId)) return { success: false, error: 'STOCKED_POND_REASSIGNMENT_FORBIDDEN' };
    const hall = halls.find((item) => item.id === nextHallId && item.isActive);
    const speciesDefinition = species.find((item) => item.id === nextSpeciesId) as FarmSpeciesWithStatus | undefined;
    if (!hall) return { success: false, error: 'ACTIVE_HALL_REQUIRED' };
    if (!speciesDefinition || speciesDefinition.isActive === false) return { success: false, error: 'ACTIVE_SPECIES_REQUIRED' };
    const number = patch.number?.trim() ?? pond.number;
    const name = patch.name?.trim() ?? pond.name;
    if (!number || !name) return { success: false, error: 'POND_IDENTITY_REQUIRED' };
    if (ponds.some((item) => item.id !== pondId && item.number.trim().toLowerCase() === number.toLowerCase())) return { success: false, error: 'POND_NUMBER_DUPLICATE' };
    const current = pond as Pond & PondAdminPatch;
    const mergedStructure: PondAdminPatch = {
      pondShape: patch.pondShape ?? current.pondShape ?? 'Other',
      capacityCubicMeters: patch.capacityCubicMeters ?? pond.capacityCubicMeters,
      lengthMeters: patch.lengthMeters ?? current.lengthMeters,
      widthMeters: patch.widthMeters ?? current.widthMeters,
      depthMeters: patch.depthMeters ?? current.depthMeters,
      diameterMeters: patch.diameterMeters ?? current.diameterMeters,
    };
    const capacityCubicMeters = structureCapacity(mergedStructure, pond.capacityCubicMeters);
    if (!Number.isFinite(capacityCubicMeters) || capacityCubicMeters <= 0) return { success: false, error: 'POND_DIMENSIONS_OR_CAPACITY_REQUIRED' };
    const updated = {
      ...pond, number, name, hallId: nextHallId, speciesId: nextSpeciesId, capacityCubicMeters,
      notes: patch.notes !== undefined ? patch.notes.trim() : pond.notes,
      pondShape: mergedStructure.pondShape,
      lengthMeters: mergedStructure.lengthMeters,
      widthMeters: mergedStructure.widthMeters,
      depthMeters: mergedStructure.depthMeters,
      diameterMeters: mergedStructure.diameterMeters,
    } as Pond;
    const nextPonds = ponds.map((item) => item.id === pondId ? updated : item);
    setPonds(nextPonds);
    setHalls((previous) => withHallTotals(previous, nextPonds));
    createAuditLog('UPDATE', 'Pond', pondId, `Pond structure ${pond.number} updated`, JSON.stringify(pond), JSON.stringify(updated));
    markLocalChange({ module: 'settings', action: 'manage', entity: 'Pond', entityId: pondId, referenceId: updated.number });
    return { success: true };
  };

  const createSpeciesDefinition = (input: SpeciesAdminInput): { success: boolean; error?: string; id?: string } => {
    if (!can('settings', 'manage')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const faName = input.faName.trim();
    const enName = input.enName.trim();
    const scientificName = input.scientificName.trim();
    if (!faName || !enName || !scientificName) return { success: false, error: 'SPECIES_IDENTITY_REQUIRED' };
    if (species.some((item) => item.scientificName.trim().toLowerCase() === scientificName.toLowerCase())) return { success: false, error: 'SPECIES_SCIENTIFIC_NAME_DUPLICATE' };
    const numeric = [input.optimumTempMin, input.optimumTempMax, input.optimumDOMin, input.optimumpHMin, input.optimumpHMax, input.standardFCR, input.feedingProfileCoeff, input.caviarMaturityYears];
    if (numeric.some((value) => !Number.isFinite(value) || value < 0) || input.optimumTempMin >= input.optimumTempMax || input.optimumpHMin >= input.optimumpHMax || input.optimumDOMin <= 0 || input.standardFCR <= 0 || input.feedingProfileCoeff <= 0) return { success: false, error: 'SPECIES_LIMITS_INVALID' };
    const definition: FarmSpeciesWithStatus = {
      ...input, id: nextId('species'), faName, enName, scientificName,
      origin: input.origin.trim(), geneticLine: input.geneticLine.trim(), description: input.description.trim(), isActive: input.isActive !== false,
    };
    setSpecies((previous) => [...previous, definition]);
    createAuditLog('CREATE', 'Species', definition.id, `Species ${definition.scientificName} created`, undefined, JSON.stringify(definition));
    markLocalChange({ module: 'settings', action: 'manage', entity: 'Species', entityId: definition.id, referenceId: definition.scientificName });
    return { success: true, id: definition.id };
  };

  const setSpeciesActive = (speciesId: string, isActive: boolean): { success: boolean; error?: string } => {
    if (!can('settings', 'manage')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const definition = species.find((item) => item.id === speciesId) as FarmSpeciesWithStatus | undefined;
    if (!definition) return { success: false, error: 'SPECIES_NOT_FOUND' };
    if (!isActive && ponds.some((pond) => pond.speciesId === speciesId && pond.fishCount > 0)) return { success: false, error: 'SPECIES_IN_USE_CANNOT_BE_DEACTIVATED' };
    const updated = { ...definition, isActive } as SturgeonSpecies;
    setSpecies((previous) => previous.map((item) => item.id === speciesId ? updated : item));
    createAuditLog('UPDATE', 'Species', speciesId, `Species ${definition.scientificName} ${isActive ? 'activated' : 'deactivated'}`, JSON.stringify(definition), JSON.stringify(updated));
    markLocalChange({ module: 'settings', action: 'manage', entity: 'Species', entityId: speciesId, referenceId: definition.scientificName });
    return { success: true };
  };

  const latestWaterLog = (pondId: string): WaterQualityLog | undefined => waterLogs.filter((log) => log.pondId === pondId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const authoritativePond = (pond: Pond): Pond => {
    const log = latestWaterLog(pond.id);
    return { ...pond, dissolvedOxygen: log?.dissolvedOxygen ?? pond.dissolvedOxygen, waterTemperature: log?.temperature ?? pond.waterTemperature, ph: log?.ph ?? pond.ph, ammonia: log?.ammonia, nitrite: log?.nitrite, lastTelemetryTimestamp: log?.timestamp, sensorQuality: log?.sensorStatus };
  };

  const calculateRecommendedFeed = (pondId: string): FeedingRecommendationResult => {
    const pond = ponds.find((item) => item.id === pondId);
    const activeTreatment = pond?.activeTreatmentId ? treatments.find((item) => item.id === pond.activeTreatmentId && item.status === 'ACTIVE') : undefined;
    return calculateFeedingRecommendation(pond ? authoritativePond(pond) : undefined, species, activeTreatment);
  };

  const recordFeeding = (recordData: Omit<FeedingRecord, 'id' | 'timestamp'>): { success: boolean; error?: string } => {
    if (!can('feeding', 'create', recordData.pondId)) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const pond = ponds.find((item) => item.id === recordData.pondId);
    if (!pond) return { success: false, error: 'POND_NOT_FOUND' };
    const validatedPond = authoritativePond(pond);
    const recommendation = calculateFeedingRecommendation(validatedPond, species, validatedPond.activeTreatmentId ? treatments.find((item) => item.id === validatedPond.activeTreatmentId && item.status === 'ACTIVE') : undefined);
    if (recommendation.isLocked) return { success: false, error: recommendation.lockReason || 'FEEDING_LOCKED' };
    const validation = validateFeedingSubmission(recordData, validatedPond, inventory);
    if (!validation.success || !validation.feedItem) return { success: false, error: validation.error || 'FEEDING_VALIDATION_FAILED' };
    const amountKg = validation.normalizedAmountKg;
    const feedItem = validation.feedItem;
    const inventoryAmount = inventoryQuantityForFeedKg(feedItem, amountKg);
    if (inventoryAmount <= 0) return { success: false, error: 'FEED_UNIT_UNSUPPORTED' };
    const quantityChange = -inventoryAmount;
    const resultingQuantity = Number((feedItem.quantity + quantityChange).toFixed(4));
    if (resultingQuantity < 0) return { success: false, error: 'INSUFFICIENT_FEED_STOCK' };
    const timestamp = new Date().toISOString();
    const newRecord: FeedingRecord = { ...recordData, id: nextId('feed'), timestamp, actualAmountKg: amountKg, unit: 'kg', dissolvedOxygen: validatedPond.dissolvedOxygen, waterTemperature: validatedPond.waterTemperature, telemetryTimestamp: validatedPond.lastTelemetryTimestamp, feedingStatus: 'ACTIVE' };
    const tx: InventoryTransaction = { id: nextId('invtx'), itemId: feedItem.id, itemName: feedItem.name, sku: feedItem.sku, type: 'Consumption (مصرف روزانه)', quantityChange, resultingQuantity, unit: feedItem.unit, unitPrice: feedItem.purchasePricePerUnit, totalValue: Number((amountKg * feedItem.purchasePricePerUnit).toFixed(2)), referenceDoc: newRecord.id, pondId: pond.id, operator: currentUser?.fullName || recordData.operatorName, timestamp, notes: 'Feeding consumption' };
    setInventory((previous) => previous.map((item) => item.id === feedItem.id ? { ...item, quantity: resultingQuantity, status: inventoryStatus(item, resultingQuantity) } : item));
    setInventoryTxs((previous) => [tx, ...previous]); setFeedingRecords((previous) => [newRecord, ...previous]);
    setPonds((previous) => previous.map((item) => item.id === pond.id ? { ...item, lastFeedingKg: amountKg, lastFeedingTime: timestamp } : item));
    createAuditLog('CREATE', 'FeedingRecord', newRecord.id, `Feeding ${amountKg} kg registered for ${pond.name}`);
    markLocalChange({ module: 'feeding', action: 'create', entity: 'FeedingRecord', entityId: newRecord.id, referenceId: newRecord.id });
    return { success: true };
  };

  const stopPondFeeding = (pondId: string, reason: Pond['stopFeedingReason'], details: string, operator: string) => {
    if (!can('feeding', 'edit', pondId)) return;
    const pond = ponds.find((item) => item.id === pondId); if (!pond) return;
    const timestamp = new Date().toISOString();
    setPonds((previous) => previous.map((item) => item.id === pondId ? { ...item, feedingStatus: 'STOPPED', stopFeedingReason: reason || 'Other', stopFeedingDetails: details.trim(), stopFeedingTimestamp: timestamp, stopFeedingUser: currentUser?.fullName || operator } : item));
    createAuditLog('UPDATE', 'Pond', pondId, `Feeding stopped: ${reason || 'Other'} - ${details}`); markLocalChange({ module: 'feeding', action: 'edit', entity: 'Pond', entityId: pondId });
  };

  const resumePondFeeding = (pondId: string, operator: string): { success: boolean; error?: string } => {
    if (!can('feeding', 'approve', pondId)) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const pond = ponds.find((item) => item.id === pondId); if (!pond) return { success: false, error: 'POND_NOT_FOUND' };
    if (pond.activeTreatmentId && treatments.some((treatment) => treatment.id === pond.activeTreatmentId && treatment.status === 'ACTIVE')) return { success: false, error: 'ACTIVE_TREATMENT' };
    const safety = calculateFeedingRecommendation({ ...authoritativePond(pond), feedingStatus: 'ACTIVE' }, species, undefined);
    if (safety.isLocked) return { success: false, error: safety.lockReason || 'WATER_UNSAFE' };
    setPonds((previous) => previous.map((item) => item.id === pondId ? { ...item, feedingStatus: 'ACTIVE', stopFeedingReason: undefined, stopFeedingDetails: undefined, stopFeedingTimestamp: undefined, stopFeedingUser: currentUser?.fullName || operator } : item));
    createAuditLog('APPROVE', 'Pond', pondId, 'Feeding resumed after safety validation'); markLocalChange({ module: 'feeding', action: 'approve', entity: 'Pond', entityId: pondId }); return { success: true };
  };

  const updatePondManualSnapshot = (pondId: string, input: PondManualSnapshotInput): { success: boolean; error?: string } => {
    if (!can('ponds', 'edit', pondId)) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const pond = ponds.find((item) => item.id === pondId);
    if (!pond) return { success: false, error: 'POND_NOT_FOUND' };
    if (!input || !Array.isArray(input.speciesMix)) return { success: false, error: 'POND_SPECIES_MIX_REQUIRED' };
    if (typeof input.manualWaterTemperature !== 'number' || !Number.isFinite(input.manualWaterTemperature) || input.manualWaterTemperature < 0 || input.manualWaterTemperature > 40) return { success: false, error: 'POND_MANUAL_TEMPERATURE_INVALID' };
    if (typeof input.notes !== 'string' || input.notes.trim().length < 3) return { success: false, error: 'POND_MANUAL_REASON_REQUIRED' };

    const knownSpecies = new Set(species.map((item) => item.id));
    const speciesIds = new Set<string>();
    const chipNumbers = new Set<string>();
    const normalizedGroups: PondSpeciesManualGroup[] = [];
    for (const raw of input.speciesMix) {
      if (!raw || !knownSpecies.has(raw.speciesId) || speciesIds.has(raw.speciesId)) return { success: false, error: 'POND_SPECIES_GROUP_INVALID' };
      if (!Number.isInteger(raw.count) || raw.count < 0 || !Number.isFinite(raw.avgWeightKg) || raw.avgWeightKg < 0) return { success: false, error: 'POND_SPECIES_GROUP_BIOMETRY_INVALID' };
      if (![raw.maleCount, raw.femaleCount, raw.unknownSexCount].every((value) => Number.isInteger(value) && value >= 0) || raw.maleCount + raw.femaleCount + raw.unknownSexCount !== raw.count) return { success: false, error: 'POND_SEX_TOTAL_MISMATCH' };
      const chips = Array.from(new Set((raw.chipNumbers || []).map((value) => value.trim()).filter(Boolean)));
      if (chips.length > raw.count) return { success: false, error: 'POND_CHIP_COUNT_INVALID' };
      if (chips.some((chip) => chipNumbers.has(chip))) return { success: false, error: 'POND_CHIP_DUPLICATE_OR_INVALID' };
      chips.forEach((chip) => chipNumbers.add(chip));
      speciesIds.add(raw.speciesId);
      normalizedGroups.push({ ...raw, avgWeightKg: Number(raw.avgWeightKg.toFixed(3)), chipNumbers: chips });
    }

    const totalFishCount = normalizedGroups.reduce((sum, group) => sum + group.count, 0);
    if (totalFishCount > 0 && normalizedGroups.length === 0) return { success: false, error: 'POND_SPECIES_MIX_REQUIRED' };
    const biomassKg = Number(normalizedGroups.reduce((sum, group) => sum + group.count * group.avgWeightKg, 0).toFixed(2));
    const averageWeightKg = totalFishCount > 0 ? Number((biomassKg / totalFishCount).toFixed(3)) : 0;
    const capacityCubicMeters = manualSnapshotCapacityCubicMeters(input, pond.capacityCubicMeters);
    const timestamp = new Date().toISOString();
    const operator = currentUser?.fullName || currentUser?.username || 'operator';
    const stopFeeding = input.stopFeeding && pond.feedingStatus === 'ACTIVE';

    const updatedPond: Pond = {
      ...pond,
      fishCount: totalFishCount,
      biomassKg,
      averageWeightKg,
      speciesId: normalizedGroups[0]?.speciesId || pond.speciesId,
      speciesMix: normalizedGroups,
      capacityCubicMeters,
      ...((input as any).pondShape !== undefined ? { pondShape: input.pondShape } : {}),
      ...(input.lengthMeters !== undefined ? { lengthMeters: input.lengthMeters } : {}),
      ...(input.widthMeters !== undefined ? { widthMeters: input.widthMeters } : {}),
      ...(input.depthMeters !== undefined ? { depthMeters: input.depthMeters } : {}),
      ...(input.diameterMeters !== undefined ? { diameterMeters: input.diameterMeters } : {}),
      manualWaterTemperature: Number(input.manualWaterTemperature.toFixed(2)),
      lastManualSnapshotAt: timestamp,
      lastManualSnapshotBy: operator,
      manualSnapshotNotes: input.notes.trim(),
      ...(stopFeeding ? {
        feedingStatus: 'STOPPED' as const,
        stopFeedingReason: 'Manual Decision' as const,
        stopFeedingDetails: `Manual pond snapshot: ${input.notes.trim()}`,
        stopFeedingTimestamp: timestamp,
        stopFeedingUser: operator,
      } : {}),
    } as Pond;

    setPonds((previous) => previous.map((item) => item.id === pondId ? updatedPond : item));
    createAuditLog('UPDATE', 'Pond', pondId, `Manual snapshot: ${totalFishCount} fish, ${biomassKg} kg biomass${stopFeeding ? ', feeding stopped' : ''}`, JSON.stringify(pond), JSON.stringify(updatedPond), `snapshot_${pondId}_${timestamp}`);
    markLocalChange({ module: 'ponds', action: 'edit', entity: 'Pond', entityId: pondId, referenceId: `snapshot_${timestamp}`, transactionId: `snapshot_${pondId}_${timestamp}` });
    return { success: true };
  };

  const recordMortality = (record: Omit<MortalityRecord, 'id' | 'timestamp'>) => {
    if (!can('mortality', 'create', record.pondId)) return;
    const pond = ponds.find((item) => item.id === record.pondId);
    if (!pond || !Number.isInteger(record.count) || record.count <= 0 || !Number.isFinite(record.estimatedWeightKg) || record.estimatedWeightKg < 0) return;
    const applied = applyMortalityToPondStock(pond, {
      speciesId: record.speciesId,
      stockSex: record.stockSex,
      count: record.count,
      biomassKg: record.estimatedWeightKg,
      chipNumbers: record.chipNumbers,
    });
    if (!applied.ok || !applied.pond || !applied.selectedSex) return;
    const newRecord: MortalityRecord = { ...record, stockSex: applied.selectedSex, id: nextId('mort'), timestamp: new Date().toISOString() };
    setMortalityRecords((previous) => [newRecord, ...previous]);
    setPonds((previous) => previous.map((item) => item.id === pond.id ? applied.pond! : item));
    createAuditLog('CREATE', 'MortalityRecord', newRecord.id, `${record.count} mortality recorded in ${pond.name} / ${record.speciesId} / ${applied.selectedSex}`);
    markLocalChange({ module: 'mortality', action: 'create', entity: 'MortalityRecord', entityId: newRecord.id });
  };

  const recordBiometry = (session: Omit<BiometricSession, 'id' | 'averageWeightKg' | 'minWeightKg' | 'maxWeightKg' | 'estimatedBiomassKg' | 'estimatedCount' | 'growthRateKgPerDay' | 'sgr'>) => {
    if (!can('biometrics', 'create', session.pondId)) return;
    const pond = ponds.find((item) => item.id === session.pondId);
    const validSamples = session.samples.filter((sample) => Number.isFinite(sample.weightKg) && sample.weightKg > 0);
    if (!pond || !validSamples.length) return;
    const weights = validSamples.map((sample) => sample.weightKg);
    const average = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const applied = applyBiometryToPondStock(pond, { speciesId: session.speciesId, stockSex: session.stockSex, averageWeightKg: average, date: session.date });
    if (!applied.ok || !applied.pond || !applied.selectedSex || !Number.isInteger(applied.selectedCount) || (applied.selectedCount || 0) <= 0) return;
    const previousSession = biometricSessions
      .filter((item) => item.pondId === pond.id && item.speciesId === session.speciesId && (item.stockSex || 'Unknown') === applied.selectedSex)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const previousAverage = previousSession?.averageWeightKg || applied.previousAverageWeightKg || average;
    const currentMs = new Date(session.date).getTime();
    if (!Number.isFinite(currentMs)) return;
    const previousDate = previousSession?.date || pond.lastBiometryDate;
    const previousMsRaw = previousDate ? new Date(previousDate).getTime() : Number.NaN;
    const previousMs = Number.isFinite(previousMsRaw) ? previousMsRaw : currentMs - 86_400_000;
    const days = Math.max(1, Math.round((currentMs - previousMs) / 86_400_000));
    const growthRate = (average - previousAverage) / days;
    const sgr = previousAverage > 0 ? (Math.log(average / previousAverage) / days) * 100 : 0;
    const selectedCount = Number(applied.selectedCount);
    const estimatedBiomass = Number((selectedCount * average).toFixed(2));
    const newSession: BiometricSession = {
      ...session,
      stockSex: applied.selectedSex,
      id: nextId('bio'),
      sampleCount: validSamples.length,
      samples: validSamples,
      averageWeightKg: Number(average.toFixed(3)),
      minWeightKg: Math.min(...weights),
      maxWeightKg: Math.max(...weights),
      estimatedBiomassKg: estimatedBiomass,
      estimatedCount: selectedCount,
      previousAvgWeightKg: previousAverage,
      daysSinceLastBiometry: days,
      growthRateKgPerDay: Number(growthRate.toFixed(4)),
      sgr: Number(sgr.toFixed(3)),
    };
    setBiometricSessions((previous) => [newSession, ...previous]);
    setPonds((previous) => previous.map((item) => item.id === pond.id ? applied.pond! : item));
    createAuditLog('CREATE', 'BiometricSession', newSession.id, `Biometry recorded for ${pond.name} / ${session.speciesId} / ${applied.selectedSex}`);
    markLocalChange({ module: 'biometrics', action: 'create', entity: 'BiometricSession', entityId: newSession.id });
  };

  const recordWaterTest = (test: Omit<WaterQualityLog, 'id' | 'timestamp'>) => {
    if (!can('water_quality', 'create', test.pondId)) return;
    const pond = ponds.find((item) => item.id === test.pondId); if (!pond) return;
    const timestamp = new Date().toISOString();
    const manual = test.sensorStatus === 'MANUAL';
    const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: test.dissolvedOxygen, waterTemperature: test.temperature, ph: test.ph, ammonia: test.ammonia, nitrite: test.nitrite, timestamp, sensorStatus: manual ? 'MANUAL' : test.sensorStatus });
    const invalid = [safety.doStatus, safety.tempStatus, safety.phStatus, safety.ammoniaStatus, safety.nitriteStatus].some((status) => !status?.isValid);
    const severity: WaterQualityLog['severity'] = safety.isCriticalAlert ? 'CRITICAL' : safety.isSafeForFeeding ? 'INFO' : 'HIGH';
    const sensorStatus: WaterQualityLog['sensorStatus'] = manual ? 'MANUAL' : invalid ? 'INVALID' : safety.staleTelemetry ? 'STALE' : 'VALID';
    const authoritativeForAutomation = sensorStatus === 'VALID' && safety.isSafeForFeeding;
    const newLog: WaterQualityLog = { ...test, id: nextId('water'), timestamp, severity, sensorStatus, alertMessage: manual ? 'اندازه‌گیری دستی ثبت شد؛ برای تصمیم خوراک‌دهی منبع authoritative محسوب نمی‌شود.' : safety.feedingProhibitionReason };
    setWaterLogs((previous) => [newLog, ...previous]);
    setPonds((previous) => previous.map((item) => item.id !== pond.id ? item : {
      ...item,
      dissolvedOxygen: test.dissolvedOxygen,
      waterTemperature: test.temperature,
      ph: test.ph,
      ammonia: test.ammonia,
      nitrite: test.nitrite,
      lastTelemetryTimestamp: timestamp,
      sensorQuality: sensorStatus,
      feedingStatus: authoritativeForAutomation ? item.feedingStatus : 'STOPPED',
      stopFeedingReason: authoritativeForAutomation ? item.stopFeedingReason : (test.temperature < 4 ? 'Low Temperature' : test.dissolvedOxygen < 4 ? 'Low Oxygen' : 'Manual Decision'),
      stopFeedingDetails: authoritativeForAutomation ? item.stopFeedingDetails : (manual ? 'اندازه‌گیری دستی جایگزین تله‌متری معتبر برای ایمنی خوراک‌دهی نیست.' : safety.feedingProhibitionReason),
      stopFeedingTimestamp: authoritativeForAutomation ? item.stopFeedingTimestamp : timestamp,
    }));
    createAuditLog('CREATE', 'WaterQualityLog', newLog.id, manual ? 'Manual water quality recorded; feeding remains fail-closed' : safety.isSafeForFeeding ? 'Water quality recorded' : `Water safety alert: ${safety.feedingProhibitionReason}`);
    markLocalChange({ module: 'water_quality', action: 'create', entity: 'WaterQualityLog', entityId: newLog.id });
  };

  const recordTreatment = (treatment: Omit<TreatmentRecord, 'id'>) => {
    if (!can('treatments', 'create', treatment.pondId)) return;
    if (!Number.isFinite(treatment.dose) || treatment.dose <= 0 || Number.isNaN(new Date(treatment.startDate).getTime())) return;
    const id = nextId('treat'); const newTreatment: TreatmentRecord = { ...treatment, id }; setTreatments((previous) => [newTreatment, ...previous]);
    if (treatment.status === 'ACTIVE') setPonds((previous) => previous.map((pond) => pond.id === treatment.pondId ? { ...pond, activeTreatmentId: id, feedingStatus: 'STOPPED', stopFeedingReason: 'Treatment', stopFeedingDetails: `${treatment.drugName}: ${treatment.diagnosis}`, stopFeedingTimestamp: new Date().toISOString(), stopFeedingUser: currentUser?.fullName || treatment.veterinarian } : pond));
    createAuditLog('CREATE', 'TreatmentRecord', id, `${treatment.drugName} treatment recorded for ${treatment.pondName}`); markLocalChange({ module: 'treatments', action: 'create', entity: 'TreatmentRecord', entityId: id });
  };

  const completeTreatment = (treatmentId: string): { success: boolean; error?: string } => {
    if (!can('treatments', 'edit')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const treatment = treatments.find((item) => item.id === treatmentId);
    if (!treatment) return { success: false, error: 'TREATMENT_NOT_FOUND' };
    if (treatment.status !== 'ACTIVE') return { success: false, error: 'TREATMENT_NOT_ACTIVE' };
    setTreatments((previous) => previous.map((item) => item.id === treatmentId ? { ...item, status: 'COMPLETED' } : item));
    setPonds((previous) => previous.map((pond) => pond.id === treatment.pondId && pond.activeTreatmentId === treatmentId ? {
      ...pond,
      activeTreatmentId: undefined,
      feedingStatus: 'STOPPED',
      stopFeedingReason: 'Treatment',
      stopFeedingDetails: `درمان ${treatment.drugName} تکمیل شد؛ فعال‌سازی مجدد خوراک نیازمند تأیید جداگانه و تله‌متری معتبر است.`,
      stopFeedingTimestamp: new Date().toISOString(),
      stopFeedingUser: currentUser?.fullName || treatment.veterinarian,
    } : pond));
    createAuditLog('UPDATE', 'TreatmentRecord', treatmentId, `Treatment ${treatment.drugName} completed; withdrawal remains until ${treatment.withdrawalEndDate}`);
    markLocalChange({ module: 'treatments', action: 'edit', entity: 'TreatmentRecord', entityId: treatmentId });
    return { success: true };
  };

  const executeAtomicTransfer = (transferData: Omit<FishTransfer, 'id' | 'status'>): { success: boolean; error?: string } => {
    if (!can('transfers', 'create', transferData.sourceId)) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const result = executeAtomicFishTransfer(transferData, ponds, nurseryTanks, larvae);
    if (!result.success || !result.updatedPonds || !result.updatedNurseryTanks || !result.updatedLarvae || !result.newTransfer) return { success: false, error: result.error };
    setPonds(result.updatedPonds); setNurseryTanks(result.updatedNurseryTanks); setLarvae(result.updatedLarvae);
    setTransfers((previous) => [result.newTransfer!, ...previous]);
    createAuditLog('CREATE', 'FishTransfer', result.newTransfer.id, `${transferData.sourceName} → ${transferData.destinationName}: ${transferData.fishCount} fish`, undefined, undefined, `txn_${result.newTransfer.id}`);
    markLocalChange({ module: 'transfers', action: 'create', entity: 'FishTransfer', entityId: result.newTransfer.id, transactionId: `txn_${result.newTransfer.id}` });
    return { success: true };
  };

  const addInventoryTransaction = (tx: Omit<InventoryTransaction, 'id' | 'timestamp' | 'resultingQuantity'>) => {
    if (!can('warehouse', 'create')) return;
    const item = inventory.find((row) => row.id === tx.itemId || row.sku === tx.sku); if (!item || !Number.isFinite(tx.quantityChange) || tx.quantityChange === 0 || (tx.unit && tx.unit !== item.unit)) return; const resultingQuantity = Number((item.quantity + tx.quantityChange).toFixed(4));
    if (resultingQuantity < 0) return;
    const newTx: InventoryTransaction = { ...tx, id: nextId('invtx'), timestamp: new Date().toISOString(), resultingQuantity, itemId: item.id, itemName: item.name, sku: item.sku, operator: currentUser?.fullName || tx.operator };
    setInventory((previous) => previous.map((row) => row.id === item.id ? { ...row, quantity: resultingQuantity, status: inventoryStatus(row, resultingQuantity) } : row)); setInventoryTxs((previous) => [newTx, ...previous]); createAuditLog('CREATE', 'InventoryTransaction', newTx.id, `${tx.quantityChange} ${item.unit} ${item.sku}`); markLocalChange({ module: 'warehouse', action: 'create', entity: 'InventoryTransaction', entityId: newTx.id });
  };

  const createProcessingBatch = (batch: Omit<ProcessingBatch, 'id' | 'caviarYieldPercent' | 'filletYieldPercent'>): { success: boolean; error?: string } => {
    if (!can('processing', 'create', batch.sourcePondId)) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const sourcePond = ponds.find((pond) => pond.id === batch.sourcePondId); if (!sourcePond) return { success: false, error: 'POND_NOT_FOUND' };
    const processTime = new Date(batch.date).getTime();
    if (!Number.isFinite(processTime)) return { success: false, error: 'PROCESSING_DATE_INVALID' };
    const blockingTreatment = treatments.find((treatment) => {
      if (treatment.pondId !== batch.sourcePondId) return false;
      if (treatment.status === 'ACTIVE') return true;
      const withdrawalEnd = new Date(treatment.withdrawalEndDate).getTime();
      return Number.isFinite(withdrawalEnd) && withdrawalEnd >= processTime;
    });
    if (blockingTreatment) return { success: false, error: `PROCESSING_TREATMENT_WITHDRAWAL_HOLD:${blockingTreatment.drugName}` };
    const result = executeAtomicProcessing(batch, ponds, coldStorage);
    if (!result.success || !result.batch || !result.ponds || !result.coldStorage) return { success: false, error: result.error };
    setPonds(result.ponds); setProcessingBatches((previous) => [result.batch!, ...previous]); setColdStorage(result.coldStorage);
    createAuditLog('CREATE', 'ProcessingBatch', result.batch.id, `Atomic processing ${batch.batchCode}: ${batch.liveBiomassKg} kg consumed from ${sourcePond.name}`);
    markLocalChange({ module: 'processing', action: 'create', entity: 'ProcessingBatch', entityId: result.batch.id, referenceId: result.batch.batchCode, transactionId: result.transactionId }); return { success: true };
  };

  const createProformaInvoice = (proforma: Omit<ProformaInvoice, 'id' | 'subtotal' | 'grandTotal'>) => {
    const validCurrencies = new Set(['USD', 'EUR', 'IRR', 'RUB', 'AED']);
    if (!can('sales', 'create') || !proforma.customerId || !proforma.customerName.trim() || !validCurrencies.has(proforma.currency) || !proforma.items.length || proforma.items.some((item) => !item.productName.trim() || !item.sku.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.taxPercent < 0 || item.discount < 0)) return;
    const subtotal = proforma.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); const taxTotal = proforma.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxPercent) / 100, 0); const discountTotal = proforma.items.reduce((sum, item) => sum + item.discount, 0); const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);
    const newProforma: ProformaInvoice = { ...proforma, id: nextId('prof'), subtotal: Number(subtotal.toFixed(2)), taxTotal: Number(taxTotal.toFixed(2)), discountTotal: Number(discountTotal.toFixed(2)), grandTotal: Number(grandTotal.toFixed(2)) }; setProformas((previous) => [newProforma, ...previous]); createAuditLog('CREATE', 'ProformaInvoice', newProforma.id, `Proforma ${newProforma.invoiceNumber} created`); markLocalChange({ module: 'sales', action: 'create', entity: 'ProformaInvoice', entityId: newProforma.id });
  };

  const updateProformaStage = (id: string, newStage: ProformaInvoice['stage']) => {
    if (!can('sales', 'edit')) return;
    const existing = proformas.find((row) => row.id === id);
    if (!existing) return;
    const requiresFulfillment = newStage === 'Dispatched / Delivery (تحویل)';
    let fulfillment: ReturnType<typeof fulfillProforma> | undefined;
    if (requiresFulfillment && !existing.fulfilledAt) {
      fulfillment = fulfillProforma(existing, coldStorage);
      if (!fulfillment.success || !fulfillment.coldStorage || !fulfillment.fulfilledAt || !fulfillment.transactionId) return;
      setColdStorage(fulfillment.coldStorage);
    }
    const updatedProforma: ProformaInvoice = { ...existing, stage: newStage, ...(fulfillment ? { fulfilledAt: fulfillment.fulfilledAt, fulfillmentTransactionId: fulfillment.transactionId } : {}) };
    setProformas((previous) => previous.map((row) => row.id === id ? updatedProforma : row));
    createAuditLog('UPDATE', 'ProformaInvoice', id, `Stage changed to ${newStage}`, undefined, undefined, fulfillment?.transactionId);
    markLocalChange({ module: 'sales', action: 'edit', entity: 'ProformaInvoice', entityId: id, transactionId: fulfillment?.transactionId });
  };

  const createJournalEntry = (entry: Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'>): { success: boolean; error?: string } => {
    if (!can('accounting', 'create')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const result = validateAndExecuteJournalEntry(entry, accounts, journals); if (!result.success || !result.newEntry || !result.updatedAccounts) return { success: false, error: result.error }; setAccounts(result.updatedAccounts); setJournals((previous) => [result.newEntry!, ...previous]); createAuditLog('CREATE', 'JournalEntry', result.newEntry.id, `Balanced journal ${result.newEntry.entryNumber} posted`); markLocalChange({ module: 'accounting', action: 'create', entity: 'JournalEntry', entityId: result.newEntry.id, referenceId: result.newEntry.referenceId }); return { success: true };
  };
  const createFxConversionJournalEntry = (entry: FxConversionInput): { success: boolean; error?: string } => {
    if (!can('accounting', 'create')) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const result = validateAndExecuteFxConversion(entry, accounts, journals);
    if (!result.success || !result.newEntry || !result.updatedAccounts) return { success: false, error: result.error };
    setAccounts(result.updatedAccounts); setJournals((previous) => [result.newEntry!, ...previous]);
    createAuditLog('CREATE', 'JournalEntry', result.newEntry.id, `FX journal ${result.newEntry.entryNumber} posted`, undefined, undefined, result.newEntry.referenceId);
    markLocalChange({ module: 'accounting', action: 'create', entity: 'JournalEntry', entityId: result.newEntry.id, referenceId: result.newEntry.referenceId });
    return { success: true };
  };

  const clockAttendance = (employeeId: string, type: 'in' | 'out', shift: AttendanceRecord['shift']) => {
    if (!can('hr', 'create')) return;
    const employee = employees.find((row) => row.id === employeeId && row.status === 'Active'); if (!employee) return; const now = new Date(); const date = now.toISOString().slice(0, 10);
    if (type === 'in') { if (attendance.some((row) => row.employeeId === employeeId && row.date === date && !row.clockOutTime)) return; const record: AttendanceRecord = { id: nextId('att'), employeeId, employeeName: employee.fullName, date, clockInTime: now.toISOString(), shift, regularHours: 0, overtimeHours: 0, status: 'Present' }; setAttendance((previous) => [record, ...previous]); }
    else setAttendance((previous) => { const open = previous.find((row) => row.employeeId === employeeId && row.date === date && !row.clockOutTime); if (!open) return previous; const hours = Math.max(0, (now.getTime() - new Date(open.clockInTime).getTime()) / 3_600_000); return previous.map((row) => row.id === open.id ? { ...row, clockOutTime: now.toISOString(), regularHours: Number(Math.min(8, hours).toFixed(2)), overtimeHours: Number(Math.max(0, hours - 8).toFixed(2)) } : row); });
    createAuditLog('CREATE', 'Attendance', employeeId, `Clock ${type}`); markLocalChange({ module: 'hr', action: 'create', entity: 'Attendance', entityId: employeeId });
  };

  const generateMonthlyPayroll = (monthString: string) => {
    if (!can('hr', 'create') || !/^\d{4}-\d{2}$/.test(monthString)) return;
    const generated: PayrollRecord[] = employees.filter((employee) => employee.status === 'Active').map((employee) => { const employeeAttendance = attendance.filter((row) => row.employeeId === employee.id && row.date.startsWith(monthString)); const overtimeHours = employeeAttendance.reduce((sum, row) => sum + row.overtimeHours, 0); const hourlyRate = employee.baseSalary / 240; const overtimePay = Number((overtimeHours * hourlyRate * 1.4).toFixed(0)); const grossSalary = employee.baseSalary + overtimePay; return { id: nextId('pay'), payrollMonth: monthString, employeeId: employee.id, employeeName: employee.fullName, department: employee.department, baseSalary: employee.baseSalary, overtimePay, shiftBonus: 0, hardshipAllowance: 0, grossSalary, socialSecurityInsurance: 0, incomeTax: 0, loanDeduction: 0, netPay: grossSalary, currency: employee.currency, paymentStatus: 'Calculated' as const }; });
    setPayrolls((previous) => [...generated, ...previous.filter((row) => row.payrollMonth !== monthString)]); createAuditLog('CREATE', 'Payroll', monthString, 'Draft payroll generated from recorded attendance'); markLocalChange({ module: 'hr', action: 'create', entity: 'Payroll', entityId: monthString });
  };

  const buildBackupData = (): Record<string, unknown> => ({ halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs });
  const createBackupSnapshot = (type: BackupSnapshot['type'] = 'Manual Export'): BackupSnapshot => {
    const isPreRestore = type === 'Pre-Restore Safety Snapshot';
    if (!can('backup', 'export') && !(isPreRestore && can('backup', 'approve'))) throw new Error('ACTION_NOT_ALLOWED');
    const data = buildBackupData(); const serialized = JSON.stringify(data); const timestamp = new Date().toISOString(); const snapshot: BackupSnapshot = { id: nextId('backup'), filename: `fathi-aqua-erp-${timestamp.slice(0, 10)}.json`, timestamp, version: '6.1.0', schemaVersion: BACKUP_SCHEMA_VERSION, dataSizeKb: Number((new Blob([serialized]).size / 1024).toFixed(2)), tablesCount: Object.keys(data).length, checksum: checksumBackupData(data), checksumAlgorithm: 'SHA-256', creator: currentUser?.fullName || '', type, data };
    setBackups((previous) => [stripBackupData(snapshot), ...previous].slice(0, 100)); markLocalChange({ module: 'backup', action: 'export', entity: 'BackupSnapshot', entityId: snapshot.id, referenceId: snapshot.filename }); return snapshot;
  };

  const createEncryptedBackup = async (passphrase: string): Promise<EncryptedBackupEnvelope> => {
    if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('BACKUP_PASSPHRASE_TOO_SHORT');
    const snapshot = createBackupSnapshot('Manual Export');
    return encryptBackupDocument(snapshot, passphrase);
  };

  const restoreFromSnapshotJson = async (jsonString: string, passphrase?: string): Promise<{ success: boolean; message: string }> => {
    if (!can('backup', 'approve')) return { success: false, message: 'ACTION_NOT_ALLOWED' };
    try {
      const parsed = JSON.parse(jsonString); const decrypted: { ok: boolean; error?: string; data?: Record<string, any> } = parsed?.format === 'FATHI_ERP_ENCRYPTED_BACKUP' ? await decryptBackupDocument(parsed, passphrase || '') : { ok: true, data: parsed?.data };
      if (!decrypted.ok || !decrypted.data) return { success: false, message: decrypted.error || 'BACKUP_INVALID' };
      const candidate = parsed?.format === 'FATHI_ERP_ENCRYPTED_BACKUP' ? { schemaVersion: BACKUP_SCHEMA_VERSION, data: decrypted.data, checksum: checksumBackupData(decrypted.data) } : parsed;
      const validation = validateBackupDocument(candidate); if (!validation.ok || !validation.data) return { success: false, message: validation.error || 'BACKUP_INVALID' };
      const token = getStoredSessionToken();
      if (!token) return { success: false, message: 'AUTH_REQUIRED' };
      const candidateState = { ...validation.data, backups: Array.isArray(stateData.backups) ? stateData.backups : [] };
      const response = await fetch('/api/state', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: candidateState, version: serverVersion, operation: { module: 'backup', action: 'approve', entity: 'BackupRestore', entityId: nextId('restore') } }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || !payload.state?.data) return { success: false, message: payload.error || 'BACKUP_RESTORE_FAILED' };
      pendingOperations.current = [];
      conflictRetryCount.current = 0;
      applyState(payload.state.data, Array.isArray(payload.auditLogs) ? payload.auditLogs : []);
      setServerVersion(Number(payload.state.version));
      setSyncStatus((previous) => ({ ...previous, status: 'ONLINE', pendingChangesCount: 0, lastSyncTimestamp: new Date().toISOString() }));
      return { success: true, message: 'BACKUP_RESTORED' };
    } catch { return { success: false, message: 'BACKUP_PARSE_FAILED' }; }
  };

  const addBroodstock = (fish: Omit<BroodstockFish, 'id'>) => { if (!can('hatchery', 'create') || !fish.chipNumber.trim() || broodstock.some((row) => row.chipNumber === fish.chipNumber || row.plateNumber === fish.plateNumber) || !Number.isFinite(fish.weightKg) || fish.weightKg <= 0) return; const newFish: BroodstockFish = { ...fish, id: nextId('brood') }; setBroodstock((previous) => [newFish, ...previous]); createAuditLog('CREATE', 'Broodstock', newFish.id, `Broodstock ${fish.chipNumber} registered`); markLocalChange({ module: 'hatchery', action: 'create', entity: 'Broodstock', entityId: newFish.id }); };
  const recordFertilization = (fert: Omit<FertilizationBatch, 'id' | 'fertilizationTimestamp' | 'status'>) => { if (!can('hatchery', 'create')) return; const parentsExist = fert.femaleIds.every((id) => broodstock.some((fish) => fish.id === id && fish.sex === 'Female')) && fert.maleIds.every((id) => broodstock.some((fish) => fish.id === id && fish.sex === 'Male')); if (!parentsExist || !Number.isFinite(fert.fertilizationRatePercent) || fert.fertilizationRatePercent < 0 || fert.fertilizationRatePercent > 100) return; const newBatch: FertilizationBatch = { ...fert, id: nextId('fert'), fertilizationTimestamp: new Date().toISOString(), status: 'Incubating' }; setFertilizations((previous) => [newBatch, ...previous]); createAuditLog('CREATE', 'FertilizationBatch', newBatch.id, `Fertilization ${fert.batchCode} registered`); markLocalChange({ module: 'hatchery', action: 'create', entity: 'FertilizationBatch', entityId: newBatch.id }); };
  const addCustomer = (cust: Omit<Customer, 'id' | 'createdAt' | 'totalOrdersCount' | 'totalSpent' | 'outstandingBalance'>) => { if (!can('crm', 'create') || !cust.name.trim() || !cust.companyName.trim() || !cust.country.trim() || !cust.city.trim() || !cust.currency.trim() || (cust.email && customers.some((row) => row.email.toLowerCase() === cust.email.toLowerCase()))) return; const customer: Customer = { ...cust, id: nextId('cust'), createdAt: new Date().toISOString(), totalOrdersCount: 0, totalSpent: 0, outstandingBalance: 0 }; setCustomers((previous) => [customer, ...previous]); createAuditLog('CREATE', 'Customer', customer.id, `Customer ${customer.name} created`); markLocalChange({ module: 'crm', action: 'create', entity: 'Customer', entityId: customer.id }); };
  const addSocialPost = (post: Omit<SocialMediaPost, 'id' | 'status'>) => { if (!can('media', 'create')) return; const newPost: SocialMediaPost = { ...post, id: nextId('post'), status: 'Draft' }; setSocialPosts((previous) => [newPost, ...previous]); createAuditLog('CREATE', 'SocialMediaPost', newPost.id, `Draft post ${post.title} created`); markLocalChange({ module: 'media', action: 'create', entity: 'SocialMediaPost', entityId: newPost.id }); };

  const value = useMemo<FarmContextType>(() => ({ halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups, syncStatus, createHallStructure, updateHallStructure, createPondStructure, updatePondStructure, createSpeciesDefinition, setSpeciesActive, calculateRecommendedFeed, recordFeeding, stopPondFeeding, resumePondFeeding, updatePondManualSnapshot, recordMortality, recordBiometry, recordWaterTest, recordTreatment, completeTreatment, executeAtomicTransfer, addInventoryTransaction, createProcessingBatch, createProformaInvoice, updateProformaStage, createJournalEntry, createFxConversionJournalEntry, clockAttendance, generateMonthlyPayroll, createAuditLog, createBackupSnapshot, createEncryptedBackup, restoreFromSnapshotJson, addBroodstock, recordFertilization, addCustomer, addSocialPost }), [halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups, syncStatus]);
  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
};

export const useFarm = (): FarmContextType => { const context = useContext(FarmContext); if (!context) throw new Error('useFarm must be used within a FarmProvider'); return context; };
