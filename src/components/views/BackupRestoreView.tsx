import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, ShieldCheck, Upload } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';

export const BackupRestoreView: React.FC = () => {
  const { t } = useI18n();
  const { createBackupSnapshot, restoreFromSnapshotJson } = useFarm();
  const [restoreJson, setRestoreJson] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDownloadBackup = () => {
    const snapshot = createBackupSnapshot('Manual Export');
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fathi-aqua-erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage({ type: 'success', text: t('backupRestore.successExport') });
  };

  const handleRestore = (event: React.FormEvent) => {
    event.preventDefault();
    if (!restoreJson.trim()) return;
    const result = restoreFromSnapshotJson(restoreJson);
    if (result.success) {
      setStatusMessage({ type: 'success', text: t('backupRestore.successRestore') });
      setRestoreJson('');
    } else {
      setStatusMessage({ type: 'error', text: t('backupRestore.errorRestore') });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5"><Database className="w-6 h-6 text-amber-400" />{t('backupRestore.title')}</h1>
          <p className="text-xs text-slate-400 mt-1">{t('backupRestore.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-bold"><ShieldCheck className="w-4 h-4 text-emerald-400" /><span>{t('backupRestore.engineBadge')}</span></div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs animate-fadeIn ${statusMessage.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-300'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="font-bold text-white">{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center"><Download className="w-6 h-6" /></div>
            <h3 className="font-bold text-base text-white">{t('backupRestore.exportCardTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('backupRestore.exportCardDesc')}</p>
          </div>
          <button onClick={handleDownloadBackup} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all"><Download className="w-4 h-4" />{t('backupRestore.btnCreateBackup')}</button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0"><Upload className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-sm text-white">{t('backupRestore.importCardTitle')}</h3><span className="text-[11px] text-slate-400">{t('backupRestore.importCardDesc')}</span></div>
          </div>
          <form onSubmit={handleRestore} className="space-y-3 text-xs">
            <textarea rows={4} value={restoreJson} onChange={(e) => setRestoreJson(e.target.value)} placeholder={t('backupRestore.restorePlaceholder')} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-[11px] focus:border-blue-500" required />
            <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 transition-all"><Upload className="w-4 h-4" />{t('backupRestore.btnRestore')}</button>
          </form>
        </div>
      </div>
    </div>
  );
};
