import React, { useState } from 'react';
import { useI18n, LANGUAGES } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { dynamicTranslationService } from '../../services/dynamicTranslationService';
import {
  Globe,
  Wifi,
  WifiOff,
  ShieldCheck,
  Search,
  User as UserIcon,
  LogOut,
  AlertTriangle,
  Download,
  CheckCircle2,
  Cpu,
  Layers,
  Bell,
  Menu,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { LanguageCode } from '../../types';

interface HeaderProps {
  onSelectNav: (viewId: string) => void;
  onOpenSearch: () => void;
  onToggleMobileMenu?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectNav,
  onOpenSearch,
  onToggleMobileMenu,
  onOpenAuth,
}) => {
  const { t, language, setLanguage, meta, dir } = useI18n();
  const { currentUser, logout, usersList, login } = useAuth();
  const { ponds } = useFarm();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAiTransDetails, setShowAiTransDetails] = useState(false);
  const [isLanOffline, setIsLanOffline] = useState(false);
  const [dynamicAiEnabled, setDynamicAiEnabled] = useState(dynamicTranslationService.isTranslationEnabled());

  const handleToggleAiTrans = () => {
    const nextState = !dynamicAiEnabled;
    dynamicTranslationService.toggleTranslation(nextState);
    setDynamicAiEnabled(nextState);
  };

  const metrics = dynamicTranslationService.getMetrics();
  const stoppedPonds = ponds.filter((p) => p.feedingStatus === 'STOPPED');
  const criticalPonds = ponds.filter((p) => p.dissolvedOxygen < 4.0 || p.criticalAlerts.length > 0);

  return (
    <header className="h-[64px] bg-[#0C0C0E] text-[#E4E4E7] border-b border-[#1F1F22] sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between shadow-md">
      {/* Brand / Title & Mobile Menu Button */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[#A1A1AA] hover:text-white lg:hidden cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => onSelectNav('dashboard')}
          className="flex items-center gap-2.5 text-right cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-inner group-hover:border-[#D4AF37] transition-all">
            <span className="font-serif italic font-bold text-lg text-[#D4AF37]">FA</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif italic text-lg tracking-tight text-white group-hover:text-[#D4AF37] transition-colors">
                Fathi Aqua
              </span>
              <span className="text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-[#18181B] text-[#D4AF37] border border-[#D4AF37]/30">
                ERP Enterprise
              </span>
            </div>
            <p className="text-[10px] text-[#71717A] tracking-wider hidden sm:block">
              {t('appSlogan')}
            </p>
          </div>
        </button>
      </div>

      {/* Global Search Bar (Sophisticated Pill) */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] hover:border-[#3F3F46] rounded-full px-4 py-2 text-xs text-[#A1A1AA] flex items-center justify-between transition-all cursor-pointer shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <Search className="w-3.5 h-3.5 text-[#71717A]" />
            <span className="text-[#A1A1AA]">{t('searchPlaceholder')}</span>
          </div>
          <kbd className="hidden lg:inline-block px-2 py-0.5 text-[9px] font-mono font-semibold text-[#71717A] bg-[#0C0C0E] border border-[#27272A] rounded-md">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Top Controls & Status Bar */}
      <div className="flex items-center gap-2.5">
        {/* Critical Alert Warning */}
        {stoppedPonds.length > 0 && (
          <button
            onClick={() => onSelectNav('ponds')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181B] text-rose-400 border border-rose-500/40 rounded-lg text-xs font-semibold animate-pulse cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{stoppedPonds.length} استخر قطع خوراک</span>
          </button>
        )}

        {/* LAN / Online Status */}
        <button
          onClick={() => setIsLanOffline(!isLanOffline)}
          title={isLanOffline ? t('lanMode') : t('online')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            isLanOffline
              ? 'bg-[#18181B] border-[#D4AF37]/40 text-[#D4AF37]'
              : 'bg-[#18181B] border-[#27272A] text-emerald-400'
          }`}
        >
          {isLanOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden xl:inline">{t('offline')} (LAN)</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden xl:inline">{t('online')} (LAN 4ms)</span>
            </>
          )}
        </button>

        {/* 7-Language Selector Component */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#18181B] hover:bg-[#1F1F22] text-[#E4E4E7] border border-[#27272A] rounded-lg text-xs font-medium cursor-pointer transition-colors"
          >
            <span className="text-sm leading-none">{meta.flag}</span>
            <span className="font-semibold text-xs">{meta.nativeName}</span>
            <span className="text-[10px] text-[#71717A] uppercase ml-0.5">({language})</span>
          </button>

          {showLangDropdown && (
            <div
              className={`absolute ${
                dir === 'rtl' ? 'left-0' : 'right-0'
              } mt-2 w-52 bg-[#121214] border border-[#1F1F22] rounded-xl shadow-2xl py-1.5 z-50`}
            >
              <div className="px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-bold text-[#71717A] border-b border-[#1F1F22]">
                Select Language (7 Locales)
              </div>
              {LANGUAGES.map((langItem) => (
                <button
                  key={langItem.code}
                  onClick={() => {
                    setLanguage(langItem.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs hover:bg-[#18181B] transition-colors cursor-pointer ${
                    language === langItem.code
                      ? 'text-[#D4AF37] font-bold bg-[#18181B]'
                      : 'text-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{langItem.flag}</span>
                    <span>{langItem.nativeName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#71717A] uppercase">
                    {langItem.code}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Dynamic Translation Toggle & Telemetry */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowAiTransDetails(!showAiTransDetails)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              dynamicAiEnabled
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900/40 shadow-sm shadow-cyan-950/30'
                : 'bg-[#18181B] text-[#71717A] border-[#27272A] hover:text-[#A1A1AA]'
            }`}
            title="وضعیت ترجمه هوشمند محتوای پویا"
          >
            <Sparkles className={`w-3.5 h-3.5 ${dynamicAiEnabled ? 'text-cyan-400 animate-pulse' : 'text-[#71717A]'}`} />
            <span className="text-[11px]">AI Trans</span>
            <span className={`w-1.5 h-1.5 rounded-full ${dynamicAiEnabled ? 'bg-cyan-400' : 'bg-[#52525B]'}`} />
          </button>

          {showAiTransDetails && (
            <div
              className={`absolute ${
                dir === 'rtl' ? 'left-0' : 'right-0'
              } mt-2 w-72 bg-[#121214] border border-[#1F1F22] rounded-xl shadow-2xl p-3 z-50 animate-fadeIn`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#1F1F22]">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">ترجمه رانتایم هوشمند (Gemini)</span>
                </div>
                <button
                  onClick={handleToggleAiTrans}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    dynamicAiEnabled
                      ? 'bg-cyan-500 text-black'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {dynamicAiEnabled ? 'فعال' : 'غیرفعال'}
                </button>
              </div>

              <div className="py-2 space-y-1.5 text-[11px] text-[#A1A1AA]">
                <p className="text-[10px] text-[#71717A] leading-relaxed">
                  ترجمه در لحظه نمایش یادداشت‌ها، علت‌ها و توضیحات کاربر بدون تغییر پایگاه‌داده اصلی.
                </p>
                <div className="bg-[#18181B] p-2 rounded-lg space-y-1 border border-[#27272A] font-mono text-[10px]">
                  <div className="flex justify-between">
                    <span>درخواست‌های کل:</span>
                    <span className="text-white font-bold">{metrics.totalRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>حافظه کش (Cache Hit):</span>
                    <span className="text-emerald-400 font-bold">{metrics.cacheHits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>فراخوانی سرور (API Calls):</span>
                    <span className="text-cyan-400 font-bold">{metrics.apiCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>کاراکترهای صرفه‌جویی:</span>
                    <span className="text-[#D4AF37] font-bold">{metrics.savedCharacters}</span>
                  </div>
                </div>
              </div>

              <div className="pt-1.5 border-t border-[#1F1F22] flex justify-end">
                <button
                  onClick={() => {
                    dynamicTranslationService.clearCache();
                    setShowAiTransDetails(false);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  پاک‌سازی حافظه موقت (Clear Cache)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Icon Button */}
        <button
          onClick={() => onSelectNav('securityAudit')}
          className="w-9 h-9 rounded-full bg-[#18181B] border border-[#27272A] hover:border-[#D4AF37]/50 flex items-center justify-center text-[#A1A1AA] hover:text-[#D4AF37] transition-colors cursor-pointer"
          title="Audit & Alerts"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User Profile / RBAC Switch */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 p-1.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-lg text-xs cursor-pointer transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-[#1F1F22] border border-[#D4AF37]/40 text-[#D4AF37] font-serif italic font-bold flex items-center justify-center text-xs">
              {currentUser?.fullName ? currentUser.fullName.slice(0, 1) : 'U'}
            </div>
            <div className="hidden lg:block text-right">
              <div className="text-[11px] font-semibold text-white leading-tight">
                {currentUser?.fullName?.split(' ')[0] || 'Admin'}
              </div>
              <div className="text-[9px] text-[#D4AF37] font-mono">
                {currentUser?.role || 'SuperAdmin'}
              </div>
            </div>
          </button>

          {showUserDropdown && (
            <div
              className={`absolute ${
                dir === 'rtl' ? 'left-0' : 'right-0'
              } mt-2 w-64 bg-[#121214] border border-[#1F1F22] rounded-xl shadow-2xl p-2.5 z-50`}
            >
              <div className="px-3 py-2 border-b border-[#1F1F22] mb-1.5">
                <p className="text-xs font-bold text-white">{currentUser?.fullName}</p>
                <p className="text-[11px] text-[#D4AF37] font-semibold">{currentUser?.role}</p>
                <p className="text-[10px] text-[#71717A] font-mono mt-0.5">{currentUser?.email}</p>
              </div>

              <div className="py-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] px-3 py-1">
                  Active Personnel Accounts:
                </p>
                {usersList.map((u) => (
                  <div
                    key={u.id}
                    className={`w-full text-right px-3 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors ${
                      currentUser?.id === u.id ? 'bg-[#18181B] font-bold text-[#D4AF37]' : 'text-[#A1A1AA]'
                    }`}
                  >
                    <span className="truncate">{u.fullName}</span>
                    <span className="text-[9px] text-[#71717A] mr-2 font-mono">@{u.username}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-[#1F1F22] mt-1.5 space-y-1.5">
                {onOpenAuth && (
                  <button
                    onClick={() => {
                      onOpenAuth();
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-center py-1.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#D4AF37]/30 text-[#D4AF37] text-xs rounded-lg transition-colors cursor-pointer font-medium flex items-center justify-center gap-1.5"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>تغییر حساب / ورود با کاربر دیگر</span>
                  </button>
                )}
                <div className="flex justify-between gap-2">
                  <button
                    onClick={() => {
                      onSelectNav('securityAudit');
                      setShowUserDropdown(false);
                    }}
                    className="flex-1 text-center py-1.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] text-[#E4E4E7] text-xs rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    مدیریت امنیت
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserDropdown(false);
                    }}
                    className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs rounded-lg transition-colors cursor-pointer font-medium flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
