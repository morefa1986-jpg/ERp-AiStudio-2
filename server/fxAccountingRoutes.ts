import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { StateConflictError, StoredAuditLog } from './storage';
import { validateMutationScope, validateStateMutation, validateStateSnapshot } from '../src/utils/stateIntegrity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; fullName?: string; [key: string]: unknown };
}

interface StateEnvelope {
  version: number;
  data: Record<string, unknown>;
}

interface Dependencies {
  requireAuth: any;
  store: {
    getState(): StateEnvelope | null | undefined;
    saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope;
  };
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

const FX_WRITE_ROLES = new Set(['Super Admin', 'Farm Owner', 'Farm Manager', 'Accountant']);

function rows(state: Record<string, unknown>, key: string): any[] {
  return Array.isArray(state[key]) ? state[key] as any[] : [];
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

function safeCurrency(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
}

function bridgeAccount(currency: string) {
  const code = safeCurrency(currency);
  return {
    id: `sys_fx_position_${code}`,
    code: `FX-${code}`,
    name: `FX Position ${code}`,
    faName: `موقعیت تسویه تبدیل ارز ${code}`,
    type: 'Equity (سرمایه)',
    balance: 0,
    currency: code,
    isSystem: true,
    systemPurpose: 'FX_POSITION',
  };
}

function ensureBridge(accounts: any[], currency: string): { accounts: any[]; account: any; created: boolean } | { error: string } {
  const expected = bridgeAccount(currency);
  const current = accounts.find((row) => row?.id === expected.id);
  if (current) {
    if (current.currency !== expected.currency || current.type !== expected.type || current.systemPurpose !== 'FX_POSITION') return { error: 'FX_SYSTEM_ACCOUNT_CONFLICT' };
    return { accounts, account: current, created: false };
  }
  return { accounts: [...accounts, expected], account: expected, created: true };
}

export function buildFxPostingMutation(
  state: Record<string, unknown>,
  input: {
    date: string;
    description: string;
    sourceAccountId: string;
    targetAccountId: string;
    sourceAmount: number;
    sourceToTargetRate: number;
    referenceId?: string;
    approvedBy?: string;
  },
  now = Date.now(),
): { ok: boolean; error?: string; state?: Record<string, unknown>; journals?: any[]; groupId?: string } {
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) return { ok: false, error: 'FX_DATE_INVALID' };
  if (!input.description?.trim()) return { ok: false, error: 'FX_DESCRIPTION_REQUIRED' };
  if (!Number.isFinite(input.sourceAmount) || input.sourceAmount <= 0) return { ok: false, error: 'FX_SOURCE_AMOUNT_INVALID' };
  if (!Number.isFinite(input.sourceToTargetRate) || input.sourceToTargetRate <= 0) return { ok: false, error: 'FX_RATE_INVALID' };

  const journals = rows(state, 'journals');
  const referenceId = String(input.referenceId || '').trim();
  if (referenceId && journals.some((journal) => journal?.fxReferenceId === referenceId)) return { ok: false, error: 'FX_REFERENCE_DUPLICATE' };

  const originalAccounts = rows(state, 'accounts');
  const source = originalAccounts.find((account) => account?.id === input.sourceAccountId);
  const target = originalAccounts.find((account) => account?.id === input.targetAccountId);
  if (!source || !target) return { ok: false, error: 'FX_ACCOUNT_NOT_FOUND' };
  if (source.id === target.id) return { ok: false, error: 'FX_ACCOUNTS_MUST_DIFFER' };
  if (source.currency === target.currency) return { ok: false, error: 'FX_CURRENCIES_MUST_DIFFER' };
  if (!String(source.type).startsWith('Asset') || !String(target.type).startsWith('Asset')) return { ok: false, error: 'FX_ONLY_ASSET_ACCOUNTS' };

  const sourceAmount = money(input.sourceAmount);
  const targetAmount = money(sourceAmount * input.sourceToTargetRate);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return { ok: false, error: 'FX_TARGET_AMOUNT_INVALID' };
  if (!Number.isFinite(Number(source.balance)) || Number(source.balance) < sourceAmount) return { ok: false, error: 'FX_SOURCE_BALANCE_INSUFFICIENT' };

  let workingAccounts = originalAccounts.map((account) => ({ ...account }));
  const sourceBridgeResult = ensureBridge(workingAccounts, source.currency);
  if ('error' in sourceBridgeResult) return { ok: false, error: sourceBridgeResult.error };
  workingAccounts = sourceBridgeResult.accounts;
  const targetBridgeResult = ensureBridge(workingAccounts, target.currency);
  if ('error' in targetBridgeResult) return { ok: false, error: targetBridgeResult.error };
  workingAccounts = targetBridgeResult.accounts;

  const sourceBridge = workingAccounts.find((account) => account.id === sourceBridgeResult.account.id)!;
  const targetBridge = workingAccounts.find((account) => account.id === targetBridgeResult.account.id)!;
  const groupId = `fx_${crypto.randomUUID()}`;
  const createdAt = new Date(now).toISOString();
  const fxMeta = {
    sourceAccountId: source.id,
    targetAccountId: target.id,
    sourceCurrency: source.currency,
    targetCurrency: target.currency,
    sourceAmount,
    targetAmount,
    sourceToTargetRate: input.sourceToTargetRate,
  };

  const sourceJournal = {
    id: `jnl_${crypto.randomUUID()}`,
    entryNumber: `FX-SRC-${createdAt.replace(/\D/g, '').slice(0, 14)}`,
    date: input.date,
    description: `${input.description.trim()} · Source leg`,
    referenceType: 'FX',
    referenceId: `${referenceId || groupId}:SRC`,
    debits: [{ accountId: sourceBridge.id, accountName: sourceBridge.faName || sourceBridge.name, amount: sourceAmount }],
    credits: [{ accountId: source.id, accountName: source.faName || source.name, amount: sourceAmount }],
    totalDebit: sourceAmount,
    totalCredit: sourceAmount,
    isBalanced: true,
    approvedBy: input.approvedBy,
    createdAt,
    isFxConversion: true,
    fx: fxMeta,
    fxGroupId: groupId,
    fxReferenceId: referenceId || undefined,
    fxLeg: 'SOURCE',
  };

  const targetJournal = {
    id: `jnl_${crypto.randomUUID()}`,
    entryNumber: `FX-DST-${createdAt.replace(/\D/g, '').slice(0, 14)}`,
    date: input.date,
    description: `${input.description.trim()} · Target leg`,
    referenceType: 'FX',
    referenceId: `${referenceId || groupId}:DST`,
    debits: [{ accountId: target.id, accountName: target.faName || target.name, amount: targetAmount }],
    credits: [{ accountId: targetBridge.id, accountName: targetBridge.faName || targetBridge.name, amount: targetAmount }],
    totalDebit: targetAmount,
    totalCredit: targetAmount,
    isBalanced: true,
    approvedBy: input.approvedBy,
    createdAt,
    isFxConversion: true,
    fx: fxMeta,
    fxGroupId: groupId,
    fxReferenceId: referenceId || undefined,
    fxLeg: 'TARGET',
  };

  workingAccounts = workingAccounts.map((account) => {
    if (account.id === source.id) return { ...account, balance: money(Number(account.balance) - sourceAmount) };
    if (account.id === target.id) return { ...account, balance: money(Number(account.balance) + targetAmount) };
    if (account.id === sourceBridge.id) return { ...account, balance: money(Number(account.balance) - sourceAmount) };
    if (account.id === targetBridge.id) return { ...account, balance: money(Number(account.balance) + targetAmount) };
    return account;
  });

  const baseline = { ...state, accounts: workingAccounts.map((account) => {
    if (account.id === source.id) return { ...account, balance: Number(source.balance) };
    if (account.id === target.id) return { ...account, balance: Number(target.balance) };
    if (account.id === sourceBridge.id) return { ...account, balance: sourceBridgeResult.created ? 0 : Number(sourceBridge.balance) };
    if (account.id === targetBridge.id) return { ...account, balance: targetBridgeResult.created ? 0 : Number(targetBridge.balance) };
    return account;
  }) };

  const next = { ...state, accounts: workingAccounts, journals: [targetJournal, sourceJournal, ...journals] };
  const snapshot = validateStateSnapshot(next);
  if (!snapshot.ok) return { ok: false, error: snapshot.error };
  const operation = { module: 'accounting', action: 'create' };
  const invariant = validateStateMutation(baseline, next, operation);
  if (!invariant.ok) return { ok: false, error: invariant.error };
  const scope = validateMutationScope(state, next, operation);
  if (!scope.ok) return { ok: false, error: scope.error };

  return { ok: true, state: next, journals: [sourceJournal, targetJournal], groupId };
}

export function registerFxAccountingRoutes(app: Express, deps: Dependencies): void {
  app.post('/api/accounting/fx', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !FX_WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = deps.store.getState();
    if (!previous) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });

    const mutation = buildFxPostingMutation(previous.data, {
      date: String(req.body?.date || ''),
      description: String(req.body?.description || ''),
      sourceAccountId: String(req.body?.sourceAccountId || ''),
      targetAccountId: String(req.body?.targetAccountId || ''),
      sourceAmount: Number(req.body?.sourceAmount),
      sourceToTargetRate: Number(req.body?.sourceToTargetRate),
      referenceId: typeof req.body?.referenceId === 'string' ? req.body.referenceId : undefined,
      approvedBy: String(req.user.fullName || req.user.id),
    });
    if (!mutation.ok || !mutation.state || !mutation.journals || !mutation.groupId) return res.status(422).json({ success: false, error: mutation.error || 'FX_POSTING_FAILED' });

    const operation = { module: 'accounting', action: 'create', entity: 'FxConversion', entityId: mutation.groupId };
    const audit = deps.auditFromOperation(req, operation, undefined, JSON.stringify({ groupId: mutation.groupId, journals: mutation.journals.map((journal) => journal.id) }));
    if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    try {
      const saved = deps.store.saveStateAndAudit(mutation.state, previous.version, audit);
      return res.json({ success: true, groupId: mutation.groupId, journals: mutation.journals, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
    } catch (error) {
      if (error instanceof StateConflictError) return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT' });
      return res.status(500).json({ success: false, error: 'FX_SAVE_FAILED' });
    }
  });
}
