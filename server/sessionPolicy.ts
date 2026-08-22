import crypto from 'crypto';

export interface SessionTimingState {
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

export interface SessionPolicy {
  absoluteTtlMs: number;
  inactivityTtlMs: number;
  bootstrapWindowMs: number;
  bootstrapMaxFailures: number;
}

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function resolveSessionPolicy(env: NodeJS.ProcessEnv = process.env): SessionPolicy {
  const absoluteMinutes = boundedInteger(env.FATHI_SESSION_ABSOLUTE_MINUTES, 240, 30, 1440);
  const inactivityMinutes = boundedInteger(env.FATHI_SESSION_INACTIVITY_MINUTES, 20, 5, 240);
  const bootstrapWindowMinutes = boundedInteger(env.FATHI_BOOTSTRAP_WINDOW_MINUTES, 15, 1, 120);
  const bootstrapMaxFailures = boundedInteger(env.FATHI_BOOTSTRAP_MAX_FAILURES, 5, 1, 20);
  return {
    absoluteTtlMs: absoluteMinutes * 60_000,
    inactivityTtlMs: Math.min(inactivityMinutes, absoluteMinutes) * 60_000,
    bootstrapWindowMs: bootstrapWindowMinutes * 60_000,
    bootstrapMaxFailures,
  };
}

export function isSessionExpired(session: SessionTimingState, policy: SessionPolicy, now = Date.now()): boolean {
  if (!Number.isFinite(session.createdAt) || !Number.isFinite(session.lastActivityAt) || !Number.isFinite(session.expiresAt)) return true;
  if (now >= session.expiresAt) return true;
  if (now - session.lastActivityAt >= policy.inactivityTtlMs) return true;
  if (now < session.createdAt - 60_000 || session.lastActivityAt < session.createdAt) return true;
  return false;
}

export function constantTimeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
