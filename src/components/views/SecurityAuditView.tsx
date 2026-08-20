import React, { useState } from 'react';
import { Clock, Search, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n';
import { runtimeValueLabel } from '../../i18n/runtimeMessages';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';

export const SecurityAuditView: React.FC = () => {
  const { t, formatDate, formatTime, language } = useI18n();
  const { usersList } = useAuth();
  const { auditLogs } = useFarm();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [searchLog, setSearchLog] = useState<string>('');

  const filteredLogs = auditLogs.filter((log) =>
    searchLog === '' ||
    log.details.toLowerCase().includes(searchLog.toLowerCase()) ||
    log.action.toLowerCase().includes(searchLog.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchLog.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5"><ShieldAlert className="w-6 h-6 text-amber-400" />{t('securityAudit.title')}</h1>
          <p className="text-xs text-slate-400 mt-1">{t('securityAudit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'users' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>{t('securityAudit.tabUsers')} ({usersList.length})</button>
          <button onClick={() => setActiveTab('audit')} className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'audit' ? 'bg-blue-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>{t('securityAudit.tabAudit')} ({auditLogs.length})</button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usersList.map((user) => (
            <div key={user.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div><h3 className="font-bold text-sm text-white">{user.fullName}</h3><span className="font-mono text-xs text-amber-400">@{user.username}</span></div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${user.role === 'Super Admin' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : user.role === 'Veterinarian' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>{user.role}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between gap-3"><span className="text-slate-400">{t('securityAudit.email')}:</span><span className="font-mono text-slate-200 truncate">{user.email}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-400">{t('securityAudit.status')}:</span><span className={`font-semibold ${user.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>{user.isActive ? t('active') : t('inactive')}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-400">{t('securityAudit.role')}:</span><span className="text-slate-200">{user.role}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-400">{t('securityAudit.lastLogin')}:</span><span className="text-slate-300">{user.lastLoginAt ? `${formatDate(user.lastLoginAt)} ${formatTime(user.lastLoginAt)}` : t('noData')}</span></div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400"><span>{formatDate(user.createdAt)}</span><span className="font-mono text-emerald-400">SHA-256</span></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />{t('securityAudit.tabAudit')}</h3>
            <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2" /><input type="text" value={searchLog} onChange={(e) => setSearchLog(e.target.value)} placeholder={t('securityAudit.searchPlaceholder')} className="bg-slate-800 border border-slate-700 text-white rounded-xl pe-9 ps-3 py-1.5 text-xs focus:border-amber-500 w-64" /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase border-b border-slate-700"><tr><th className="p-3">{t('securityAudit.thAction')}</th><th className="p-3">{t('securityAudit.resource')}</th><th className="p-3">{t('securityAudit.thUser')}</th><th className="p-3">{t('securityAudit.thDetails')}</th><th className="p-3">{t('securityAudit.ipAddress')}</th><th className="p-3">{t('securityAudit.thTime')}</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLogs.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40"><td className="p-3 font-bold text-amber-400 font-mono text-[11px]">{runtimeValueLabel(language, log.action)}</td><td className="p-3 text-slate-300 font-semibold">{log.entity}</td><td className="p-3 text-white font-bold">{log.userName}</td><td className="p-3 text-slate-200">{log.details}</td><td className="p-3 font-mono text-slate-400">{log.ipAddress || '—'}</td><td className="p-3 text-slate-400">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
