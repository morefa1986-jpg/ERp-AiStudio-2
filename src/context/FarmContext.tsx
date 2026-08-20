import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Account, AttendanceRecord, BackupSnapshot, BiometricSession, BroodstockFish, ColdStoragePallet, Customer,
  Employee, Equipment, FeedingRecord, FertilizationBatch, FishTransfer, FarmAuditLog, Hall, IncubatorUnit,
  InventoryItem, InventoryTransaction, JournalEntry, LabSample, LarvalBatch, MortalityRecord, NurseryTank,
  PayrollRecord, Pond, ProcessingBatch, ProformaInvoice, SocialMediaPost, SturgeonSpecies, TreatmentRecord,
  WaterQualityLog,
} from '../types';
import {
  INITIAL_ACCOUNTS, INITIAL_AUDIT_LOGS, INITIAL_BROODSTOCK, INITIAL_COLD_STORAGE, INITIAL_CUSTOMERS,
  INITIAL_EQUIPMENT, INITIAL_FERTILIZATIONS, INITIAL_HALLS, INITIAL_INCUBATORS, INITIAL_INVENTORY,
  INITIAL_INVENTORY_TXS, INITIAL_JOURNALS, INITIAL_LARVAE, INITIAL_PONDS, INITIAL_PROCESSING_BATCHES,
  INITIAL_PROFORMAS, INITIAL_SPECIES, INITIAL_EMPLOYEES,
} from '../data/initialData';
import { BACKUP_SCHEMA_VERSION, checksumBackupData, validateBackupDocument } from '../utils/backupEngine';
import { validateAndExecuteJournalEntry } from '../utils/accountingEngine';
import { calculateFeedingRecommendation, validateFeedingSubmission } from '../utils/feedingEngine';
import { assessWaterSafetyForFeeding } from '../utils/sensorValidation';
import { executeAtomicFishTransfer } from '../utils/transferEngine';

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
  createProcessingBatch: (batch: Omit<ProcessingBatch, 'id' | 'caviarYieldPercent' | 'filletYieldPercent'>) => void;
  createProformaInvoice: (proforma: Omit<ProformaInvoice, 'id' | 'subtotal' | 'grandTotal'>) => void;
  updateProformaStage: (id: string, newStage: ProformaInvoice['stage']) => void;
  createJournalEntry: (entry: Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'>) => { success: boolean; error?: string };
  clockAttendance: (employeeId: string, type: 'in' | 'out', shift: AttendanceRecord['shift']) => void;
  generateMonthlyPayroll: (monthString: string) => void;
  createAuditLog: (action: string, entity: string, entityId: string, details: string, beforeState?: string, afterState?: string) => void;
  createBackupSnapshot: (type?: BackupSnapshot['type']) => BackupSnapshot;
  restoreFromSnapshotJson: (jsonString: string) => { success: boolean; message: string };
  addBroodstock: (fish: Omit<BroodstockFish, 'id'>) => void;
  recordFertilization: (fert: Omit<FertilizationBatch, 'id' | 'fertilizationTimestamp' | 'status'>) => void;
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt' | 'totalOrdersCount' | 'totalSpent' | 'outstandingBalance'>) => void;
  addSocialPost: (post: Omit<SocialMediaPost, 'id' | 'status'>) => void;
}

const FarmContext = createContext<FarmContextType | null>(null);
const ROOT_STORAGE_KEY = 'fathi_erp_state_v2';

function loadRoot(): Record<string, any> {
  try { const raw = localStorage.getItem(ROOT_STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function loadCollection<T>(name: string, legacyKey: string, fallback: T): T {
  try {
    const root = loadRoot();
    if (root && root[name] !== undefined) return root[name] as T;
    const legacy = localStorage.getItem(legacyKey);
    return legacy ? JSON.parse(legacy) as T : fallback;
  } catch { return fallback; }
}
function nextId(prefix: string): string { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function inventoryStatus(item: InventoryItem, quantity: number): InventoryItem['status'] {
  if (item.expiryDate && new Date(item.expiryDate).getTime() < Date.now()) return 'Expired';
  if (quantity <= item.minimumStockThreshold) return 'Critical Low';
  if (quantity <= item.reorderLevel) return 'Low Stock';
  return 'Adequate';
}
function stripBackupData(snapshot: BackupSnapshot): BackupSnapshot { const { data: _data, ...metadata } = snapshot; return metadata; }

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [halls, setHalls] = useState<Hall[]>(() => loadCollection('halls', 'fathi_halls', INITIAL_HALLS));
  const [ponds, setPonds] = useState<Pond[]>(() => loadCollection('ponds', 'fathi_ponds', INITIAL_PONDS));
  const [species, setSpecies] = useState<SturgeonSpecies[]>(() => loadCollection('species', 'fathi_species', INITIAL_SPECIES));
  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>(() => loadCollection('feedingRecords', 'fathi_feeding', []));
  const [biometricSessions, setBiometricSessions] = useState<BiometricSession[]>(() => loadCollection('biometricSessions', 'fathi_biometrics', []));
  const [waterLogs, setWaterLogs] = useState<WaterQualityLog[]>(() => loadCollection('waterLogs', 'fathi_water', []));
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>(() => loadCollection('mortalityRecords', 'fathi_mortality', []));
  const [treatments, setTreatments] = useState<TreatmentRecord[]>(() => loadCollection('treatments', 'fathi_treatments', []));
  const [transfers, setTransfers] = useState<FishTransfer[]>(() => loadCollection('transfers', 'fathi_transfers', []));
  const [broodstock, setBroodstock] = useState<BroodstockFish[]>(() => loadCollection('broodstock', 'fathi_broodstock', INITIAL_BROODSTOCK));
  const [fertilizations, setFertilizations] = useState<FertilizationBatch[]>(() => loadCollection('fertilizations', 'fathi_fert', INITIAL_FERTILIZATIONS));
  const [incubators, setIncubators] = useState<IncubatorUnit[]>(() => loadCollection('incubators', 'fathi_incubators', INITIAL_INCUBATORS));
  const [larvae, setLarvae] = useState<LarvalBatch[]>(() => loadCollection('larvae', 'fathi_larvae', INITIAL_LARVAE));
  const [nurseryTanks, setNurseryTanks] = useState<NurseryTank[]>(() => loadCollection('nurseryTanks', 'fathi_nursery', []));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadCollection('inventory', 'fathi_inventory', INITIAL_INVENTORY));
  const [inventoryTxs, setInventoryTxs] = useState<InventoryTransaction[]>(() => loadCollection('inventoryTxs', 'fathi_inv_txs', INITIAL_INVENTORY_TXS));
  const [labSamples, setLabSamples] = useState<LabSample[]>(() => loadCollection('labSamples', 'fathi_lab', []));
  const [processingBatches, setProcessingBatches] = useState<ProcessingBatch[]>(() => loadCollection('processingBatches', 'fathi_processing', INITIAL_PROCESSING_BATCHES));
  const [coldStorage, setColdStorage] = useState<ColdStoragePallet[]>(() => loadCollection('coldStorage', 'fathi_cold_storage', INITIAL_COLD_STORAGE));
  const [customers, setCustomers] = useState<Customer[]>(() => loadCollection('customers', 'fathi_customers', INITIAL_CUSTOMERS));
  const [proformas, setProformas] = useState<ProformaInvoice[]>(() => loadCollection('proformas', 'fathi_proformas', INITIAL_PROFORMAS));
  const [accounts, setAccounts] = useState<Account[]>(() => loadCollection('accounts', 'fathi_accounts', INITIAL_ACCOUNTS));
  const [journals, setJournals] = useState<JournalEntry[]>(() => loadCollection('journals', 'fathi_journals', INITIAL_JOURNALS));
  const [employees, setEmployees] = useState<Employee[]>(() => loadCollection('employees', 'fathi_employees', INITIAL_EMPLOYEES));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => loadCollection('attendance', 'fathi_attendance', []));
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => loadCollection('payrolls', 'fathi_payrolls', []));
  const [equipment, setEquipment] = useState<Equipment[]>(() => loadCollection('equipment', 'fathi_equipment', INITIAL_EQUIPMENT));
  const [socialPosts, setSocialPosts] = useState<SocialMediaPost[]>(() => loadCollection('socialPosts', 'fathi_social', []));
  const [auditLogs, setAuditLogs] = useState<FarmAuditLog[]>(() => loadCollection('auditLogs', 'fathi_audit', INITIAL_AUDIT_LOGS));
  const [backups, setBackups] = useState<BackupSnapshot[]>(() => loadCollection('backups', 'fathi_backups', []));
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({ status: 'OFFLINE', pendingChangesCount: 0, lastSyncTimestamp: '' });

  useEffect(() => {
    try {
      localStorage.setItem(ROOT_STORAGE_KEY, JSON.stringify({ halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups: backups.map(stripBackupData) }));
    } catch { setSyncStatus((previous) => ({ ...previous, status: 'ERROR' })); }
  }, [halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups]);

  useEffect(() => {
    setHalls((previous) => previous.map((hall) => {
      const hallPonds = ponds.filter((pond) => pond.hallId === hall.id);
      const next = { ...hall, pondCount: hallPonds.length, totalBiomassKg: Number(hallPonds.reduce((sum, pond) => sum + pond.biomassKg, 0).toFixed(2)), totalFishCount: hallPonds.reduce((sum, pond) => sum + pond.fishCount, 0) };
      return hall.pondCount === next.pondCount && hall.totalBiomassKg === next.totalBiomassKg && hall.totalFishCount === next.totalFishCount ? hall : next;
    }));
  }, [ponds]);

  const markLocalChange = () => setSyncStatus((previous) => ({ ...previous, status: 'PENDING_CHANGES', pendingChangesCount: previous.pendingChangesCount + 1 }));
  const createAuditLog = (action: string, entity: string, entityId: string, details: string, beforeState?: string, afterState?: string) => {
    const log: FarmAuditLog = { id: nextId('audit'), timestamp: new Date().toISOString(), userId: 'local-session', userName: 'Local Operator', userRole: 'Authenticated Session', action, entity, entityId, details, beforeState, afterState };
    setAuditLogs((previous) => [log, ...previous].slice(0, 1000));
  };
  const latestWaterTimestamp = (pondId: string): string | undefined => waterLogs.filter((log) => log.pondId === pondId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp;

  const calculateRecommendedFeed = (pondId: string): FeedingRecommendationResult => {
    const pond = ponds.find((item) => item.id === pondId);
    const activeTreatment = pond?.activeTreatmentId ? treatments.find((item) => item.id === pond.activeTreatmentId && item.status === 'ACTIVE') : undefined;
    const base = calculateFeedingRecommendation(pond, species, activeTreatment);
    if (!pond || base.isLocked) return base;
    const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: pond.dissolvedOxygen, waterTemperature: pond.waterTemperature, ph: pond.ph, timestamp: latestWaterTimestamp(pond.id) });
    if (!safety.isSafeForFeeding) return { recommendedKg: 0, isLocked: true, lockReason: safety.feedingProhibitionReason, waterSafety: { isSafe: false, doStatus: safety.doStatus.status, tempStatus: safety.tempStatus.status } };
    return base;
  };

  const recordFeeding = (recordData: Omit<FeedingRecord, 'id' | 'timestamp'>): { success: boolean; error?: string } => {
    const pond = ponds.find((item) => item.id === recordData.pondId);
    if (!pond) return { success: false, error: 'استخر یافت نشد.' };
    const recommendation = calculateRecommendedFeed(recordData.pondId);
    if (recommendation.isLocked) return { success: false, error: recommendation.lockReason || 'تغذیه قفل است.' };
    const validation = validateFeedingSubmission(recordData, pond, inventory);
    if (!validation.success || !validation.feedItem) return { success: false, error: validation.error || 'اعتبارسنجی خوراک ناموفق بود.' };
    const amountKg = validation.normalizedAmountKg;
    const feedItem = validation.feedItem;
    const resultingQuantity = Number((feedItem.quantity - amountKg).toFixed(4));
    if (resultingQuantity < 0) return { success: false, error: 'موجودی خوراک کافی نیست.' };
    const timestamp = new Date().toISOString();
    const newRecord: FeedingRecord = { ...recordData, id: nextId('feed'), timestamp, actualAmountKg: amountKg, unit: 'kg', dissolvedOxygen: pond.dissolvedOxygen, waterTemperature: pond.waterTemperature, feedingStatus: 'ACTIVE' };
    const tx: InventoryTransaction = { id: nextId('invtx'), itemId: feedItem.id, itemName: feedItem.name, sku: feedItem.sku, type: 'Consumption (مصرف روزانه)', quantityChange: -amountKg, resultingQuantity, unit: feedItem.unit, unitPrice: feedItem.purchasePricePerUnit, totalValue: Number((amountKg * feedItem.purchasePricePerUnit).toFixed(2)), referenceDoc: newRecord.id, pondId: pond.id, operator: recordData.operatorName, timestamp, notes: 'Feeding consumption' };
    setInventory((previous) => previous.map((item) => item.id === feedItem.id ? { ...item, quantity: resultingQuantity, status: inventoryStatus(item, resultingQuantity) } : item));
    setInventoryTxs((previous) => [tx, ...previous]);
    setFeedingRecords((previous) => [newRecord, ...previous]);
    setPonds((previous) => previous.map((item) => item.id === pond.id ? { ...item, lastFeedingKg: amountKg, lastFeedingTime: timestamp } : item));
    createAuditLog('CREATE', 'FeedingRecord', newRecord.id, `Feeding ${amountKg} kg registered for ${pond.name}`); markLocalChange();
    return { success: true };
  };

  const stopPondFeeding = (pondId: string, reason: Pond['stopFeedingReason'], details: string, operator: string) => {
    const timestamp = new Date().toISOString();
    setPonds((previous) => previous.map((pond) => pond.id === pondId ? { ...pond, feedingStatus: 'STOPPED', stopFeedingReason: reason || 'Other', stopFeedingDetails: details.trim(), stopFeedingTimestamp: timestamp, stopFeedingUser: operator } : pond));
    createAuditLog('UPDATE', 'Pond', pondId, `Feeding stopped: ${reason || 'Other'} - ${details}`); markLocalChange();
  };

  const resumePondFeeding = (pondId: string, operator: string): { success: boolean; error?: string } => {
    const pond = ponds.find((item) => item.id === pondId);
    if (!pond) return { success: false, error: 'استخر یافت نشد.' };
    if (pond.activeTreatmentId && treatments.some((treatment) => treatment.id === pond.activeTreatmentId && treatment.status === 'ACTIVE')) return { success: false, error: 'درمان فعال است؛ تغذیه قابل وصل نیست.' };
    const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: pond.dissolvedOxygen, waterTemperature: pond.waterTemperature, ph: pond.ph, timestamp: latestWaterTimestamp(pond.id) });
    if (!safety.isSafeForFeeding) return { success: false, error: safety.feedingProhibitionReason || 'کیفیت آب ایمن نیست.' };
    setPonds((previous) => previous.map((item) => item.id === pondId ? { ...item, feedingStatus: 'ACTIVE', stopFeedingReason: undefined, stopFeedingDetails: undefined, stopFeedingTimestamp: undefined, stopFeedingUser: operator } : item));
    createAuditLog('UPDATE', 'Pond', pondId, 'Feeding resumed after safety validation'); markLocalChange(); return { success: true };
  };

  const recordMortality = (record: Omit<MortalityRecord, 'id' | 'timestamp'>) => {
    const pond = ponds.find((item) => item.id === record.pondId);
    if (!pond || !Number.isInteger(record.count) || record.count <= 0 || record.count > pond.fishCount || !Number.isFinite(record.estimatedWeightKg) || record.estimatedWeightKg < 0 || record.estimatedWeightKg > pond.biomassKg) { createAuditLog('REJECT', 'MortalityRecord', record.pondId, 'Invalid mortality transaction rejected'); return; }
    const newRecord: MortalityRecord = { ...record, id: nextId('mort'), timestamp: new Date().toISOString() };
    const newCount = pond.fishCount - record.count; const newBiomass = Number((pond.biomassKg - record.estimatedWeightKg).toFixed(2));
    setMortalityRecords((previous) => [newRecord, ...previous]);
    setPonds((previous) => previous.map((item) => item.id === pond.id ? { ...item, fishCount: newCount, biomassKg: newBiomass, averageWeightKg: newCount > 0 ? Number((newBiomass / newCount).toFixed(3)) : 0, dailyMortalityCount: item.dailyMortalityCount + record.count } : item));
    createAuditLog('CREATE', 'MortalityRecord', newRecord.id, `${record.count} mortality recorded in ${pond.name}`); markLocalChange();
  };

  const recordBiometry = (session: Omit<BiometricSession, 'id' | 'averageWeightKg' | 'minWeightKg' | 'maxWeightKg' | 'estimatedBiomassKg' | 'estimatedCount' | 'growthRateKgPerDay' | 'sgr'>) => {
    const pond = ponds.find((item) => item.id === session.pondId); const validSamples = session.samples.filter((sample) => Number.isFinite(sample.weightKg) && sample.weightKg > 0); if (!pond || !validSamples.length) return;
    const weights = validSamples.map((sample) => sample.weightKg); const average = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const previousSession = biometricSessions.filter((item) => item.pondId === pond.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const previousAverage = previousSession?.averageWeightKg || pond.averageWeightKg || average; const previousDate = previousSession?.date || pond.lastBiometryDate;
    const days = Math.max(1, Math.round((new Date(session.date).getTime() - new Date(previousDate).getTime()) / 86_400_000)); const growthRate = (average - previousAverage) / days; const sgr = previousAverage > 0 ? (Math.log(average / previousAverage) / days) * 100 : 0; const estimatedBiomass = Number((pond.fishCount * average).toFixed(2));
    const newSession: BiometricSession = { ...session, id: nextId('bio'), sampleCount: validSamples.length, samples: validSamples, averageWeightKg: Number(average.toFixed(3)), minWeightKg: Math.min(...weights), maxWeightKg: Math.max(...weights), estimatedBiomassKg: estimatedBiomass, estimatedCount: pond.fishCount, previousAvgWeightKg: previousAverage, daysSinceLastBiometry: days, growthRateKgPerDay: Number(growthRate.toFixed(4)), sgr: Number(sgr.toFixed(3)) };
    setBiometricSessions((previous) => [newSession, ...previous]); setPonds((previous) => previous.map((item) => item.id === pond.id ? { ...item, averageWeightKg: newSession.averageWeightKg, biomassKg: estimatedBiomass, lastBiometryDate: session.date } : item)); createAuditLog('CREATE', 'BiometricSession', newSession.id, `Biometry recorded for ${pond.name}`); markLocalChange();
  };

  const recordWaterTest = (test: Omit<WaterQualityLog, 'id' | 'timestamp'>) => {
    const pond = ponds.find((item) => item.id === test.pondId); if (!pond) return; const timestamp = new Date().toISOString();
    const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: test.dissolvedOxygen, waterTemperature: test.temperature, ph: test.ph, ammonia: test.ammonia, nitrite: test.nitrite, timestamp });
    const invalid = !safety.doStatus.isValid || !safety.tempStatus.isValid || safety.phStatus?.isValid === false; const severity: WaterQualityLog['severity'] = safety.isCriticalAlert ? 'CRITICAL' : safety.isSafeForFeeding ? 'INFO' : 'HIGH'; const sensorStatus: WaterQualityLog['sensorStatus'] = invalid ? 'INVALID' : 'VALID';
    const newLog: WaterQualityLog = { ...test, id: nextId('water'), timestamp, severity, sensorStatus, alertMessage: safety.feedingProhibitionReason }; setWaterLogs((previous) => [newLog, ...previous]);
    setPonds((previous) => previous.map((item) => {
      if (item.id !== pond.id) return item;
      if (invalid) return { ...item, feedingStatus: 'STOPPED', stopFeedingReason: 'Other', stopFeedingDetails: safety.feedingProhibitionReason || 'Invalid sensor data', stopFeedingTimestamp: timestamp };
      return { ...item, dissolvedOxygen: test.dissolvedOxygen, waterTemperature: test.temperature, ph: test.ph, feedingStatus: safety.isSafeForFeeding ? item.feedingStatus : 'STOPPED', stopFeedingReason: safety.isSafeForFeeding ? item.stopFeedingReason : (test.temperature < 4 ? 'Low Temperature' : test.dissolvedOxygen < 4 ? 'Low Oxygen' : 'Other'), stopFeedingDetails: safety.isSafeForFeeding ? item.stopFeedingDetails : safety.feedingProhibitionReason, stopFeedingTimestamp: safety.isSafeForFeeding ? item.stopFeedingTimestamp : timestamp };
    })); createAuditLog('CREATE', 'WaterQualityLog', newLog.id, safety.isSafeForFeeding ? 'Water quality recorded' : `Water safety alert: ${safety.feedingProhibitionReason}`); markLocalChange();
  };

  const recordTreatment = (treatment: Omit<TreatmentRecord, 'id'>) => {
    if (!Number.isFinite(treatment.dose) || treatment.dose <= 0 || Number.isNaN(new Date(treatment.startDate).getTime())) return; const id = nextId('treat'); const newTreatment: TreatmentRecord = { ...treatment, id }; setTreatments((previous) => [newTreatment, ...previous]);
    if (treatment.status === 'ACTIVE') setPonds((previous) => previous.map((pond) => pond.id === treatment.pondId ? { ...pond, activeTreatmentId: id, feedingStatus: 'STOPPED', stopFeedingReason: 'Treatment', stopFeedingDetails: `${treatment.drugName}: ${treatment.diagnosis}`, stopFeedingTimestamp: new Date().toISOString(), stopFeedingUser: treatment.veterinarian } : pond));
    createAuditLog('CREATE', 'TreatmentRecord', id, `${treatment.drugName} treatment recorded for ${treatment.pondName}`); markLocalChange();
  };

  const executeAtomicTransfer = (transferData: Omit<FishTransfer, 'id' | 'status'>): { success: boolean; error?: string } => {
    const result = executeAtomicFishTransfer(transferData, ponds); if (!result.success || !result.updatedPonds || !result.newTransfer) return { success: false, error: result.error }; setPonds(result.updatedPonds); setTransfers((previous) => [result.newTransfer!, ...previous]); createAuditLog('CREATE', 'FishTransfer', result.newTransfer.id, `${transferData.sourceName} → ${transferData.destinationName}: ${transferData.fishCount} fish`); markLocalChange(); return { success: true };
  };

  const addInventoryTransaction = (tx: Omit<InventoryTransaction, 'id' | 'timestamp' | 'resultingQuantity'>) => {
    const item = inventory.find((row) => row.id === tx.itemId || row.sku === tx.sku); if (!item || !Number.isFinite(tx.quantityChange) || tx.quantityChange === 0 || (tx.unit && tx.unit !== item.unit)) return; const resultingQuantity = Number((item.quantity + tx.quantityChange).toFixed(4));
    if (resultingQuantity < 0) { createAuditLog('REJECT', 'InventoryTransaction', item.id, 'Inventory transaction rejected because it would create negative stock'); return; }
    const newTx: InventoryTransaction = { ...tx, id: nextId('invtx'), timestamp: new Date().toISOString(), resultingQuantity, itemId: item.id, itemName: item.name, sku: item.sku };
    setInventory((previous) => previous.map((row) => row.id === item.id ? { ...row, quantity: resultingQuantity, status: inventoryStatus(row, resultingQuantity) } : row)); setInventoryTxs((previous) => [newTx, ...previous]); createAuditLog('CREATE', 'InventoryTransaction', newTx.id, `${tx.quantityChange} ${item.unit} ${item.sku}`); markLocalChange();
  };

  const createProcessingBatch = (batch: Omit<ProcessingBatch, 'id' | 'caviarYieldPercent' | 'filletYieldPercent'>) => {
    if (!Number.isInteger(batch.fishCount) || batch.fishCount <= 0 || !Number.isFinite(batch.liveBiomassKg) || batch.liveBiomassKg <= 0) return; const outputs = [batch.caviarYieldKg, batch.filletMeatYieldKg, batch.smokedMeatYieldKg, batch.byProductAndWasteKg]; if (outputs.some((value) => !Number.isFinite(value) || value < 0) || outputs.reduce((sum, value) => sum + value, 0) > batch.liveBiomassKg + 0.1) return;
    const newBatch: ProcessingBatch = { ...batch, id: nextId('proc'), caviarYieldPercent: Number(((batch.caviarYieldKg / batch.liveBiomassKg) * 100).toFixed(2)), filletYieldPercent: Number(((batch.filletMeatYieldKg / batch.liveBiomassKg) * 100).toFixed(2)) }; setProcessingBatches((previous) => [newBatch, ...previous]); createAuditLog('CREATE', 'ProcessingBatch', newBatch.id, `Processing batch ${batch.batchCode} created`); markLocalChange();
  };

  const createProformaInvoice = (proforma: Omit<ProformaInvoice, 'id' | 'subtotal' | 'grandTotal'>) => {
    if (!proforma.items.length || proforma.items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return; const subtotal = proforma.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); const taxTotal = proforma.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxPercent) / 100, 0); const discountTotal = proforma.items.reduce((sum, item) => sum + Math.max(0, item.discount), 0); const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);
    const newProforma: ProformaInvoice = { ...proforma, id: nextId('prof'), subtotal: Number(subtotal.toFixed(2)), taxTotal: Number(taxTotal.toFixed(2)), discountTotal: Number(discountTotal.toFixed(2)), grandTotal: Number(grandTotal.toFixed(2)) }; setProformas((previous) => [newProforma, ...previous]); createAuditLog('CREATE', 'ProformaInvoice', newProforma.id, `Proforma ${newProforma.invoiceNumber} created`); markLocalChange();
  };
  const updateProformaStage = (id: string, newStage: ProformaInvoice['stage']) => { setProformas((previous) => previous.map((row) => row.id === id ? { ...row, stage: newStage } : row)); createAuditLog('UPDATE', 'ProformaInvoice', id, `Stage changed to ${newStage}`); markLocalChange(); };
  const createJournalEntry = (entry: Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'>): { success: boolean; error?: string } => { const result = validateAndExecuteJournalEntry(entry, accounts, journals); if (!result.success || !result.newEntry || !result.updatedAccounts) return { success: false, error: result.error }; setAccounts(result.updatedAccounts); setJournals((previous) => [result.newEntry!, ...previous]); createAuditLog('CREATE', 'JournalEntry', result.newEntry.id, `Balanced journal ${result.newEntry.entryNumber} posted`); markLocalChange(); return { success: true }; };

  const clockAttendance = (employeeId: string, type: 'in' | 'out', shift: AttendanceRecord['shift']) => {
    const employee = employees.find((row) => row.id === employeeId && row.status === 'Active'); if (!employee) return; const now = new Date(); const date = now.toISOString().slice(0, 10);
    if (type === 'in') { if (attendance.some((row) => row.employeeId === employeeId && row.date === date && !row.clockOutTime)) return; const record: AttendanceRecord = { id: nextId('att'), employeeId, employeeName: employee.fullName, date, clockInTime: now.toISOString(), shift, regularHours: 0, overtimeHours: 0, status: 'Present' }; setAttendance((previous) => [record, ...previous]); }
    else setAttendance((previous) => { const open = previous.find((row) => row.employeeId === employeeId && row.date === date && !row.clockOutTime); if (!open) return previous; const hours = Math.max(0, (now.getTime() - new Date(open.clockInTime).getTime()) / 3_600_000); return previous.map((row) => row.id === open.id ? { ...row, clockOutTime: now.toISOString(), regularHours: Number(Math.min(8, hours).toFixed(2)), overtimeHours: Number(Math.max(0, hours - 8).toFixed(2)) } : row); });
    createAuditLog('CREATE', 'Attendance', employeeId, `Clock ${type}`); markLocalChange();
  };

  const generateMonthlyPayroll = (monthString: string) => {
    if (!/^\d{4}-\d{2}$/.test(monthString)) return; const generated: PayrollRecord[] = employees.filter((employee) => employee.status === 'Active').map((employee) => { const employeeAttendance = attendance.filter((row) => row.employeeId === employee.id && row.date.startsWith(monthString)); const overtimeHours = employeeAttendance.reduce((sum, row) => sum + row.overtimeHours, 0); const hourlyRate = employee.baseSalary / 240; const overtimePay = Number((overtimeHours * hourlyRate * 1.4).toFixed(0)); const grossSalary = employee.baseSalary + overtimePay; return { id: nextId('pay'), payrollMonth: monthString, employeeId: employee.id, employeeName: employee.fullName, department: employee.department, baseSalary: employee.baseSalary, overtimePay, shiftBonus: 0, hardshipAllowance: 0, grossSalary, socialSecurityInsurance: 0, incomeTax: 0, loanDeduction: 0, netPay: grossSalary, currency: employee.currency, paymentStatus: 'Calculated' }; }); setPayrolls((previous) => [...generated, ...previous.filter((row) => row.payrollMonth !== monthString)]); createAuditLog('CREATE', 'Payroll', monthString, 'Draft payroll generated from attendance; statutory deductions require configured policy'); markLocalChange();
  };

  const buildBackupData = (): Record<string, unknown> => ({ halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs });
  const createBackupSnapshot = (type: BackupSnapshot['type'] = 'Manual Export'): BackupSnapshot => { const data = buildBackupData(); const serialized = JSON.stringify(data); const timestamp = new Date().toISOString(); const snapshot: BackupSnapshot = { id: nextId('backup'), filename: `fathi-aqua-erp-${timestamp.slice(0, 10)}.json`, timestamp, version: '6.0.5', schemaVersion: BACKUP_SCHEMA_VERSION, dataSizeKb: Number((new Blob([serialized]).size / 1024).toFixed(2)), tablesCount: Object.keys(data).length, checksum: checksumBackupData(data), checksumAlgorithm: 'FNV1A32', creator: 'Authenticated Local Session', type, data }; setBackups((previous) => [stripBackupData(snapshot), ...previous].slice(0, 100)); return snapshot; };
  const restoreFromSnapshotJson = (jsonString: string): { success: boolean; message: string } => {
    try {
      const validation = validateBackupDocument(JSON.parse(jsonString)); if (!validation.ok || !validation.data) return { success: false, message: validation.error || 'فایل پشتیبان معتبر نیست.' }; createBackupSnapshot('Pre-Restore Safety Snapshot'); const data = validation.data; const array = <T,>(key: string): T[] => Array.isArray(data[key]) ? data[key] as T[] : [];
      setHalls(array<Hall>('halls')); setPonds(array<Pond>('ponds')); setSpecies(array<SturgeonSpecies>('species')); setFeedingRecords(array<FeedingRecord>('feedingRecords')); setBiometricSessions(array<BiometricSession>('biometricSessions')); setWaterLogs(array<WaterQualityLog>('waterLogs')); setMortalityRecords(array<MortalityRecord>('mortalityRecords')); setTreatments(array<TreatmentRecord>('treatments')); setTransfers(array<FishTransfer>('transfers')); setBroodstock(array<BroodstockFish>('broodstock')); setFertilizations(array<FertilizationBatch>('fertilizations')); setIncubators(array<IncubatorUnit>('incubators')); setLarvae(array<LarvalBatch>('larvae')); setNurseryTanks(array<NurseryTank>('nurseryTanks')); setInventory(array<InventoryItem>('inventory')); setInventoryTxs(array<InventoryTransaction>('inventoryTxs')); setLabSamples(array<LabSample>('labSamples')); setProcessingBatches(array<ProcessingBatch>('processingBatches')); setColdStorage(array<ColdStoragePallet>('coldStorage')); setCustomers(array<Customer>('customers')); setProformas(array<ProformaInvoice>('proformas')); setAccounts(array<Account>('accounts')); setJournals(array<JournalEntry>('journals')); setEmployees(array<Employee>('employees')); setAttendance(array<AttendanceRecord>('attendance')); setPayrolls(array<PayrollRecord>('payrolls')); setEquipment(array<Equipment>('equipment')); setSocialPosts(array<SocialMediaPost>('socialPosts')); setAuditLogs(array<FarmAuditLog>('auditLogs')); markLocalChange(); return { success: true, message: 'بازیابی با اعتبارسنجی ساختار و چک‌سام انجام شد.' };
    } catch { return { success: false, message: 'JSON فایل پشتیبان قابل خواندن نیست.' }; }
  };

  const addBroodstock = (fish: Omit<BroodstockFish, 'id'>) => { if (!fish.chipNumber.trim() || broodstock.some((row) => row.chipNumber === fish.chipNumber || row.plateNumber === fish.plateNumber) || !Number.isFinite(fish.weightKg) || fish.weightKg <= 0) return; const newFish: BroodstockFish = { ...fish, id: nextId('brood') }; setBroodstock((previous) => [newFish, ...previous]); createAuditLog('CREATE', 'Broodstock', newFish.id, `Broodstock ${fish.chipNumber} registered`); markLocalChange(); };
  const recordFertilization = (fert: Omit<FertilizationBatch, 'id' | 'fertilizationTimestamp' | 'status'>) => { const parentsExist = fert.femaleIds.every((id) => broodstock.some((fish) => fish.id === id && fish.sex === 'Female')) && fert.maleIds.every((id) => broodstock.some((fish) => fish.id === id && fish.sex === 'Male')); if (!parentsExist || !Number.isFinite(fert.fertilizationRatePercent) || fert.fertilizationRatePercent < 0 || fert.fertilizationRatePercent > 100) return; const newBatch: FertilizationBatch = { ...fert, id: nextId('fert'), fertilizationTimestamp: new Date().toISOString(), status: 'Incubating' }; setFertilizations((previous) => [newBatch, ...previous]); createAuditLog('CREATE', 'FertilizationBatch', newBatch.id, `Fertilization ${fert.batchCode} registered`); markLocalChange(); };
  const addCustomer = (cust: Omit<Customer, 'id' | 'createdAt' | 'totalOrdersCount' | 'totalSpent' | 'outstandingBalance'>) => { if (!cust.name.trim() || (cust.email && customers.some((row) => row.email.toLowerCase() === cust.email.toLowerCase()))) return; const customer: Customer = { ...cust, id: nextId('cust'), createdAt: new Date().toISOString(), totalOrdersCount: 0, totalSpent: 0, outstandingBalance: 0 }; setCustomers((previous) => [customer, ...previous]); createAuditLog('CREATE', 'Customer', customer.id, `Customer ${customer.name} created`); markLocalChange(); };
  const addSocialPost = (post: Omit<SocialMediaPost, 'id' | 'status'>) => { const newPost: SocialMediaPost = { ...post, id: nextId('post'), status: 'Draft' }; setSocialPosts((previous) => [newPost, ...previous]); createAuditLog('CREATE', 'SocialMediaPost', newPost.id, `Draft post ${post.title} created`); markLocalChange(); };

  const value = useMemo<FarmContextType>(() => ({ halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups, syncStatus, calculateRecommendedFeed, recordFeeding, stopPondFeeding, resumePondFeeding, recordMortality, recordBiometry, recordWaterTest, recordTreatment, executeAtomicTransfer, addInventoryTransaction, createProcessingBatch, createProformaInvoice, updateProformaStage, createJournalEntry, clockAttendance, generateMonthlyPayroll, createAuditLog, createBackupSnapshot, restoreFromSnapshotJson, addBroodstock, recordFertilization, addCustomer, addSocialPost }), [halls, ponds, species, feedingRecords, biometricSessions, waterLogs, mortalityRecords, treatments, transfers, broodstock, fertilizations, incubators, larvae, nurseryTanks, inventory, inventoryTxs, labSamples, processingBatches, coldStorage, customers, proformas, accounts, journals, employees, attendance, payrolls, equipment, socialPosts, auditLogs, backups, syncStatus]);
  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
};

export const useFarm = (): FarmContextType => { const context = useContext(FarmContext); if (!context) throw new Error('useFarm must be used within a FarmProvider'); return context; };
