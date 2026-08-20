import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PASSWORD_SALT = 'fathi_aqua_salt_2026';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AI_WINDOW_MS = 60_000;
const AI_REQUESTS_PER_WINDOW = 30;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

interface ServerUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
  preferredLanguage: string;
  lastLoginAt?: string;
  createdAt: string;
}

interface ActiveSession {
  token: string;
  userId: string;
  username: string;
  role: string;
  createdAt: number;
  expiresAt: number;
}

interface AuthenticatedRequest extends Request {
  session?: ActiveSession;
  user?: ServerUser;
}

// Compatibility hashes for the current local deployment accounts. No plaintext passwords are stored in source.
const USERS_DB = new Map<string, ServerUser>([
  ['admin', {
    id: 'usr_admin', username: 'admin', fullName: 'مهندس سعید فتحی (Super Admin)', email: 'admin@fathi-aqua.com', role: 'Super Admin',
    passwordHash: '6bda9e007f9f2b46bac9c60ed76969764f8b55d0f2d9955f8ba06a1c422700c6', isActive: true, preferredLanguage: 'fa',
    lastLoginAt: '2026-08-19T07:00:00Z', createdAt: '2024-01-01',
  }],
  ['vet', {
    id: 'usr_vet', username: 'vet', fullName: 'دکتر مریم علوی (سرپرست دامپزشکی و بهداشت)', email: 'vet@fathi-aqua.com', role: 'Veterinarian',
    passwordHash: '9fad5faa99c6ed98b343df7f9a142e7ee3699a1473baa0163a1836ec4244e46b', isActive: true, preferredLanguage: 'fa', createdAt: '2024-02-15',
  }],
  ['hatchery', {
    id: 'usr_hatchery', username: 'hatchery', fullName: 'مهندس رضا حسینی (مدیر تکثیر و ژنتیک)', email: 'hatchery@fathi-aqua.com', role: 'Hatchery Manager',
    passwordHash: '6b9e7b0dda7d0aba361da563aa59564986aa27a60466d857b9aeda89ce61283d', isActive: true, preferredLanguage: 'fa', createdAt: '2024-03-01',
  }],
  ['sales', {
    id: 'usr_sales', username: 'sales', fullName: 'آقای شمس (مدیر فروش و صادرات خاویار)', email: 'sales@fathi-aqua.com', role: 'Sales Manager',
    passwordHash: '365e4423b120eb78a6a162710903b03ac7fd7aecfe33db6c938954c9d80667ab', isActive: true, preferredLanguage: 'en', createdAt: '2024-04-10',
  }],
  ['accountant', {
    id: 'usr_accountant', username: 'accountant', fullName: 'خانم مهندس صابری (حسابدار ارشد)', email: 'accounting@fathi-aqua.com', role: 'Accountant',
    passwordHash: '1ba376b43c9f34c8edfd83a03b57b7b35680919d870132bcf9c2baaaa2c12381', isActive: true, preferredLanguage: 'fa', createdAt: '2024-05-01',
  }],
]);

const SESSIONS = new Map<string, ActiveSession>();
const aiRateLimits = new Map<string, { windowStart: number; count: number }>();

function hashPasswordServer(plain: string): string {
  return crypto.createHash('sha256').update(plain + PASSWORD_SALT).digest('hex');
}

function safeHashEquals(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

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
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
    return null;
  }
  const user = USERS_DB.get(session.username);
  if (!user?.isActive) {
    SESSIONS.delete(token);
    return null;
  }
  return { session, user };
}

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

app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const language = req.body?.language;
  if (!username || !password) return res.status(400).json({ success: false, error: 'USERNAME_PASSWORD_REQUIRED' });

  const user = USERS_DB.get(username);
  if (!user || !user.isActive) return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
  if (!safeHashEquals(hashPasswordServer(password), user.passwordHash)) return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });

  const token = `fathi_sec_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const session: ActiveSession = { token, userId: user.id, username: user.username, role: user.role, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  SESSIONS.set(token, session);
  user.lastLoginAt = new Date().toISOString();
  if (isSupportedLanguage(language)) user.preferredLanguage = language;

  return res.json({ success: true, token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.session) SESSIONS.delete(req.session.token);
  return res.json({ success: true });
});

app.get('/api/auth/session', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ success: true, user: sanitizeUser(req.user!) });
});

app.get('/api/auth/users', requireAuth, requireAdmin, (_req, res) => {
  return res.json({ success: true, users: Array.from(USERS_DB.values()).map(sanitizeUser) });
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
    feedingStatus: pond?.feedingStatus === 'STOPPED' ? 'STOPPED' : 'ACTIVE',
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
    version: '6.0.5',
    ai: getAIClient() ? 'configured_optional' : 'not_configured_optional',
  });
});

const handleAiAssistant = async (req: AuthenticatedRequest, res: Response) => {
  const userQuery = typeof req.body?.prompt === 'string' ? req.body.prompt : typeof req.body?.query === 'string' ? req.body.query : '';
  const language = isSupportedLanguage(req.body?.language) ? req.body.language : 'fa';
  if (!userQuery.trim()) return res.status(400).json({ success: false, error: 'QUERY_REQUIRED' });

  const farmContext = sanitizeFarmContext(req.body?.farmContext);
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

app.post('/api/ai/assistant', requireAuth, aiRateLimit, handleAiAssistant);
app.post('/api/ai/ask', requireAuth, aiRateLimit, handleAiAssistant);

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

app.post('/api/ai/translate-dynamic', requireAuth, aiRateLimit, handleDynamicTranslation);

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

app.post('/api/ai/media', requireAuth, aiRateLimit, handleAiMarketing);
app.post('/api/ai/marketing-campaign', requireAuth, aiRateLimit, handleAiMarketing);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fathi Aqua Super ERP Server running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Server startup failed', error);
  process.exitCode = 1;
});
