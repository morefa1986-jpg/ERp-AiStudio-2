import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { getStoredSessionToken, useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  Globe,
  Share2,
  Copy,
  Check,
  Send,
  RefreshCw,
  Award,
  Crown,
} from 'lucide-react';

export const CaviarMarketingView: React.FC = () => {
  const { t, language } = useI18n();
  const { hasPermission } = useAuth();

  const [targetLang, setTargetLang] = useState<string>('en');
  const [platform, setPlatform] = useState<string>('LinkedIn Luxury & B2B (صادراتی و هتل‌های ۵ ستاره)');
  const [productType, setProductType] = useState<string>('Imperial Beluga Caviar (Huso huso) - 50g & 100g');
  const [tone, setTone] = useState<string>('Ultra-Luxury & Gastronomic Elegance (فوق لوکس)');
  const [targetMarket, setTargetMarket] = useState<string>('Dubai, Paris, London, Tokyo Luxury Michelin Restaurants');
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const languagesList = [
    { code: 'fa', label: 'Persian (فارسی - بازار داخلی و حوزه خلیج فارس)' },
    { code: 'en', label: 'English (انگلیسی - بازار جهانی)' },
    { code: 'de', label: 'German (آلمانی - آلمان و سوئیس)' },
    { code: 'fr', label: 'French (فرانسوی - فرانسه و رستوران‌های میشلن)' },
    { code: 'es', label: 'Spanish (اسپانیایی - اسپانیا و آمریکای لاتین)' },
    { code: 'ru', label: 'Russian (روسی - روسیه و اوراسیا)' },
    { code: 'ar', label: 'Arabic (عربی - امارات، قطر و کویت)' },
  ];

  const handleGenerateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedContent('');

    try {
      const response = await fetch('/api/ai/marketing-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getStoredSessionToken() ? { Authorization: `Bearer ${getStoredSessionToken()}` } : {}) },
        body: JSON.stringify({
          language: targetLang,
          productType,
          platform,
          targetMarket,
          tone,
        }),
      });

      const data = await response.json();
      setGeneratedContent(data.campaignText || (data.error === 'AI_NOT_CONFIGURED' ? 'موتور هوش مصنوعی اختیاری پیکربندی نشده است؛ متن تبلیغاتی تولید نشد.' : 'محتوایی تولید نشد.'));
    } catch (err) {
      setGeneratedContent(
        'خطا در تولید محتوای تبلیغاتی. لطفاً از اتصال سرور و کلید هوش مصنوعی اطمینان حاصل فرمایید.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-amber-400" />
            استودیو مارکتینگ و کمپین‌های چندزبانه خاویار لوکس (۷ زبان)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            تولید هوشمند متون بازاریابی B2B، کاتالوگ هتل‌های لوکس، پست‌های رسانه‌ای و معرفی خاویار با هوش مصنوعی چندزبانه
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-bold">
          <Globe className="w-4 h-4 text-amber-400" />
          <span>7 Supported Living Languages</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 cols: Generator Settings Form */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            تنظیمات کمپین تبلیغاتی صادراتی
          </h3>

          <form onSubmit={handleGenerateCampaign} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                زبان هدف تولید محتوا (Target Language):
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-amber-500"
              >
                {languagesList.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                رسانه و قالب انتشار (Channel / Platform):
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-500"
              >
                <option value="LinkedIn Luxury B2B (پیشنهاد به مدیران هتل و رستوران)">
                  LinkedIn Luxury B2B (پیشنهاد به مدیران هتل و سرآشپزان بین‌المللی)
                </option>
                <option value="Instagram Luxury Brand (پست و کپشن برند لوکس)">
                  Instagram Luxury Brand (پست و کپشن رسمی همراه با هشتگ‌های جذاب)
                </option>
                <option value="Hotel & Michelin Catalog (معرفی در کاتالوگ منوی تشریفاتی)">
                  Hotel & Michelin Catalog (معرفی در کاتالوگ منوی تشریفاتی)
                </option>
                <option value="Email VIP Pitch (ایمیل اختصاصی به خریداران عمده اروپا و امارات)">
                  Email VIP Pitch (ایمیل اختصاصی به خریداران عمده اروپا و امارات)
                </option>
                <option value="International Press Release (بیانیه خبری صادرات)">
                  International Press Release (بیانیه خبری رسمی صادرات و مجوز CITES)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                محصول و گرید خاویار:
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-500"
              >
                <option value="Imperial Beluga Caviar (Huso huso) - 50g / 100g Tin">
                  خاویار امپریال بلوگا فیل‌ماهی (دانه درشت بالای ۳.۴mm)
                </option>
                <option value="Royal Beluga Caviar">خاویار رویال بلوگا فتحی</option>
                <option value="Asetra Gold Caviar (Acipenser gueldenstaedtii)">
                  خاویار استرا طلایی تاس‌ماهی
                </option>
                <option value="Sevruga Caviar (Acipenser stellatus)">خاویار سوروگا اوزون‌برون</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                بازار و مخاطب هدف (Target Market):
              </label>
              <input
                type="text"
                value={targetMarket}
                onChange={(e) => setTargetMarket(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">لحن بیان (Brand Tone):</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-500"
              >
                <option value="Ultra-Luxury & Gastronomic Elegance">
                  فوق‌العاده لوکس و تشریفاتی (Ultra-Luxury & Gastronomic)
                </option>
                <option value="B2B Commercial & CITES Certified Authority">
                  تجاری رسمی با تأکید بر اصالت و مجوز سایتس (B2B Authority)
                </option>
                <option value="Storytelling & Caspian Heritage">
                  داستان‌سرایی و اصالت میراث دریای خزر (Caspian Heritage)
                </option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !hasPermission('media', 'create')}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال نگارش هوشمند کمپین با هوش مصنوعی...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>تولید هوشمند محتوای کمپین ({targetLang.toUpperCase()})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 7 cols: Generated Result Studio */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                متن تولید شده کمپین
              </h3>

              {generatedContent && (
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی متن</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 text-slate-400">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs">
                  هوش مصنوعی در حال طراحی پیام اختصاصی بر اساس فرهنگ مقصد و استانداردهای خاویار فیل‌ماهی...
                </p>
              </div>
            ) : generatedContent ? (
              <div
                dir={targetLang === 'fa' || targetLang === 'ar' ? 'rtl' : 'ltr'}
                className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 text-slate-200 text-xs leading-relaxed max-h-[420px] overflow-y-auto whitespace-pre-wrap font-sans"
              >
                {generatedContent}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
                <Globe className="w-12 h-12 stroke-1 text-slate-600" />
                <p className="text-xs">
                  پارامترهای زبان و رسانه را تنظیم کرده و دکمه تولید هوشمند را فشار دهید.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
