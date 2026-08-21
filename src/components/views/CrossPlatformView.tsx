import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import {
  Smartphone,
  Laptop,
  Apple,
  Download,
  CheckCircle2,
  Share2,
  Layers,
  Sparkles,
  WifiOff,
  Shield,
  FileCode,
} from 'lucide-react';

export const CrossPlatformView: React.FC = () => {
  const { t } = useI18n();
  const [downloadedPlatform, setDownloadedPlatform] = useState<string | null>(null);

  const handleDownloadInstaller = (platformName: string) => {
    setDownloadedPlatform(platformName);
    if (platformName.startsWith('Windows') && typeof window !== 'undefined') {
      window.open('https://github.com/morefa1986-jpg/ERp-AiStudio-2/actions/workflows/windows-desktop-installer.yml', '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => setDownloadedPlatform(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-amber-400" />
            مرکز توزیع چندسکویی (Windows Installer, iOS PWA & Android)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            بسته‌های اجرایی مستقل برای کامپیوترهای مزرعه (ویندوز دسکتاپ آفلاین)، تبلت‌های سالن پرورش و گوشی‌های هوشمند پرسنل
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-bold">
          <WifiOff className="w-4 h-4 text-emerald-400" />
          <span>SQLite محلی؛ LAN فقط با فعال‌سازی صریح</span>
        </div>
      </div>

      {downloadedPlatform && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-xs animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <strong className="block font-bold text-white">
              {downloadedPlatform.startsWith('Windows')
                ? `وضعیت ${downloadedPlatform} در مسیر رسمی ساخت باز شد.`
                : `بسته ${downloadedPlatform} در این نسخه منتشر نشده است.`}
            </strong>
            <span className="text-[11px] text-emerald-200">
              وجود فایل، امضا و وضعیت اتصال باید از خروجی رسمی همان مسیر تأیید شود؛ این رابط فایل جعلی تولید نمی‌کند.
            </span>
          </div>
        </div>
      )}

      {/* 3 Platforms Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PLATFORM 1: Windows 11/10 Desktop Installer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-blue-500/40 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Laptop className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-white">
                نسخه نصبی ویندوز (Desktop .exe)
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                مخصوص سیستم‌های کنترل مرکزی، مانیتورینگ سالن‌ها، سرور محلی و ثبت فاکتورهای حسابداری با چاپ مستقیم.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>پشتیبانی کامل از چاپگرهای فیش و لیبل حرارتی</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>همگام‌سازی LAN فقط با FATHI_LAN_MODE و میزبان مجاز</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>سرور داخلی روی localhost با داده پایدار SQLite</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadInstaller('Windows 64-bit Desktop Setup (.exe)')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30 transition-all"
          >
            <Download className="w-4 h-4" />
            مشاهده ساخت رسمی Windows در GitHub Actions
          </button>
        </div>

        {/* PLATFORM 2: iOS Progressive Web App (Apple) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-slate-600 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center">
              <Apple className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-white">
                نسخه آیفون و آیپد (Apple iOS PWA)
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                مخصوص تکنسین‌های سالن پرورش، کارشناسان بیومتری و بازدیدکنندگان با تبلت iPad در محوطه استخرها.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>نصب فوری با کلیک روی Add to Home Screen</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>پشتیبانی از اسکن بارکد و QR-Code با دوربین</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>عملکرد تمام صفحه (Standalone Native Feel)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadInstaller('iOS Safari PWA Configuration')}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all"
          >
            <Share2 className="w-4 h-4" />
            راهنمای iOS (بسته محلی در این نسخه ارائه نشده است)
          </button>
        </div>

        {/* PLATFORM 3: Android APK & Tablet Edition */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-emerald-500/40 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-white">
                نسخه اندروید و هندهلد (Android APK)
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                مخصوص دستگاه‌های هندهلد صنعتی RFID ریدر، ثبت وعده خوراک پای استخرها و تبلت‌های ضدآب.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>اتصال مستقیم به اسکنرهای بلوتوثی RFID چیپ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>ثبت رکوردها در SQLite محلی؛ نسخه مستقل موبایلی در این انتشار ارائه نشده است</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>پشتیبانی از تم تیره برای دید در شب استخرها</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadInstaller('Android Package (.apk)')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Download className="w-4 h-4" />
            راهنمای Android (بسته محلی در این نسخه ارائه نشده است)
          </button>
        </div>
      </div>
    </div>
  );
};
