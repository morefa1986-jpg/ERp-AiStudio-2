import React from 'react';
import { Settings, ShieldCheck, Power, RotateCcw } from 'lucide-react';
import { APP_MODULES, useModuleConfig } from '../../context/ModuleConfigContext';
import { useAuth } from '../../context/AuthContext';

export const AdminSettingsView:React.FC=()=>{
 const {currentUser}=useAuth(); const {enabled,setEnabled,enableAll,reset}=useModuleConfig();
 const admin=currentUser?.role==='Super Admin'||currentUser?.role==='Farm Owner';
 if(!admin)return <div className="p-8 bg-rose-950/20 border border-rose-500/30 rounded-2xl text-rose-200"><ShieldCheck className="inline mr-2"/>این بخش فقط برای Super Admin / Farm Owner قابل تغییر است.</div>;
 const groups=[...new Set(APP_MODULES.map(m=>m.group))];
 return <div className="space-y-6 pb-12"><div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between gap-4"><div><h1 className="text-xl font-black flex gap-2"><Settings className="text-amber-400"/>مرکز تنظیمات ادمین — مدیریت کل برنامه</h1><p className="text-xs text-slate-400 mt-1">تمام بخش‌های ERP در این صفحه نمایش داده می‌شوند. خاموش کردن هر بخش آن را از منو و دسترسی عادی کاربران حذف می‌کند؛ داده‌های آن حذف نمی‌شوند.</p></div><div className="flex gap-2"><button onClick={enableAll} className="px-3 py-2 bg-emerald-600 rounded-xl text-xs font-bold">فعال‌سازی همه</button><button onClick={reset} className="px-3 py-2 bg-slate-800 rounded-xl text-xs flex gap-1"><RotateCcw className="w-4"/>بازنشانی</button></div></div>
 <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">ماژول‌های هسته‌ای Dashboard، Ponds، Security، Backup و Admin Settings برای جلوگیری از قفل‌شدن یا از دست رفتن کنترل مدیریتی قابل خاموش‌شدن نیستند.</div>
 {groups.map(g=><section key={g} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="font-bold text-amber-400 mb-4">{g}</h2><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{APP_MODULES.filter(m=>m.group===g).map(m=>{const on=enabled[m.id]!==false;return <div key={m.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"><div><div className="font-bold text-sm">{m.label}</div><div className="text-[10px] text-slate-500 font-mono">{m.id}{m.core?' • CORE':''}</div></div><button disabled={m.core} onClick={()=>setEnabled(m.id,!on)} className={`w-14 h-7 rounded-full p-1 transition ${on?'bg-emerald-600':'bg-slate-700'} disabled:opacity-50`} title={m.core?'ماژول هسته‌ای':'فعال/غیرفعال'}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on?'translate-x-7':'translate-x-0'}`}/></button></div>})}</div></section>)}
 </div>;
};
