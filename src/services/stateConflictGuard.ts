import { threeWayMergeState } from '../utils/stateConflictMerge';

interface StateEnvelope {
  version: number;
  data: Record<string, unknown>;
}

interface StatePutBody {
  state: Record<string, unknown>;
  version: number | null;
  operation?: Record<string, unknown>;
}

let cachedServerState: StateEnvelope | null = null;

function stateUrl(input: RequestInfo | URL): boolean {
  if (typeof input === 'string') return input.split('?')[0].endsWith('/api/state');
  if (input instanceof URL) return input.pathname === '/api/state';
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try { return new URL(input.url, window.location.origin).pathname === '/api/state'; } catch { return false; }
  }
  return false;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function parsePutBody(init?: RequestInit): StatePutBody | null {
  if (typeof init?.body !== 'string') return null;
  try {
    const parsed = JSON.parse(init.body);
    if (!parsed || typeof parsed !== 'object' || !parsed.state || typeof parsed.state !== 'object' || Array.isArray(parsed.state)) return null;
    return parsed as StatePutBody;
  } catch {
    return null;
  }
}

async function responseState(response: Response): Promise<StateEnvelope | null> {
  try {
    const payload = await response.clone().json();
    const state = payload?.state;
    if (!state || !Number.isInteger(Number(state.version)) || !state.data || typeof state.data !== 'object' || Array.isArray(state.data)) return null;
    return { version: Number(state.version), data: state.data as Record<string, unknown> };
  } catch {
    return null;
  }
}

function remember(state: StateEnvelope | null): void {
  if (state) cachedServerState = state;
}

function failClosed(error: string, details?: unknown): Response {
  return new Response(JSON.stringify({ success: false, error, details }), {
    status: 422,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Installs a narrow fetch guard around /api/state.
 * On optimistic concurrency conflict, it merges independent row changes against
 * the last server snapshot. Same-row edits fail closed; no last-write-wins retry
 * is allowed when the original base snapshot is unknown.
 */
export function installStateConflictGuard(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const globalWindow = window as typeof window & { __fathiStateConflictGuardInstalled?: boolean };
  if (globalWindow.__fathiStateConflictGuardInstalled) return;
  globalWindow.__fathiStateConflictGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!stateUrl(input)) return nativeFetch(input, init);
    const method = requestMethod(input, init);

    if (method === 'GET') {
      const response = await nativeFetch(input, init);
      if (response.ok) remember(await responseState(response));
      return response;
    }

    if (method !== 'PUT') return nativeFetch(input, init);
    const body = parsePutBody(init);
    if (!body || !Number.isInteger(Number(body.version))) return nativeFetch(input, init);

    const requestBase = cachedServerState && cachedServerState.version === Number(body.version)
      ? cachedServerState
      : null;
    const first = await nativeFetch(input, init);
    if (first.ok) {
      remember(await responseState(first));
      return first;
    }
    if (first.status !== 409) return first;

    const remote = await responseState(first);
    if (!remote || !requestBase) {
      return failClosed('STATE_CONFLICT_BASE_UNAVAILABLE');
    }

    const merged = threeWayMergeState(requestBase.data, body.state, remote.data);
    if (!merged.ok || !merged.state) {
      return failClosed('STATE_MERGE_CONFLICT', merged.conflicts);
    }

    const retryBody: StatePutBody = { ...body, state: merged.state, version: remote.version };
    const retry = await nativeFetch(input, { ...init, body: JSON.stringify(retryBody) });
    if (retry.status === 409) return failClosed('STATE_MERGE_RETRY_CONFLICT');
    if (retry.ok) remember(await responseState(retry));
    return retry;
  };
}
