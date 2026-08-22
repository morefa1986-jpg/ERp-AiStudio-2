import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { DUMMY_PASSWORD_HASH, hashPasswordServer, verifyPasswordServer } from './server/auth';
import { resolveServerListenConfig } from './server/lanConfig';
import { constantTimeEqual, isSessionExpired, resolveSessionPolicy } from './server/sessionPolicy';
import { defaultDatabasePath, SqliteERPStore, StateConflictError, StoredAuditLog, StoredSocialConnection, StoredSocialDraft, StoredUser } from './server/storage';
import { MODULE_COLLECTIONS, STATE_COLLECTIONS, validateMutationScope, validateStateMutation, validateStateSnapshot } from './src/utils/stateIntegrity';

dotenv.config();

const app = express();
const listenConfig = resolveServerListenConfig(process.env);
const sessionPolicy = resolveSessionPolicy(process.env);
const PORT = listenConfig.port;
const AI_WINDOW_MS = 60_000;
const AI_REQUESTS_PER_WINDOW = 30;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 5;
const LAN_MODE = listenConfig.lanMode;
const LAN_TLS_ENABLED = listenConfig.tlsEnabled;
const BIND_HOST = listenConfig.host;
const store = new SqliteERPStore(defaultDatabasePath());

app.disable('x-powered-by');
app.set('trust proxy', false);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  if (_req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '10mb' }));

type ServerUser = StoredUser;

interface ActiveSession {
  token: string;
  userId: string;
  username: string;
  role: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

interface AuthenticatedRequest extends Request {
  session?: ActiveSession;
  user?: ServerUser;
}

const SESSIONS = new Map<string, ActiveSession>();
const aiRateLimits = new Map<string, { windowStart: number; count: number }>();
const VALID_SERVER_ROLES = new Set([
  'Super Admin', 'Farm Owner', 'Farm Manager', 'Hall Manager', 'Technician', 'Hatchery Manager',
  'Laboratory', 'Veterinarian', 'Feed Manager', 'Warehouse Manager', 'Processing Manager',
  'Cold Storage Manager', 'Accountant', 'Sales Manager', 'CRM Operator', 'HR Manager',
  'Media Manager', 'Viewer/Auditor',
]);
const VALID_STATE_MODULES = new Set([
  'dashboard', 'farm', 'halls', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality',
  'treatments', 'transfers', 'hatchery', 'nursery', 'feed_factory', 'warehouse', 'laboratory',
  'processing', 'cold_storage', 'crm', 'sales', 'accounting', 'hr', 'media', 'ai_assistant',
  'reports', 'backup', 'users', 'settings',
]);
const VALID_STATE_ACTIONS = new Set(['view', 'create', 'edit', 'delete', 'approve', 'export', 'print', 'manage']);

function sanitizeUser(user: ServerUser) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function bearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function resolveSession(token: string | null): { session: ActiveSession; user: ServerUser } | null {
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session) return null;
  const now = Date.now();
  if (isSessionExpired(session, sessionPolicy, now)) {
    SESSIONS.delete(token);
    return null;
  }
  const user = store.getUserById(session.userId);
  if (!user?.isActive) {
    SESSIONS.delete(token);
    return null;
  }
  session.lastActivityAt = now;
  return { session, user };
}

function revokeUserSessions(userId: string, exceptToken?: string): void {
  for (const [token, session] of SESSIONS.entries()) {
    if (session.userId === userId && token !== exceptToken) SESSIONS.delete(token);
  }
}

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of SESSIONS.entries()) {
    if (isSessionExpired(session, sessionPolicy, now)) SESSIONS.delete(token);
  }
}, 60_000);
sessionCleanupTimer.unref?.();

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const resolved = resolveSession(bearerToken(req));
  if (!resolved) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
  req.session = resolved.session;
  req.user = resolved.user;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !['Super Admin', 'Farm Owner'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED' });
  }
  next();
}

function isAdmin(user: ServerUser | undefined): boolean {
  return Boolean(user && ['Super Admin', 'Farm Owner'].includes(user.role));
}

function roleAllowsServer(role: string, module: string, action: string): boolean {
  if (role === 'Super Admin' || role === 'Farm Owner') return true;
  const viewLike = ['view', 'export', 'print'].includes(action);
  const operational = ['view', 'create', 'edit', 'approve', 'export', 'print'].includes(action);
  switch (role) {
    case 'Farm Manager': return module !== 'users' && module !== 'settings' && !(module === 'backup' && action === 'approve') && action !== 'delete';
    case 'Hall Manager': return ['dashboard', 'halls', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers', 'reports'].includes(module) && operational;
    case 'Technician': return ['dashboard', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers'].includes(module) && ['view', 'create', 'edit'].includes(action);
    case 'Veterinarian': return (['dashboard', 'treatments', 'mortality', 'laboratory', 'biometrics', 'water_quality', 'reports'].includes(module) && operational) || (module === 'feeding' && ['view', 'create', 'approve', 'export', 'print'].includes(action));
    case 'Hatchery Manager': return ['dashboard', 'hatchery', 'nursery', 'biometrics', 'water_quality', 'laboratory', 'reports'].includes(module) && operational;
    case 'Laboratory': return ['dashboard', 'laboratory', 'water_quality', 'treatments', 'reports'].includes(module) && operational;
    case 'Feed Manager': return ['dashboard', 'feeding', 'feed_factory', 'warehouse', 'reports'].includes(module) && operational;
    case 'Warehouse Manager': return ['dashboard', 'warehouse', 'reports'].includes(module) && operational;
    case 'Processing Manager': return ['dashboard', 'processing', 'cold_storage', 'warehouse', 'reports'].includes(module) && operational;
    case 'Cold Storage Manager': return ['dashboard', 'cold_storage', 'warehouse', 'sales', 'reports'].includes(module) && operational;
    case 'Accountant': return ['dashboard', 'accounting', 'sales', 'hr', 'warehouse', 'reports'].includes(module) && operational;
    case 'Sales Manager':
    case 'CRM Operator': return ['dashboard', 'crm', 'sales', 'processing', 'cold_storage', 'media', 'reports'].includes(module) && operational;
    case 'HR Manager': return ['dashboard', 'hr', 'reports'].includes(module) && operational;
    case 'Media Manager': return ['dashboard', 'media', 'reports'].includes(module) && operational;
    case 'Viewer/Auditor': return viewLike;
    default: return false;
  }
}

function requireStateAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const operation = req.body?.operation;
  if (!operation || typeof operation.module !== 'string' || typeof operation.action !== 'string') {
    return res.status(400).json({ success: false, error: 'STATE_OPERATION_REQUIRED' });
  }
  if (!VALID_STATE_MODULES.has(operation.module) || !VALID_STATE_ACTIONS.has(operation.action)) {
    return res.status(400).json({ success: false, error: 'STATE_OPERATION_INVALID' });
  }
  if (!roleAllowsServer(req.user?.role || '', operation.module, operation.action)) {
    return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
  }
  if (operation.action === 'view' || operation.action === 'print') {
    return res.status(405).json({ success: false, error: 'STATE_READ_ONLY_OPERATION' });
  }
  if (operation.module === 'backup' && operation.action === 'approve' && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED' });
  }
  next();
}

function requireModuleAction(module: string, action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roleAllowsServer(req.user.role, module, action)) {
      return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    }
    next();
  };
}

const COLLECTION_VIEW_MODULES: Record<string, string[]> = {
  halls: ['halls', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers'],
  ponds: ['ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers', 'processing'],
  species: ['ponds', 'feeding', 'biometrics', 'hatchery'],
  feedingRecords: ['feeding'],
  biometricSessions: ['biometrics'],
  waterLogs: ['water_quality', 'feeding', 'biometrics', 'laboratory'],
  mortalityRecords: ['mortality'],
  treatments: ['treatments', 'mortality', 'feeding'],
  transfers: ['transfers'],
  broodstock: ['hatchery', 'biometrics'],
  fertilizations: ['hatchery'],
  incubators: ['hatchery'],
  larvae: ['hatchery', 'nursery'],
  nurseryTanks: ['nursery'],
  inventory: ['warehouse', 'feeding', 'feed_factory', 'processing'],
  inventoryTxs: ['warehouse', 'feeding', 'feed_factory'],
  labSamples: ['laboratory'],
  processingBatches: ['processing'],
  coldStorage: ['cold_storage', 'processing', 'sales'],
  customers: ['crm', 'sales'],
  proformas: ['sales'],
  accounts: ['accounting'],
  journals: ['accounting'],
  employees: ['hr'],
  attendance: ['hr'],
  payrolls: ['hr'],
  equipment: ['settings'],
  socialPosts: ['media'],
  auditLogs: ['users'],
  backups: ['backup'],
};

function canViewCollection(role: string, collection: string): boolean {
  return (COLLECTION_VIEW_MODULES[collection] || []).some((module) => roleAllowsServer(role, module, 'view'));
}

function filterStateForUser(data: Record<string, unknown>, role: string): Record<string, unknown> {
  const filtered: Record<string, unknown> = Object.fromEntries(STATE_COLLECTIONS.map((collection) => [collection, data[collection]]));
  for (const collection of STATE_COLLECTIONS) {
    if (!canViewCollection(role, collection)) filtered[collection] = [];
  }
  return filtered;
}

function mergeStateForOperation(previous: Record<string, unknown> | undefined, submitted: Record<string, unknown>, operation: { module?: string; action?: string }, role: string): Record<string, unknown> {
  if (!previous) return submitted;
  if (operation.module === 'backup' && operation.action === 'approve') {
    // The SQL audit table is authoritative. Never let a restored document
    // replace it with client-provided or stale audit rows.
    return { ...submitted, auditLogs: previous.auditLogs };
  }
  const allowed = new Set(MODULE_COLLECTIONS[operation.module || ''] || []);
  const merged: Record<string, unknown> = Object.fromEntries(STATE_COLLECTIONS.map((collection) => [collection, previous[collection]]));
  for (const collection of allowed) {
    if (collection === 'auditLogs') continue;
    if (!canViewCollection(role, collection)) continue;
    if (Array.isArray(submitted[collection])) merged[collection] = submitted[collection];
  }
  return merged;
}

function synchronizeHallAggregates(data: Record<string, unknown>, previous?: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(data.halls) || !Array.isArray(data.ponds)) return data;
  if (previous && JSON.stringify(previous.ponds) === JSON.stringify(data.ponds)) return data;
  const ponds = data.ponds as any[];
  return {
    ...data,
    halls: (data.halls as any[]).map((hall) => {
      const hallPonds = ponds.filter((pond) => pond?.hallId === hall?.id);
      return {
        ...hall,
        pondCount: hallPonds.length,
        totalBiomassKg: Number(hallPonds.reduce((sum, pond) => sum + (Number.isFinite(pond?.biomassKg) ? pond.biomassKg : 0), 0).toFixed(2)),
        totalFishCount: hallPonds.reduce((sum, pond) => sum + (Number.isFinite(pond?.fishCount) ? pond.fishCount : 0), 0),
      };
    }),
  };
}

function clientDeviceId(req: Request): string | undefined {
  const value = req.headers['x-device-id'];
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 128) : undefined;
}

function auditFromOperation(req: AuthenticatedRequest, operation: any, beforeState?: string, afterState?: string): StoredAuditLog | null {
  if (!req.user) return null;
  return {
    id: `audit_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    userId: req.user.id,
    userRole: req.user.role,
    action: operation.action,
    entity: String(operation.entity || operation.module),
    entityId: String(operation.entityId || 'state'),
    beforeState,
    afterState,
    referenceId: typeof operation.referenceId === 'string' ? operation.referenceId : undefined,
    transactionId: typeof operation.transactionId === 'string'
      ? operation.transactionId
      : typeof operation.referenceId === 'string' ? operation.referenceId : `txn_${crypto.randomUUID()}`,
    ipAddress: req.ip,
    deviceId: clientDeviceId(req),
  };
}

function appendAuditFromOperation(req: AuthenticatedRequest, operation: any, beforeState?: string, afterState?: string): void {
  const audit = auditFromOperation(req, operation, beforeState, afterState);
  if (audit) store.appendAuditLog(audit);
}

function aiRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const key = req.session?.userId || req.ip || 'unknown';
  const now = Date.now();
  const current = aiRateLimits.get(key);
  if (!current || now - current.windowStart >= AI_WINDOW_MS) {
    aiRateLimits.set(key, { windowStart: now, count: 1 });
    return next();
  }
  if (current.count >= AI_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ success: false, error: 'AI_RATE_LIMITED' });
  }
  current.count += 1;
  next();
}

function isSupportedLanguage(value: unknown): value is string {
  return typeof value === 'string' && ['fa', 'en', 'de', 'fr', 'es', 'ru', 'ar'].includes(value);
}

function loginKey(req: Request, username: string): string {
  return `${req.ip || 'unknown'}:${username}`;
}

function loginUsernameKey(username: string): string {
  return `username:${username}`;
}

function bootstrapKey(req: Request): string {
  return `bootstrap:${req.ip || 'unknown'}`;
}

app.get('/api/auth/status', (_req, res) => {
  res.json({ success: true, needsBootstrap: !store.hasUsers(), database: 'sqlite', host: BIND_HOST, lanMode: process.env.FATHI_LAN_MODE === 'true' });
});

app.post('/api/auth/bootstrap', (req, res) => {
  if (store.hasUsers()) return res.status(409).json({ success: false, error: 'BOOTSTRAP_ALREADY_COMPLETED' });
  const lanMode = process.env.FATHI_LAN_MODE === 'true';
  const setupToken = process.env.FATHI_SETUP_TOKEN?.trim();
  const throttleKey = bootstrapKey(req);
  if (lanMode && store.isLoginBlocked(throttleKey, Date.now(), sessionPolicy.bootstrapWindowMs, sessionPolicy.bootstrapMaxFailures)) {
    return res.status(429).json({ success: false, error: 'BOOTSTRAP_RATE_LIMITED' });
  }
  const headerToken = typeof req.headers['x-fathi-setup-token'] === 'string' ? req.headers['x-fathi-setup-token'] : undefined;
  if (lanMode && (!setupToken || !constantTimeEqual(headerToken, setupToken))) {
    store.recordLoginFailure(throttleKey, Date.now(), sessionPolicy.bootstrapWindowMs);
    return res.status(403).json({ success: false, error: 'BOOTSTRAP_REQUIRES_SETUP_TOKEN' });
  }
  const remoteAddress = (req.ip || '').replace(/^::ffff:/, '');
  if (!lanMode && !['127.0.0.1', '::1', 'localhost'].includes(remoteAddress)) return res.status(403).json({ success: false, error: 'BOOTSTRAP_LOCAL_ONLY' });
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 12 || !fullName || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'BOOTSTRAP_INPUT_INVALID' });
  }
  try {
    const user: ServerUser = {
      id: `usr_${crypto.randomUUID()}`, username, fullName, email, role: 'Super Admin',
      passwordHash: hashPasswordServer(password), isActive: true, preferredLanguage: isSupportedLanguage(req.body?.language) ? req.body.language : 'fa',
      createdAt: new Date().toISOString(),
    };
    if (!store.insertUserIfEmpty(user)) return res.status(409).json({ success: false, error: 'BOOTSTRAP_ALREADY_COMPLETED' });
    if (lanMode) store.clearLoginFailures(throttleKey);
    store.appendAuditLog({
      id: `audit_${crypto.randomUUID()}`, timestamp: new Date().toISOString(), userId: user.id, userRole: user.role,
      action: 'create', entity: 'User', entityId: user.id, afterState: JSON.stringify(sanitizeUser(user)),
      transactionId: `txn_${crypto.randomUUID()}`, ipAddress: req.ip, deviceId: clientDeviceId(req),
    });
    return res.json({ success: true });
  } catch {
    return res.status(409).json({ success: false, error: 'BOOTSTRAP_FAILED' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const language = req.body?.language;
  if (!username || !password) return res.status(400).json({ success: false, error: 'USERNAME_PASSWORD_REQUIRED' });

  const key = loginKey(req, username);
  const usernameKey = loginUsernameKey(username);
  if (store.isLoginBlocked(key, Date.now(), LOGIN_WINDOW_MS, LOGIN_MAX_FAILURES) || store.isLoginBlocked(usernameKey, Date.now(), LOGIN_WINDOW_MS, LOGIN_MAX_FAILURES)) return res.status(429).json({ success: false, error: 'LOGIN_RATE_LIMITED' });
  const user = store.getUserByUsername(username);
  const passwordMatches = verifyPasswordServer(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !user.isActive || !passwordMatches) {
    store.recordLoginFailure(key, Date.now(), LOGIN_WINDOW_MS);
    store.recordLoginFailure(usernameKey, Date.now(), LOGIN_WINDOW_MS);
    return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
  }
  store.clearLoginFailures(key);
  store.clearLoginFailures(usernameKey);

  const token = `fathi_sec_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const session: ActiveSession = {
    token,
    userId: user.id,
    username: user.username,
    role: user.role,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + sessionPolicy.absoluteTtlMs,
  };
  SESSIONS.set(token, session);
  user.lastLoginAt = new Date().toISOString();
  if (isSupportedLanguage(language)) user.preferredLanguage = language;
  store.updateUser(user);

  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
    session: { expiresAt: session.expiresAt, inactivityTtlMs: sessionPolicy.inactivityTtlMs },
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.session) SESSIONS.delete(req.session.token);
  return res.json({ success: true });
});

app.get('/api/auth/session', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({
    success: true,
    user: sanitizeUser(req.user!),
    session: req.session ? { expiresAt: req.session.expiresAt, inactivityTtlMs: sessionPolicy.inactivityTtlMs } : undefined,
  });
});

app.get('/api/auth/users', requireAuth, requireAdmin, (_req, res) => {
  return res.json({ success: true, users: store.listUsers().map(sanitizeUser) });
});

app.post('/api/auth/users', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const role = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 12 || !fullName || !email.includes('@') || !VALID_SERVER_ROLES.has(role)) {
    return res.status(400).json({ success: false, error: 'USER_INPUT_INVALID' });
  }
  try {
    const user: ServerUser = {
      id: `usr_${crypto.randomUUID()}`, username, fullName, email, role,
      passwordHash: hashPasswordServer(password), isActive: true,
      preferredLanguage: isSupportedLanguage(req.body?.preferredLanguage) ? req.body.preferredLanguage : 'fa',
      createdAt: new Date().toISOString(),
    };
    store.insertUser(user);
    appendAuditFromOperation(req, { module: 'users', action: 'create', entity: 'User', entityId: user.id }, undefined, JSON.stringify(sanitizeUser(user)));
    return res.status(201).json({ success: true, user: sanitizeUser(user) });
  } catch {
    return res.status(409).json({ success: false, error: 'USERNAME_EXISTS' });
  }
});

app.patch('/api/auth/users/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const user = store.getUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
  const beforeState = JSON.stringify(sanitizeUser(user));
  if (typeof req.body?.isActive === 'boolean' && user.id === req.user?.id && !req.body.isActive) {
    return res.status(400).json({ success: false, error: 'CANNOT_DISABLE_CURRENT_USER' });
  }
  let revokeExistingSessions = false;
  if (typeof req.body?.isActive === 'boolean') {
    user.isActive = req.body.isActive;
    if (!user.isActive) revokeExistingSessions = true;
  }
  if (typeof req.body?.password === 'string') {
    if (req.body.password.length < 12) return res.status(400).json({ success: false, error: 'PASSWORD_TOO_SHORT' });
    user.passwordHash = hashPasswordServer(req.body.password);
    revokeExistingSessions = true;
  }
  store.updateUser(user);
  if (revokeExistingSessions) {
    const keepCurrentToken = user.id === req.user?.id && user.isActive ? req.session?.token : undefined;
    revokeUserSessions(user.id, keepCurrentToken);
  }
  appendAuditFromOperation(req, { module: 'users', action: 'edit', entity: 'User', entityId: user.id }, beforeState, JSON.stringify(sanitizeUser(user)));
  return res.json({ success: true, user: sanitizeUser(user), sessionsRevoked: revokeExistingSessions });
});

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

function configuredAiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

function classifyAiError(error: unknown): 'AI_QUOTA_EXHAUSTED' | 'AI_BILLING_REQUIRED' | 'AI_TEMPORARILY_UNAVAILABLE' {
  const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (text.includes('quota') || text.includes('429') || text.includes('rate')) return 'AI_QUOTA_EXHAUSTED';
  if (text.includes('billing') || text.includes('payment') || text.includes('402') || text.includes('403')) return 'AI_BILLING_REQUIRED';
  return 'AI_TEMPORARILY_UNAVAILABLE';
}

function sanitizeFarmContext(raw: any) {
  const ponds = Array.isArray(raw?.ponds) ? raw.ponds.slice(0, 200).map((pond: any) => ({
    id: String(pond?.id || ''),
    name: String(pond?.name || ''),
    feedingStatus: pond?.feedingStatus === 'STOPPED' ? 'STOPPED' : pond?.feedingStatus === 'ACTIVE' ? 'ACTIVE' : null,
    fishCount: Number.isFinite(Number(pond?.fishCount)) ? Number(pond.fishCount) : null,
    biomassKg: Number.isFinite(Number(pond?.biomassKg)) ? Number(pond.biomassKg) : null,
    fcr: Number.isFinite(Number(pond?.fcr)) ? Number(pond.fcr) : null,
    dissolvedOxygen: Number.isFinite(Number(pond?.dissolvedOxygen)) ? Number(pond.dissolvedOxygen) : null,
    waterTemperature: Number.isFinite(Number(pond?.waterTemperature)) ? Number(pond.waterTemperature) : null,
    ph: Number.isFinite(Number(pond?.ph)) ? Number(pond.ph) : null,
  })) : [];
  return { ponds };
}

function offlineFarmAnswer(query: string, language: string, farmContext: any): string {
  const ponds = farmContext.ponds as any[];
  const stopped = ponds.filter((pond) => pond.feedingStatus === 'STOPPED');
  const lowOxygen = ponds.filter((pond) => typeof pond.dissolvedOxygen === 'number' && pond.dissolvedOxygen < 4);
  const biomass = ponds.reduce((sum, pond) => sum + (typeof pond.biomassKg === 'number' ? pond.biomassKg : 0), 0);
  const fishCount = ponds.reduce((sum, pond) => sum + (typeof pond.fishCount === 'number' ? pond.fishCount : 0), 0);
  const q = query.toLowerCase();

  if (language === 'fa') {
    if (q.includes('اکسیژن') || q.includes('oxygen') || q.includes(' do')) {
      return lowOxygen.length
        ? `⚠️ ${lowOxygen.length} استخر بر اساس داده‌های ارسالی اکسیژن کمتر از ۴ mg/L دارند. تغذیه این استخرها باید متوقف بماند.`
        : 'بر اساس داده‌های ارسالی، هیچ استخر با اکسیژن کمتر از ۴ mg/L مشاهده نشد.';
    }
    return `حالت تحلیل محلی فعال است. داده‌های دریافت‌شده: ${ponds.length} استخر، ${fishCount.toLocaleString()} قطعه ماهی، ${biomass.toLocaleString()} کیلوگرم بیومس و ${stopped.length} استخر با تغذیه متوقف.`;
  }

  return `Local analysis mode. Provided data contains ${ponds.length} ponds, ${fishCount.toLocaleString()} fish, ${biomass.toLocaleString()} kg biomass and ${stopped.length} stopped-feeding ponds.`;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Fathi Aqua Super ERP Enterprise',
    version: process.env.APP_VERSION || '6.1.0',
    ai: getAIClient() ? 'configured_optional' : 'not_configured_optional',
    database: 'sqlite',
    host: BIND_HOST,
    lanMode: LAN_MODE,
    protocol: listenConfig.protocol,
    lanTls: LAN_TLS_ENABLED ? 'enabled' : LAN_MODE ? 'explicitly_disabled' : 'not_applicable',
  });
});

app.get('/api/state', requireAuth, (req: AuthenticatedRequest, res) => {
  const state = store.getState();
  const serverAudit = req.user && roleAllowsServer(req.user.role, 'users', 'view') ? store.listAuditLogs() : [];
  if (!state) return res.json({ success: true, state: null, auditLogs: serverAudit });
  return res.json({ success: true, state: { ...state, data: filterStateForUser(state.data, req.user?.role || '') }, auditLogs: serverAudit });
});

app.put('/api/state', requireAuth, requireStateAction, (req: AuthenticatedRequest, res) => {
  const submittedState = req.body?.state;
  if (!submittedState || typeof submittedState !== 'object' || Array.isArray(submittedState)) {
    return res.status(400).json({ success: false, error: 'STATE_OBJECT_REQUIRED' });
  }
  const expectedVersion = req.body?.version === null || req.body?.version === undefined
    ? null
    : Number(req.body.version);
  if (expectedVersion !== null && !Number.isInteger(expectedVersion)) {
    return res.status(400).json({ success: false, error: 'STATE_VERSION_INVALID' });
  }
  const previous = store.getState();
  if (previous && expectedVersion === null) {
    return res.status(409).json({ success: false, error: 'STATE_VERSION_REQUIRED', version: previous.version });
  }
  const state = synchronizeHallAggregates(mergeStateForOperation(previous?.data, submittedState as Record<string, unknown>, req.body.operation, req.user?.role || ''), previous?.data);
  const snapshotValidation = validateStateSnapshot(state);
  if (!snapshotValidation.ok) return res.status(400).json({ success: false, error: snapshotValidation.error });
  const mutationValidation = validateStateMutation(previous?.data, state, req.body.operation);
  if (!mutationValidation.ok) return res.status(422).json({ success: false, error: mutationValidation.error });
  const scopeValidation = validateMutationScope(previous?.data, state, req.body.operation);
  if (!scopeValidation.ok) return res.status(422).json({ success: false, error: scopeValidation.error });
  try {
    if (req.body.operation?.module === 'backup' && req.body.operation?.action === 'approve' && previous) store.createStateSnapshot('pre-restore', previous);
    const audit = auditFromOperation(req, req.body.operation, previous ? JSON.stringify(previous.data) : undefined, JSON.stringify(state));
    const saved = audit
      ? store.saveStateAndAudit(state as Record<string, unknown>, expectedVersion, audit)
      : store.saveState(state as Record<string, unknown>, expectedVersion);
    return res.json({ success: true, state: { ...saved, data: filterStateForUser(saved.data, req.user?.role || '') } });
  } catch (error) {
    if (error instanceof StateConflictError) {
      return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT', state: error.current });
    }
    return res.status(500).json({ success: false, error: 'STATE_SAVE_FAILED' });
  }
});

app.get('/api/audit-logs', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED' });
  return res.json({ success: true, logs: store.listAuditLogs() });
});

const handleAiAssistant = async (req: AuthenticatedRequest, res: Response) => {
  const userQuery = typeof req.body?.prompt === 'string' ? req.body.prompt : typeof req.body?.query === 'string' ? req.body.query : '';
  const language = isSupportedLanguage(req.body?.language) ? req.body.language : 'fa';
  if (!userQuery.trim()) return res.status(400).json({ success: false, error: 'QUERY_REQUIRED' });

  const authoritativeState = store.getState()?.data;
  const farmContext = sanitizeFarmContext(authoritativeState ? filterStateForUser(authoritativeState, req.user?.role || '') : {});
  const ai = getAIClient();
  if (!ai) {
    return res.json({ success: true, answer: offlineFarmAnswer(userQuery, language, farmContext), source: 'local-deterministic-engine', aiStatus: 'NOT_CONFIGURED' });
  }

  try {
    const model = configuredAiModel();
    const response = await ai.models.generateContent({
      model,
      contents: `Verified farm context supplied by the ERP:\n${JSON.stringify(farmContext)}\n\nUser question (${language}): ${userQuery}`,
      config: {
        systemInstruction: 'You are an aquaculture ERP assistant. Use only the supplied farm context for farm-specific facts. Never invent telemetry, stock, fish counts, biomass, mortality, FCR, treatment or financial values. If data is missing, explicitly state that it is unavailable.',
        temperature: 0.2,
      },
    });
    return res.json({ success: true, answer: response.text || offlineFarmAnswer(userQuery, language, farmContext), source: model, aiStatus: 'AVAILABLE' });
  } catch (error) {
    const aiStatus = classifyAiError(error);
    return res.json({ success: true, answer: offlineFarmAnswer(userQuery, language, farmContext), source: 'local-deterministic-engine', aiStatus });
  }
};

app.post('/api/ai/assistant', requireAuth, requireModuleAction('ai_assistant', 'view'), aiRateLimit, handleAiAssistant);
app.post('/api/ai/ask', requireAuth, requireModuleAction('ai_assistant', 'view'), aiRateLimit, handleAiAssistant);

const NEVER_TRANSLATE = /(password|passcode|token|secret|api[_-]?key|credential|private[_-]?key|salary|payroll|bank|iban|account\s*number)/i;

const handleDynamicTranslation = async (req: AuthenticatedRequest, res: Response) => {
  const sourceLocale = isSupportedLanguage(req.body?.sourceLocale) ? req.body.sourceLocale : 'fa';
  const targetLocale = isSupportedLanguage(req.body?.targetLocale) ? req.body.targetLocale : 'en';
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : typeof req.body?.text === 'string' ? [{ id: 'single_1', text: req.body.text, sourceLocale }] : [];
  const requestItems = rawItems.slice(0, 25).map((item: any, index: number) => ({ id: String(item?.id || `item_${index}`), text: String(item?.text || '').slice(0, 4000), sourceLocale: isSupportedLanguage(item?.sourceLocale) ? item.sourceLocale : sourceLocale }));
  if (!requestItems.length || requestItems.every((item) => !item.text.trim())) return res.status(400).json({ success: false, error: 'NO_TEXT' });
  if (requestItems.some((item) => NEVER_TRANSLATE.test(item.text))) return res.status(400).json({ success: false, error: 'SENSITIVE_CONTENT_BLOCKED' });

  if (sourceLocale === targetLocale) {
    return res.json({ success: true, translations: requestItems.map((item) => ({ id: item.id, translatedText: item.text, sourceLocale: item.sourceLocale, targetLocale, fromCache: true })) });
  }

  const ai = getAIClient();
  if (!ai) {
    return res.json({
      success: true,
      translations: requestItems.map((item) => ({ id: item.id, translatedText: item.text, sourceLocale: item.sourceLocale, targetLocale, isOfflineFallback: true })),
      source: 'original-text-fallback',
      aiStatus: 'NOT_CONFIGURED',
    });
  }

  try {
    const model = configuredAiModel();
    const response = await ai.models.generateContent({
      model,
      contents: JSON.stringify({ sourceLocale, targetLocale, items: requestItems }),
      config: {
        systemInstruction: `Translate user-entered aquaculture ERP text from ${sourceLocale} to ${targetLocale}. Preserve IDs, scientific names, numeric values and units. Return JSON only with {"translations":[{"id":"...","translatedText":"...","sourceLocale":"...","targetLocale":"..."}]}. Do not add facts.`,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    if (!Array.isArray(parsed.translations)) throw new Error('INVALID_AI_RESPONSE');
    return res.json({ success: true, translations: parsed.translations, source: model, aiStatus: 'AVAILABLE' });
  } catch (error) {
    return res.json({
      success: true,
      translations: requestItems.map((item) => ({ id: item.id, translatedText: item.text, sourceLocale: item.sourceLocale, targetLocale, isOfflineFallback: true })),
      source: 'original-text-fallback',
      aiStatus: classifyAiError(error),
    });
  }
};

app.post('/api/ai/translate-dynamic', requireAuth, requireModuleAction('ai_assistant', 'view'), aiRateLimit, handleDynamicTranslation);

const SOCIAL_PLATFORM_IDS = new Set(['instagram', 'linkedin', 'whatsapp', 'telegram', 'eitaa', 'rubika', 'bale', 'facebook', 'x', 'youtube']);
const SOCIAL_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'READY_TO_PUBLISH', 'PUBLISHED', 'REJECTED']);

function normalizeStringList(value: unknown, maxItems = 40): string[] {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizePlatformIds(value: unknown): string[] {
  return normalizeStringList(value, 20).filter((item) => SOCIAL_PLATFORM_IDS.has(item));
}

function sanitizeSocialDraftInput(raw: any, existing?: StoredSocialDraft): { ok: true; draft: StoredSocialDraft } | { ok: false; error: string } {
  const now = new Date().toISOString();
  const status = typeof raw?.status === 'string' && SOCIAL_STATUSES.has(raw.status) ? raw.status : existing?.status || 'DRAFT';
  const platformIds = normalizePlatformIds(raw?.platformIds ?? existing?.platformIds);
  const title = String(raw?.title ?? existing?.title ?? '').trim().slice(0, 180);
  const caption = String(raw?.caption ?? existing?.caption ?? '').trim().slice(0, 5000);
  if (!title || !caption || platformIds.length === 0) return { ok: false, error: 'SOCIAL_DRAFT_INPUT_INVALID' };
  const scheduledAt = typeof raw?.scheduledAt === 'string' && raw.scheduledAt ? raw.scheduledAt.slice(0, 80) : existing?.scheduledAt;
  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) return { ok: false, error: 'SOCIAL_SCHEDULE_INVALID' };
  const draft: StoredSocialDraft = {
    id: existing?.id || `social_${crypto.randomUUID()}`,
    title,
    caption,
    hashtags: normalizeStringList(raw?.hashtags ?? existing?.hashtags, 60).map((tag) => tag.replace(/^#/, '').replace(/\s+/g, '_')),
    platformIds,
    mediaAssetIds: normalizeStringList(raw?.mediaAssetIds ?? existing?.mediaAssetIds, 80),
    scheduledAt,
    status,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    approvedAt: typeof raw?.approvedAt === 'string' ? raw.approvedAt : existing?.approvedAt,
    approvedBy: typeof raw?.approvedBy === 'string' ? raw.approvedBy.slice(0, 180) : existing?.approvedBy,
    publishedAt: typeof raw?.publishedAt === 'string' ? raw.publishedAt : existing?.publishedAt,
    notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 2000) : existing?.notes,
  };
  return { ok: true, draft };
}

function listSocialConnectionsWithDefaults(): StoredSocialConnection[] {
  const saved = new Map(store.listSocialConnections().map((connection) => [connection.platformId, connection]));
  return Array.from(SOCIAL_PLATFORM_IDS).map((platformId) => saved.get(platformId) || { platformId, connected: false });
}

app.get('/api/social/connections', requireAuth, requireModuleAction('media', 'view'), (_req, res) => {
  return res.json({ success: true, connections: listSocialConnectionsWithDefaults() });
});

app.post('/api/social/connections/:platformId', requireAuth, requireModuleAction('media', 'edit'), (req: AuthenticatedRequest, res) => {
  const platformId = req.params.platformId;
  if (!SOCIAL_PLATFORM_IDS.has(platformId)) return res.status(400).json({ success: false, error: 'SOCIAL_PLATFORM_INVALID' });
  const before = store.listSocialConnections().find((connection) => connection.platformId === platformId);
  const accountLabel = typeof req.body?.accountLabel === 'string' ? req.body.accountLabel.slice(0, 180) : undefined;
  const connection = store.upsertSocialConnection({ platformId, connected: false, accountLabel });
  appendAuditFromOperation(req, { module: 'media', action: 'edit', entity: 'SocialConnection', entityId: platformId }, before ? JSON.stringify(before) : undefined, JSON.stringify(connection));
  return res.json({ success: true, connections: listSocialConnectionsWithDefaults() });
});

app.post('/api/social/connections/:platformId/opened', requireAuth, requireModuleAction('media', 'view'), (req: AuthenticatedRequest, res) => {
  const platformId = req.params.platformId;
  if (!SOCIAL_PLATFORM_IDS.has(platformId)) return res.status(400).json({ success: false, error: 'SOCIAL_PLATFORM_INVALID' });
  const connection = store.markSocialConnectionOpened(platformId);
  appendAuditFromOperation(req, { module: 'media', action: 'view', entity: 'SocialConnection', entityId: platformId }, undefined, JSON.stringify(connection));
  return res.json({ success: true, connections: listSocialConnectionsWithDefaults() });
});

app.get('/api/social/drafts', requireAuth, requireModuleAction('media', 'view'), (_req, res) => {
  return res.json({ success: true, drafts: store.listSocialDrafts() });
});

app.post('/api/social/drafts', requireAuth, requireModuleAction('media', 'create'), (req: AuthenticatedRequest, res) => {
  const normalized = sanitizeSocialDraftInput(req.body);
  if (normalized.ok === false) return res.status(400).json({ success: false, error: normalized.error });
  const draft = store.upsertSocialDraft(normalized.draft);
  appendAuditFromOperation(req, { module: 'media', action: 'create', entity: 'SocialCampaignDraft', entityId: draft.id }, undefined, JSON.stringify(draft));
  return res.status(201).json({ success: true, draft, drafts: store.listSocialDrafts() });
});

app.patch('/api/social/drafts/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
  const requestedStatus = typeof req.body?.status === 'string' ? req.body.status : undefined;
  const action = ['APPROVED', 'REJECTED', 'READY_TO_PUBLISH', 'PUBLISHED'].includes(requestedStatus || '') ? 'approve' : 'edit';
  return requireModuleAction('media', action)(req, res, next);
}, (req: AuthenticatedRequest, res) => {
  const existing = store.getSocialDraft(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'SOCIAL_DRAFT_NOT_FOUND' });
  const normalized = sanitizeSocialDraftInput(req.body, existing);
  if (normalized.ok === false) return res.status(400).json({ success: false, error: normalized.error });
  const draft = store.upsertSocialDraft(normalized.draft);
  appendAuditFromOperation(req, { module: 'media', action: normalized.draft.status === existing.status ? 'edit' : 'approve', entity: 'SocialCampaignDraft', entityId: draft.id }, JSON.stringify(existing), JSON.stringify(draft));
  return res.json({ success: true, draft, drafts: store.listSocialDrafts() });
});

app.delete('/api/social/drafts/:id', requireAuth, requireModuleAction('media', 'delete'), (req: AuthenticatedRequest, res) => {
  const existing = store.getSocialDraft(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'SOCIAL_DRAFT_NOT_FOUND' });
  store.deleteSocialDraft(req.params.id);
  appendAuditFromOperation(req, { module: 'media', action: 'delete', entity: 'SocialCampaignDraft', entityId: req.params.id }, JSON.stringify(existing), undefined);
  return res.json({ success: true, drafts: store.listSocialDrafts() });
});

const handleAiMarketing = async (req: AuthenticatedRequest, res: Response) => {
  const productType = typeof req.body?.productType === 'string' ? req.body.productType.slice(0, 200) : 'Caviar';
  const language = isSupportedLanguage(req.body?.language) ? req.body.language : 'en';
  const ai = getAIClient();

  if (!ai) {
    return res.json({ success: false, error: 'AI_NOT_CONFIGURED', aiStatus: 'NOT_CONFIGURED' });
  }

  try {
    const model = configuredAiModel();
    const response = await ai.models.generateContent({
      model,
      contents: `Product: ${productType}\nLanguage: ${language}\nPlatform: ${String(req.body?.platform || '')}\nTarget market: ${String(req.body?.targetMarket || '')}`,
      config: {
        systemInstruction: 'Generate concise premium marketing copy. Do not invent certifications, permits, awards, traceability claims, health claims or product facts not provided by the user.',
        temperature: 0.6,
      },
    });
    return res.json({ success: true, content: response.text || '', campaignText: response.text || '', source: model, aiStatus: 'AVAILABLE' });
  } catch (error) {
    return res.status(503).json({ success: false, error: classifyAiError(error), aiStatus: classifyAiError(error) });
  }
};

app.post('/api/ai/media', requireAuth, requireModuleAction('media', 'create'), aiRateLimit, handleAiMarketing);
app.post('/api/ai/marketing-campaign', requireAuth, requireModuleAction('media', 'create'), aiRateLimit, handleAiMarketing);

app.post('/api/license/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  const configuredKey = process.env.FATHI_LICENSE_KEY?.trim();
  if (!configuredKey) {
    return res.json({ valid: false, configured: false, reason: 'LICENSE_VALIDATION_NOT_CONFIGURED' });
  }
  const suppliedKey = typeof req.body?.licenseKey === 'string' ? req.body.licenseKey : '';
  const valid = suppliedKey.length === configuredKey.length && crypto.timingSafeEqual(Buffer.from(suppliedKey), Buffer.from(configuredKey));
  return res.json({ valid, configured: true, edition: valid ? 'Enterprise Commercial' : undefined });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const announce = () => {
    const protocol = LAN_TLS_ENABLED ? 'https' : 'http';
    console.log(`Fathi Aqua Super ERP Server running on ${protocol}://${BIND_HOST}:${PORT} (SQLite)`);
  };

  if (LAN_TLS_ENABLED) {
    const key = fs.readFileSync(listenConfig.tlsKeyPath!, 'utf8');
    const cert = fs.readFileSync(listenConfig.tlsCertPath!, 'utf8');
    https.createServer({ key, cert }, app).listen(PORT, BIND_HOST, announce);
  } else {
    app.listen(PORT, BIND_HOST, announce);
  }
}

start().catch((error) => {
  console.error('Server startup failed', error);
  process.exitCode = 1;
});
