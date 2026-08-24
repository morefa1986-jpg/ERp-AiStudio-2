import { getStoredSessionToken } from '../context/AuthContext';
import { JournalEntry } from '../types';

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface FxPostingInput {
  date: string;
  description: string;
  sourceAccountId: string;
  targetAccountId: string;
  sourceAmount: number;
  sourceToTargetRate: number;
  referenceId?: string;
}

export async function postFxConversion(input: FxPostingInput): Promise<{ groupId: string; journals: JournalEntry[] }> {
  const response = await fetch('/api/accounting/fx', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !payload.groupId || !Array.isArray(payload.journals)) throw new Error(payload.error || 'FX_POSTING_FAILED');
  return { groupId: String(payload.groupId), journals: payload.journals as JournalEntry[] };
}

export function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
