import React, { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import {
  appendDurableEntry,
  DurableStateOperation,
  inferDurableOperation,
  queueDurableWrite,
  trimDurableEntriesToCount,
} from '../../utils/durableOutbox';

function withoutBackupPayload(backups: any[]): any[] {
  return backups.map((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;
    const { data: _data, ...metadata } = snapshot;
    return metadata;
  });
}

const INITIALIZATION_FALLBACK: DurableStateOperation = {
  module: 'settings',
  action: 'manage',
  entity: 'StateInitializationOrRecovery',
};

export const DurableOutboxBridge: React.FC = () => {
  const { currentUser } = useAuth();
  const farm = useFarm();

  const snapshot = useMemo<Record<string, unknown>>(() => ({
    halls: farm.halls,
    ponds: farm.ponds,
    species: farm.species,
    feedingRecords: farm.feedingRecords,
    biometricSessions: farm.biometricSessions,
    waterLogs: farm.waterLogs,
    mortalityRecords: farm.mortalityRecords,
    treatments: farm.treatments,
    transfers: farm.transfers,
    broodstock: farm.broodstock,
    fertilizations: farm.fertilizations,
    incubators: farm.incubators,
    larvae: farm.larvae,
    nurseryTanks: farm.nurseryTanks,
    inventory: farm.inventory,
    inventoryTxs: farm.inventoryTxs,
    labSamples: farm.labSamples,
    processingBatches: farm.processingBatches,
    coldStorage: farm.coldStorage,
    customers: farm.customers,
    proformas: farm.proformas,
    officeDocuments: farm.officeDocuments,
    officeSettings: farm.officeSettings,
    gatePasses: farm.gatePasses,
    chatThreads: farm.chatThreads,
    chatMessages: farm.chatMessages,
    accounts: farm.accounts,
    journals: farm.journals,
    employees: farm.employees,
    attendance: farm.attendance,
    payrolls: farm.payrolls,
    equipment: farm.equipment,
    socialPosts: farm.socialPosts,
    auditLogs: farm.auditLogs,
    backups: withoutBackupPayload(farm.backups),
  }), [
    farm.halls, farm.ponds, farm.species, farm.feedingRecords, farm.biometricSessions, farm.waterLogs,
    farm.mortalityRecords, farm.treatments, farm.transfers, farm.broodstock, farm.fertilizations,
    farm.incubators, farm.larvae, farm.nurseryTanks, farm.inventory, farm.inventoryTxs, farm.labSamples,
    farm.processingBatches, farm.coldStorage, farm.customers, farm.proformas, farm.officeDocuments, farm.officeSettings, farm.gatePasses, farm.chatThreads, farm.chatMessages, farm.accounts, farm.journals,
    farm.employees, farm.attendance, farm.payrolls, farm.equipment, farm.socialPosts, farm.auditLogs, farm.backups,
  ]);

  const previousState = useRef<Record<string, unknown>>(snapshot);
  const previousPending = useRef(farm.syncStatus.pendingChangesCount);
  const previousUserId = useRef(currentUser?.id || '');

  useEffect(() => {
    const userId = currentUser?.id || '';
    const pending = farm.syncStatus.pendingChangesCount;

    if (!userId) {
      previousUserId.current = '';
      previousState.current = snapshot;
      previousPending.current = pending;
      return;
    }

    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      previousState.current = snapshot;
      previousPending.current = pending;
      return;
    }

    const delta = pending - previousPending.current;
    if (delta > 0) {
      const operation = inferDurableOperation(previousState.current, snapshot) || INITIALIZATION_FALLBACK;
      queueDurableWrite(async () => {
        for (let index = 0; index < delta; index += 1) {
          await appendDurableEntry(userId, operation, snapshot);
        }
      });
    } else if (delta < 0) {
      queueDurableWrite(() => trimDurableEntriesToCount(userId, pending));
    }

    previousState.current = snapshot;
    previousPending.current = pending;
  }, [currentUser?.id, farm.syncStatus.pendingChangesCount, snapshot]);

  return null;
};
