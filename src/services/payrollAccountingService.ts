import { getStoredSessionToken } from '../context/AuthContext';
import type { Account, JournalEntry, PayrollRecord } from '../types';
import { buildPayrollJournalDraft } from '../utils/payrollAccounting';

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function rows<T>(state: Record<string, unknown>, key: string): T[] {
  return Array.isArray(state[key]) ? state[key] as T[] : [];
}

function nextJournalNumber(journals: JournalEntry[]): string {
  const next = journals.length + 1;
  return `JE-${String(next).padStart(6, '0')}`;
}

export async function postPayrollAccrualOnServerState(input: { payrollMonth: string; currency: string; approvedBy?: string }): Promise<JournalEntry> {
  const getResponse = await fetch('/api/state', { headers: headers() });
  const current = await getResponse.json().catch(() => ({}));
  if (!getResponse.ok || !current.success || !current.state?.data) throw new Error(current.error || 'STATE_LOAD_FAILED');
  const state = current.state.data as Record<string, unknown>;
  const payrolls = rows<PayrollRecord>(state, 'payrolls');
  const accounts = rows<Account>(state, 'accounts');
  const journals = rows<JournalEntry>(state, 'journals');
  const draftResult = buildPayrollJournalDraft({ payrolls, accounts, payrollMonth: input.payrollMonth, currency: input.currency, approvedBy: input.approvedBy });
  if (!draftResult.success || !draftResult.draft) throw new Error(draftResult.error || 'PAYROLL_JOURNAL_DRAFT_FAILED');
  if (journals.some((journal) => journal.referenceType === 'Payroll' && journal.referenceId === draftResult.draft?.referenceId)) throw new Error('PAYROLL_JOURNAL_ALREADY_POSTED');
  const journal: JournalEntry = {
    id: `journal_${draftResult.draft.referenceId}`,
    entryNumber: nextJournalNumber(journals),
    date: draftResult.draft.date,
    referenceType: draftResult.draft.referenceType,
    referenceId: draftResult.draft.referenceId,
    description: draftResult.draft.description,
    debits: draftResult.draft.debits,
    credits: draftResult.draft.credits,
    totalDebit: draftResult.draft.totalDebit,
    totalCredit: draftResult.draft.totalCredit,
    isBalanced: true,
    approvedBy: draftResult.draft.approvedBy || input.approvedBy || 'ERP User',
  } as JournalEntry;
  const nextState = { ...state, journals: [journal, ...journals] };
  const putResponse = await fetch('/api/state', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      state: nextState,
      version: current.state.version,
      operation: { module: 'accounting', action: 'create', entity: 'PayrollJournal', entityId: journal.id, referenceId: journal.referenceId },
    }),
  });
  const saved = await putResponse.json().catch(() => ({}));
  if (!putResponse.ok || !saved.success) throw new Error(saved.error || 'PAYROLL_JOURNAL_SAVE_FAILED');
  return journal;
}
