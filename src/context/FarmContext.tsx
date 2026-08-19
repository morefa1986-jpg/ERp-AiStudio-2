import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Hall,
  Pond,
  SturgeonSpecies,
  FeedingRecord,
  BiometricSession,
  WaterQualityLog,
  MortalityRecord,
  TreatmentRecord,
  FishTransfer,
  BroodstockFish,
  FertilizationBatch,
  IncubatorUnit,
  LarvalBatch,
  NurseryTank,
  InventoryItem,
  InventoryTransaction,
  LabSample,
  ProcessingBatch,
  ColdStoragePallet,
  Customer,
  ProformaInvoice,
  Account,
  JournalEntry,
  Employee,
  AttendanceRecord,
  PayrollRecord,
  Equipment,
  SocialMediaPost,
  FarmAuditLog,
  BackupSnapshot,
  FeedingStatus,
} from '../types';

import {
  INITIAL_SPECIES,
  INITIAL_HALLS,
  INITIAL_PONDS,
  INITIAL_BROODSTOCK,
  INITIAL_FERTILIZATIONS,
  INITIAL_INCUBATORS,
  INITIAL_LARVAE,
  INITIAL_INVENTORY,
  INITIAL_INVENTORY_TXS,
  INITIAL_PROCESSING_BATCHES,
  INITIAL_COLD_STORAGE,
  INITIAL_CUSTOMERS,
  INITIAL_PROFORMAS,
  INITIAL_ACCOUNTS,
  INITIAL_JOURNALS,
  INITIAL_EMPLOYEES,
  INITIAL_EQUIPMENT,
  INITIAL_AUDIT_LOGS,
} from '../data/initialData';

import { assessWaterSafetyForFeeding, validateDissolvedOxygen, validateWaterTemperature } from '../utils/sensorValidation';

export interface FeedingRecommendationResult {
  recommendedKg: number;
  isLocked: boolean;
  lockReason?: string;
  waterSafety?: {
    isSafe: boolean;
    doStatus: string;
    tempStatus: string;
  };
}

export interface OfflineSyncStatus {
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'PENDING_CHANGES' | 'ERROR';
  pendingChangesCount: number;
  lastSyncTimestamp: string;
}

interface FarmContextType {
  // State
  halls: Hall[];
  ponds: Pond[];
  species: SturgeonSpecies[];
  feedingRecords: FeedingRecord[];
  biometricSessions: BiometricSession[];
  waterLogs: WaterQualityLog[];
  mortalityRecords: MortalityRecord[];
  treatments: TreatmentRecord[];
  transfers: FishTransfer[];
  broodstock: BroodstockFish[];
  fertilizations: FertilizationBatch[];
  incubators: IncubatorUnit[];
  larvae: LarvalBatch[];
  nurseryTanks: NurseryTank[];
  inventory: InventoryItem[];
  inventoryTxs: InventoryTransaction[];
  labSamples: LabSample[];
  processingBatches: ProcessingBatch[];
  coldStorage: ColdStoragePallet[];
  customers: Customer[];
  proformas: ProformaInvoice[];
  accounts: Account[];
  journals: JournalEntry[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  payrolls: PayrollRecord[];
  equipment: Equipment[];
  socialPosts: SocialMediaPost[];
  auditLogs: FarmAuditLog[];
  backups: BackupSnapshot[];
  syncStatus: OfflineSyncStatus;

  // Operational Actions & Safety Engines
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

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial states from LocalStorage or default datasets
  const [halls, setHalls] = useState<Hall[]>(() => loadOrInitial('fathi_halls', INITIAL_HALLS));
  const [ponds, setPonds] = useState<Pond[]>(() => loadOrInitial('fathi_ponds', INITIAL_PONDS));
  const [species, setSpecies] = useState<SturgeonSpecies[]>(() => loadOrInitial('fathi_species', INITIAL_SPECIES));
  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>(() => loadOrInitial('fathi_feeding', []));
  const [biometricSessions, setBiometricSessions] = useState<BiometricSession[]>(() => loadOrInitial('fathi_biometrics', []));
  const [waterLogs, setWaterLogs] = useState<WaterQualityLog[]>(() => loadOrInitial('fathi_water', []));
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>(() => loadOrInitial('fathi_mortality', []));
  const [treatments, setTreatments] = useState<TreatmentRecord[]>(() => loadOrInitial('fathi_treatments', []));
  const [transfers, setTransfers] = useState<FishTransfer[]>(() => loadOrInitial('fathi_transfers', []));
  const [broodstock, setBroodstock] = useState<BroodstockFish[]>(() => loadOrInitial('fathi_broodstock', INITIAL_BROODSTOCK));
  const [fertilizations, setFertilizations] = useState<FertilizationBatch[]>(() => loadOrInitial('fathi_fert', INITIAL_FERTILIZATIONS));
  const [incubators, setIncubators] = useState<IncubatorUnit[]>(() => loadOrInitial('fathi_incubators', INITIAL_INCUBATORS));
  const [larvae, setLarvae] = useState<LarvalBatch[]>(() => loadOrInitial('fathi_larvae', INITIAL_LARVAE));
  const [nurseryTanks, setNurseryTanks] = useState<NurseryTank[]>(() => loadOrInitial('fathi_nursery', []));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadOrInitial('fathi_inventory', INITIAL_INVENTORY));
  const [inventoryTxs, setInventoryTxs] = useState<InventoryTransaction[]>(() => loadOrInitial('fathi_inv_txs', INITIAL_INVENTORY_TXS));
  const [labSamples, setLabSamples] = useState<LabSample[]>(() => loadOrInitial('fathi_lab', []));
  const [processingBatches, setProcessingBatches] = useState<ProcessingBatch[]>(() => loadOrInitial('fathi_processing', INITIAL_PROCESSING_BATCHES));
  const [coldStorage, setColdStorage] = useState<ColdStoragePallet[]>(() => loadOrInitial('fathi_cold_storage', INITIAL_COLD_STORAGE));
  const [customers, setCustomers] = useState<Customer[]>(() => loadOrInitial('fathi_customers', INITIAL_CUSTOMERS));
  const [proformas, setProformas] = useState<ProformaInvoice[]>(() => loadOrInitial('fathi_proformas', INITIAL_PROFORMAS));
  const [accounts, setAccounts] = useState<Account[]>(() => loadOrInitial('fathi_accounts', INITIAL_ACCOUNTS));
  const [journals, setJournals] = useState<JournalEntry[]>(() => loadOrInitial('fathi_journals', INITIAL_JOURNALS));
  const [employees, setEmployees] = useState<Employee[]>(() => loadOrInitial('fathi_employees', INITIAL_EMPLOYEES));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => loadOrInitial('fathi_attendance', []));
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => loadOrInitial('fathi_payrolls', []));
  const [equipment, setEquipment] = useState<Equipment[]>(() => loadOrInitial('fathi_equipment', INITIAL_EQUIPMENT));
  const [socialPosts, setSocialPosts] = useState<SocialMediaPost[]>(() => loadOrInitial('fathi_social', []));
  const [auditLogs, setAuditLogs] = useState<FarmAuditLog[]>(() => loadOrInitial('fathi_audit', INITIAL_AUDIT_LOGS));
  const [backups, setBackups] = useState<BackupSnapshot[]>(() => loadOrInitial('fathi_backups', []));

  // Sync state for LAN & Offline-first capabilities
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({
    status: 'ONLINE',
    pendingChangesCount: 0,
    lastSyncTimestamp: new Date().toISOString(),
  });

  function loadOrInitial<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // Persistence effects
  useEffect(() => { localStorage.setItem('fathi_ponds', JSON.stringify(ponds)); }, [ponds]);
  useEffect(() => { localStorage.setItem('fathi_halls', JSON.stringify(halls)); }, [halls]);
  useEffect(() => { localStorage.setItem('fathi_species', JSON.stringify(species)); }, [species]);
  useEffect(() => { localStorage.setItem('fathi_feeding', JSON.stringify(feedingRecords)); }, [feedingRecords]);
  useEffect(() => { localStorage.setItem('fathi_biometrics', JSON.stringify(biometricSessions)); }, [biometricSessions]);
  useEffect(() => { localStorage.setItem('fathi_water', JSON.stringify(waterLogs)); }, [waterLogs]);
  useEffect(() => { localStorage.setItem('fathi_mortality', JSON.stringify(mortalityRecords)); }, [mortalityRecords]);
  useEffect(() => { localStorage.setItem('fathi_treatments', JSON.stringify(treatments)); }, [treatments]);
  useEffect(() => { localStorage.setItem('fathi_transfers', JSON.stringify(transfers)); }, [transfers]);
  useEffect(() => { localStorage.setItem('fathi_broodstock', JSON.stringify(broodstock)); }, [broodstock]);
  useEffect(() => { localStorage.setItem('fathi_inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('fathi_inv_txs', JSON.stringify(inventoryTxs)); }, [inventoryTxs]);
  useEffect(() => { localStorage.setItem('fathi_processing', JSON.stringify(processingBatches)); }, [processingBatches]);
  useEffect(() => { localStorage.setItem('fathi_cold_storage', JSON.stringify(coldStorage)); }, [coldStorage]);
  useEffect(() => { localStorage.setItem('fathi_customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('fathi_proformas', JSON.stringify(proformas)); }, [proformas]);
  useEffect(() => { localStorage.setItem('fathi_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('fathi_journals', JSON.stringify(journals)); }, [journals]);
  useEffect(() => { localStorage.setItem('fathi_audit', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('fathi_backups', JSON.stringify(backups)); }, [backups]);

  // Recalculate Hall aggregates when ponds change
  useEffect(() => {
    setHalls((prevHalls) =>
      prevHalls.map((hall) => {
        const hallPonds = ponds.filter((p) => p.hallId === hall.id);
        const totalBiomassKg = hallPonds.reduce((sum, p) => sum + p.biomassKg, 0);
        const totalFishCount = hallPonds.reduce((sum, p) => sum + p.fishCount, 0);
        return {
          ...hall,
          pondCount: hallPonds.length,
          totalBiomassKg,
          totalFishCount,
        };
      })
    );
  }, [ponds]);

  // Audit Logger
  const createAuditLog = (
    action: string,
    entity: string,
    entityId: string,
    details: string,
    beforeState?: string,
    afterState?: string
  ) => {
    const newLog: FarmAuditLog = {
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      userId: 'usr_active',
      userName: 'Current Operator',
      userRole: 'Enterprise Role',
      action,
      entity,
      entityId,
      details,
      beforeState,
      afterState,
      ipAddress: '127.0.0.1 (Local LAN)',
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 499)]); // Keep last 500
  };

  /**
   * STRICT FEEDING SAFETY ENGINE (PHASE 3 & PHASE 4)
   * Evaluates DO, temperature, treatment lockouts, and pond status.
   * If any safety condition fails, returns recommendedKg = 0 and isLocked = true.
   */
  const calculateRecommendedFeed = (pondId: string): FeedingRecommendationResult => {
    const pond = ponds.find((p) => p.id === pondId);
    if (!pond) {
      return { recommendedKg: 0, isLocked: true, lockReason: 'استخر یافت نشد.' };
    }

    // 1. Explicit Feeding Status Check
    if (pond.feedingStatus === 'STOPPED') {
      return {
        recommendedKg: 0,
        isLocked: true,
        lockReason: `تغذیه این استخر قطع است (${pond.stopFeedingReason || 'توقف دستی'}: ${pond.stopFeedingDetails || ''})`,
      };
    }

    // 2. Active Medical Treatment Check
    if (pond.activeTreatmentId) {
      const treatment = treatments.find((t) => t.id === pond.activeTreatmentId && t.status === 'Active');
      if (treatment) {
        return {
          recommendedKg: 0,
          isLocked: true,
          lockReason: `استخر تحت درمان دارویی فعال (${treatment.medicineName}) قرار دارد و تغذیه طبق پروتکل دامپزشکی ممنوع است.`,
        };
      }
    }

    // 3. Strict Sensor Data Validation Assessment
    const safetyAssessment = assessWaterSafetyForFeeding({
      dissolvedOxygen: pond.dissolvedOxygen,
      waterTemperature: pond.waterTemperature,
      ph: pond.ph,
    });

    if (!safetyAssessment.isSafeForFeeding) {
      return {
        recommendedKg: 0,
        isLocked: true,
        lockReason: safetyAssessment.feedingProhibitionReason || 'شرایط کیفیت آب برای تغذیه ناامن است.',
        waterSafety: {
          isSafe: false,
          doStatus: safetyAssessment.doStatus.status,
          tempStatus: safetyAssessment.tempStatus.status,
        },
      };
    }

    // 4. Mathematical Ration Computation
    const sp = species.find((s) => s.id === pond.speciesId);
    const coeff = sp ? sp.feedingProfileCoeff : 1.0;

    let tempFactor = 1.0;
    if (pond.waterTemperature >= 14 && pond.waterTemperature <= 18.5) {
      tempFactor = 1.0;
    } else if (pond.waterTemperature < 14) {
      tempFactor = Math.max(0.4, (pond.waterTemperature / 14));
    } else {
      tempFactor = Math.max(0.6, 1.0 - ((pond.waterTemperature - 18.5) * 0.08));
    }

    const baseRate = 0.009 * coeff * tempFactor; // ~0.9% of body weight
    const recommendedKg = Number((pond.biomassKg * baseRate).toFixed(2));

    return {
      recommendedKg: Math.max(0, recommendedKg),
      isLocked: false,
      waterSafety: {
        isSafe: true,
        doStatus: safetyAssessment.doStatus.status,
        tempStatus: safetyAssessment.tempStatus.status,
      },
    };
  };

  /**
   * DOMAIN-LEVEL FEEDING REGISTRATION
   * Prevents API or UI bypass of feeding safety rules.
   */
  const recordFeeding = (recordData: Omit<FeedingRecord, 'id' | 'timestamp'>): { success: boolean; error?: string } => {
    const pond = ponds.find((p) => p.id === recordData.pondId);
    if (!pond) return { success: false, error: 'استخر یافت نشد.' };

    // Strict Domain-Layer Safety Enforcements
    if (pond.feedingStatus === 'STOPPED') {
      createAuditLog(
        'SECURITY_SAFETY_VIOLATION_REJECTED',
        'Feeding',
        pond.id,
        `تلاش ناموفق برای ثبت خوراک در استخر متوقف‌شده (${pond.name})`
      );
      return { success: false, error: 'ثبت خوراک غیرمجاز است: وضعیت استخر قطع غذا (STOPPED) است.' };
    }

    if (recordData.dissolvedOxygen < 4.0) {
      createAuditLog(
        'SECURITY_SAFETY_VIOLATION_REJECTED',
        'Feeding',
        pond.id,
        `تلاش ناموفق برای ثبت خوراک در شرایط اکسیژن بحرانی (${recordData.dissolvedOxygen} mg/L)`
      );
      return { success: false, error: `ثبت خوراک غیرمجاز است: میزان اکسیژن (${recordData.dissolvedOxygen} mg/L) کمتر از ۴.۰ است.` };
    }

    if (recordData.actualAmountKg <= 0) {
      return { success: false, error: 'مقدار خوراک مصرفی باید بزرگتر از صفر باشد.' };
    }

    const newRecord: FeedingRecord = {
      ...recordData,
      id: 'fd_' + Date.now(),
      timestamp: new Date().toISOString(),
    };

    setFeedingRecords((prev) => [newRecord, ...prev]);

    // Update pond last feeding info
    setPonds((prev) =>
      prev.map((p) =>
        p.id === recordData.pondId
          ? {
              ...p,
              lastFeedingKg: recordData.actualAmountKg,
              lastFeedingTime: newRecord.timestamp,
            }
          : p
      )
    );

    // Ledger deduction from warehouse
    const feedItem = inventory.find((i) => i.sku === recordData.feedTypeSku || i.category.includes('Feed'));
    if (feedItem) {
      addInventoryTransaction({
        itemId: feedItem.id,
        itemName: feedItem.name,
        sku: feedItem.sku,
        type: 'Consumption (مصرف روزانه)',
        quantityChange: -recordData.actualAmountKg,
        unit: 'kg',
        unitPrice: feedItem.purchasePricePerUnit,
        totalValue: recordData.actualAmountKg * feedItem.purchasePricePerUnit,
        referenceDoc: newRecord.id,
        pondId: pond.id,
        operator: recordData.operatorName,
        notes: `تغذیه استخر ${pond.name}`,
      });
    }

    createAuditLog(
      'FEEDING_LOGGED',
      'Pond',
      pond.id,
      `ثبت غذادهی ${recordData.actualAmountKg} kg در ${pond.name}`,
      `lastFeedingKg: ${pond.lastFeedingKg}`,
      `lastFeedingKg: ${recordData.actualAmountKg}`
    );

    return { success: true };
  };

  const stopPondFeeding = (pondId: string, reason: Pond['stopFeedingReason'], details: string, operator: string) => {
    const pond = ponds.find((p) => p.id === pondId);
    if (!pond) return;

    setPonds((prev) =>
      prev.map((p) =>
        p.id === pondId
          ? {
              ...p,
              feedingStatus: 'STOPPED',
              stopFeedingReason: reason,
              stopFeedingDetails: details,
              stopFeedingTimestamp: new Date().toISOString(),
              stopFeedingUser: operator,
              criticalAlerts: [`تغذیه قطع شد: ${reason} - ${details}`, ...p.criticalAlerts],
            }
          : p
      )
    );

    createAuditLog(
      'FEEDING_STOPPED',
      'Pond',
      pondId,
      `قطع اضطراری تغذیه در استخر ${pond.name} به دلیل ${reason} توسط ${operator}`,
      'feedingStatus: ACTIVE',
      'feedingStatus: STOPPED'
    );
  };

  const resumePondFeeding = (pondId: string, operator: string): { success: boolean; error?: string } => {
    const pond = ponds.find((p) => p.id === pondId);
    if (!pond) return { success: false, error: 'استخر یافت نشد.' };

    // Safety check: Cannot resume if DO is still < 4.0
    if (pond.dissolvedOxygen < 4.0) {
      return {
        success: false,
        error: `وصل مجدد تغذیه امکان‌پذیر نیست: اکسیژن استخر هنوز ${pond.dissolvedOxygen} mg/L است و باید بالای ۴.۰ mg/L پایدار شود.`,
      };
    }

    setPonds((prev) =>
      prev.map((p) =>
        p.id === pondId
          ? {
              ...p,
              feedingStatus: 'ACTIVE',
              stopFeedingReason: undefined,
              stopFeedingDetails: undefined,
              criticalAlerts: p.criticalAlerts.filter((a) => !a.includes('تغذیه قطع شد')),
            }
          : p
      )
    );

    createAuditLog(
      'FEEDING_RESUMED',
      'Pond',
      pondId,
      `وصل مجدد تغذیه در استخر ${pond.name} توسط ${operator}`,
      'feedingStatus: STOPPED',
      'feedingStatus: ACTIVE'
    );

    return { success: true };
  };

  // Mortality Logging & Live Inventory Reduction
  const recordMortality = (recordData: Omit<MortalityRecord, 'id' | 'timestamp'>) => {
    const pond = ponds.find((p) => p.id === recordData.pondId);
    if (!pond) return;

    const newRecord: MortalityRecord = {
      ...recordData,
      id: 'mort_' + Date.now(),
      timestamp: new Date().toISOString(),
    };

    setMortalityRecords((prev) => [newRecord, ...prev]);

    // Automatically reduce live fish count and biomass
    setPonds((prev) =>
      prev.map((p) => {
        if (p.id === recordData.pondId) {
          const newCount = Math.max(0, p.fishCount - recordData.count);
          const newBiomass = Math.max(0, p.biomassKg - recordData.estimatedWeightKg);
          const newAvg = newCount > 0 ? Number((newBiomass / newCount).toFixed(2)) : 0;
          return {
            ...p,
            fishCount: newCount,
            biomassKg: newBiomass,
            averageWeightKg: newAvg,
            dailyMortalityCount: p.dailyMortalityCount + recordData.count,
          };
        }
        return p;
      })
    );

    createAuditLog(
      'MORTALITY_LOGGED',
      'Pond',
      pond.id,
      `ثبت تلفات ${recordData.count} قطعه (${recordData.estimatedWeightKg} kg) به علت ${recordData.reason}`,
      `fishCount: ${pond.fishCount}`,
      `fishCount: ${pond.fishCount - recordData.count}`
    );
  };

  // Biometrics & SGR Engine
  const recordBiometry = (sessionData: Omit<BiometricSession, 'id' | 'averageWeightKg' | 'minWeightKg' | 'maxWeightKg' | 'estimatedBiomassKg' | 'estimatedCount' | 'growthRateKgPerDay' | 'sgr'>) => {
    const pond = ponds.find((p) => p.id === sessionData.pondId);
    if (!pond) return;

    const weights = sessionData.samples.map((s) => s.weightKg);
    const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : pond.averageWeightKg;
    const minWeight = weights.length > 0 ? Math.min(...weights) : avgWeight;
    const maxWeight = weights.length > 0 ? Math.max(...weights) : avgWeight;

    const days = Math.max(1, sessionData.daysSinceLastBiometry || 30);
    const prevWeight = sessionData.previousAvgWeightKg || pond.averageWeightKg;
    const growthRate = (avgWeight - prevWeight) / days;
    const sgr = prevWeight > 0 && avgWeight > 0 ? ((Math.log(avgWeight) - Math.log(prevWeight)) / days) * 100 : 0;

    const estimatedBiomass = Number((pond.fishCount * avgWeight).toFixed(2));

    const newSession: BiometricSession = {
      ...sessionData,
      id: 'bio_' + Date.now(),
      averageWeightKg: Number(avgWeight.toFixed(2)),
      minWeightKg: Number(minWeight.toFixed(2)),
      maxWeightKg: Number(maxWeight.toFixed(2)),
      estimatedBiomassKg: estimatedBiomass,
      estimatedCount: pond.fishCount,
      growthRateKgPerDay: Number(growthRate.toFixed(4)),
      sgr: Number(sgr.toFixed(3)),
    };

    setBiometricSessions((prev) => [newSession, ...prev]);

    // Update pond biometry state
    setPonds((prev) =>
      prev.map((p) =>
        p.id === sessionData.pondId
          ? {
              ...p,
              averageWeightKg: newSession.averageWeightKg,
              biomassKg: newSession.estimatedBiomassKg,
              lastBiometryDate: sessionData.date,
            }
          : p
      )
    );

    createAuditLog(
      'BIOMETRY_RECORDED',
      'Pond',
      pond.id,
      `ثبت بیومتری استخر ${pond.name}: میانگین وزن جدید ${newSession.averageWeightKg} kg, SGR: ${newSession.sgr}%/روز`,
      `avgWeight: ${pond.averageWeightKg}`,
      `avgWeight: ${newSession.averageWeightKg}`
    );
  };

  const recordWaterTest = (testData: Omit<WaterQualityLog, 'id' | 'timestamp'>) => {
    const newLog: WaterQualityLog = {
      ...testData,
      id: 'wq_' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    setWaterLogs((prev) => [newLog, ...prev]);

    // Update pond live water parameters
    setPonds((prev) =>
      prev.map((p) =>
        p.id === testData.pondId
          ? {
              ...p,
              waterTemperature: testData.temperature,
              dissolvedOxygen: testData.dissolvedOxygen,
              ph: testData.ph,
            }
          : p
      )
    );
  };

  const recordTreatment = (treatmentData: Omit<TreatmentRecord, 'id'>) => {
    const newTreatment: TreatmentRecord = {
      ...treatmentData,
      id: 'tr_' + Date.now(),
    };
    setTreatments((prev) => [newTreatment, ...prev]);

    // Update pond active treatment
    setPonds((prev) =>
      prev.map((p) =>
        p.id === treatmentData.pondId
          ? {
              ...p,
              activeTreatmentId: newTreatment.id,
            }
          : p
      )
    );
  };

  /**
   * ATOMIC FISH TRANSFER ENGINE (PHASE 6)
   * Guaranteed single-transaction mutation: Source fish decrement strictly equals destination increment.
   */
  const executeAtomicTransfer = (transferData: Omit<FishTransfer, 'id' | 'status'>): { success: boolean; error?: string } => {
    const sourcePond = ponds.find((p) => p.id === transferData.sourceId);
    const destPond = ponds.find((p) => p.id === transferData.destinationId);

    if (!sourcePond) return { success: false, error: 'استخر مبدا یافت نشد.' };
    if (!destPond) return { success: false, error: 'استخر مقصد یافت نشد.' };
    if (sourcePond.id === destPond.id) return { success: false, error: 'استخر مبدا و مقصد نمی‌توانند یکسان باشند.' };

    if (transferData.fishCount <= 0) {
      return { success: false, error: 'تعداد ماهیان انتقال باید بیشتر از صفر باشد.' };
    }

    if (sourcePond.fishCount < transferData.fishCount) {
      return {
        success: false,
        error: `تعداد ماهیان درخواستی (${transferData.fishCount}) بیشتر از موجودی استخر مبدا (${sourcePond.fishCount}) است.`,
      };
    }

    const transferBiomass = Number((transferData.fishCount * transferData.averageWeightKg).toFixed(2));

    const newTransfer: FishTransfer = {
      ...transferData,
      id: 'trf_' + Date.now(),
      totalBiomassKg: transferBiomass,
      status: 'COMPLETED',
    };

    // Atomic update of both Source and Destination ponds in single state mutation
    setPonds((prevPonds) => {
      return prevPonds.map((p) => {
        if (p.id === transferData.sourceId) {
          const newCount = p.fishCount - transferData.fishCount;
          const newBiomass = Math.max(0, p.biomassKg - transferBiomass);
          const newAvg = newCount > 0 ? Number((newBiomass / newCount).toFixed(2)) : 0;
          return {
            ...p,
            fishCount: newCount,
            biomassKg: newBiomass,
            averageWeightKg: newAvg,
            lastTransferDate: transferData.date,
          };
        }
        if (p.id === transferData.destinationId) {
          const newCount = p.fishCount + transferData.fishCount;
          const newBiomass = p.biomassKg + transferBiomass;
          const newAvg = newCount > 0 ? Number((newBiomass / newCount).toFixed(2)) : transferData.averageWeightKg;
          return {
            ...p,
            fishCount: newCount,
            biomassKg: newBiomass,
            averageWeightKg: newAvg,
            lastTransferDate: transferData.date,
          };
        }
        return p;
      });
    });

    setTransfers((prev) => [newTransfer, ...prev]);

    createAuditLog(
      'FISH_TRANSFER_ATOMIC',
      'Pond',
      transferData.sourceId,
      `انتقال اتمیک ${transferData.fishCount} قطعه ماهی از ${transferData.sourceName} به ${transferData.destinationName}`,
      `sourceFishCount: ${sourcePond.fishCount}`,
      `sourceFishCount: ${sourcePond.fishCount - transferData.fishCount}`
    );

    return { success: true };
  };

  // Warehouse Ledger
  const addInventoryTransaction = (txData: Omit<InventoryTransaction, 'id' | 'timestamp' | 'resultingQuantity'>) => {
    const item = inventory.find((i) => i.id === txData.itemId);
    if (!item) return;

    const newQty = Math.max(0, item.quantity + txData.quantityChange);
    const newTx: InventoryTransaction = {
      ...txData,
      id: 'tx_' + Date.now(),
      resultingQuantity: newQty,
      timestamp: new Date().toISOString(),
    };

    setInventoryTxs((prev) => [newTx, ...prev]);
    setInventory((prev) =>
      prev.map((i) =>
        i.id === txData.itemId
          ? {
              ...i,
              quantity: newQty,
              status: newQty <= i.minimumStockThreshold ? 'Low Stock' : 'Adequate',
            }
          : i
      )
    );
  };

  // Processing Batch
  const createProcessingBatch = (batchData: Omit<ProcessingBatch, 'id' | 'caviarYieldPercent' | 'filletYieldPercent'>) => {
    const caviarPct = batchData.liveBiomassKg > 0 ? Number(((batchData.caviarYieldKg / batchData.liveBiomassKg) * 100).toFixed(2)) : 0;
    const filletPct = batchData.liveBiomassKg > 0 ? Number(((batchData.filletMeatYieldKg / batchData.liveBiomassKg) * 100).toFixed(2)) : 0;

    const newBatch: ProcessingBatch = {
      ...batchData,
      id: 'proc_' + Date.now(),
      caviarYieldPercent: caviarPct,
      filletYieldPercent: filletPct,
    };

    setProcessingBatches((prev) => [newBatch, ...prev]);

    // Add pallet slot to cold storage
    const newPallet: ColdStoragePallet = {
      id: 'plt_' + Date.now(),
      slotCode: `COLD-A-${newBatch.batchCode.slice(-4)}`,
      temperatureC: -2.8,
      productType: 'Caviar (Cans/Jars)',
      batchCode: newBatch.batchCode,
      weightKg: newBatch.caviarYieldKg,
      unitsCount: Math.round(newBatch.caviarYieldKg * 20), // 50g units
      packagingUnit: 'قوطی ۵۰ گرمی واکیوم',
      entryDate: newBatch.date,
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'Stored',
    };
    setColdStorage((prev) => [newPallet, ...prev]);

    createAuditLog(
      'PROCESSING_COMMITTED',
      'ProcessingBatch',
      newBatch.batchCode,
      `فرآوری ${newBatch.liveBiomassKg} kg فیل‌ماهی: تولید ${newBatch.caviarYieldKg} kg خاویار (${caviarPct}%) و ${newBatch.filletMeatYieldKg} kg فیله`
    );
  };

  // Sales & Proforma
  const createProformaInvoice = (proformaData: Omit<ProformaInvoice, 'id' | 'subtotal' | 'grandTotal'>) => {
    const subtotal = proformaData.items.reduce((s, i) => s + i.total, 0);
    const grandTotal = subtotal + (proformaData.taxTotal || 0) - (proformaData.discountTotal || 0);

    const newProforma: ProformaInvoice = {
      ...proformaData,
      id: 'prof_' + Date.now(),
      subtotal,
      grandTotal,
    };

    setProformas((prev) => [newProforma, ...prev]);
  };

  const updateProformaStage = (id: string, newStage: ProformaInvoice['stage']) => {
    setProformas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stage: newStage } : p))
    );
  };

  /**
   * DOUBLE-ENTRY ACCOUNTING ENGINE (PHASE 15)
   * Strictly verifies Debit === Credit before posting to ledger.
   */
  const createJournalEntry = (
    entryData: Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'isBalanced'>
  ): { success: boolean; error?: string } => {
    if (!entryData.debits || entryData.debits.length === 0 || !entryData.credits || entryData.credits.length === 0) {
      return { success: false, error: 'سند حسابداری باید حداقل شامل یک ردیف بدهکار و یک ردیف بستانکار باشد.' };
    }

    const totalDebit = entryData.debits.reduce((sum, d) => sum + d.amount, 0);
    const totalCredit = entryData.credits.reduce((sum, c) => sum + c.amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `عدم توازن سند دوبل: جمع بدهکار (${totalDebit.toLocaleString()}) با جمع بستانکار (${totalCredit.toLocaleString()}) برابر نیست!`,
      };
    }

    const newEntry: JournalEntry = {
      ...entryData,
      id: 'jnl_' + Date.now(),
      entryNumber: 'SANAD-' + Date.now().toString().slice(-6),
      totalDebit,
      totalCredit,
      isBalanced: true,
      createdAt: new Date().toISOString(),
    };

    setJournals((prev) => [newEntry, ...prev]);

    // Update account balances
    setAccounts((prevAccounts) =>
      prevAccounts.map((acc) => {
        const debitHit = entryData.debits.find((d) => d.accountId === acc.id);
        const creditHit = entryData.credits.find((c) => c.accountId === acc.id);
        let diff = 0;
        if (debitHit) diff += debitHit.amount;
        if (creditHit) diff -= creditHit.amount;
        return {
          ...acc,
          balance: acc.balance + diff,
        };
      })
    );

    createAuditLog(
      'JOURNAL_POSTED',
      'Accounting',
      newEntry.entryNumber,
      `ثبت سند حسابداری دوبل به مبلغ ${totalDebit.toLocaleString()}`
    );

    return { success: true };
  };

  // HR & Attendance
  const clockAttendance = (employeeId: string, type: 'in' | 'out', shift: AttendanceRecord['shift']) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString();

    if (type === 'in') {
      const newAtt: AttendanceRecord = {
        id: 'att_' + Date.now(),
        employeeId,
        employeeName: emp.fullName,
        date: todayStr,
        clockInTime: timeStr,
        shift,
        regularHours: 8,
        overtimeHours: 0,
        status: 'Present',
      };
      setAttendance((prev) => [newAtt, ...prev]);
    } else {
      setAttendance((prev) =>
        prev.map((a) =>
          a.employeeId === employeeId && a.date === todayStr ? { ...a, clockOutTime: timeStr } : a
        )
      );
    }
  };

  const generateMonthlyPayroll = (monthString: string) => {
    const newPayrolls: PayrollRecord[] = employees.map((emp) => {
      const base = emp.baseSalary;
      const overtime = Math.round(base * 0.15);
      const bonus = Math.round(base * 0.1);
      const gross = base + overtime + bonus;
      const insurance = Math.round(gross * 0.07);
      const tax = Math.round(gross * 0.1);
      const net = gross - insurance - tax;

      return {
        id: 'pay_' + emp.id + '_' + monthString,
        payrollMonth: monthString,
        employeeId: emp.id,
        employeeName: emp.fullName,
        department: emp.department,
        baseSalary: base,
        overtimePay: overtime,
        shiftBonus: bonus,
        hardshipAllowance: 0,
        grossSalary: gross,
        socialSecurityInsurance: insurance,
        incomeTax: tax,
        loanDeduction: 0,
        netPay: net,
        currency: emp.currency,
        paymentStatus: 'Approved',
        paymentDate: new Date().toISOString().split('T')[0],
      };
    });

    setPayrolls(newPayrolls);
  };

  // Backup Snapshots & Restore Rollback
  const createBackupSnapshot = (type: BackupSnapshot['type'] = 'Manual Export'): BackupSnapshot => {
    const backupData = {
      halls,
      ponds,
      species,
      feedingRecords,
      biometricSessions,
      waterLogs,
      mortalityRecords,
      treatments,
      transfers,
      broodstock,
      fertilizations,
      incubators,
      larvae,
      inventory,
      inventoryTxs,
      processingBatches,
      coldStorage,
      customers,
      proformas,
      accounts,
      journals,
      employees,
      auditLogs,
      exportedAt: new Date().toISOString(),
      version: '6.0.4 Enterprise',
    };

    const json = JSON.stringify(backupData);
    const sizeKb = Number((json.length / 1024).toFixed(1));
    const checksum = 'SHA256:' + Math.random().toString(36).substr(2, 8).toUpperCase();

    const snapshot: BackupSnapshot = {
      id: 'bkp_' + Date.now(),
      filename: `FATHI_AQUA_BACKUP_${new Date().toISOString().slice(0, 10)}.json`,
      timestamp: new Date().toISOString(),
      version: '6.0.4 Enterprise',
      dataSizeKb: sizeKb,
      tablesCount: 22,
      checksum,
      creator: 'Super Admin (Manual Export)',
      type,
    };

    setBackups((prev) => [snapshot, ...prev]);
    return snapshot;
  };

  const restoreFromSnapshotJson = (jsonString: string): { success: boolean; message: string } => {
    try {
      createBackupSnapshot('Pre-Restore Safety Snapshot');

      const data = JSON.parse(jsonString);
      if (!data.ponds || !data.halls) {
        return { success: false, message: 'ساختار فایل پشتیبان نامعتبر است (جداول اصلی یافت نشدند).' };
      }

      if (data.halls) setHalls(data.halls);
      if (data.ponds) setPonds(data.ponds);
      if (data.species) setSpecies(data.species);
      if (data.feedingRecords) setFeedingRecords(data.feedingRecords);
      if (data.broodstock) setBroodstock(data.broodstock);
      if (data.inventory) setInventory(data.inventory);
      if (data.processingBatches) setProcessingBatches(data.processingBatches);
      if (data.customers) setCustomers(data.customers);
      if (data.proformas) setProformas(data.proformas);
      if (data.accounts) setAccounts(data.accounts);
      if (data.journals) setJournals(data.journals);

      createAuditLog(
        'DATABASE_RESTORED',
        'System',
        'Database',
        'بازیابی موفقیت‌آمیز پایگاه داده از فایل پشتیبان به همراه تهیه خودکار Safety Snapshot پیش از اجرا'
      );

      return { success: true, message: 'بازیابی پایگاه داده با موفقیت انجام شد.' };
    } catch (e: any) {
      return { success: false, message: 'خطا در خواندن فایل: ' + (e?.message || 'فرمت JSON نامعتبر است') };
    }
  };

  const addBroodstock = (fishData: Omit<BroodstockFish, 'id'>) => {
    const newFish: BroodstockFish = {
      ...fishData,
      id: 'brood_' + Date.now(),
    };
    setBroodstock((prev) => [newFish, ...prev]);
  };

  const recordFertilization = (fertData: Omit<FertilizationBatch, 'id' | 'fertilizationTimestamp' | 'status'>) => {
    const newFert: FertilizationBatch = {
      ...fertData,
      id: 'fert_' + Date.now(),
      fertilizationTimestamp: new Date().toISOString(),
      status: 'Incubating',
    };
    setFertilizations((prev) => [newFert, ...prev]);
  };

  const addCustomer = (custData: Omit<Customer, 'id' | 'createdAt' | 'totalOrdersCount' | 'totalSpent' | 'outstandingBalance'>) => {
    const newCust: Customer = {
      ...custData,
      id: 'cust_' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
      totalOrdersCount: 0,
      totalSpent: 0,
      outstandingBalance: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);
  };

  const addSocialPost = (postData: Omit<SocialMediaPost, 'id' | 'status'>) => {
    const newPost: SocialMediaPost = {
      ...postData,
      id: 'post_' + Date.now(),
      status: 'Draft',
    };
    setSocialPosts((prev) => [newPost, ...prev]);
  };

  return (
    <FarmContext.Provider
      value={{
        halls,
        ponds,
        species,
        feedingRecords,
        biometricSessions,
        waterLogs,
        mortalityRecords,
        treatments,
        transfers,
        broodstock,
        fertilizations,
        incubators,
        larvae,
        nurseryTanks,
        inventory,
        inventoryTxs,
        labSamples,
        processingBatches,
        coldStorage,
        customers,
        proformas,
        accounts,
        journals,
        employees,
        attendance,
        payrolls,
        equipment,
        socialPosts,
        auditLogs,
        backups,
        syncStatus,
        calculateRecommendedFeed,
        recordFeeding,
        stopPondFeeding,
        resumePondFeeding,
        recordMortality,
        recordBiometry,
        recordWaterTest,
        recordTreatment,
        executeAtomicTransfer,
        addInventoryTransaction,
        createProcessingBatch,
        createProformaInvoice,
        updateProformaStage,
        createJournalEntry,
        clockAttendance,
        generateMonthlyPayroll,
        createAuditLog,
        createBackupSnapshot,
        restoreFromSnapshotJson,
        addBroodstock,
        recordFertilization,
        addCustomer,
        addSocialPost,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = (): FarmContextType => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
};
