import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredSessionToken, useAuth } from './AuthContext';
import {
  Account, AttendanceRecord, BackupSnapshot, BiometricSession, BroodstockFish, ColdStoragePallet, Customer,
  Employee, Equipment, FeedingRecord, FertilizationBatch, FishTransfer, FarmAuditLog, Hall, IncubatorUnit,
  InventoryItem, InventoryTransaction, JournalEntry, LabSample, LarvalBatch, MortalityRecord, NurseryTank,
  PayrollRecord, PermissionAction, PermissionModule, Pond, ProcessingBatch, ProformaInvoice, SocialMediaPost,
  SturgeonSpecies, TreatmentRecord, WaterQualityLog,
} from '../types';
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
  calculateRecommendedFeed: (pondId: string) => FeedingRecommendationResult;
  recordFeeding: (record: Omit<FeedingRecord, 'id' | 'timestamp'>) => { success: boolean; error?: string };
  stopPondFeeding: (pondId: string, reason: Pond['stopFeedingReason'], details: string, operator: string) => void;
  resumePondFeeding: (pondId: string, operator: string) => { success: boolean; error?: string };
  recordMortality: (record: Omit<MortalityRecord, 'id' | 'timestamp'>) => void;
  recordBiometry: (session: Omit<BiometricSession, 'id' | 'averageWeightKg' | 'minWeightKg' | 'maxWeightKg' | 'estimatedBiomassKg' | 'estimatedCount' | 'growthRateKgPerDay' | 'sgr'>) => void;
  recordWaterTest: (test: Omit<WaterQualityLog, 'id' | 'timestamp'>) => void;
  recordTreatment: (treatment: Omit<TreatmentRecord, 'id'>) => void;
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
  const pendingOperation = useRef<StateOperation | null>(null);
  const persistenceInFlight = useRef(false);
  const failedRevision = useRef<number | null>(null);
  const revision = useRef(0);
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
      pendingOperation.current = null;
      revision.current += 1;
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
        } else {
          setServerVersion(null);
          pendingOperation.current = { module: 'settings', action: 'manage', entity: 'StateInitialization', entityId: 'state' };
          revision.current += 1;
          setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: previous.pendingChangesCount + 1 }));
        }
        setStateReady(true);
        setSyncStatus((previous) => ({ ...previous, status: 'ONLINE', lastSyncTimestamp: new Date().toISOString() }));
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
    if (!stateReady || !currentUser || !pendingOperation.current || persistenceInFlight.current) return;
    const operation = pendingOperation.current;
    pendingOperation.current = null;
    const token = getStoredSessionToken();
    if (!token) {
      pendingOperation.current = operation;
      setSyncStatus((previous) => ({ ...previous, status: 'OFFLINE', pendingChangesCount: Math.max(1, previous.pendingChangesCount) }));
      return;
    }
    const requestRevision = revision.current;
    if (failedRevision.current === requestRevision) return;
    persistenceInFlight.current = true;
    setSyncStatus((previous) => ({ ...previous, status: 'SYNCING' }));
    fetch('/api/state', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: stateData, version: serverVersion, operation }) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.success) {
          if (response.status === 409 || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
            failedRevision.current = requestRevision;
            setSyncStatus((previous) => ({ ...previous, status: 'ERROR' }));
            return;
          }
          pendingOperation.current = operation;
          failedRevision.current = requestRevision;
          setSyncStatus((previous) => ({ ...previous, status: 'OFFLINE', pendingChangesCount: Math.max(1, previous.pendingChangesCount) }));
          return;
        }
        setServerVersion(Number(payload.state.version));
        failedRevision.current = null;
        setSyncStatus((previous) => ({ ...previous, status: 'ONLINE', pendingChangesCount: 0, lastSyncTimestamp: new Date().toISOString() }));
      })
      .catch(() => {
        pendingOperation.current = operation;
        failedRevision.current = requestRevision;
        setSyncStatus((previous) => ({ ...previous, status: 'OFFLINE', pendingChangesCount: Math.max(1, previous.pendingChangesCount) }));
      })
      .finally(() => { persistenceInFlight.current = false; });
  }, [stateData, stateReady, currentUser?.id, serverVersion, syncStatus.pendingChangesCount, retryNonce]);

  useEffect(() => {
    if (!currentUser) return;
    const retry = () => {
      if (!pendingOperation.current) return;
      failedRevision.current = null;
      setRetryNonce((value) => value + 1);
      setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: Math.max(1, previous.pendingChangesCount) }));
    };
    window.addEventListener('online', retry);
    const interval = window.setInterval(retry, 15_000);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(interval);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    setHalls((previous) => previous.map((hall) => {
      const hallPonds = ponds.filter((pond) => pond.hallId === hall.id);
      const next = { ...hall, pondCount: hallPonds.length, totalBiomassKg: Number(hallPonds.reduce((sum, pond) => sum + pond.biomassKg, 0).toFixed(2)), totalFishCount: hallPonds.reduce((sum, pond) => sum + pond.fishCount, 0) };
      return hall.pondCount === next.pondCount && hall.totalBiomassKg === next.totalBiomassKg && hall.totalFishCount === next.totalFishCount ? hall : next;
    }));
  }, [ponds]);

  const can = (module: PermissionModule, action: PermissionAction, scopeId?: string): boolean =>
    stateReady && hasPermission(module, action, scopeId);
  const markLocalChange = (operation: StateOperation) => {
    pendingOperation.current = operation;
    revision.current += 1;
    failedRevision.current = null;
    setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: previous.pendingChangesCount + 1 }));
  };
  const createAuditLog = (action: string, entity: string, entityId: string, details: string, beforeState?: string, afterState?: string, transactionId?: string) => {
    if (!currentUser) return;
    const log: FarmAuditLog = { id: nextId('audit'), timestamp: new Date().toISOString(), userId: currentUser.id, userName: currentUser.fullName, userRole: currentUser.role, action, entity, entityId, details, beforeState, afterState, transactionId };
    setAuditLogs((previous) => [log, ...previous].slice(0, 1000));
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
    // The recommendation engine correctly refuses a STOPPED pond. For a resume
    // decision, evaluate only the water/treatment gates with a temporary active
    // status, then apply the explicit approval below.
    const safety = calculateFeedingRecommendation({ ...authoritativePond(pond), feedingStatus: 'ACTIVE' }, species, undefined);
    if (safety.isLocked) return { success: false, error: safety.lockReason || 'WATER_UNSAFE' };
    setPonds((previous) => previous.map((item) => item.id === pondId ? { ...item, feedingStatus: 'ACTIVE', stopFeedingReason: undefined, stopFeedingDetails: undefined, stopFeedingTimestamp: undefined, stopFeedingUser: currentUser?.fullName || operator } : item));
    createAuditLog('APPROVE', 'Pond', pondId, 'Feeding resumed after safety validation'); markLocalChange({ module: 'feeding', action: 'approve', entity: 'Pond', entityId: pondId }); return { success: true };
  };

  const recordMortality = (record: Omit<MortalityRecord, 'id' | 'timestamp'>) => {
    if (!can('mortality', 'create', record.pondId)) return;
    const pond = ponds.find((item) => item.id === record.pondId);
    if (!pond || !Number.isInteger(record.count) || record.count <= 0 || record.count > pond.fishCount || !Number.isFinite(record.estimatedWeightKg) || record.estimatedWeightKg < 0 || record.estimatedWeightKg > pond.biomassKg) return;
    const newRecord: MortalityRecord = { ...record, id: nextId('mort'), timestamp: new Date().toISOString() };
    const newCount = pond.fishCount - record.count; const newBiomass = Number((pond.biomassKg - record.estimatedWeightKg).toFixed(2));
    setMortalityRecords((previous) => [newRecord, ...previous]); setPonds((previous) => previous.map((item) => item.id === pond.id ? { ...item, fishCount: newCount, biomassKg: newBiomass, averageWeightKg: newCount > 0 ? Number((newBiomass / newCount).toFixed(3)) : 0, dailyMortalityCount: item.dailyMortalityCount + record.count } : item));
    createAuditLog('CREATE', 'MortalityRecord', newRecord.id, `${record.count} mortality recorded in ${pond.name}`); markLocalChange({ module: 'mortality', action: 'create', entity: 'MortalityRecord', entityId: newRecord.id });
  };

  const recordBiometry = (session: Omit<BiometricSession, 'id' | 'averageWeightKg' | 'minWeightKg' | 'maxWeightKg' | 'estimatedBiomassKg' | 'estimatedCount' | 'growthRateKgPerDay' | 'sgr'>) => {
    if (!can('biometrics', 'create', session.pondId)) return;
    const pond = ponds.find((item) => item.id === session.pondId); const validSamples = session.samples.filter((sample) => Number.isFinite(sample.weightKg) && sample.weightKg > 0); if (!pond || !validSamples.length) return;
    const weights = validSamples.map((sample) => sample.weightKg); const average = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const previousSession = biometricSessions.filter((item) => item.pondId === pond.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const previousAverage = previousSession?.averageWeightKg || pond.averageWeightKg || average; const previousDate = previousSession?.date || pond.lastBiometryDate;
    const days = Math.max(1, Math.round((new Date(session.date).getTime() - new Date(previousDate).getTime()) / 86_400_000)); const growthRate = (average - previousAverage) / days; const sgr = previousAverage > 0 ? (Math.log(average / previousAverage) / days) * 100 : 0; const estimatedBiomass = Number((pond.fishCount * average).toFixed(2));
    const newSession: BiometricSession = { ...session, id: nextId('bio'), sampleCount: validSamples.length, samples: validSamples, averageWeightKg: Number(average.toFixed(3)), minWeightKg: Math.min(...weights), maxWeightKg: Math.max(...weights), estimatedBiomassKg: estimatedBiomass, estimatedCount: pond.fishCount, previousAvgWeightKg: previousAverage, daysSinceLastBiometry: days, growthRateKgPerDay: Number(growthRate.toFixed(4)), sgr: Number(sgr.toFixed(3)) };
    setBiometricSessions((previous) => [newSession, ...previous]); setPonds((previous) => previous.map((item) => item.id === pond.id ? { ...item, averageWeightKg: newSession.averageWeightKg, biomassKg: estimatedBiomass, lastBiometryDate: session.date } : item));
    createAuditLog('CREATE', 'BiometricSession', newSession.id, `Biometry recorded for ${pond.name}`); markLocalChange({ module: 'biometrics', action: 'create', entity: 'BiometricSession', entityId: newSession.id });
  };

  const recordWaterTest = (test: Omit<WaterQualityLog, 'id' | 'timestamp'>) => {
    if (!can('water_quality', 'create', test.pondId)) return;
    const pond = ponds.find((item) => item.id === test.pondId); if (!pond) return; const timestamp = new Date().toISOString();
    const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: test.dissolvedOxygen, waterTemperature: test.temperature, ph: test.ph, ammonia: test.ammonia, nitrite: test.nitrite, timestamp });
    const invalid = [safety.doStatus, safety.tempStatus, safety.phStatus, safety.ammoniaStatus, safety.nitriteStatus].some((status) => !status?.isValid); const severity: WaterQualityLog['severity'] = safety.isCriticalAlert ? 'CRITICAL' : safety.isSafeForFeeding ? 'INFO' : 'HIGH'; const sensorStatus: WaterQualityLog['sensorStatus'] = invalid ? 'INVALID' : safety.staleTelemetry ? 'STALE' : 'VALID';
    const newLog: WaterQualityLog = { ...test, id: nextId('water'), timestamp, severity, sensorStatus, alertMessage: safety.feedingProhibitionReason }; setWaterLogs((previous) => [newLog, ...previous]);
    setPonds((previous) => previous.map((item) => item.id !== pond.id ? item : { ...item, dissolvedOxygen: test.dissolvedOxygen, waterTemperature: test.temperature, ph: test.ph, ammonia: test.ammonia, nitrite: test.nitrite, lastTelemetryTimestamp: timestamp, sensorQuality: sensorStatus, feedingStatus: safety.isSafeForFeeding ? item.feedingStatus : 'STOPPED', stopFeedingReason: safety.isSafeForFeeding ? item.stopFeedingReason : (test.temperature < 4 ? 'Low Temperature' : test.dissolvedOxygen < 4 ? 'Low Oxygen' : 'Other'), stopFeedingDetails: safety.isSafeForFeeding ? item.stopFeedingDetails : safety.feedingProhibitionReason, stopFeedingTimestamp: safety.isSafeForFeeding ? item.stopFeedingTimestamp : timestamp }));
    createAuditLog('CREATE', 'WaterQualityLog', newLog.id, safety.isSafeForFeeding ? 'Water quality recorded' : `Water safety alert: ${safety.feedingProhibitionReason}`); markLocalChange({ module: 'water_quality', action: 'create', entity: 'WaterQualityLog', entityId: newLog.id });
  };

  const recordTreatment = (treatment: Omit<TreatmentRecord, 'id'>) => {
    if (!can('treatments', 'create', treatment.pondId)) return;
    if (!Number.isFinite(treatment.dose) || treatment.dose <= 0 || Number.isNaN(new Date(treatment.startDate).getTime())) return;
    const id = nextId('treat'); const newTreatment: TreatmentRecord = { ...treatment, id }; setTreatments((previous) => [newTreatment, ...previous]);
    if (treatment.status === 'ACTIVE') setPonds((previous) => previous.map((pond) => pond.id === treatment.pondId ? { ...pond, activeTreatmentId: id, feedingStatus: 'STOPPED', stopFeedingReason: 'Treatment', stopFeedingDetails: `${treatment.drugName}: ${treatment.diagnosis}`, stopFeedingTimestamp: new Date().toISOString(), stopFeedingUser: currentUser?.fullName || treatment.veterinarian } : pond));
    createAuditLog('CREATE', 'TreatmentRecord', id, `${treatment.drugName} treatment recorded for ${treatment.pondName}`); markLocalChange({ module: 'treatments', action: 'create', entity: 'TreatmentRecord', entityId: id });
  };

  const executeAtomicTransfer = (transferData: Omit<FishTransfer, 'id' | 'status'>): { success: boolean; error?: string } => {
    if (!can('transfers', 'create', transferData.sourceId)) return { success: false, error: 'ACTION_NOT_ALLOWED' };
    const result = executeAtomicFishTransfer(transferData, ponds, nurseryTanks, larvae);
    if (!result.success || !result.updatedPonds || !result.updatedNurseryTanks || !result.updatedLarvae || !result.newTransfer) return { success: false, error: result.error };
    setPonds(result.updatedPonds);
    setNurseryTanks(result.updatedNurseryTanks);
    setLarvae(result.updatedLarvae);
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
    const requiresFulfillment = newStage === 'Payment Received (تسویه)' || newStage === 'Dispatched / Delivery (تحویل)' || String(newStage) === 'Paid';
    let updatedColdStorage = coldStorage;
    let fulfillment: ReturnType<typeof fulfillProforma> | undefined;
    if (requiresFulfillment && !existing.fulfilledAt) {
      fulfillment = fulfillProforma(existing, coldStorage);
      if (!fulfillment.success || !fulfillment.coldStorage || !fulfillment.fulfilledAt || !fulfillment.transactionId) return;
      updatedColdStorage = fulfillment.coldStorage;
      setColdStorage(updatedColdStorage);
    }
    const updatedProforma: ProformaInvoice = {
      ...existing,
      stage: newStage,
      ...(fulfillment ? { fulfilledAt: fulfillment.fulfilledAt, fulfillmentTransactionId: fulfillment.transactionId } : {}),
    };
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
    setAccounts(result.updatedAccounts);
    setJournals((previous) => [result.newEntry!, ...previous]);
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
      pendingOperation.current = null;
      revision.current += 1;
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

  const value = useMemo<FarmContextType>(() => ({ halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups, syncStatus, calculateRecommendedFeed, recordFeeding, stopPondFeeding, resumePondFeeding, recordMortality, recordBiometry, recordWaterTest, recordTreatment, executeAtomicTransfer, addInventoryTransaction, createProcessingBatch, createProformaInvoice, updateProformaStage, createJournalEntry, createFxConversionJournalEntry, clockAttendance, generateMonthlyPayroll, createAuditLog, createBackupSnapshot, createEncryptedBackup, restoreFromSnapshotJson, addBroodstock, recordFertilization, addCustomer, addSocialPost }), [halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups, syncStatus]);
  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
};

export const useFarm = (): FarmContextType => { const context = useContext(FarmContext); if (!context) throw new Error('useFarm must be used within a FarmProvider'); return context; };
