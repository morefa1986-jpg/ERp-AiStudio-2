export const MODULE_VISIBILITY_IDS = [
  'dashboard', 'farmHalls', 'ponds', 'feeding', 'biometrics', 'waterQuality', 'mortality', 'treatments',
  'transfers', 'hatchery', 'nursery', 'feedFactory', 'warehouse', 'laboratory', 'processing', 'coldStorage',
  'crm', 'sales', 'accounting', 'hr', 'aiAssistant', 'mediaStudio', 'maintenance', 'reports', 'securityAudit',
  'documents', 'backup', 'platformHub', 'adminSettings',
] as const;

export type SharedModuleVisibilityId = typeof MODULE_VISIBILITY_IDS[number];
export type SharedModuleVisibilityMap = Record<SharedModuleVisibilityId, boolean>;

export const LOCKED_MODULE_VISIBILITY_IDS = new Set<SharedModuleVisibilityId>(['dashboard', 'adminSettings']);

export function defaultModuleVisibility(): SharedModuleVisibilityMap {
  return Object.fromEntries(MODULE_VISIBILITY_IDS.map((id) => [id, true])) as SharedModuleVisibilityMap;
}

export function normalizeModuleVisibility(raw: unknown): SharedModuleVisibilityMap {
  const normalized = defaultModuleVisibility();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return normalized;
  const record = raw as Record<string, unknown>;
  for (const id of MODULE_VISIBILITY_IDS) {
    normalized[id] = LOCKED_MODULE_VISIBILITY_IDS.has(id) ? true : record[id] !== false;
  }
  return normalized;
}

export function validateModuleVisibilityPayload(raw: unknown): { ok: true; visibility: SharedModuleVisibilityMap } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'MODULE_VISIBILITY_OBJECT_REQUIRED' };
  const record = raw as Record<string, unknown>;
  const known = new Set<string>(MODULE_VISIBILITY_IDS);
  const unknown = Object.keys(record).find((key) => !known.has(key));
  if (unknown) return { ok: false, error: `MODULE_VISIBILITY_UNKNOWN_ID:${unknown}` };
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'boolean') return { ok: false, error: `MODULE_VISIBILITY_BOOLEAN_REQUIRED:${key}` };
  }
  return { ok: true, visibility: normalizeModuleVisibility(record) };
}
