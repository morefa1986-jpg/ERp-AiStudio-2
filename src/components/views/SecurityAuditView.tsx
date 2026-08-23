import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Key, Plus, Search, ShieldAlert, UserCheck, UserX, Users } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { LanguageCode, UserRole } from '../../types';

const ROLES: UserRole[] = ['Farm Owner','Farm Manager','Hall Manager','Technician','Hatchery Manager','Laboratory','Veterinarian','Feed Manager','Warehouse Manager','Processing Manager','Cold Storage Manager','Accountant','Sales Manager','CRM Operator','HR Manager','Media Manager','Viewer/Auditor'];

export const SecurityAuditView: React.FC = () => {
  const { formatDate, formatTime } = useI18n();
  const { usersList, currentUser, createNewUser, toggleUserActive, resetUserPassword } = useAuth();
  const { auditLogs } = useFarm();
  const [tab, setTab] = useState<'users' | 'audit' | 'policy'>('users');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ username: '', fullName: '', email: '', role: 'Viewer/Auditor' as UserRole, password: '', preferredLanguage: 'fa' as LanguageCode });

  const isAdmin = currentUser?.role === 'Super Admin' || currentUser?.role === 'Farm Owner';
  const filteredLogs = useMemo(() => auditLogs.filter((log) => {
    const needle = search.trim().toLowerCase();
    return !needle || `${log.action} ${log.entity} ${log.userName} ${log.details} ${log.ipAddress || ''}`.toLowerCase().includes(needle);
  }), [auditLogs, search]);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    try {
      await createNewUser({ username: form.username.trim().toLowerCase(), fullName: form.fullName.trim(), email: form.email.trim(), role: form.role, isActive: true, preferredLanguage: form.preferredLanguage }, form.password);
      setMessage('کاربر در دیتابیس Server ایجاد شد.'); setShowNew(false);
      setForm({ username: '', fullName: '', email: '', role: 'Viewer/Auditor', password: '', preferredLanguage: 'fa' });
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

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-amber-400" />امنیت، کاربران و Audit Trail</h1><p className="text-xs text-slate-400 mt-1">کاربران و رمزها Server-authoritative هستند. Audit فعلی ثبت سروری دارد، اما تا اضافه‌شدن cryptographic hash-chain به‌عنوان «غیرقابل‌دستکاری رمزنگاری‌شده» معرفی نمی‌شود.</p></div><div className="flex gap-2 text-xs"><button onClick={() => setTab('users')} className={`px-3 py-2 rounded-xl ${tab === 'users' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>کاربران</button><button onClick={() => setTab('audit')} className={`px-3 py-2 rounded-xl ${tab === 'audit' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Audit</button><button onClick={() => setTab('policy')} className={`px-3 py-2 rounded-xl ${tab === 'policy' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>سیاست دسترسی</button></div></div>

    {message && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200">{message}</div>}

    {tab === 'users' && <div className="space-y-4">{isAdmin && <div className="flex justify-end"><button onClick={() => setShowNew(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold"><Plus className="w-4 h-4 inline ml-1" />کاربر Server جدید</button></div>}<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{usersList.map((user) => <div key={user.id} className={`bg-slate-900 border rounded-2xl p-5 ${user.isActive ? 'border-slate-800' : 'border-rose-500/30'}`}><div className="flex justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="text-white block">{user.fullName}</strong><span className="font-mono text-amber-400 text-xs">@{user.username}</span></div><span className="text-[10px] text-slate-400">{user.role}</span></div><div className="space-y-2 mt-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">ایمیل</span><span className="text-slate-300">{user.email}</span></div><div className="flex justify-between"><span className="text-slate-500">وضعیت</span><strong className={user.isActive ? 'text-emerald-400' : 'text-rose-400'}>{user.isActive ? 'فعال' : 'غیرفعال'}</strong></div><div className="flex justify-between"><span className="text-slate-500">زبان</span><span className="text-slate-300 uppercase">{user.preferredLanguage}</span></div></div>{isAdmin && <div className="flex gap-2 mt-4"><button onClick={() => void toggle(user.id)} disabled={user.id === currentUser?.id} className={`flex-1 action ${user.isActive ? 'text-rose-300' : 'text-emerald-300'} disabled:opacity-30`}>{user.isActive ? <><UserX className="w-4 h-4" />غیرفعال</> : <><UserCheck className="w-4 h-4" />فعال</>}</button><button onClick={() => { setResetUserId(user.id); setResetPassword(''); }} className="action text-amber-300"><Key className="w-4 h-4" />رمز</button></div>}</div>)}</div></div>}

    {tab === 'audit' && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex flex-col sm:flex-row justify-between gap-3 mb-4"><div><h2 className="text-sm font-bold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />ردپای عملیات Server</h2><span className="text-[10px] text-slate-500">برای Tamper Evidence کامل، Hash-chain/remote append-only sink هنوز باید در Backend اضافه شود.</span></div><div className="relative"><Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو..." className="bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white" /></div></div><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">زمان</th><th className="p-3">کاربر</th><th className="p-3">عملیات</th><th className="p-3">موجودیت</th><th className="p-3">شرح</th><th className="p-3">IP</th><th className="p-3">Transaction</th></tr></thead><tbody className="divide-y divide-slate-800">{filteredLogs.map((log) => <tr key={log.id} className="text-slate-300"><td className="p-3 whitespace-nowrap">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td><td className="p-3 text-white">{log.userName}</td><td className="p-3 font-mono text-amber-400">{log.action}</td><td className="p-3">{log.entity}</td><td className="p-3 min-w-64">{log.details}</td><td className="p-3 font-mono text-slate-500">{log.ipAddress || '—'}</td><td className="p-3 font-mono text-[10px] text-slate-500">{log.transactionId || '—'}</td></tr>)}</tbody></table></div></div>}

    {tab === 'policy' && <div className="grid md:grid-cols-2 gap-4"><div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5"><h2 className="text-sm font-bold text-emerald-300 mb-2">فعال: نقش‌های Server-authoritative</h2><p className="text-xs text-slate-400 leading-relaxed">نقش‌های سیستمی از ماتریس RBAC مشترک استفاده می‌کنند و عملیات حساس دوباره در Server بررسی می‌شود. Super Admin و Farm Owner کنترل کامل مدیریتی دارند.</p></div><div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5"><h2 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Custom Role</h2><p className="text-xs text-slate-400 leading-relaxed">Custom Role محلی قبلی غیرفعال شده است، چون در Server ذخیره و enforce نمی‌شد. تا زمان اضافه‌شدن جدول نقش/مجوز سروری، سیستم به‌صورت Fail-Closed فقط نقش‌های معتبر Backend را قبول می‌کند.</p></div></div>}

    {showNew && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-xl"><h2 className="text-white font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-amber-400" />کاربر جدید</h2><form onSubmit={createUser} className="grid grid-cols-2 gap-3 text-xs"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" required autoComplete="off" className="field" /><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="نام کامل" required className="field" /><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email" required className="field col-span-2" /><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="field">{ROLES.map((role) => <option key={role}>{role}</option>)}</select><select value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as LanguageCode })} className="field"><option value="fa">فارسی</option><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option><option value="ru">Русский</option><option value="ar">العربية</option></select><input type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="رمز حداقل ۱۲ نویسه" required autoComplete="new-password" className="field col-span-2" /><div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">ایجاد روی Server</button></div></form></div></div>}

    {resetUserId && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-md"><h2 className="text-white font-bold mb-4">بازنشانی رمز — {usersList.find((user) => user.id === resetUserId)?.fullName}</h2><form onSubmit={reset} className="space-y-3 text-xs"><input type="password" minLength={12} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="رمز جدید حداقل ۱۲ نویسه" required autoComplete="new-password" className="field w-full" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setResetUserId('')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">تغییر رمز</button></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}.action{display:flex;align-items:center;justify-content:center;gap:.35rem;padding:.5rem .65rem;background:#1e293b;border:1px solid #334155;border-radius:.7rem;font-size:.7rem;font-weight:700}`}</style>
  </div>;
};
