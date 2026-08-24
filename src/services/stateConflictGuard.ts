import { getLastAuthenticatedUserId } from '../context/AuthContext';
import { clearStateOutbox, loadStateOutbox, saveStateOutbox } from './stateOutbox';
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

async function responsePayload(response: Response): Promise<any> {
  try { return await response.clone().json(); } catch { return null; }
}

async function responseState(response: Response): Promise<StateEnvelope | null> {
  const payload = await responsePayload(response);
  const state = payload?.state;
  if (!state || !Number.isInteger(Number(state.version)) || !state.data || typeof state.data !== 'object' || Array.isArray(state.data)) return null;
  return { version: Number(state.version), data: state.data as Record<string, unknown> };
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

function replayHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set('Content-Type', 'application/json');
  return headers;
}

function dispatchOutboxEvent(type: 'replayed' | 'conflict' | 'pending', detail?: unknown): void {
  try { window.dispatchEvent(new CustomEvent(`fathi:state-outbox-${type}`, { detail })); } catch { /* UI notification is best effort. */ }
}

async function replayDurableOutbox(
  nativeFetch: typeof window.fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  remote: StateEnvelope,
  originalResponse: Response,
): Promise<Response | null> {
  const userId = getLastAuthenticatedUserId();
  if (!userId) return null;
  const outbox = await loadStateOutbox(userId);
  if (!outbox) return null;

  let candidate = outbox.localState;
  if (remote.version !== outbox.baseVersion) {
    if (!outbox.baseState) {
      dispatchOutboxEvent('conflict', { error: 'OUTBOX_BASE_UNAVAILABLE', savedAt: outbox.savedAt });
      return null;
    }
    const merged = threeWayMergeState(outbox.baseState, outbox.localState, remote.data);
    if (!merged.ok || !merged.state) {
      dispatchOutboxEvent('conflict', { error: 'OUTBOX_MERGE_CONFLICT', conflicts: merged.conflicts, savedAt: outbox.savedAt });
      return null;
    }
    candidate = merged.state;
  }

  const body: StatePutBody = { state: candidate, version: remote.version, operation: outbox.operation };
  const replay = await nativeFetch('/api/state', {
    method: 'PUT',
    headers: replayHeaders(input, init),
    body: JSON.stringify(body),
  });
  if (!replay.ok) {
    dispatchOutboxEvent(replay.status === 409 || replay.status === 422 ? 'conflict' : 'pending', { status: replay.status, savedAt: outbox.savedAt });
    return null;
  }

  const savedState = await responseState(replay);
  if (!savedState) return null;
  remember(savedState);
  await clearStateOutbox(userId, outbox.writeId);
  dispatchOutboxEvent('replayed', { savedAt: outbox.savedAt, version: savedState.version });

  const originalPayload = await responsePayload(originalResponse) || {};
  return new Response(JSON.stringify({ ...originalPayload, success: true, state: { ...originalPayload.state, ...savedState }, outboxReplayed: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Installs a narrow fetch guard around /api/state.
 * - Independent concurrent row changes are three-way merged.
 * - Same-row conflicts fail closed instead of using last-write-wins.
 * - Every authenticated state write is durably staged in IndexedDB before network I/O.
 * - A staged write is replayed after restart/login only for the same user.
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
      if (!response.ok) return response;
      const remote = await responseState(response);
      remember(remote);
      if (!remote) return response;
      try {
        const replayed = await replayDurableOutbox(nativeFetch, input, init, remote, response);
        return replayed || response;
      } catch {
        dispatchOutboxEvent('pending');
        return response;
      }
    }

    if (method !== 'PUT') return nativeFetch(input, init);
    const body = parsePutBody(init);
    if (!body || !Number.isInteger(Number(body.version))) return nativeFetch(input, init);

    const requestBase = cachedServerState && cachedServerState.version === Number(body.version)
      ? cachedServerState
      : null;
    const userId = getLastAuthenticatedUserId();
    const staged = userId
      ? await saveStateOutbox({
        userId,
        baseVersion: Number(body.version),
        baseState: requestBase?.data || null,
        localState: body.state,
        operation: body.operation || {},
      }).catch(() => null)
      : null;

    let first: Response;
    try {
      first = await nativeFetch(input, init);
    } catch (error) {
      dispatchOutboxEvent('pending', { error: error instanceof Error ? error.message : 'NETWORK_ERROR' });
      throw error;
    }
    if (first.ok) {
      remember(await responseState(first));
      if (userId && staged) await clearStateOutbox(userId, staged.writeId);
      return first;
    }
    if (first.status !== 409) return first;

    const remote = await responseState(first);
    if (!remote || !requestBase) {
      dispatchOutboxEvent('conflict', { error: 'STATE_CONFLICT_BASE_UNAVAILABLE' });
      return failClosed('STATE_CONFLICT_BASE_UNAVAILABLE');
    }

    const merged = threeWayMergeState(requestBase.data, body.state, remote.data);
    if (!merged.ok || !merged.state) {
      dispatchOutboxEvent('conflict', { error: 'STATE_MERGE_CONFLICT', conflicts: merged.conflicts });
      return failClosed('STATE_MERGE_CONFLICT', merged.conflicts);
    }

    const retryBody: StatePutBody = { ...body, state: merged.state, version: remote.version };
    const retry = await nativeFetch(input, { ...init, body: JSON.stringify(retryBody) });
    if (retry.status === 409) {
      dispatchOutboxEvent('conflict', { error: 'STATE_MERGE_RETRY_CONFLICT' });
      return failClosed('STATE_MERGE_RETRY_CONFLICT');
    }
    if (retry.ok) {
      remember(await responseState(retry));
      if (userId && staged) await clearStateOutbox(userId, staged.writeId);
    }
    return retry;
  };
}
