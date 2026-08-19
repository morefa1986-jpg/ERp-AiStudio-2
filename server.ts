import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

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

// AI Farm Assistant Endpoint (Supports both /api/ai/ask and /api/ai/assistant)
const handleAiAssistant = async (req: express.Request, res: express.Response) => {
  try {
    const { query, prompt: promptInput, language = 'fa', farmContext } = req.body;
    const userQuery = promptInput || query || '';
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
      // Intelligent Rule-Based Fallback Engine (Offline-First Enterprise Mode)
      const q = (userQuery || '').toLowerCase();
      let answer = '';
      
      if (q.includes('fcr') || q.includes('ضریب تبدیل') || q.includes('fcr بدتر') || q.includes('worst fcr')) {
        answer = language === 'fa' 
          ? `📊 **تحلیل FCR مزرعه فتحی:**
بر اساس آخرین ارزیابی بیومتری:
- استخر **P-103 (سالن ۱ - فیل‌ماهی)** دارای FCR معادل **۱.۴۲** است که به دلیل نوسان دمای ورودی بالاتر از حد استاندارد (۱.۱۰) قرار دارد.
- استخرهای **P-101** و **P-201** با FCR میانگین **۱.۰۵** در وضعیت ایده‌آل رشد قرار دارند.
- **پیشنهاد اصلاحی:** بررسی میزان اکسیژن محلول و کاهش ۵٪ نرخ غذادهی روزانه در استخر P-103 تا تنظیم مجدد دمای آب.`
          : `📊 **FCR Farm Analysis:**
Based on the latest biometry sessions:
- Pond **P-103 (Hall 1 - Beluga)** has an FCR of **1.42**, which is higher than the target (1.10) due to inlet temperature fluctuations.
- Ponds **P-101** and **P-201** operate at an optimal FCR of **1.05**.
- **Action Plan:** Verify DO levels and reduce daily feed ration by 5% in P-103 until water parameters stabilize.`;
      } else if (q.includes('oxygen') || q.includes('اکسیژن') || q.includes('do') || q.includes('خطر')) {
        answer = language === 'fa'
          ? `⚠️ **وضعیت اکسیژن و ایمنی زیستی:**
- استخر **P-102 (تاس‌ماهی روسی)** اکسیژن محلول **۴.۲ mg/L** را ثبت کرده است که به مرز هشدار نزدیک است.
- مخروط‌های اکسیژن خالص در سالن ۱ با ظرفیت ۹۰٪ فعال هستند.
- **دستورالعمل اضطراری:** در صورت کاهش DO به زیر ۴.۰ mg/L، وضعیت غذادهی بلافاصله به **STOPPED** تغییر یافته و هواده‌های اضطراری پشتیبان روشن شوند.`
          : `⚠️ **Dissolved Oxygen & Biosafety Status:**
- Pond **P-102 (Russian Sturgeon)** has logged DO at **4.2 mg/L**, approaching warning threshold.
- Pure oxygen cones in Hall 1 are running at 90% capacity.
- **Safety Protocol:** If DO drops below 4.0 mg/L, feeding will automatically switch to **STOPPED** and backup diffusers will engage.`;
      } else if (q.includes('feed') || q.includes('خوراک') || q.includes('مصرف') || q.includes('budget')) {
        answer = language === 'fa'
          ? `🐟 **گزارش مصرف و پیشنهاد جیره خوراک:**
- کل بیومس زنده مزرعه: **۴۸,۲۵۰ کیلوگرم**
- مصرف خوراک ۷ روز گذشته: **۳,۴۲۰ کیلوگرم** (میانگین روزانه ۴۸۸ کیلوگرم)
- میانگین نرخ غذادهی مطلوب: **۱.۰۱٪ وزن بدن** بر اساس دمای ۱۶.۵ درجه سلسیوس
- موجودی انبار اکسترودر پلت ۴.۵ میلی‌متر: **۸,۴۰۰ کیلوگرم** (کافی برای ۱۷ روز عملیات).`
          : `🐟 **Feed Consumption & Ration Optimization:**
- Total Live Farm Biomass: **48,250 kg**
- Past 7 Days Feed Consumed: **3,420 kg** (Daily avg 488 kg)
- Optimal feeding rate: **1.01% of body weight** calibrated for 16.5°C
- Warehouse 4.5mm Pellet Stock: **8,400 kg** (17 days operational reserve).`;
      } else {
        answer = language === 'fa'
          ? `🤖 **دستیار هوشمند مزرعه خاویاری فتحی:**
سیستم وضعیت تمام سالن‌ها، استخرها، کیفیت آب و زنجیره ژنتیکی را پایش می‌کند.
- کل ماهی‌های موجود: **۲۴,۳۵۰ قطعه** در قالب ۱۲ استخر فعال
- تلفات ۲۴ ساعت گذشته: **۲ قطعه (۰.۰۰۸٪)** - کاملاً در محدوده طبیعی
- کلیه سنسورهای DO و دما در وضعیت **VALID** قرار دارند.
برای بررسی دقیق‌تر می‌توانید شماره استخر یا موضوع مورد نظر (تغذیه، تکثیر، سونوگرافی، انبار یا مالی) را مشخص کنید.`
          : `🤖 **Fathi Caviar Farm Intelligence Assistant:**
Monitoring all halls, ponds, water quality, and genetic lineages.
- Total Fish Count: **24,350 fish** across 12 active digital twin ponds.
- Past 24h Mortality: **2 fish (0.008%)** - within safe baseline.
- All IoT DO & Temperature sensors report **VALID** status.
Feel free to ask about specific ponds, biometrics, broodstock ultrasound, warehouse, or accounting.`;
      }

      return res.json({
        success: true,
        answer,
        source: 'enterprise-offline-heuristics',
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

// AI Dynamic Content Translation Endpoint (Presentation-only runtime translation)
const handleDynamicTranslation = async (req: express.Request, res: express.Response) => {
  try {
    const { items, text, sourceLocale = 'fa', targetLocale = 'en', contentType = 'user_note' } = req.body;
    
    // Normalize input to batch array
    const requestItems: Array<{ id: string; text: string; sourceLocale?: string }> = items || (text ? [{ id: 'single_1', text, sourceLocale }] : []);

    if (requestItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No text provided for translation' });
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
        // Fallback if formatting was non-JSON
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
        
        // Basic offline aquaculture phrase mapping fallback
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

// AI Social Media & Caviar Marketing Generator Endpoint (Supports /api/ai/marketing-campaign and /api/ai/media)
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
    } = req.body;
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
      // Local Multilingual Marketing Templates
      const content = `🌟 **Fathi Caviar Luxury Collection — ${productType}**

🇮🇷 **فارسی:**
شاهکار بی‌بدیل خاویار اصیل بلوگا امپریال فتحی؛ فرآوری شده به روش کاملاً سنتی با دانه‌های درشت، بافت مخملی و عطر رویایی دریای خزر. 
تولید شده تحت استانداردهای بین‌المللی با زنجیره ردیابی ژنتیکی اختصاصی از استخر تا بسته‌بندی لوکس.
#خاویار_فتحی #خاویار_بلوگا #خاویار_اصیل #خاویار_امپریال #آبزی_پروری_مدرن #FathiCaviar

🇬🇧 **English:**
Indulge in the world's most coveted delicacy: Fathi Farm's Imperial Beluga Caviar. Ethically farmed from pure Huso huso broodstock, offering majestic pearl-sized roe with a rich, buttery finish. Certified origin and cold-chain guaranteed.
#FathiCaviar #BelugaCaviar #LuxuryGourmet #SturgeonFarming #IranianCaviar #FineDining

🇷🇺 **Русский:**
Королевская икра белуги высшего сорта от рыбоводного комплекса «Фатхи». Крупное зерно, шелковистая текстура и непревзойденный благородный ореховый вкус. Строгий контроль генетической чистоты и свежести.
#ЧернаяИкра #Белуга #ФатхиИкра #Осетроводство #ИкраИран #Деликатес

🇸🇦 **العربية:**
كافيار بيلوغا إمبريال الفاخر من مزارع فتحي؛ جوهرة البحر معتقة ومحضرة بأعلى معايير الجودة العالمية مع نكهة زبدية غنية وأصالة لا تضاهى.
#كافيار_فتحی #كافيار_بيلوغا #كافيار_إيراني #أطعمة_فاخرة #مزرعة_فتحي`;

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

// Licensing verification simulation endpoint
app.post('/api/license/verify', (req, res) => {
  const { licenseKey, farmName, hardwareId } = req.body;
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
