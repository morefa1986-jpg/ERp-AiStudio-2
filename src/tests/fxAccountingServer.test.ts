import { describe, expect, it } from 'vitest';
import { buildFxPostingMutation } from '../../server/fxAccountingRoutes';
import { validateStateSnapshot } from '../utils/stateIntegrity';

function baseState() {
  return {
    halls: [], ponds: [], species: [], feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [],
    treatments: [], transfers: [], broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [],
    inventory: [], inventoryTxs: [], labSamples: [], processingBatches: [], coldStorage: [], customers: [], proformas: [],
    accounts: [
      { id: 'acc_usd', code: 'USD-01', name: 'USD Bank', faName: 'بانک دلاری', type: 'Asset (دارایی)', balance: 1_000, currency: 'USD' },
      { id: 'acc_irr', code: 'IRR-01', name: 'IRR Bank', faName: 'بانک ریالی', type: 'Asset (دارایی)', balance: 100_000_000, currency: 'IRR' },
      { id: 'acc_eur', code: 'EUR-01', name: 'EUR Bank', faName: 'بانک یورویی', type: 'Asset (دارایی)', balance: 500, currency: 'EUR' },
    ],
    journals: [], employees: [], attendance: [], payrolls: [], equipment: [], socialPosts: [], auditLogs: [], backups: [],
  } as Record<string, unknown>;
}

describe('registered server FX workflow', () => {
  it('creates two balanced same-currency journals and system FX position accounts', () => {
    const result = buildFxPostingMutation(baseState(), {
      date: '2026-08-24', description: 'USD to IRR conversion', sourceAccountId: 'acc_usd', targetAccountId: 'acc_irr',
      sourceAmount: 100, sourceToTargetRate: 620_000, referenceId: 'FX-E2E-001', approvedBy: 'Accountant',
    }, new Date('2026-08-24T08:00:00Z').getTime());

    expect(result.ok).toBe(true);
    expect(result.journals).toHaveLength(2);
    const [sourceJournal, targetJournal] = result.journals!;
    expect(sourceJournal.totalDebit).toBe(sourceJournal.totalCredit);
    expect(targetJournal.totalDebit).toBe(targetJournal.totalCredit);
    expect(sourceJournal.debits[0].amount).toBe(100);
    expect(targetJournal.debits[0].amount).toBe(62_000_000);
    expect(sourceJournal.fxGroupId).toBe(targetJournal.fxGroupId);

    const next = result.state! as any;
    expect(next.accounts.find((row: any) => row.id === 'acc_usd').balance).toBe(900);
    expect(next.accounts.find((row: any) => row.id === 'acc_irr').balance).toBe(162_000_000);
    expect(next.accounts.find((row: any) => row.id === 'sys_fx_position_USD')).toMatchObject({ currency: 'USD', balance: -100, systemPurpose: 'FX_POSITION' });
    expect(next.accounts.find((row: any) => row.id === 'sys_fx_position_IRR')).toMatchObject({ currency: 'IRR', balance: 62_000_000, systemPurpose: 'FX_POSITION' });
    expect(validateStateSnapshot(next)).toEqual({ ok: true });
  });

  it('reuses registered FX position accounts on subsequent conversions', () => {
    const first = buildFxPostingMutation(baseState(), {
      date: '2026-08-24', description: 'First', sourceAccountId: 'acc_usd', targetAccountId: 'acc_irr', sourceAmount: 100, sourceToTargetRate: 620_000, referenceId: 'FX-1',
    });
    const second = buildFxPostingMutation(first.state!, {
      date: '2026-08-24', description: 'Second', sourceAccountId: 'acc_usd', targetAccountId: 'acc_irr', sourceAmount: 50, sourceToTargetRate: 620_000, referenceId: 'FX-2',
    });
    expect(second.ok).toBe(true);
    const accounts = (second.state as any).accounts;
    expect(accounts.filter((row: any) => row.id === 'sys_fx_position_USD')).toHaveLength(1);
    expect(accounts.filter((row: any) => row.id === 'sys_fx_position_IRR')).toHaveLength(1);
    expect(accounts.find((row: any) => row.id === 'sys_fx_position_USD').balance).toBe(-150);
    expect(accounts.find((row: any) => row.id === 'sys_fx_position_IRR').balance).toBe(93_000_000);
  });

  it('rejects duplicate references, same-currency conversion and insufficient source balance', () => {
    const first = buildFxPostingMutation(baseState(), {
      date: '2026-08-24', description: 'First', sourceAccountId: 'acc_usd', targetAccountId: 'acc_irr', sourceAmount: 100, sourceToTargetRate: 620_000, referenceId: 'FX-DUP',
    });
    expect(buildFxPostingMutation(first.state!, {
      date: '2026-08-24', description: 'Duplicate', sourceAccountId: 'acc_usd', targetAccountId: 'acc_irr', sourceAmount: 10, sourceToTargetRate: 620_000, referenceId: 'FX-DUP',
    }).error).toBe('FX_REFERENCE_DUPLICATE');

    const sameCurrency = { ...baseState(), accounts: [...(baseState().accounts as any[]), { id: 'acc_usd_2', code: 'USD-02', name: 'USD 2', faName: 'دلار ۲', type: 'Asset (دارایی)', balance: 100, currency: 'USD' }] };
    expect(buildFxPostingMutation(sameCurrency, {
      date: '2026-08-24', description: 'Same', sourceAccountId: 'acc_usd', targetAccountId: 'acc_usd_2', sourceAmount: 10, sourceToTargetRate: 1,
    }).error).toBe('FX_CURRENCIES_MUST_DIFFER');

    expect(buildFxPostingMutation(baseState(), {
      date: '2026-08-24', description: 'Too much', sourceAccountId: 'acc_usd', targetAccountId: 'acc_irr', sourceAmount: 2_000, sourceToTargetRate: 620_000,
    }).error).toBe('FX_SOURCE_BALANCE_INSUFFICIENT');
  });
});
