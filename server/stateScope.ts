export interface ScopedUser {
  id: string;
  role: string;
  hallScope?: string[];
  pondScope?: string[];
}

const SCOPE_REQUIRED_ROLES = new Set(['Hall Manager', 'Technician']);
const POND_LINKED_COLLECTIONS = new Set([
  'feedingRecords', 'biometricSessions', 'waterLogs', 'mortalityRecords', 'treatments',
]);
const SCOPE_SENSITIVE_COLLECTIONS = new Set([
  'halls', 'ponds', ...POND_LINKED_COLLECTIONS, 'transfers', 'processingBatches', 'labSamples',
]);

function rows(data: Record<string, unknown>, key: string): any[] {
  return Array.isArray(data[key]) ? data[key] as any[] : [];
}

export function userHasDataScopeRestriction(user: ScopedUser): boolean {
  if (user.role === 'Super Admin' || user.role === 'Farm Owner') return false;
  return Boolean(user.pondScope?.length || user.hallScope?.length || SCOPE_REQUIRED_ROLES.has(user.role));
}

export function allowedPondIds(data: Record<string, unknown>, user: ScopedUser): Set<string> | null {
  if (!userHasDataScopeRestriction(user)) return null;
  const ponds = rows(data, 'ponds');
  if (user.pondScope?.length) {
    const requested = new Set(user.pondScope);
    return new Set(ponds.filter((pond) => requested.has(String(pond?.id || ''))).map((pond) => String(pond.id)));
  }
  const halls = new Set(user.hallScope || []);
  return new Set(ponds.filter((pond) => halls.has(String(pond?.hallId || ''))).map((pond) => String(pond.id)));
}

export function allowedHallIds(data: Record<string, unknown>, user: ScopedUser): Set<string> | null {
  if (!userHasDataScopeRestriction(user)) return null;
  const explicit = new Set(user.hallScope || []);
  const ponds = rows(data, 'ponds');
  const pondIds = allowedPondIds(data, user) || new Set<string>();
  for (const pond of ponds) if (pondIds.has(String(pond?.id || '')) && pond?.hallId) explicit.add(String(pond.hallId));
  return explicit;
}

export function rowWithinUserScope(collection: string, row: any, data: Record<string, unknown>, user: ScopedUser): boolean {
  if (!SCOPE_SENSITIVE_COLLECTIONS.has(collection) || !userHasDataScopeRestriction(user)) return true;
  const pondIds = allowedPondIds(data, user) || new Set<string>();
  const hallIds = allowedHallIds(data, user) || new Set<string>();
  if (collection === 'halls') return hallIds.has(String(row?.id || ''));
  if (collection === 'ponds') return pondIds.has(String(row?.id || ''));
  if (POND_LINKED_COLLECTIONS.has(collection)) return pondIds.has(String(row?.pondId || ''));
  if (collection === 'processingBatches') return pondIds.has(String(row?.sourcePondId || ''));
  if (collection === 'labSamples') {
    return false;
  }
  if (collection === 'transfers') {
    const pondRefs: string[] = [];
    if (row?.sourceType === 'Pond') pondRefs.push(String(row.sourceId || ''));
    if (row?.destinationType === 'Pond') pondRefs.push(String(row.destinationId || ''));
    return pondRefs.length > 0 && pondRefs.every((id) => pondIds.has(id));
  }
  return true;
}

export function filterRowsByUserScope(collection: string, value: unknown, data: Record<string, unknown>, user: ScopedUser): unknown {
  if (!Array.isArray(value) || !SCOPE_SENSITIVE_COLLECTIONS.has(collection) || !userHasDataScopeRestriction(user)) return value;
  return value.filter((row) => rowWithinUserScope(collection, row, data, user));
}

export function validateSubmittedUserScope(
  previous: Record<string, unknown>,
  submitted: Record<string, unknown>,
  allowedCollections: Iterable<string>,
  user: ScopedUser,
): { ok: boolean; error?: string } {
  if (!userHasDataScopeRestriction(user)) return { ok: true };
  for (const collection of allowedCollections) {
    if (!SCOPE_SENSITIVE_COLLECTIONS.has(collection) || !Array.isArray(submitted[collection])) continue;
    if ((submitted[collection] as any[]).some((row) => !rowWithinUserScope(collection, row, previous, user))) {
      return { ok: false, error: `STATE_SCOPE_VIOLATION:${collection}` };
    }
  }
  return { ok: true };
}

export function mergeSubmittedRowsWithinScope(
  collection: string,
  previousValue: unknown,
  submittedValue: unknown,
  previousState: Record<string, unknown>,
  user: ScopedUser,
): unknown {
  if (!Array.isArray(previousValue) || !Array.isArray(submittedValue) || !SCOPE_SENSITIVE_COLLECTIONS.has(collection) || !userHasDataScopeRestriction(user)) {
    return submittedValue;
  }
  const hidden = previousValue.filter((row) => !rowWithinUserScope(collection, row, previousState, user));
  return [...submittedValue, ...hidden];
}

export type RequestedScopeResult =
  | { ok: true; hallScope: string[]; pondScope: string[]; error?: undefined }
  | { ok: false; error: string; hallScope?: undefined; pondScope?: undefined };

export function validateRequestedUserScope(
  state: Record<string, unknown> | undefined,
  role: string,
  hallScopeRaw: unknown,
  pondScopeRaw: unknown,
): RequestedScopeResult {
  const hallScope = Array.isArray(hallScopeRaw) ? [...new Set(hallScopeRaw.map(String).map((id) => id.trim()).filter(Boolean))] : [];
  const pondScope = Array.isArray(pondScopeRaw) ? [...new Set(pondScopeRaw.map(String).map((id) => id.trim()).filter(Boolean))] : [];
  if (role === 'Super Admin' || role === 'Farm Owner') return { ok: true, hallScope: [], pondScope: [] };
  if (SCOPE_REQUIRED_ROLES.has(role) && hallScope.length === 0 && pondScope.length === 0) return { ok: false, error: 'USER_OPERATIONAL_SCOPE_REQUIRED' };
  if (!state) {
    if (hallScope.length || pondScope.length) return { ok: false, error: 'USER_SCOPE_STATE_UNAVAILABLE' };
    return { ok: true, hallScope, pondScope };
  }
  const hallIds = new Set(rows(state, 'halls').map((hall) => String(hall?.id || '')));
  const pondRows = rows(state, 'ponds');
  const pondsById = new Map(pondRows.map((pond) => [String(pond?.id || ''), pond]));
  if (hallScope.some((id) => !hallIds.has(id))) return { ok: false, error: 'USER_HALL_SCOPE_INVALID' };
  if (pondScope.some((id) => !pondsById.has(id))) return { ok: false, error: 'USER_POND_SCOPE_INVALID' };
  if (hallScope.length && pondScope.some((id) => !hallScope.includes(String(pondsById.get(id)?.hallId || '')))) {
    return { ok: false, error: 'USER_SCOPE_RELATION_INVALID' };
  }
  return { ok: true, hallScope, pondScope };
}
