import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, RotateCcw, Search, Settings2, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { MODULE_CATALOG, ModuleSection, ModuleVisibilityId, useModuleVisibility } from '../../context/ModuleVisibilityContext';
import { useAuth } from '../../context/AuthContext';
import { MasterDataAdminPanel } from './MasterDataAdminPanel';
import { WaterTelemetryAdminPanel } from './WaterTelemetryAdminPanel';

const SECTION_COPY: Record<ModuleSection, { fa: string; en: string }> = {
  breeding: { fa: 'پرورش و عملیات مزرعه', en: 'Farm Operations' },
  hatchery: { fa: 'تکثیر، تولید و زنجیره محصول', en: 'Production Chain' },
  commercial: { fa: 'بازرگانی، مالی و منابع انسانی', en: 'Commercial & Finance' },
  system: { fa: 'سیستم، امنیت و مدیریت', en: 'System & Administration' },
};

export const AdminSettingsView: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    visibility,
    canManageModules,
    setModuleEnabled,
    enableAllModules,
    disableOptionalModules,
    resetModuleVisibility,
    enabledCount,
  } = useModuleVisibility();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MODULE_CATALOG;
    return MODULE_CATALOG.filter((item) =>
      item.titleFa.toLowerCase().includes(needle)
      || item.titleEn.toLowerCase().includes(needle)
      || item.descriptionFa.toLowerCase().includes(needle)
    );
  }, [query]);

  if (!canManageModules) {
    return (
      <div className="max-w-2xl mx-auto bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-sm text-slate-300">
        <div className="flex items-center gap-2 text-rose-300 font-bold mb-2"><LockKeyhole className="w-5 h-5" /> دسترسی محدود</div>
        این بخش فقط برای Farm Owner و Super Admin قابل تغییر است.
      </div>
    );
  }

  const enabledOptional = MODULE_CATALOG.filter((item) => !item.locked && visibility[item.id] !== false).length;
  const optionalCount = MODULE_CATALOG.filter((item) => !item.locked).length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Settings2 className="w-6 h-6 text-amber-400" />
            تنظیمات ادمین و مرکز کنترل کل ERP
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Master Data مزرعه روی Server مدیریت می‌شود. کنترل نمایش ماژول‌ها نیز در همین مرکز قرار دارد؛ خاموش‌کردن یک ماژول آن را از Sidebar و Routing حذف می‌کند.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          {currentUser?.fullName || 'Admin'} · {enabledCount}/{MODULE_CATALOG.length} فعال
        </div>
      </div>

      <MasterDataAdminPanel />
      <WaterTelemetryAdminPanel />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><span className="text-[11px] text-slate-400 block">کل ماژول‌ها</span><strong className="text-2xl text-white">{MODULE_CATALOG.length}</strong></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><span className="text-[11px] text-slate-400 block">فعال</span><strong className="text-2xl text-emerald-400">{enabledCount}</strong></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><span className="text-[11px] text-slate-400 block">اختیاری فعال</span><strong className="text-2xl text-amber-400">{enabledOptional}/{optionalCount}</strong></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><span className="text-[11px] text-slate-400 block">قفل سیستمی</span><strong className="text-2xl text-cyan-400">{MODULE_CATALOG.filter((item) => item.locked).length}</strong></div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی بخش برنامه..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={enableAllModules} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"><Eye className="w-4 h-4" />فعال‌کردن همه</button>
          <button onClick={disableOptionalModules} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"><EyeOff className="w-4 h-4" />خاموش‌کردن همه اختیاری‌ها</button>
          <button onClick={resetModuleVisibility} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5"><RotateCcw className="w-4 h-4" />بازنشانی پیش‌فرض</button>
        </div>
      </div>

      {(Object.keys(SECTION_COPY) as ModuleSection[]).map((section) => {
        const items = filtered.filter((item) => item.section === section);
        if (!items.length) return null;
        return (
          <section key={section} className="space-y-3">
            <div className="flex items-end justify-between px-1">
              <div><h2 className="text-sm font-black text-white">{SECTION_COPY[section].fa}</h2><span className="text-[10px] text-slate-500 uppercase tracking-wider">{SECTION_COPY[section].en}</span></div>
              <span className="text-[11px] text-slate-500">{items.length} بخش</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((item) => {
                const enabled = item.locked || visibility[item.id] !== false;
                return (
                  <article key={item.id} className={`rounded-2xl border p-4 transition-colors ${enabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 opacity-70'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white truncate">{item.titleFa}</h3>
                          {item.locked && <span className="text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">SYSTEM LOCK</span>}
                        </div>
                        <span className="text-[10px] text-amber-400/80 font-mono">{item.titleEn}</span>
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed min-h-[32px]">{item.descriptionFa}</p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={enabled}
                        disabled={Boolean(item.locked)}
                        onClick={() => setModuleEnabled(item.id as ModuleVisibilityId, !enabled)}
                        className={`shrink-0 rounded-xl p-2 border ${item.locked ? 'cursor-not-allowed bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : enabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                        title={item.locked ? 'این بخش برای مدیریت سیستم همیشه فعال می‌ماند.' : enabled ? 'خاموش کردن ماژول' : 'فعال کردن ماژول'}
                      >
                        {item.locked ? <LockKeyhole className="w-5 h-5" /> : enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="font-mono text-slate-500">{item.id}</span>
                      <span className={enabled ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>{enabled ? 'فعال' : 'خاموش'}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
