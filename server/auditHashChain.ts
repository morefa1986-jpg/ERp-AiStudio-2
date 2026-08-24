import crypto from 'crypto';

export interface AuditHashInput {
  id: string;
  timestamp: string;
  userId?: string;
  userRole?: string;
  action: string;
  entity: string;
  entityId: string;
  beforeState?: string;
  afterState?: string;
  transactionId?: string;
}

export interface AuditHashRow extends AuditHashInput {
  previousHash: string;
  hash: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

export function hashAuditRow(input: AuditHashInput, previousHash = 'GENESIS'): string {
  const payload = canonical({
    id: input.id,
    timestamp: input.timestamp,
    userId: input.userId || '',
    userRole: input.userRole || '',
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    beforeState: input.beforeState || '',
    afterState: input.afterState || '',
    transactionId: input.transactionId || '',
    previousHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function buildAuditHashChain(rows: AuditHashInput[], genesis = 'GENESIS'): AuditHashRow[] {
  let previousHash = genesis;
  return rows.map((row) => {
    const hash = hashAuditRow(row, previousHash);
    const chained = { ...row, previousHash, hash };
    previousHash = hash;
    return chained;
  });
}

export function verifyAuditHashChain(rows: AuditHashRow[], genesis = 'GENESIS'): { ok: boolean; error?: string; index?: number } {
  let previousHash = genesis;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.previousHash !== previousHash) return { ok: false, error: 'AUDIT_PREVIOUS_HASH_MISMATCH', index };
    const expected = hashAuditRow(row, previousHash);
    if (row.hash !== expected) return { ok: false, error: 'AUDIT_HASH_MISMATCH', index };
    previousHash = row.hash;
  }
  return { ok: true };
}
