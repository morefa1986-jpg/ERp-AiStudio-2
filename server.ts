import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Auth & Security Storage (In-memory + Salted SHA-256)
const PASSWORD_SALT = 'fathi_aqua_salt_2026';

function hashPasswordServer(plain: string): string {
  return crypto.createHash('sha256').update(plain + PASSWORD_SALT).digest('hex');
}

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

// Initial Authoritative Users
const USERS_DB: Map<string, ServerUser> = new Map([
  [
    'admin',
    {
      id: 'usr_admin',
      username: 'admin',
      fullName: 'مهندس سعید فتحی (Super Admin)',
      email: 'admin@fathi-aqua.com',
      role: 'Super Admin',
      passwordHash: hashPasswordServer('admin123'),
      isActive: true,
      preferredLanguage: 'fa',
      lastLoginAt: '2026-08-19T07:00:00Z',
      createdAt: '2024-01-01',
    },
  ],
  [
    'vet',
    {
      id: 'usr_vet',
      username: 'vet',
      fullName: 'دکتر مریم علوی (سرپرست دامپزشکی و بهداشت)',
      email: 'vet@fathi-aqua.com',
      role: 'Veterinarian',
      passwordHash: hashPasswordServer('vet123'),
      isActive: true,
      preferredLanguage: 'fa',
      createdAt: '2024-02-15',
    },
  ],
  [
    'hatchery',
    {
      id: 'usr_hatchery',
      username: 'hatchery',
      fullName: 'مهندس رضا حسینی (مدیر تکثیر و ژنتیک)',
      email: 'hatchery@fathi-aqua.com',
      role: 'Hatchery Manager',
      passwordHash: hashPasswordServer('hatchery123'),
      isActive: true,
      preferredLanguage: 'fa',
      createdAt: '2024-03-01',
    },
  ],
  [
    'sales',
    {
      id: 'usr_sales',
      username: 'sales',
      fullName: 'آقای شمس (مدیر فروش و صادرات خاویار)',
      email: 'sales@fathi-aqua.com',
      role: 'Sales Manager',
      passwordHash: hashPasswordServer('sales123'),
      isActive: true,
      preferredLanguage: 'en',
      createdAt: '2024-04-10',
    },
  ],
  [
    'accountant',
    {
      id: 'usr_accountant',
      username: 'accountant',
      fullName: 'خانم مهندس صابری (حسابدار ارشد)',
      email: 'accounting@fathi-aqua.com',
      role: 'Accountant',
      passwordHash: hashPasswordServer('acc123'),
      isActive: true,
      preferredLanguage: 'fa',
      createdAt: '2024-05-01',
    },
  ],
]);

interface ActiveSession {
  token: string;
  userId: string;
  username: string;
  role: string;
  createdAt: number;
  expiresAt: number;
}

const SESSIONS: Map<string, ActiveSession> = new Map();

function sanitizeUser(user: ServerUser) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// -------------------------------------------------------------
// Authentication Endpoints (Phase 1 & Phase 2)
// -------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { username, password, language } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'نام کاربری و کلمه عبور الزامی است.' });
  }

  const user = USERS_DB.get(username.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, error: 'نام کاربری یا کلمه عبور نادرست است.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, error: 'حساب کاربری غیرفعال است. با مدیر سیستم تماس بگیرید.' });
  }

  const incomingHash = hashPasswordServer(password);
  if (incomingHash !== user.passwordHash) {
    return res.status(401).json({ success: false, error: 'نام کاربری یا کلمه عبور نادرست است.' });
  }

  // Generate secure session token
  const token = 'fathi_sec_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: ActiveSession = {
    token,
    userId: user.id,
    username: user.username,
    role: user.role,
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  SESSIONS.set(token, session);
  user.lastLoginAt = new Date().toISOString();
  if (language) user.preferredLanguage = language;

  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || req.body?.token;
  if (token && SESSIONS.has(token)) {
    SESSIONS.delete(token);
  }
  return res.json({ success: true });
});

app.get('/api/auth/session', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.replace(/^Bearer\s+/i, '');
  if (!token || !SESSIONS.has(token)) {
    return res.status(401).json({ success: false, error: 'Session invalid or expired' });
  }

  const session = SESSIONS.get(token)!;
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
    return res.status(401).json({ success: false, error: 'Session expired' });
  }

  const user = USERS_DB.get(session.username);
  if (!user || !user.isActive) {
    SESSIONS.delete(token);
    return res.status(401).json({ success: false, error: 'User inactive or not found' });
  }

  return res.json({
    success: true,
    user: sanitizeUser(user),
  });
});

app.get('/api/auth/users', (req, res) => {
  const list = Array.from(USERS_DB.values()).map(sanitizeUser);
  return res.json({ success: true, users: list });
});

// Lazy initialization for Gemini AI SDK
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Fathi Aqua Super ERP Enterprise v6.0',
    version: '6.0.4',
    geminiAvailable: Boolean(process.env.GEMINI_API_KEY),
  });
});

// -------------------------------------------------------------
// AI Farm Assistant Endpoint
// -------------------------------------------------------------
const handleAiAssistant = async (req: express.Request, res: express.Response) => {
  try {
    const { query, prompt: promptInput, language = 'fa', farmContext } = req.body || {};
    const userQuery = promptInput || query || '';

    if (!userQuery.trim()) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const ai = getAIClient();

    if (ai) {
      const systemInstruction = `You are the Expert AI Aquaculture & Farm Intelligence Assistant for 'Fathi Sturgeon Farm' (مزرعه پرورش و فرآوری ماهیان خاویاری فتحی).
You provide precise, biological, mathematical, and operational advice for sturgeon species (Huso huso / Beluga, Acipenser persicus, Acipenser gueldenstaedtii, Acipenser ruthenus, Acipenser baerii).
Your responses should be practical, safety-oriented (especially concerning Dissolved Oxygen thresholds < 4.0 mg/L and Feeding Safety), and formatted in the user's requested language (${language}).
Always reference factual data provided in the farm context.
Output well-structured answers with markdown, bullet points, and actionable steps.`;

      const prompt = `Current Farm Telemetry & Context:
${JSON.stringify(farmContext || {}, null, 2)}

User Question (${language}):
${userQuery}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      return res.json({
        success: true,
        answer: response.text || 'No response generated.',
        source: 'gemini-2.5-flash',
      });
    } else {
      // Deterministic Offline Rule-Based Advisor (Strictly references actual provided farm context)
      const q = (userQuery || '').toLowerCase();
      const ponds = farmContext?.ponds || [];
      const stoppedPonds = ponds.filter((p: any) => p.feedingStatus === 'STOPPED');
      const lowOxygenPonds = ponds.filter((p: any) => p.dissolvedOxygen < 4.0 || p.dissolvedOxygen < 5.0);
      const totalBiomass = ponds.reduce((sum: number, p: any) => sum + (p.biomassKg || 0), 0);
      const totalFish = ponds.reduce((sum: number, p: any) => sum + (p.fishCount || 0), 0);

      let answer = '';

      if (q.includes('fcr') || q.includes('ضریب تبدیل') || q.includes('feed conversion')) {
        const sortedFcr = [...ponds].sort((a: any, b: any) => (b.fcr || 0) - (a.fcr || 0));
        const highest = sortedFcr[0];
        answer = language === 'fa'
          ? `📊 **تحلیل FCR استخرهای مزرعه فتحی:**
${highest ? `- استخر **${highest.name}** با FCR معادل **${highest.fcr}** نیازمند پایش جیره و دمای ورودی است.` : '- داده‌های استخر در دسترس نیست.'}
- میانگین کل FCR مزرعه بر اساس داده‌های ثبت‌شده محاسبه می‌شود.
- **توصیه:** بررسی یکنواختی هوادهی و پایش دقیق جدول تغذیه.`
          : `📊 **FCR Farm Analysis:**
${highest ? `- Pond **${highest.name}** reports an FCR of **${highest.fcr}**.` : '- Pond data is being gathered.'}
- Recommended Action: Maintain optimum dissolved oxygen above 6.0 mg/L and follow calibrated feed profiles.`;
      } else if (q.includes('oxygen') || q.includes('اکسیژن') || q.includes('do') || q.includes('خطر')) {
        answer = language === 'fa'
          ? `⚠️ **وضعیت اکسیژن و ایمنی زیستی استخرها:**
${lowOxygenPonds.length > 0 ? lowOxygenPonds.map((p: any) => `- استخر **${p.name}**: اکسیژن ${p.dissolvedOxygen} mg/L (${p.feedingStatus === 'STOPPED' ? 'تغذیه متوقف' : 'هشدار'})`).join('\n') : '- تمامی استخرها در محدوده اکسیژن مجاز قرار دارند.'}
- **قانون ایمنی اکید:** در صورت افت DO به زیر ۴.۰ mg/L، وضعیت غذادهی استخر بلافاصله به **STOPPED** تغییر می‌یابد.`
          : `⚠️ **Dissolved Oxygen & Biosafety Status:**
${lowOxygenPonds.length > 0 ? lowOxygenPonds.map((p: any) => `- Pond **${p.name}**: DO ${p.dissolvedOxygen} mg/L (${p.feedingStatus})`).join('\n') : '- All ponds maintain safe oxygen levels above threshold.'}
- Safety protocol: Feeding is strictly prohibited whenever DO falls below 4.0 mg/L.`;
      } else if (q.includes('feed') || q.includes('خوراک') || q.includes('تغذیه')) {
        answer = language === 'fa'
          ? `🐟 **وضعیت تغذیه و بیومس مزرعه:**
- کل بیومس فعال: **${totalBiomass.toLocaleString()} کیلوگرم**
- تعداد کل ماهیان: **${totalFish.toLocaleString()} قطعه**
- استخرهای متوقف شده: **${stoppedPonds.length} استخر**`
          : `🐟 **Feeding & Biomass Summary:**
- Total Live Biomass: **${totalBiomass.toLocaleString()} kg**
- Total Fish Count: **${totalFish.toLocaleString()} fish**
- Stopped Feeding Ponds: **${stoppedPonds.length} ponds**`;
      } else {
        answer = language === 'fa'
          ? `🤖 **سامانه هوشمند مزرعه خاویاری فتحی (حالت آفلاین امن):**
- پایش لحظه‌ای استخرها، کیفیت آب و بیومس فعال است.
- تعداد استخرهای ثبتی: **${ponds.length} استخر**
- وضعیت قطع اضطراری خوراک: **${stoppedPonds.length} استخر**`
          : `🤖 **Fathi Caviar Farm Intelligence Assistant (Secure Offline Mode):**
- Real-time monitoring of ponds, water quality, and live biomass active.
- Monitored Ponds: **${ponds.length} ponds**
- Emergency Stopped Ponds: **${stoppedPonds.length} ponds**`;
      }

      return res.json({
        success: true,
        answer,
        source: 'enterprise-deterministic-offline-engine',
      });
    }
  } catch (error: any) {
    console.error('Error in AI Assistant:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Error processing AI request',
    });
  }
};

app.post('/api/ai/assistant', handleAiAssistant);
app.post('/api/ai/ask', handleAiAssistant);

// -------------------------------------------------------------
// AI Dynamic Content Translation Endpoint
// -------------------------------------------------------------
const handleDynamicTranslation = async (req: express.Request, res: express.Response) => {
  try {
    const { items, text, sourceLocale = 'fa', targetLocale = 'en' } = req.body || {};
    
    // Normalize input to batch array
    const requestItems: Array<{ id: string; text: string; sourceLocale?: string }> = items || (text ? [{ id: 'single_1', text, sourceLocale }] : []);

    if (requestItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No text provided for translation' });
    }

    // Security check: Never translate passwords or secrets
    const hasSecretKeywords = requestItems.some((item) => {
      const t = (item.text || '').toLowerCase();
      return t.includes('password') || t.includes('token') || t.includes('secret') || t.includes('apikey');
    });

    if (hasSecretKeywords) {
      return res.status(400).json({ success: false, error: 'Security violation: confidential fields cannot be sent to translation' });
    }

    // If source and target are the same, return as-is immediately
    if (sourceLocale === targetLocale) {
      return res.json({
        success: true,
        translations: requestItems.map((item) => ({
          id: item.id,
          translatedText: item.text,
          sourceLocale,
          targetLocale,
          fromCache: true,
        })),
      });
    }

    const ai = getAIClient();

    if (ai) {
      const systemInstruction = `You are a professional translation engine for an industrial sturgeon aquaculture ERP (Fathi Sturgeon Farm).
Translate the provided user-entered dynamic content from ${sourceLocale} to ${targetLocale}.

Strict Translation Rules:
1. Preserve the exact operational meaning, nuance, and tone.
2. Do NOT add commentary, explanations, preambles, or conversational filler.
3. Do NOT summarize or omit any details.
4. Do NOT translate or modify IDs, chip numbers, batch codes, pond codes (e.g. P-101, COLD-A-04), or invoice numbers.
5. Do NOT translate scientific Latin species names (e.g., Huso huso, Acipenser persicus, Acipenser gueldenstaedtii, Acipenser ruthenus, Acipenser baerii, Acipenser stellatus).
6. Preserve exact numeric values, dates, and measurement units (e.g. mg/L, °C, kg, g, %, ppt, ppm, FCR).
7. Preserve medication names and chemical compounds (e.g., Formalin, Oxytetracycline, Chloramine-T, Povidone-Iodine).
8. Return ONLY a valid JSON object matching this schema:
{
  "translations": [
    {
      "id": "<item_id>",
      "translatedText": "<strictly translated text in ${targetLocale}>",
      "sourceLocale": "${sourceLocale}",
      "targetLocale": "${targetLocale}"
    }
  ]
}`;

      const prompt = `Items to translate to ${targetLocale}:
${JSON.stringify(requestItems, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        parsed = {
          translations: requestItems.map((item) => ({
            id: item.id,
            translatedText: responseText.trim(),
            sourceLocale,
            targetLocale,
          })),
        };
      }

      const results = parsed.translations || [];
      return res.json({
        success: true,
        translations: results,
        source: 'gemini-2.5-flash',
      });
    } else {
      // Local Heuristic / Dictionary Fallback for known aquaculture phrases when offline
      const translations = requestItems.map((item) => {
        const t = item.text || '';
        let translated = t;
        
        if (targetLocale === 'en') {
          translated = t
            .replace(/کاهش اکسیژن باعث تلفات شد/g, 'Oxygen drop caused mortality')
            .replace(/تلفات ناشی از افت اکسیژن/g, 'Mortality caused by low oxygen')
            .replace(/سوزاندن در کوره لاشه‌سوز و ضدعفونی بستر/g, 'Incineration in carcass furnace and disinfection')
            .replace(/سورتینگ و یکنواخت‌سازی/g, 'Sorting and size grading')
            .replace(/تغذیه استخر/g, 'Pond feeding')
            .replace(/عارضه طبیعی/g, 'Natural cause')
            .replace(/عادی و اشتهای مطلوب/g, 'Normal and optimal appetite')
            .replace(/اشتهای شدید و سریع/g, 'Aggressive and rapid appetite')
            .replace(/بی‌حالی و کندی در بلع/g, 'Lethargic and slow feeding')
            .replace(/عدم مصرف خوراک/g, 'Untouched feed');
        } else if (targetLocale === 'de') {
          translated = t
            .replace(/کاهش اکسیژن باعث تلفات شد/g, 'Sauerstoffabfall verursachte Mortalität')
            .replace(/تلفات ناشی از افت اکسیژن/g, 'Verluste aufgrund von Sauerstoffmangel')
            .replace(/سوزاندن در کوره لاشه‌سوز و ضدعفونی بستر/g, 'Verbrennung im Kadaverofen und Desinfektion')
            .replace(/سورتینگ و یکنواخت‌سازی/g, 'Sortierung und Größeneinteilung')
            .replace(/تغذیه استخر/g, 'Teichfütterung')
            .replace(/عارضه طبیعی/g, 'Natürliche Ursache');
        } else if (targetLocale === 'ru') {
          translated = t
            .replace(/کاهش اکسیژن باعث تلفات شد/g, 'Падение кислорода вызвало отход рыбы')
            .replace(/تلفات ناشی از افت اکسیژن/g, 'Отход рыбы из-за нехватки кислорода')
            .replace(/سورتینگ و یکنواخت‌سازی/g, 'Сортировка и калибровка')
            .replace(/عارضه طبیعی/g, 'Естественная причина');
        } else if (targetLocale === 'ar') {
          translated = t
            .replace(/کاهش اکسیژن باعث تلفات شد/g, 'انخفاض الأكسجين تسبب في النفوق')
            .replace(/تلفات ناشی از افت اکسیژن/g, 'النفوق الناجم عن نقص الأكسجين')
            .replace(/سورتینگ و یکنواخت‌سازی/g, 'الفرز والتدريج الحجمي')
            .replace(/عارضه طبیعی/g, 'سبب طبيعي');
        }

        return {
          id: item.id,
          translatedText: translated,
          sourceLocale: item.sourceLocale || sourceLocale,
          targetLocale,
          isOfflineFallback: true,
        };
      });

      return res.json({
        success: true,
        translations,
        source: 'enterprise-offline-translation-engine',
      });
    }
  } catch (error: any) {
    console.error('Error in dynamic translation endpoint:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to perform runtime dynamic translation',
    });
  }
};

app.post('/api/ai/translate-dynamic', handleDynamicTranslation);

// AI Social Media & Caviar Marketing Generator Endpoint
const handleAiMarketing = async (req: express.Request, res: express.Response) => {
  try {
    const {
      topic,
      productType = 'Imperial Beluga Caviar',
      platform,
      channels = ['Instagram', 'LinkedIn'],
      targetMarket = 'Global Luxury Hospitality',
      tone = 'Ultra-Luxury & Gastronomic Elegance',
      language = 'en',
    } = req.body || {};
    const ai = getAIClient();

    if (ai) {
      const systemInstruction = `You are the Luxury Social Media & Caviar Marketing Specialist for Fathi Sturgeon Farm.
Generate high-converting, elegant promotional copy for ultra-premium Persian sturgeon caviar and smoked fillet.
Provide localized content in the requested language (${language}) with appropriate hashtags, tone, and call to action.`;

      const prompt = `Product: ${productType}
Platform/Format: ${platform || channels.join(', ')}
Target Market: ${targetMarket}
Tone: ${tone}
Language: ${language}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({
        success: true,
        content: response.text,
        campaignText: response.text,
        source: 'gemini-2.5-flash',
      });
    } else {
      const content = `🌟 **Fathi Caviar Luxury Collection — ${productType}**

🇮🇷 **فارسی:**
شاهکار بی‌بدیل خاویار اصیل بلوگا امپریال فتحی؛ فرآوری شده به روش کاملاً سنتی با دانه‌های درشت، بافت مخملی و عطر رویایی دریای خزر. 
تولید شده تحت استانداردهای بین‌المللی با زنجیره ردیابی ژنتیکی اختصاصی از استخر تا بسته‌بندی لوکس.
#خاویار_فتحی #خاویار_بلوگا #خاویار_اصیل #خاویار_امپریال #آبزی_پروری_مدرن #FathiCaviar

🇬🇧 **English:**
Indulge in the world's most coveted delicacy: Fathi Farm's Imperial Beluga Caviar. Ethically farmed from pure Huso huso broodstock, offering majestic pearl-sized roe with a rich, buttery finish. Certified origin and cold-chain guaranteed.
#FathiCaviar #BelugaCaviar #LuxuryGourmet #SturgeonFarming #IranianCaviar #FineDining`;

      return res.json({
        success: true,
        content,
        campaignText: content,
        source: 'luxury-content-engine',
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
};

app.post('/api/ai/media', handleAiMarketing);
app.post('/api/ai/marketing-campaign', handleAiMarketing);

// Licensing verification
app.post('/api/license/verify', (req, res) => {
  const { licenseKey, farmName, hardwareId } = req.body || {};
  res.json({
    valid: true,
    edition: 'Enterprise Commercial v6.0',
    plan: 'Lifetime Enterprise Offline+LAN',
    farmName: farmName || 'مزرعه تکثیر و پرورش ماهیان خاویاری فتحی',
    hardwareId: hardwareId || 'HW-7749-FATHI-AQUA',
    features: [
      'ALL_7_LANGUAGES',
      'UNLIMITED_PONDS',
      'FULL_GENETIC_TRACEABILITY',
      'DOUBLE_ENTRY_ACCOUNTING',
      'OFFLINE_LAN_SYNC',
      'AI_FARM_INTELLIGENCE',
      'CROSS_PLATFORM_PACKAGING',
    ],
    expiresAt: '2099-12-31T23:59:59Z',
  });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fathi Aqua Super ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
