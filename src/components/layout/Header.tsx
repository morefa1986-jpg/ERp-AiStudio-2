import React, { useEffect, useState } from 'react';
import { Bell, LogOut, Menu, RefreshCw, Search, Sparkles, User as UserIcon, Wifi, WifiOff } from 'lucide-react';
import { LANGUAGES, useI18n } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { dynamicTranslationService } from '../../services/dynamicTranslationService';

interface HeaderProps {
  onSelectNav: (viewId: string) => void;
  onOpenSearch: () => void;
  onToggleMobileMenu?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSelectNav, onOpenSearch, onToggleMobileMenu, onOpenAuth }) => {
  const { t, language, setLanguage, meta, dir } = useI18n();
  const { currentUser, logout, usersList } = useAuth();
  const { ponds } = useFarm();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAiTransDetails, setShowAiTransDetails] = useState(false);
  const [dynamicAiEnabled, setDynamicAiEnabled] = useState(dynamicTranslationService.isTranslationEnabled());
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const online = () => setNetworkOnline(true);
    const offline = () => setNetworkOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  const stoppedPonds = ponds.filter((pond) => pond.feedingStatus === 'STOPPED');
  const metrics = dynamicTranslationService.getMetrics();

  const toggleDynamicTranslation = () => {
    const enabled = !dynamicAiEnabled;
    dynamicTranslationService.toggleTranslation(enabled);
    setDynamicAiEnabled(enabled);
  };

  return (
    <header className="h-[64px] bg-[#0C0C0E] text-[#E4E4E7] border-b border-[#1F1F22] sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[#A1A1AA] hover:text-white lg:hidden cursor-pointer"
            aria-label="menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <button type="button" onClick={() => onSelectNav('dashboard')} className="flex items-center gap-2.5 text-start cursor-pointer group min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#D4AF37]/40 flex items-center justify-center shadow-inner group-hover:border-[#D4AF37] transition-all shrink-0">
            <span className="font-serif italic font-bold text-lg text-[#D4AF37]">FA</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif italic text-lg tracking-tight text-white group-hover:text-[#D4AF37] transition-colors truncate">Fathi Aqua</span>
              <span className="hidden sm:inline text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-[#18181B] text-[#D4AF37] border border-[#D4AF37]/30">ERP Enterprise</span>
            </div>
            <p className="text-[10px] text-[#71717A] tracking-wider hidden sm:block truncate">{t('appSlogan')}</p>
          </div>
        </button>
      </div>

      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] hover:border-[#3F3F46] rounded-full px-4 py-2 text-xs text-[#A1A1AA] flex items-center justify-between transition-all cursor-pointer shadow-inner"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" />
            <Search className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
            <span className="text-[#A1A1AA] truncate">{t('searchPlaceholder')}</span>
          </div>
          <kbd className="hidden lg:inline-block px-2 py-0.5 text-[9px] font-mono font-semibold text-[#71717A] bg-[#0C0C0E] border border-[#27272A] rounded-md">Ctrl + K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        {stoppedPonds.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectNav('ponds')}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#18181B] text-rose-400 border border-rose-500/40 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{t('nav.stoppedBadge', { count: stoppedPonds.length })}</span>
          </button>
        )}

        <div
          title={networkOnline ? t('online') : t('offline')}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${networkOnline ? 'bg-[#18181B] border-[#27272A] text-emerald-400' : 'bg-[#18181B] border-[#D4AF37]/40 text-[#D4AF37]'}`}
        >
          {networkOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden xl:inline">{networkOnline ? t('online') : t('offline')}</span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangDropdown((value) => !value)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#18181B] hover:bg-[#1F1F22] text-[#E4E4E7] border border-[#27272A] rounded-lg text-xs font-medium cursor-pointer transition-colors"
          >
            <span className="text-sm leading-none">{meta.flag}</span>
            <span className="font-semibold text-xs hidden sm:inline">{meta.nativeName}</span>
            <span className="text-[10px] text-[#71717A] uppercase">({language})</span>
          </button>

          {showLangDropdown && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-52 bg-[#121214] border border-[#1F1F22] rounded-xl shadow-2xl py-1.5 z-50`}>
              <div className="px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-bold text-[#71717A] border-b border-[#1F1F22]">{t('header.selectLanguage')}</div>
              {LANGUAGES.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  onClick={() => {
                    setLanguage(item.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs hover:bg-[#18181B] transition-colors cursor-pointer ${language === item.code ? 'text-[#D4AF37] font-bold bg-[#18181B]' : 'text-[#A1A1AA]'}`}
                >
                  <div className="flex items-center gap-2.5"><span className="text-base">{item.flag}</span><span>{item.nativeName}</span></div>
                  <span className="text-[10px] font-mono text-[#71717A] uppercase">{item.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setShowAiTransDetails((value) => !value)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${dynamicAiEnabled ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40' : 'bg-[#18181B] text-[#71717A] border-[#27272A]'}`}
            title={t('header.aiTransTitle')}
          >
            <Sparkles className={`w-3.5 h-3.5 ${dynamicAiEnabled ? 'text-cyan-400' : 'text-[#71717A]'}`} />
            <span className="text-[11px] hidden xl:inline">{t('header.aiTrans')}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${dynamicAiEnabled ? 'bg-cyan-400' : 'bg-[#52525B]'}`} />
          </button>

          {showAiTransDetails && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-72 bg-[#121214] border border-[#1F1F22] rounded-xl shadow-2xl p-3 z-50`}>
              <div className="flex items-center justify-between pb-2 border-b border-[#1F1F22]">
                <div className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-cyan-400" /><span className="text-xs font-bold text-white">{t('header.aiTransTitle')}</span></div>
                <button type="button" onClick={toggleDynamicTranslation} className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${dynamicAiEnabled ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                  {dynamicAiEnabled ? t('active') : t('inactive')}
                </button>
              </div>
              <p className="py-2 text-[10px] text-[#71717A] leading-relaxed">{t('header.aiTransDesc')}</p>
              <div className="bg-[#18181B] p-2 rounded-lg space-y-1 border border-[#27272A] font-mono text-[10px] text-[#A1A1AA]">
                <div className="flex justify-between"><span>{t('header.totalRequests')}</span><span className="text-white font-bold">{metrics.totalRequests}</span></div>
                <div className="flex justify-between"><span>{t('header.cacheHits')}</span><span className="text-emerald-400 font-bold">{metrics.cacheHits}</span></div>
                <div className="flex justify-between"><span>{t('header.apiCalls')}</span><span className="text-cyan-400 font-bold">{metrics.apiCalls}</span></div>
                <div className="flex justify-between"><span>{t('header.savedChars')}</span><span className="text-[#D4AF37] font-bold">{metrics.savedCharacters}</span></div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    dynamicTranslationService.clearCache();
                    setShowAiTransDetails(false);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />{t('header.clearCache')}
                </button>
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => onSelectNav('securityAudit')} className="w-9 h-9 rounded-full bg-[#18181B] border border-[#27272A] hover:border-[#D4AF37]/50 flex items-center justify-center text-[#A1A1AA] hover:text-[#D4AF37] transition-colors cursor-pointer" title={t('header.notificationsTitle')}>
          <Bell className="w-4 h-4" />
        </button>

        <div className="relative">
          <button type="button" onClick={() => setShowUserDropdown((value) => !value)} className="flex items-center gap-2.5 p-1.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-lg text-xs cursor-pointer transition-colors">
            <div className="w-6 h-6 rounded-full bg-[#1F1F22] border border-[#D4AF37]/40 text-[#D4AF37] font-serif italic font-bold flex items-center justify-center text-xs">{currentUser?.fullName?.slice(0, 1) || 'U'}</div>
            <div className="hidden lg:block text-start">
              <div className="text-[11px] font-semibold text-white leading-tight">{currentUser?.fullName?.split(' ')[0] || 'Admin'}</div>
              <div className="text-[9px] text-[#D4AF37] font-mono">{currentUser?.role}</div>
            </div>
          </button>

          {showUserDropdown && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-64 bg-[#121214] border border-[#1F1F22] rounded-xl shadow-2xl p-2.5 z-50`}>
              <div className="px-3 py-2 border-b border-[#1F1F22] mb-1.5">
                <p className="text-xs font-bold text-white">{currentUser?.fullName}</p>
                <p className="text-[11px] text-[#D4AF37] font-semibold">{currentUser?.role}</p>
                <p className="text-[10px] text-[#71717A] font-mono mt-0.5">{currentUser?.email}</p>
              </div>
              <div className="py-1 max-h-40 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] px-3 py-1">{t('header.activeAccounts')}</p>
                {usersList.filter((user) => user.isActive).map((user) => (
                  <div key={user.id} className={`px-3 py-1.5 text-xs rounded-lg flex items-center justify-between ${currentUser?.id === user.id ? 'bg-[#18181B] font-bold text-[#D4AF37]' : 'text-[#A1A1AA]'}`}>
                    <span className="truncate">{user.fullName}</span><span className="text-[9px] text-[#71717A] ms-2 font-mono">@{user.username}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-[#1F1F22] mt-1.5 space-y-1.5">
                {onOpenAuth && (
                  <button type="button" onClick={() => { onOpenAuth(); setShowUserDropdown(false); }} className="w-full py-1.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#D4AF37]/30 text-[#D4AF37] text-xs rounded-lg cursor-pointer font-medium flex items-center justify-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5" />{t('header.switchAccount')}
                  </button>
                )}
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => { onSelectNav('securityAudit'); setShowUserDropdown(false); }} className="flex-1 py-1.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] text-[#E4E4E7] text-xs rounded-lg cursor-pointer font-medium">{t('header.manageSecurity')}</button>
                  <button type="button" onClick={() => { logout(); setShowUserDropdown(false); }} className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs rounded-lg cursor-pointer font-medium flex items-center gap-1">
                    <LogOut className="w-3 h-3" />{t('header.logout')}
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
