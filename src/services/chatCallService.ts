import { getStoredSessionToken } from '../context/AuthContext';
import { InternalChatCall } from '../types';

type SignalType = 'offer' | 'answer' | 'ice' | 'hangup';

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getStoredSessionToken() || ''}`, 'Content-Type': 'application/json' };
}

async function call(path: string, method = 'GET', body?: Record<string, unknown>) {
  const response = await fetch(path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || 'CHAT_CALL_REQUEST_FAILED');
  return data;
}

export async function createChatCall(threadId: string, callType: InternalChatCall['callType']): Promise<InternalChatCall> {
  const data = await call('/api/chat/calls', 'POST', { threadId, callType });
  return data.call;
}

export async function listChatCalls(threadId: string): Promise<InternalChatCall[]> {
  const data = await call(`/api/chat/calls?threadId=${encodeURIComponent(threadId)}`);
  return Array.isArray(data.calls) ? data.calls : [];
}

export async function endChatCall(callId: string): Promise<void> {
  await call(`/api/chat/calls/${encodeURIComponent(callId)}/end`, 'POST');
}

export async function postChatSignal(callId: string, type: SignalType, payload: unknown): Promise<void> {
  await call(`/api/chat/calls/${encodeURIComponent(callId)}/signals`, 'POST', { type, payload });
}

export async function listChatSignals(callId: string, after = 0): Promise<Array<{ id: number; fromUserId: string; type: SignalType; payload: unknown; createdAt: string }>> {
  const data = await call(`/api/chat/calls/${encodeURIComponent(callId)}/signals?after=${after}`);
  return Array.isArray(data.signals) ? data.signals : [];
}
