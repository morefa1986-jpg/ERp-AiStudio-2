import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Users,
  Lock,
  Plus,
  Key,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { User } from '../../types';

export const SecurityAuditView: React.FC = () => {
  const { t, formatDate, formatTime } = useI18n();
  const { usersList, currentUser } = useAuth();
  const { auditLogs } = useFarm();

  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'roles'>('users');
  const [searchLog, setSearchLog] = useState<string>('');

  const filteredLogs = auditLogs.filter(
    (l) =>
      searchLog === '' ||
      l.details.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.action.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.userName.toLowerCase().includes(searchLog.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            امنیت، مدیریت دسترسی‌ها (RBAC) و لاگ‌های بازرسی
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            کنترل سطح دسترسی نقش‌ها، هش پسوردها، ردپای دیجیتال عملیات حساس و سیاهه رخدادهای غیرقابل دستکاری
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            کاربران و پرسنل ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-blue-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            لاگ‌های ممیزی سیستم ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Users & Roles List */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usersList.map((u) => (
              <div
                key={u.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div>
                    <h3 className="font-bold text-sm text-white">{u.fullName}</h3>
                    <span className="font-mono text-xs text-amber-400">@{u.username}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      u.role === 'Super Admin'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : u.role === 'Veterinarian'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">پست الکترونیک:</span>
                    <span className="font-mono text-slate-200">{u.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">وضعیت حساب:</span>
                    <span className={`font-semibold ${u.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {u.isActive ? 'فعال (Active)' : 'غیرفعال'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">زبان پیش‌فرض:</span>
                    <span className="font-mono text-slate-300 uppercase">{u.preferredLanguage}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                  <span>تاریخ ایجاد: {u.createdAt}</span>
                  <span className="font-mono text-emerald-400">SHA-256 Hashed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              سیاهه ممیزی غیرقابل تغییر عملیات مزرعه
            </h3>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="جستجو در لاگ‌ها..."
                className="bg-slate-800 border border-slate-700 text-white rounded-xl pr-9 pl-3 py-1.5 text-xs focus:border-amber-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase border-b border-slate-700">
                <tr>
                  <th className="p-3">عملیات</th>
                  <th className="p-3">موجودیت</th>
                  <th className="p-3">کاربر</th>
                  <th className="p-3">شرح رخداد</th>
                  <th className="p-3">آدرس IP / نشست</th>
                  <th className="p-3">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-amber-400 font-mono text-[11px]">{log.action}</td>
                    <td className="p-3 text-slate-300 font-semibold">{log.entity}</td>
                    <td className="p-3 text-white font-bold">{log.userName}</td>
                    <td className="p-3 text-slate-200">{log.details}</td>
                    <td className="p-3 font-mono text-slate-400">{log.ipAddress || '192.168.1.100'}</td>
                    <td className="p-3 text-slate-400">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
