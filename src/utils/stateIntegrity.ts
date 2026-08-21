import { assessWaterSafetyForFeeding } from './sensorValidation';
import { inventoryQuantityForFeedKg, normalizeFeedAmountToKg } from './feedingEngine';
import { saleLotMatchesSku, validateSaleFulfillmentConservation } from './salesEngine';

export const STATE_COLLECTIONS = [
  'halls', 'ponds', 'species', 'feedingRecords', 'biometricSessions', 'waterLogs', 'mortalityRecords',
  'treatments', 'transfers', 'broodstock', 'fertilizations', 'incubators', 'larvae', 'nurseryTanks',
  'inventory', 'inventoryTxs', 'labSamples', 'processingBatches', 'coldStorage', 'customers', 'proformas',
  'accounts', 'journals', 'employees', 'attendance', 'payrolls', 'equipment', 'socialPosts', 'auditLogs', 'backups',
] as const;

type State = Record<string, any>;

const finiteNonNegative = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const collection = (state: State, key: string): any[] => Array.isArray(state[key]) ? state[key] : [];

export const MODULE_COLLECTIONS: Record<string, string[]> = {
  feeding: ['feedingRecords', 'ponds', 'halls', 'inventory', 'inventoryTxs', 'auditLogs'],
  biometrics: ['biometricSessions', 'ponds', 'halls', 'auditLogs'],
  water_quality: ['waterLogs', 'ponds', 'halls', 'auditLogs'],
  mortality: ['mortalityRecords', 'ponds', 'halls', 'auditLogs'],
  treatments: ['treatments', 'ponds', 'halls', 'auditLogs'],
  transfers: ['transfers', 'ponds', 'nurseryTanks', 'larvae', 'halls', 'auditLogs'],
  processing: ['processingBatches', 'ponds', 'halls', 'coldStorage', 'auditLogs'],
  warehouse: ['inventory', 'inventoryTxs', 'auditLogs'],
  feed_factory: ['inventory', 'inventoryTxs', 'auditLogs'],
  hatchery: ['broodstock', 'fertilizations', 'incubators', 'larvae', 'auditLogs'],
  nursery: ['larvae', 'nurseryTanks', 'auditLogs'],
  laboratory: ['labSamples', 'waterLogs', 'auditLogs'],
  crm: ['customers', 'auditLogs'],
  sales: ['proformas', 'customers', 'coldStorage', 'auditLogs'],
  accounting: ['accounts', 'journals', 'auditLogs'],
  hr: ['employees', 'attendance', 'payrolls', 'auditLogs'],
  media: ['socialPosts', 'auditLogs'],
  backup: ['backups', 'auditLogs'],
  settings: ['auditLogs'],
};

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function changedStateCollections(previousRaw: unknown, nextRaw: unknown): string[] {
  if (!previousRaw || typeof previousRaw !== 'object') return [...STATE_COLLECTIONS];
  const previous = previousRaw as State;
  const next = nextRaw as State;
  return STATE_COLLECTIONS.filter((key) => !sameValue(previous[key], next[key]));
}

export function validateMutationScope(
  previousRaw: unknown,
  nextRaw: unknown,
  operation: { module?: string; action?: string },
): { ok: boolean; error?: string } {
  const module = operation?.module || '';
  const action = operation?.action || '';
  if (module === 'backup' && action === 'approve') return { ok: true };
  if (!previousRaw && module === 'settings' && action === 'manage') return { ok: true };
  const changed = changedStateCollections(previousRaw, nextRaw);
  const allowed = MODULE_COLLECTIONS[module];
  if (!allowed) return { ok: false, error: 'STATE_OPERATION_MODULE_INVALID' };
  if (changed.some((key) => !allowed.includes(key))) return { ok: false, error: 'STATE_MUTATION_SCOPE_VIOLATION' };
  return { ok: true };
}

export function validateStateSnapshot(raw: unknown): { ok: boolean; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'STATE_OBJECT_REQUIRED' };
  const state = raw as State;
  const unknownKeys = Object.keys(state).filter((key) => !(STATE_COLLECTIONS as readonly string[]).includes(key));
  if (unknownKeys.length) return { ok: false, error: `STATE_UNKNOWN_COLLECTION:${unknownKeys[0]}` };
  for (const key of STATE_COLLECTIONS) if (!Array.isArray(state[key])) return { ok: false, error: `STATE_COLLECTION_REQUIRED:${key}` };
  for (const key of STATE_COLLECTIONS) {
    const rows = state[key] as any[];
    const ids = rows.map((row) => row && typeof row.id === 'string' ? row.id : '');
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return { ok: false, error: `STATE_COLLECTION_IDS_INVALID:${key}` };
  }
  for (const pond of state.ponds) {
    if (!pond || typeof pond.id !== 'string' || !finiteNonNegative(pond.fishCount) || !finiteNonNegative(pond.biomassKg)) return { ok: false, error: 'STATE_POND_INVALID' };
  }
  for (const tank of state.nurseryTanks) {
    if (!tank || typeof tank.id !== 'string' || !Number.isInteger(tank.fishCount) || tank.fishCount < 0 || !finiteNonNegative(tank.totalBiomassGrams) || !finiteNonNegative(tank.avgWeightGrams)) {
      return { ok: false, error: 'STATE_NURSERY_TANK_INVALID' };
    }
  }
  for (const batch of state.larvae) {
    if (!batch || !Number.isInteger(batch.larvalCount) || batch.larvalCount < 0 || !finiteNonNegative(batch.totalBiomassKg ?? 0)) {
      return { ok: false, error: 'STATE_LARVAL_BATCH_INVALID' };
    }
  }
  for (const item of state.inventory) if (!item || typeof item.id !== 'string' || !finiteNonNegative(item.quantity)) return { ok: false, error: 'STATE_INVENTORY_INVALID' };
  for (const journal of state.journals) {
    if (!journal || journal.isBalanced !== true || !Array.isArray(journal.debits) || !Array.isArray(journal.credits) || !finiteNonNegative(journal.totalDebit) || !finiteNonNegative(journal.totalCredit) || Math.abs(Number(journal.totalDebit) - Number(journal.totalCredit)) > 0.01) return { ok: false, error: 'STATE_JOURNAL_UNBALANCED' };
    const lines = [...journal.debits, ...journal.credits];
    if (!lines.length || lines.some((line) => !line || typeof line.accountId !== 'string' || !Number.isFinite(line.amount) || line.amount <= 0)) return { ok: false, error: 'STATE_JOURNAL_LINE_INVALID' };
    const accountIds = new Set(state.accounts.map((account) => account?.id));
    if (lines.some((line) => !accountIds.has(line.accountId))) return { ok: false, error: 'STATE_JOURNAL_ACCOUNT_REF_INVALID' };
    const currencies = new Set(lines.map((line) => state.accounts.find((account) => account.id === line.accountId)?.currency).filter(Boolean));
    if (currencies.size > 1) return { ok: false, error: 'STATE_JOURNAL_MIXED_CURRENCY' };
  }
  return { ok: true };
}

/** Every ACTIVE feeding pond must be backed by fresh, valid, safe telemetry. */
export function validateActiveFeedingState(raw: unknown): { ok: boolean; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'STATE_OBJECT_REQUIRED' };
  const state = raw as State;
  for (const pond of collection(state, 'ponds')) {
    if (pond?.feedingStatus !== 'ACTIVE') continue;
    if (pond.activeTreatmentId || collection(state, 'treatments').some((treatment) => treatment?.pondId === pond.id && treatment?.status === 'ACTIVE')) {
      return { ok: false, error: 'FEEDING_ACTIVE_DURING_TREATMENT' };
    }
    const latest = collection(state, 'waterLogs')
      .filter((log) => log?.pondId === pond.id)
      .sort((left, right) => new Date(String(right.timestamp || '')).getTime() - new Date(String(left.timestamp || '')).getTime())[0];
    if (!latest || latest.sensorStatus !== 'VALID' || !latest.timestamp) return { ok: false, error: 'FEEDING_TELEMETRY_NOT_AUTHORITATIVE' };
    if (pond.lastTelemetryTimestamp !== latest.timestamp || pond.sensorQuality !== latest.sensorStatus || pond.dissolvedOxygen !== latest.dissolvedOxygen || pond.waterTemperature !== latest.temperature || pond.ph !== latest.ph || pond.ammonia !== latest.ammonia || pond.nitrite !== latest.nitrite) {
      return { ok: false, error: 'FEEDING_TELEMETRY_LEDGER_MISSING' };
    }
    const safety = assessWaterSafetyForFeeding({
      dissolvedOxygen: latest.dissolvedOxygen,
      waterTemperature: latest.temperature,
      ph: latest.ph,
      ammonia: latest.ammonia,
      nitrite: latest.nitrite,
      timestamp: latest.timestamp,
      sensorStatus: latest.sensorStatus,
    });
    if (!safety.isSafeForFeeding) return { ok: false, error: 'FEEDING_SAFETY_FAILED' };
  }
  return { ok: true };
}

function newRows(previous: State, next: State, key: string): any[] {
  const oldIds = new Set(collection(previous, key).map((row) => row?.id).filter(Boolean));
  return collection(next, key).filter((row) => row?.id && !oldIds.has(row.id));
}

const IMMUTABLE_LEDGER_COLLECTIONS = [
  'feedingRecords', 'waterLogs', 'mortalityRecords', 'transfers',
  'processingBatches', 'inventoryTxs', 'biometricSessions', 'journals',
];

const NON_DELETABLE_REGISTERED_COLLECTIONS = [
  ...IMMUTABLE_LEDGER_COLLECTIONS,
  'halls', 'ponds', 'broodstock', 'fertilizations', 'incubators', 'larvae', 'nurseryTanks', 'inventory', 'accounts',
];

function modifiedExistingRows(previous: State, next: State, key: string): boolean {
  const previousById = new Map(collection(previous, key).filter((row) => row?.id).map((row) => [row.id, row]));
  return collection(next, key).some((row) => row?.id && previousById.has(row.id) && !sameValue(previousById.get(row.id), row));
}

function deletedExistingRows(previous: State, next: State, key: string): boolean {
  const nextIds = new Set(collection(next, key).map((row) => row?.id).filter(Boolean));
  return collection(previous, key).some((row) => row?.id && !nextIds.has(row.id));
}

function pondById(state: State, id: string): any | undefined {
  return collection(state, 'ponds').find((pond) => pond.id === id);
}

function nearlyEqual(left: unknown, right: unknown, tolerance = 0.05): boolean {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

function changedRows(previous: State, next: State, key: string): any[] {
  const before = new Map(collection(previous, key).map((row) => [row?.id, row]));
  return collection(next, key).filter((row) => row?.id && before.has(row.id) && !sameValue(before.get(row.id), row));
}

function validatePondMutation(previous: State, next: State, operation: { module?: string; action?: string }): { ok: boolean; error?: string } {
  const module = operation.module || '';
  const beforeById = new Map(collection(previous, 'ponds').map((pond) => [pond.id, pond]));
  const nextById = new Map(collection(next, 'ponds').map((pond) => [pond.id, pond]));
  const changed = collection(next, 'ponds').filter((pond) => pond?.id && (!beforeById.has(pond.id) || !sameValue(beforeById.get(pond.id), pond)));
  if (!changed.length) return { ok: true };
  if (module === 'settings' || module === 'backup') return { ok: true };
  if (changed.some((pond) => !beforeById.has(pond.id))) return { ok: false, error: 'POND_CREATION_REQUIRES_REGISTERED_WORKFLOW' };

  const mutableFields = new Set([
    'fishCount', 'biomassKg', 'averageWeightKg', 'lastFeedingKg', 'lastFeedingTime', 'feedingStatus',
    'stopFeedingReason', 'stopFeedingDetails', 'stopFeedingTimestamp', 'stopFeedingUser', 'dailyMortalityCount',
    'dissolvedOxygen', 'waterTemperature', 'ph', 'ammonia', 'nitrite', 'lastTelemetryTimestamp', 'sensorQuality',
    'activeTreatmentId', 'lastBiometryDate', 'lastTransferDate', 'criticalAlerts',
  ]);
  for (const pond of changed) {
    const before = beforeById.get(pond.id)!;
    const beforeMetadata = Object.fromEntries(Object.entries(before).filter(([key]) => !mutableFields.has(key)));
    const nextMetadata = Object.fromEntries(Object.entries(pond).filter(([key]) => !mutableFields.has(key)));
    if (!sameValue(beforeMetadata, nextMetadata)) return { ok: false, error: 'POND_METADATA_MUTATION_NOT_ALLOWED' };
  }

  const biologicalFields = ['fishCount', 'biomassKg', 'averageWeightKg'];
  const biologicalChanged = changed.some((pond) => biologicalFields.some((field) => !nearlyEqual(beforeById.get(pond.id)?.[field], pond[field], field === 'fishCount' ? 0 : 0.001)));
  if (['feeding', 'water_quality', 'treatments'].includes(module) && biologicalChanged) return { ok: false, error: 'POND_BIOLOGY_MUTATION_NOT_ALLOWED' };

  if (module === 'biometrics') {
    const sessions = newRows(previous, next, 'biometricSessions');
    if (!sessions.length) return { ok: false, error: 'BIOMETRY_LEDGER_MISSING' };
    for (const pond of changed) {
      const session = sessions.filter((row) => row.pondId === pond.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const before = beforeById.get(pond.id);
      if (!session || pond.fishCount !== before.fishCount || !nearlyEqual(pond.averageWeightKg, session.averageWeightKg, 0.001) || !nearlyEqual(pond.biomassKg, session.estimatedBiomassKg, 0.05) || !nearlyEqual(session.estimatedBiomassKg, pond.fishCount * session.averageWeightKg, 0.05)) {
        return { ok: false, error: 'BIOMETRY_CONSERVATION_FAILED' };
      }
    }
  }

  if (module === 'water_quality') {
    const logs = newRows(previous, next, 'waterLogs');
    for (const log of logs) {
      const pond = nextById.get(log.pondId);
      if (!pond || pond.lastTelemetryTimestamp !== log.timestamp || pond.sensorQuality !== log.sensorStatus || pond.dissolvedOxygen !== log.dissolvedOxygen || pond.waterTemperature !== log.temperature || pond.ph !== log.ph || pond.ammonia !== log.ammonia || pond.nitrite !== log.nitrite) return { ok: false, error: 'WATER_TELEMETRY_LEDGER_MISSING' };
    }
    for (const pond of changed) {
      const latest = logs.filter((row) => row.pondId === pond.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      const before = beforeById.get(pond.id);
      const telemetryChanged = before.lastTelemetryTimestamp !== pond.lastTelemetryTimestamp || before.sensorQuality !== pond.sensorQuality || before.dissolvedOxygen !== pond.dissolvedOxygen || before.waterTemperature !== pond.waterTemperature || before.ph !== pond.ph || before.ammonia !== pond.ammonia || before.nitrite !== pond.nitrite;
      if ((telemetryChanged && !latest) || (latest && (pond.lastTelemetryTimestamp !== latest.timestamp || pond.sensorQuality !== latest.sensorStatus || pond.dissolvedOxygen !== latest.dissolvedOxygen || pond.waterTemperature !== latest.temperature || pond.ph !== latest.ph || pond.ammonia !== latest.ammonia || pond.nitrite !== latest.nitrite))) {
        return { ok: false, error: 'WATER_TELEMETRY_LEDGER_MISSING' };
      }
    }
  }

  if (module === 'feeding') {
    for (const pond of changed) {
      const before = beforeById.get(pond.id);
      if (before.feedingStatus === 'STOPPED' && pond.feedingStatus === 'ACTIVE') {
        if (operation.action !== 'approve' || pond.activeTreatmentId) return { ok: false, error: 'FEEDING_RESUME_NOT_APPROVED' };
        const latest = collection(next, 'waterLogs').filter((log) => log.pondId === pond.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        if (!latest || latest.sensorStatus !== 'VALID') return { ok: false, error: 'FEEDING_TELEMETRY_NOT_AUTHORITATIVE' };
        const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: latest.dissolvedOxygen, waterTemperature: latest.temperature, ph: latest.ph, ammonia: latest.ammonia, nitrite: latest.nitrite, timestamp: latest.timestamp, sensorStatus: latest.sensorStatus });
        if (!safety.isSafeForFeeding) return { ok: false, error: 'FEEDING_SAFETY_FAILED' };
      }
    }
  }

  if (module === 'mortality') {
    const records = newRows(previous, next, 'mortalityRecords');
    if (!records.length) return { ok: false, error: 'MORTALITY_LEDGER_MISSING' };
    const totals = new Map<string, { count: number; biomass: number }>();
    for (const record of records) {
      const current = totals.get(record.pondId) || { count: 0, biomass: 0 };
      current.count += Number(record.count);
      current.biomass += Number(record.estimatedWeightKg);
      totals.set(record.pondId, current);
    }
    for (const [pondId, total] of totals) {
      const before = beforeById.get(pondId);
      const after = nextById.get(pondId);
      if (!before || !after || before.fishCount - after.fishCount !== total.count || !nearlyEqual(before.biomassKg - after.biomassKg, total.biomass) || after.dailyMortalityCount - before.dailyMortalityCount !== total.count) return { ok: false, error: 'MORTALITY_CONSERVATION_FAILED' };
    }
  }

  return { ok: true };
}

function validateTransferConservation(previous: State, next: State): { ok: boolean; error?: string } {
  const transfers = newRows(previous, next, 'transfers').filter((transfer) => transfer.status === 'COMPLETED');
  if (!transfers.length) return { ok: true };
  const pondDeltas = new Map<string, { count: number; biomass: number }>();
  const tankDeltas = new Map<string, { count: number; biomass: number }>();
  const larvalDeltas = new Map<string, { count: number; biomass: number }>();
  const addDelta = (map: Map<string, { count: number; biomass: number }>, id: string, count: number, biomass: number) => {
    const current = map.get(id) || { count: 0, biomass: 0 };
    current.count += count;
    current.biomass += biomass;
    map.set(id, current);
  };
  for (const transfer of transfers) {
    if (!['Pond', 'Nursery', 'Hatchery'].includes(transfer.sourceType) || !['Pond', 'Nursery'].includes(transfer.destinationType)) return { ok: false, error: 'TRANSFER_DESTINATION_LEDGER_REQUIRED' };
    if (!Number.isInteger(transfer.fishCount) || transfer.fishCount <= 0 || !finiteNonNegative(transfer.totalBiomassKg) || transfer.totalBiomassKg <= 0 || !Number.isFinite(transfer.averageWeightKg) || transfer.averageWeightKg <= 0 || !nearlyEqual(transfer.totalBiomassKg, transfer.fishCount * transfer.averageWeightKg)) return { ok: false, error: 'TRANSFER_INPUT_INVALID' };
    if (transfer.sourceType === 'Pond') addDelta(pondDeltas, transfer.sourceId, -transfer.fishCount, -transfer.totalBiomassKg);
    if (transfer.sourceType === 'Nursery') addDelta(tankDeltas, transfer.sourceId, -transfer.fishCount, -transfer.totalBiomassKg);
    if (transfer.sourceType === 'Hatchery' && transfer.destinationType === 'Pond') addDelta(larvalDeltas, transfer.sourceId, -transfer.fishCount, -transfer.totalBiomassKg);
    if (transfer.destinationType === 'Pond') addDelta(pondDeltas, transfer.destinationId, transfer.fishCount, transfer.totalBiomassKg);
    if (transfer.destinationType === 'Nursery') addDelta(tankDeltas, transfer.destinationId, transfer.fishCount, transfer.totalBiomassKg);
  }
  for (const [pondId, delta] of pondDeltas) {
    const before = pondById(previous, pondId); const after = pondById(next, pondId);
    if (!before || !after || after.fishCount - before.fishCount !== delta.count || !nearlyEqual(after.biomassKg - before.biomassKg, delta.biomass)) return { ok: false, error: 'TRANSFER_CONSERVATION_FAILED' };
  }
  for (const [tankId, delta] of tankDeltas) {
    const before = collection(previous, 'nurseryTanks').find((tank) => tank.id === tankId);
    const after = collection(next, 'nurseryTanks').find((tank) => tank.id === tankId);
    if (!before || !after || after.fishCount - before.fishCount !== delta.count || !nearlyEqual((after.totalBiomassGrams - before.totalBiomassGrams) / 1000, delta.biomass)) return { ok: false, error: 'TRANSFER_NURSERY_CONSERVATION_FAILED' };
  }
  for (const [batchId, delta] of larvalDeltas) {
    const before = collection(previous, 'larvae').find((batch) => batch.id === batchId); const after = collection(next, 'larvae').find((batch) => batch.id === batchId);
    if (!before || !after || after.larvalCount - before.larvalCount !== delta.count || !finiteNonNegative(before.totalBiomassKg) || !finiteNonNegative(after.totalBiomassKg) || !nearlyEqual((after.totalBiomassKg || 0) - (before.totalBiomassKg || 0), delta.biomass)) return { ok: false, error: 'TRANSFER_HATCHERY_CONSERVATION_FAILED' };
  }
  for (const transfer of transfers.filter((item) => item.sourceType === 'Hatchery' && item.destinationType === 'Nursery')) {
    const batch = collection(next, 'larvae').find((row) => row.id === transfer.sourceId);
    const tank = collection(next, 'nurseryTanks').find((row) => row.id === transfer.destinationId);
    if (!batch || !tank || batch.currentTankId !== tank.id || batch.larvalCount !== transfer.fishCount || !nearlyEqual(batch.totalBiomassKg || 0, transfer.totalBiomassKg) || tank.currentBatchId !== batch.id || tank.fishCount !== transfer.fishCount || !nearlyEqual(tank.totalBiomassGrams / 1000, transfer.totalBiomassKg)) return { ok: false, error: 'TRANSFER_HATCHERY_DESTINATION_LEDGER_REQUIRED' };
  }
  for (const transfer of transfers.filter((item) => item.sourceType === 'Nursery')) {
    const beforeTank = collection(previous, 'nurseryTanks').find((tank) => tank.id === transfer.sourceId);
    const afterTank = collection(next, 'nurseryTanks').find((tank) => tank.id === transfer.sourceId);
    if (!beforeTank || !afterTank) return { ok: false, error: 'TRANSFER_NURSERY_SOURCE_LEDGER_REQUIRED' };
    if (beforeTank.currentBatchId) {
      const beforeBatch = collection(previous, 'larvae').find((batch) => batch.id === beforeTank.currentBatchId);
      const afterBatch = collection(next, 'larvae').find((batch) => batch.id === beforeTank.currentBatchId);
      if (!beforeBatch || !afterBatch) return { ok: false, error: 'TRANSFER_NURSERY_BATCH_LEDGER_REQUIRED' };
      if (beforeBatch.larvalCount !== beforeTank.fishCount || !finiteNonNegative(beforeBatch.totalBiomassKg) || !nearlyEqual(beforeBatch.totalBiomassKg || 0, beforeTank.totalBiomassGrams / 1000)) return { ok: false, error: 'TRANSFER_NURSERY_BATCH_LEDGER_REQUIRED' };
      if (transfer.destinationType === 'Pond') {
        const expectedCount = beforeBatch.larvalCount - transfer.fishCount;
        const expectedBiomass = Number(Math.max(0, (beforeBatch.totalBiomassKg || 0) - transfer.totalBiomassKg).toFixed(3));
        if (afterBatch.larvalCount !== expectedCount || !finiteNonNegative(afterBatch.totalBiomassKg) || !nearlyEqual(afterBatch.totalBiomassKg || 0, expectedBiomass) || (afterBatch.currentTankId || undefined) !== (expectedCount > 0 ? beforeTank.id : undefined)) return { ok: false, error: 'TRANSFER_NURSERY_BATCH_CONSERVATION_FAILED' };
      } else {
        const destinationTank = collection(next, 'nurseryTanks').find((tank) => tank.id === transfer.destinationId);
        if (!destinationTank || afterTank.currentBatchId || destinationTank.currentBatchId !== beforeBatch.id || afterBatch.currentTankId !== destinationTank.id || destinationTank.fishCount !== transfer.fishCount || !nearlyEqual(destinationTank.totalBiomassGrams / 1000, transfer.totalBiomassKg)) return { ok: false, error: 'TRANSFER_NURSERY_RELOCATION_LEDGER_REQUIRED' };
      }
    }
  }
  return { ok: true };
}

function validateInventoryConservation(previous: State, next: State): { ok: boolean; error?: string } {
  const beforeById = new Map(collection(previous, 'inventory').map((item) => [item.id, item]));
  const nextById = new Map(collection(next, 'inventory').map((item) => [item.id, item]));
  if (collection(next, 'inventory').some((item) => !beforeById.has(item.id)) || collection(previous, 'inventory').some((item) => !nextById.has(item.id))) return { ok: false, error: 'INVENTORY_ITEM_REGISTERED_WORKFLOW_REQUIRED' };
  const newTransactions = newRows(previous, next, 'inventoryTxs');
  const transactionTotals = new Map<string, number>();
  for (const tx of newTransactions) {
    const item = nextById.get(tx.itemId);
    if (!item || !Number.isFinite(tx.quantityChange) || tx.quantityChange === 0 || tx.unit !== item.unit || !nearlyEqual(tx.resultingQuantity, item.quantity, 0.0001)) return { ok: false, error: 'INVENTORY_TRANSACTION_INVALID' };
    transactionTotals.set(tx.itemId, (transactionTotals.get(tx.itemId) || 0) + tx.quantityChange);
  }
  for (const [itemId, before] of beforeById) {
    const after = nextById.get(itemId)!;
    const delta = Number(after.quantity) - Number(before.quantity);
    const ledgerDelta = transactionTotals.get(itemId) || 0;
    if (!nearlyEqual(delta, ledgerDelta, 0.0001)) return { ok: false, error: 'INVENTORY_CONSERVATION_FAILED' };
  }
  return { ok: true };
}

function validateColdStorageMutation(previous: State, next: State, operation: { module?: string; action?: string }): { ok: boolean; error?: string } {
  const module = operation.module || '';
  const beforeById = new Map(collection(previous, 'coldStorage').map((lot) => [lot.id, lot]));
  const nextById = new Map(collection(next, 'coldStorage').map((lot) => [lot.id, lot]));
  if (module === 'processing') {
    const batches = newRows(previous, next, 'processingBatches');
    const expected = new Set(batches.flatMap((batch) => Array.isArray(batch.outputLotIds) ? batch.outputLotIds : []));
    for (const lot of collection(previous, 'coldStorage')) if (!sameValue(lot, nextById.get(lot.id))) return { ok: false, error: 'PROCESSING_EXISTING_STORAGE_MODIFIED' };
    for (const lot of collection(next, 'coldStorage')) if (!beforeById.has(lot.id) && !expected.has(lot.id)) return { ok: false, error: 'PROCESSING_UNRELATED_STORAGE_ADDED' };
    return { ok: true };
  }
  if (module === 'sales') {
    if (collection(next, 'coldStorage').some((lot) => !beforeById.has(lot.id)) || collection(previous, 'coldStorage').some((lot) => !nextById.has(lot.id))) return { ok: false, error: 'SALE_STORAGE_LEDGER_INVALID' };
    const newlyFulfilled = changedRows(previous, next, 'proformas').filter((proforma) => {
      const before = collection(previous, 'proformas').find((row) => row.id === proforma.id);
      return Boolean(proforma.fulfilledAt && proforma.fulfillmentTransactionId && !before?.fulfilledAt && !before?.fulfillmentTransactionId);
    });
    const changedLots = changedRows(previous, next, 'coldStorage');
    if (!changedLots.length) return { ok: true };
    if (!newlyFulfilled.length) return { ok: false, error: 'SALE_FULFILLMENT_LEDGER_MISSING' };
    const allowedLots = changedLots.every((lot) => newlyFulfilled.some((proforma) => proforma.items?.some((item: any) => saleLotMatchesSku(lot, item.sku))));
    if (!allowedLots) return { ok: false, error: 'SALE_UNRELATED_STORAGE_MODIFIED' };
    for (const lot of changedLots) {
      const before = beforeById.get(lot.id);
      const nextUnits = Number(lot.unitsCount || 0);
      const nextWeight = Number(lot.weightKg);
      const beforeUnits = Number(before?.unitsCount || 0);
      const beforeWeight = Number(before?.weightKg);
      if (!before || !finiteNonNegative(nextUnits) || !finiteNonNegative(nextWeight) || !finiteNonNegative(beforeUnits) || !finiteNonNegative(beforeWeight) || nextUnits > beforeUnits || nextWeight > beforeWeight) return { ok: false, error: 'SALE_STORAGE_INCREASE_FORBIDDEN' };
      const immutableBefore = { ...before, unitsCount: undefined, weightKg: undefined, status: undefined };
      const immutableAfter = { ...lot, unitsCount: undefined, weightKg: undefined, status: undefined };
      if (!sameValue(immutableBefore, immutableAfter)) return { ok: false, error: 'SALE_STORAGE_METADATA_MODIFIED' };
    }
    return { ok: true };
  }
  if (changedStateCollections(previous, next).includes('coldStorage')) return { ok: false, error: 'COLD_STORAGE_MUTATION_NOT_ALLOWED' };
  return { ok: true };
}

function validateAccountingConservation(previous: State, next: State): { ok: boolean; error?: string } {
  const beforeAccounts = new Map(collection(previous, 'accounts').map((account) => [account.id, account]));
  const nextAccounts = new Map(collection(next, 'accounts').map((account) => [account.id, account]));
  if (collection(next, 'accounts').some((account) => !beforeAccounts.has(account.id)) || collection(previous, 'accounts').some((account) => !nextAccounts.has(account.id))) return { ok: false, error: 'ACCOUNT_REGISTERED_WORKFLOW_REQUIRED' };
  const deltas = new Map<string, number>();
  for (const journal of newRows(previous, next, 'journals')) {
    const allLines = [...collection(journal, 'debits'), ...collection(journal, 'credits')];
    const currencies = new Set(allLines.map((line) => nextAccounts.get(line.accountId)?.currency).filter(Boolean));
    if (currencies.size > 1 || journal.isBalanced !== true || !nearlyEqual(journal.totalDebit, journal.totalCredit, 0.01)) return { ok: false, error: currencies.size > 1 ? 'ACCOUNTING_MIXED_CURRENCY' : 'ACCOUNTING_UNBALANCED' };
    for (const line of collection(journal, 'debits')) {
      const account = nextAccounts.get(line.accountId); if (!account) return { ok: false, error: 'ACCOUNTING_ACCOUNT_NOT_FOUND' };
      deltas.set(line.accountId, (deltas.get(line.accountId) || 0) + Number(line.amount) * (account.type.startsWith('Asset') || account.type.startsWith('Expense') ? 1 : -1));
    }
    for (const line of collection(journal, 'credits')) {
      const account = nextAccounts.get(line.accountId); if (!account) return { ok: false, error: 'ACCOUNTING_ACCOUNT_NOT_FOUND' };
      deltas.set(line.accountId, (deltas.get(line.accountId) || 0) + Number(line.amount) * (account.type.startsWith('Asset') || account.type.startsWith('Expense') ? -1 : 1));
    }
  }
  for (const [id, before] of beforeAccounts) {
    const after = nextAccounts.get(id)!;
    if (!nearlyEqual(Number(after.balance) - Number(before.balance), deltas.get(id) || 0, 0.01)) return { ok: false, error: 'ACCOUNTING_BALANCE_LEDGER_MISMATCH' };
  }
  return { ok: true };
}

export function validateStateMutation(previousRaw: unknown, nextRaw: unknown, operation: { module?: string; action?: string }): { ok: boolean; error?: string } {
  const nextCheck = validateStateSnapshot(nextRaw);
  if (!nextCheck.ok) return nextCheck;
  const feedingStateCheck = validateActiveFeedingState(nextRaw);
  if (!feedingStateCheck.ok) return feedingStateCheck;
  if (!previousRaw) return { ok: true };
  const previous = previousRaw as State;
  const next = nextRaw as State;

  // A restore is an explicit, administrator-only replacement of the whole
  // snapshot. It is still schema/checksum validated above, but must not be
  // rejected as an ordinary append-only mutation.
  if (operation.module === 'backup' && operation.action === 'approve') return { ok: true };

  // Historical telemetry, stock movements and biological events are
  // append-only. Authorized clients may add a new event, but cannot rewrite
  // evidence already accepted by the server.
  for (const key of IMMUTABLE_LEDGER_COLLECTIONS) {
    if (modifiedExistingRows(previous, next, key)) return { ok: false, error: `STATE_IMMUTABLE_RECORD_MODIFIED:${key}` };
    if (deletedExistingRows(previous, next, key)) return { ok: false, error: `STATE_IMMUTABLE_RECORD_DELETED:${key}` };
  }
  for (const key of NON_DELETABLE_REGISTERED_COLLECTIONS) {
    if (deletedExistingRows(previous, next, key)) return { ok: false, error: `STATE_REGISTERED_RECORD_DELETED:${key}` };
  }

  const pondValidation = validatePondMutation(previous, next, operation);
  if (!pondValidation.ok) return pondValidation;
  const inventoryValidation = validateInventoryConservation(previous, next);
  if (!inventoryValidation.ok) return inventoryValidation;
  const storageValidation = validateColdStorageMutation(previous, next, operation);
  if (!storageValidation.ok) return storageValidation;
  if (operation.module === 'accounting' || newRows(previous, next, 'journals').length > 0) {
    const accountingValidation = validateAccountingConservation(previous, next);
    if (!accountingValidation.ok) return accountingValidation;
  }

  const transferValidation = validateTransferConservation(previous, next);
  if (!transferValidation.ok) return transferValidation;

  for (const batch of newRows(previous, next, 'processingBatches')) {
    const before = pondById(previous, batch.sourcePondId);
    const after = pondById(next, batch.sourcePondId);
    const outputs = [batch.caviarYieldKg, batch.filletMeatYieldKg, batch.smokedMeatYieldKg, batch.byProductAndWasteKg];
    if (!before || !after || before.fishCount - after.fishCount !== batch.fishCount || Math.abs((before.biomassKg - after.biomassKg) - batch.liveBiomassKg) > 0.05 || outputs.some((value) => !finiteNonNegative(value)) || Math.abs(outputs.reduce((sum, value) => sum + value, 0) - batch.liveBiomassKg) > 0.05) return { ok: false, error: 'PROCESSING_CONSERVATION_FAILED' };
    if (!Array.isArray(batch.outputLotIds)) return { ok: false, error: 'PROCESSING_OUTPUT_LOTS_MISSING' };
    const lots = collection(next, 'coldStorage').filter((lot) => batch.outputLotIds.includes(lot.id));
    const storedOutput = lots.reduce((sum, lot) => sum + Number(lot.weightKg || 0), 0);
    const storableOutput = Number(batch.caviarYieldKg) + Number(batch.filletMeatYieldKg) + Number(batch.smokedMeatYieldKg);
    if (lots.length !== batch.outputLotIds.length || Math.abs(storedOutput - storableOutput) > 0.05) return { ok: false, error: 'PROCESSING_OUTPUT_LOTS_INVALID' };
  }

  const previousProformas = new Map(collection(previous, 'proformas').map((row) => [row.id, row]));
  for (const proforma of collection(next, 'proformas')) {
    if (!proforma?.fulfilledAt || !proforma?.fulfillmentTransactionId) continue;
    const before = previousProformas.get(proforma.id);
    if (before?.fulfilledAt || before?.fulfillmentTransactionId) continue;
    const saleValidation = validateSaleFulfillmentConservation(collection(previous, 'coldStorage'), collection(next, 'coldStorage'), proforma);
    if (!saleValidation.ok) return { ok: false, error: saleValidation.error || 'SALE_CONSERVATION_FAILED' };
  }

  for (const record of newRows(previous, next, 'feedingRecords')) {
    const pond = pondById(next, record.pondId);
    const latest = collection(next, 'waterLogs').filter((log) => log.pondId === record.pondId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (!pond || pond.feedingStatus === 'STOPPED' || pond.activeTreatmentId || !latest || record.telemetryTimestamp !== latest.timestamp) return { ok: false, error: 'FEEDING_TELEMETRY_NOT_AUTHORITATIVE' };
    if (!['kg', 'g', 'gram', 'cup', 'cup250g', 'ton', 't', 'bag_25kg'].includes(String(record.unit))) return { ok: false, error: 'FEEDING_UNIT_INVALID' };
    const safety = assessWaterSafetyForFeeding({ dissolvedOxygen: latest.dissolvedOxygen, waterTemperature: latest.temperature, ph: latest.ph, ammonia: latest.ammonia, nitrite: latest.nitrite, timestamp: latest.timestamp });
    if (!safety.isSafeForFeeding || latest.sensorStatus !== 'VALID' || !finiteNonNegative(record.actualAmountKg) || record.actualAmountKg <= 0) return { ok: false, error: 'FEEDING_SAFETY_FAILED' };
    const feedItem = collection(next, 'inventory').find((item) => item.sku === record.feedTypeSku);
    const actualKg = normalizeFeedAmountToKg(Number(record.actualAmountKg), record.unit);
    const expectedConsumption = feedItem ? -inventoryQuantityForFeedKg(feedItem, actualKg) : Number.NaN;
    const matchingConsumption = collection(next, 'inventoryTxs').some((tx) => tx.referenceDoc === record.id && tx.sku === record.feedTypeSku && Number.isFinite(expectedConsumption) && nearlyEqual(tx.quantityChange, expectedConsumption, 0.0001));
    if (!matchingConsumption) return { ok: false, error: 'FEEDING_STOCK_TRANSACTION_MISSING' };
  }

  if (operation.module === 'accounting' || newRows(previous, next, 'journals').length > 0) {
    const accounts = new Map(collection(next, 'accounts').map((account) => [account.id, account]));
    for (const journal of newRows(previous, next, 'journals')) {
      const currencies = new Set([...collection(journal, 'debits'), ...collection(journal, 'credits')].map((line) => accounts.get(line.accountId)?.currency).filter(Boolean));
      if (currencies.size > 1) return { ok: false, error: 'ACCOUNTING_MIXED_CURRENCY' };
      if (Math.abs(Number(journal.totalDebit) - Number(journal.totalCredit)) > 0.01) return { ok: false, error: 'ACCOUNTING_UNBALANCED' };
    }
  }
  return { ok: true };
}
