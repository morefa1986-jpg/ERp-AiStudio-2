export interface StateMergeConflict {
  collection: string;
  entityId?: string;
  reason: 'BOTH_CHANGED' | 'DELETE_VS_CHANGE' | 'DUPLICATE_NEW_ID' | 'VALUE_CONFLICT';
}

export interface StateMergeResult {
  ok: boolean;
  state?: Record<string, unknown>;
  conflicts: StateMergeConflict[];
}

type IdRow = { id: string; [key: string]: unknown };

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isIdRow(value: unknown): value is IdRow {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { id?: unknown }).id === 'string');
}

function mergeRows(
  collection: string,
  baseRows: unknown[],
  localRows: unknown[],
  remoteRows: unknown[],
): { rows?: unknown[]; conflicts: StateMergeConflict[] } {
  if (![...baseRows, ...localRows, ...remoteRows].every(isIdRow)) {
    if (sameValue(localRows, baseRows)) return { rows: remoteRows, conflicts: [] };
    if (sameValue(remoteRows, baseRows) || sameValue(localRows, remoteRows)) return { rows: localRows, conflicts: [] };
    return { conflicts: [{ collection, reason: 'VALUE_CONFLICT' }] };
  }

  const baseTyped = baseRows as IdRow[];
  const localTyped = localRows as IdRow[];
  const remoteTyped = remoteRows as IdRow[];
  const base = new Map(baseTyped.map((row) => [row.id, row]));
  const local = new Map(localTyped.map((row) => [row.id, row]));
  const remote = new Map(remoteTyped.map((row) => [row.id, row]));
  const ids = new Set([...base.keys(), ...local.keys(), ...remote.keys()]);
  const merged = new Map<string, IdRow>();
  const conflicts: StateMergeConflict[] = [];

  for (const id of ids) {
    const b = base.get(id);
    const l = local.get(id);
    const r = remote.get(id);

    if (b === undefined) {
      if (l !== undefined && r !== undefined) {
        if (sameValue(l, r)) merged.set(id, l);
        else conflicts.push({ collection, entityId: id, reason: 'DUPLICATE_NEW_ID' });
      } else if (l !== undefined) merged.set(id, l);
      else if (r !== undefined) merged.set(id, r);
      continue;
    }

    if (l === undefined && r === undefined) continue;
    if (l === undefined) {
      if (sameValue(r, b)) continue;
      conflicts.push({ collection, entityId: id, reason: 'DELETE_VS_CHANGE' });
      continue;
    }
    if (r === undefined) {
      if (sameValue(l, b)) continue;
      conflicts.push({ collection, entityId: id, reason: 'DELETE_VS_CHANGE' });
      continue;
    }

    const localChanged = !sameValue(l, b);
    const remoteChanged = !sameValue(r, b);
    if (localChanged && remoteChanged) {
      if (sameValue(l, r)) merged.set(id, l);
      else conflicts.push({ collection, entityId: id, reason: 'BOTH_CHANGED' });
    } else if (localChanged) merged.set(id, l);
    else merged.set(id, r);
  }

  if (conflicts.length) return { conflicts };

  // Preserve server ordering first, then append local-only rows in their local order.
  const ordered: IdRow[] = [];
  const emitted = new Set<string>();
  for (const row of remoteTyped) {
    if (merged.has(row.id)) {
      ordered.push(merged.get(row.id)!);
      emitted.add(row.id);
    }
  }
  for (const row of localTyped) {
    if (merged.has(row.id) && !emitted.has(row.id)) {
      ordered.push(merged.get(row.id)!);
      emitted.add(row.id);
    }
  }
  return { rows: ordered, conflicts: [] };
}

/**
 * Three-way merge for ERP snapshots. Independent row changes are merged.
 * The same row changing on both clients fails closed instead of choosing a winner.
 * Hall aggregates and audit logs are server-derived/server-authoritative and therefore
 * always start from the remote copy; hall totals are recalculated again by the server.
 */
export function threeWayMergeState(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): StateMergeResult {
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  const state: Record<string, unknown> = {};
  const conflicts: StateMergeConflict[] = [];

  for (const key of keys) {
    if (key === 'halls' || key === 'auditLogs') {
      state[key] = remote[key];
      continue;
    }
    const b = base[key];
    const l = local[key];
    const r = remote[key];

    if (Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
      const result = mergeRows(key, b, l, r);
      conflicts.push(...result.conflicts);
      if (result.rows) state[key] = result.rows;
      continue;
    }

    const localChanged = !sameValue(l, b);
    const remoteChanged = !sameValue(r, b);
    if (localChanged && remoteChanged && !sameValue(l, r)) {
      conflicts.push({ collection: key, reason: 'VALUE_CONFLICT' });
      continue;
    }
    state[key] = localChanged ? l : r;
  }

  return conflicts.length ? { ok: false, conflicts } : { ok: true, state, conflicts: [] };
}
