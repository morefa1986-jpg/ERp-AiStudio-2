import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Key, Plus, Search, ShieldAlert, SlidersHorizontal, UserCheck, UserX, Users } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { LanguageCode, UserRole } from '../../types';

const ROLES: UserRole[] = ['Farm Owner','Farm Manager','Hall Manager','Technician','Hatchery Manager','Laboratory','Veterinarian','Feed Manager','Warehouse Manager','Processing Manager','Cold Storage Manager','Accountant','Sales Manager','CRM Operator','HR Manager','Media Manager','Viewer/Auditor'];
const SCOPE_REQUIRED = new Set<UserRole>(['Hall Manager', 'Technician']);
const toggleValue = (items: string[], value: string) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export const SecurityAuditView: React.FC = () => {
  const { formatDate, formatTime } = useI18n();
  const { usersList, currentUser, createNewUser, toggleUserActive, resetUserPassword, updateUserAccess } = useAuth();
  const { auditLogs, halls, ponds } = useFarm();
  const [tab, setTab] = useState<'users' | 'audit' | 'policy'>('users');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [accessUserId, setAccessUserId] = useState('');
  const [accessRole, setAccessRole] = useState<UserRole>('Viewer/Auditor');
  const [accessHallScope, setAccessHallScope] = useState<string[]>([]);
  const [accessPondScope, setAccessPondScope] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ username: '', fullName: '', email: '', role: 'Viewer/Auditor' as UserRole, password: '', preferredLanguage: 'fa' as LanguageCode, hallScope: [] as string[], pondScope: [] as string[] });

  const isAdmin = currentUser?.role === 'Super Admin' || currentUser?.role === 'Farm Owner';
  const filteredLogs = useMemo(() => auditLogs.filter((log) => {
    const needle = search.trim().toLowerCase();
    return !needle || `${log.action} ${log.entity} ${log.userName} ${log.details} ${log.ipAddress || ''}`.toLowerCase().includes(needle);
  }), [auditLogs, search]);

  const availablePondsFor = (hallScope: string[]) => hallScope.length ? ponds.filter((pond) => hallScope.includes(pond.hallId)) : ponds;
  const scopeLabel = (user: { hallScope?: string[]; pondScope?: string[] }) => {
    if (user.pondScope?.length) return `${user.pondScope.length} استخر`;
    if (user.hallScope?.length) return `${user.hallScope.length} سالن`;
    return 'کل داده مجاز نقش';
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (SCOPE_REQUIRED.has(form.role) && !form.hallScope.length && !form.pondScope.length) {
      setMessage('برای Hall Manager و Technician تعیین حداقل یک سالن یا استخر الزامی است.');
      return;
    }
    try {
      await createNewUser({ username: form.username.trim().toLowerCase(), fullName: form.fullName.trim(), email: form.email.trim(), role: form.role, isActive: true, preferredLanguage: form.preferredLanguage, hallScope: form.hallScope, pondScope: form.pondScope }, form.password);
      setMessage('کاربر و Scope دسترسی در دیتابیس Server ایجاد شد.'); setShowNew(false);
      setForm({ username: '', fullName: '', email: '', role: 'Viewer/Auditor', password: '', preferredLanguage: 'fa', hallScope: [], pondScope: [] });
    } catch (error) { setMessage(`ایجاد کاربر انجام نشد: ${error instanceof Error ? error.message : 'UNKNOWN'}`); }
  };

  const toggle = async (userId: string) => {
    setMessage('');
    if (userId === currentUser?.id) { setMessage('برای جلوگیری از قفل‌شدن نشست، غیرفعال‌کردن حساب فعلی از این صفحه مجاز نیست.'); return; }
    try { await toggleUserActive(userId); setMessage('وضعیت حساب روی Server تغییر کرد.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'USER_UPDATE_FAILED'); }
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (resetPassword.length < 12) { setMessage('رمز جدید باید حداقل ۱۲ نویسه باشد.'); return; }
    try { await resetUserPassword(resetUserId, resetPassword); setMessage('رمز عبور روی Server بازنشانی شد.'); setResetUserId(''); setResetPassword(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'PASSWORD_RESET_FAILED'); }
  };

  const openAccess = (userId: string) => {
    const user = usersList.find((item) => item.id === userId);
    if (!user) return;
    setAccessUserId(user.id);
    setAccessRole((ROLES.includes(user.role as UserRole) ? user.role : 'Viewer/Auditor') as UserRole);
    setAccessHallScope(user.hallScope || []);
    setAccessPondScope(user.pondScope || []);
  };

  const saveAccess = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (SCOPE_REQUIRED.has(accessRole) && !accessHallScope.length && !accessPondScope.length) {
      setMessage('این نقش بدون Scope عملیاتی روی Server قابل ذخیره نیست.');
      return;
    }
    try {
      await updateUserAccess(accessUserId, { role: accessRole, hallScope: accessHallScope, pondScope: accessPondScope });
      setMessage('Role و Scope دسترسی روی Server ذخیره شد.');
      setAccessUserId('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'USER_SCOPE_UPDATE_FAILED'); }
  };

  const setFormHall = (hallId: string) => {
    const next = toggleValue(form.hallScope, hallId);
    const allowed = new Set(availablePondsFor(next).map((pond) => pond.id));
    setForm({ ...form, hallScope: next, pondScope: form.pondScope.filter((id) => allowed.has(id)) });
  };
  const setAccessHall = (hallId: string) => {
    const next = toggleValue(accessHallScope, hallId);
    const allowed = new Set(availablePondsFor(next).map((pond) => pond.id));
    setAccessHallScope(next); setAccessPondScope((previous) => previous.filter((id) => allowed.has(id)));
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-amber-400" />امنیت، کاربران و Audit Trail</h1><p className="text-xs text-slate-400 mt-1">کاربران، Role و Scope سالن/استخر Server-authoritative هستند. Audit ثبت سروری دارد، اما تا اضافه‌شدن cryptographic hash-chain به‌عنوان «غیرقابل‌دستکاری رمزنگاری‌شده» معرفی نمی‌شود.</p></div><div className="flex gap-2 text-xs"><button onClick={() => setTab('users')} className={`px-3 py-2 rounded-xl ${tab === 'users' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>کاربران</button><button onClick={() => setTab('audit')} className={`px-3 py-2 rounded-xl ${tab === 'audit' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Audit</button><button onClick={() => setTab('policy')} className={`px-3 py-2 rounded-xl ${tab === 'policy' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>سیاست دسترسی</button></div></div>

    {message && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200">{message}</div>}

    {tab === 'users' && <div className="space-y-4">{isAdmin && <div className="flex justify-end"><button onClick={() => setShowNew(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold"><Plus className="w-4 h-4 inline ml-1" />کاربر Server جدید</button></div>}<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{usersList.map((user) => <div key={user.id} className={`bg-slate-900 border rounded-2xl p-5 ${user.isActive ? 'border-slate-800' : 'border-rose-500/30'}`}><div className="flex justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="text-white block">{user.fullName}</strong><span className="font-mono text-amber-400 text-xs">@{user.username}</span></div><span className="text-[10px] text-slate-400">{user.role}</span></div><div className="space-y-2 mt-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">ایمیل</span><span className="text-slate-300">{user.email}</span></div><div className="flex justify-between"><span className="text-slate-500">وضعیت</span><strong className={user.isActive ? 'text-emerald-400' : 'text-rose-400'}>{user.isActive ? 'فعال' : 'غیرفعال'}</strong></div><div className="flex justify-between"><span className="text-slate-500">Scope داده</span><span className="text-cyan-300">{scopeLabel(user)}</span></div><div className="flex justify-between"><span className="text-slate-500">زبان</span><span className="text-slate-300 uppercase">{user.preferredLanguage}</span></div></div>{isAdmin && <div className="grid grid-cols-3 gap-2 mt-4"><button onClick={() => void toggle(user.id)} disabled={user.id === currentUser?.id} className={`action ${user.isActive ? 'text-rose-300' : 'text-emerald-300'} disabled:opacity-30`}>{user.isActive ? <><UserX className="w-4 h-4" />غیرفعال</> : <><UserCheck className="w-4 h-4" />فعال</>}</button><button onClick={() => openAccess(user.id)} className="action text-cyan-300"><SlidersHorizontal className="w-4 h-4" />دسترسی</button><button onClick={() => { setResetUserId(user.id); setResetPassword(''); }} className="action text-amber-300"><Key className="w-4 h-4" />رمز</button></div>}</div>)}</div></div>}

    {tab === 'audit' && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex flex-col sm:flex-row justify-between gap-3 mb-4"><div><h2 className="text-sm font-bold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />ردپای عملیات Server</h2><span className="text-[10px] text-slate-500">برای Tamper Evidence کامل، Hash-chain/remote append-only sink هنوز باید در Backend اضافه شود.</span></div><div className="relative"><Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو..." className="bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white" /></div></div><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">زمان</th><th className="p-3">کاربر</th><th className="p-3">عملیات</th><th className="p-3">موجودیت</th><th className="p-3">شرح</th><th className="p-3">IP</th><th className="p-3">Transaction</th></tr></thead><tbody className="divide-y divide-slate-800">{filteredLogs.map((log) => <tr key={log.id} className="text-slate-300"><td className="p-3 whitespace-nowrap">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td><td className="p-3 text-white">{log.userName}</td><td className="p-3 font-mono text-amber-400">{log.action}</td><td className="p-3">{log.entity}</td><td className="p-3 min-w-64">{log.details}</td><td className="p-3 font-mono text-slate-500">{log.ipAddress || '—'}</td><td className="p-3 font-mono text-[10px] text-slate-500">{log.transactionId || '—'}</td></tr>)}</tbody></table></div></div>}

    {tab === 'policy' && <div className="grid md:grid-cols-2 gap-4"><div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5"><h2 className="text-sm font-bold text-emerald-300 mb-2">فعال: RBAC + Data Scope سروری</h2><p className="text-xs text-slate-400 leading-relaxed">Role مجوز ماژول/عملیات را تعیین می‌کند؛ hallScope/pondScope دامنه داده را محدود می‌کند. GET، PUT و حتی Conflict payload روی Server بر اساس Scope فیلتر می‌شوند.</p></div><div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5"><h2 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Custom Role</h2><p className="text-xs text-slate-400 leading-relaxed">Custom Role محلی قبلی غیرفعال است، چون هنوز جدول Role/Permission سروری مستقل ندارد. تا تکمیل آن، سیستم فقط نقش‌های معتبر Backend را قبول می‌کند.</p></div></div>}

    {showNew && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-3xl"><h2 className="text-white font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-amber-400" />کاربر جدید</h2><form onSubmit={createUser} className="grid grid-cols-2 gap-3 text-xs"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" required autoComplete="off" className="field" /><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="نام کامل" required className="field" /><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email" required className="field col-span-2" /><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, hallScope: [], pondScope: [] })} className="field">{ROLES.map((role) => <option key={role}>{role}</option>)}</select><select value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as LanguageCode })} className="field"><option value="fa">فارسی</option><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option><option value="ru">Русский</option><option value="ar">العربية</option></select><input type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="رمز حداقل ۱۲ نویسه" required autoComplete="new-password" className="field col-span-2" />
      <div className="col-span-2 scopeBox"><strong>سالن‌های مجاز {SCOPE_REQUIRED.has(form.role) && <span className="text-rose-400">*</span>}</strong><div className="scopeGrid">{halls.filter((hall) => hall.isActive !== false).map((hall) => <label key={hall.id}><input type="checkbox" checked={form.hallScope.includes(hall.id)} onChange={() => setFormHall(hall.id)} /> {hall.number} · {hall.name}</label>)}</div></div>
      <div className="col-span-2 scopeBox"><strong>استخرهای مجاز (اختیاری برای محدودکردن بیشتر)</strong><div className="scopeGrid">{availablePondsFor(form.hallScope).map((pond) => <label key={pond.id}><input type="checkbox" checked={form.pondScope.includes(pond.id)} onChange={() => setForm({ ...form, pondScope: toggleValue(form.pondScope, pond.id) })} /> {pond.number} · {pond.name}</label>)}</div></div>
      <div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">ایجاد روی Server</button></div></form></div></div>}

    {accessUserId && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"><div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-3xl"><h2 className="text-white font-bold mb-4">Role و Scope — {usersList.find((user) => user.id === accessUserId)?.fullName}</h2><form onSubmit={saveAccess} className="space-y-4 text-xs"><select value={accessRole} onChange={(e) => { setAccessRole(e.target.value as UserRole); setAccessHallScope([]); setAccessPondScope([]); }} className="field w-full">{ROLES.map((role) => <option key={role}>{role}</option>)}</select><div className="scopeBox"><strong>سالن‌های مجاز {SCOPE_REQUIRED.has(accessRole) && <span className="text-rose-400">*</span>}</strong><div className="scopeGrid">{halls.filter((hall) => hall.isActive !== false).map((hall) => <label key={hall.id}><input type="checkbox" checked={accessHallScope.includes(hall.id)} onChange={() => setAccessHall(hall.id)} /> {hall.number} · {hall.name}</label>)}</div></div><div className="scopeBox"><strong>استخرهای مجاز</strong><div className="scopeGrid">{availablePondsFor(accessHallScope).map((pond) => <label key={pond.id}><input type="checkbox" checked={accessPondScope.includes(pond.id)} onChange={() => setAccessPondScope((previous) => toggleValue(previous, pond.id))} /> {pond.number} · {pond.name}</label>)}</div></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setAccessUserId('')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl">ذخیره Scope روی Server</button></div></form></div></div>}

    {resetUserId && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-md"><h2 className="text-white font-bold mb-4">بازنشانی رمز — {usersList.find((user) => user.id === resetUserId)?.fullName}</h2><form onSubmit={reset} className="space-y-3 text-xs"><input type="password" minLength={12} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="رمز جدید حداقل ۱۲ نویسه" required autoComplete="new-password" className="field w-full" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setResetUserId('')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">تغییر رمز</button></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}.action{display:flex;align-items:center;justify-content:center;gap:.35rem;padding:.5rem .4rem;background:#1e293b;border:1px solid #334155;border-radius:.7rem;font-size:.65rem;font-weight:700}.scopeBox{background:#020617;border:1px solid #1e293b;border-radius:.8rem;padding:.8rem;color:#cbd5e1}.scopeGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.5rem;margin-top:.6rem}.scopeGrid label{background:#0f172a;border:1px solid #1e293b;border-radius:.55rem;padding:.45rem .55rem;color:#cbd5e1}`}</style>
  </div>;
};
