import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, FileJson, ShieldCheck, Upload } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';

export const BackupRestoreView: React.FC = () => {
  const { createEncryptedBackup, restoreFromSnapshotJson, backups } = useFarm();
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreFileName, setRestoreFileName] = useState('');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const download = async () => {
    try {
      const envelope = await createEncryptedBackup(backupPassphrase);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `fathi-aqua-erp-encrypted-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', text: 'پشتیبان رمزنگاری‌شده ایجاد و برای ذخیره محلی ارسال شد.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error && error.message === 'BACKUP_PASSPHRASE_TOO_SHORT' ? 'عبارت عبور باید حداقل ۱۲ نویسه باشد.' : 'تهیه فایل پشتیبان انجام نشد.' });
    }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { setStatus({ type: 'error', text: 'فایل پشتیبان بیش از ۱۰۰MB است و از رابط مرورگر بارگذاری نمی‌شود.' }); return; }
    try {
      const text = await file.text();
      JSON.parse(text);
      setRestoreJson(text); setRestoreFileName(file.name); setConfirmRestore(false);
      setStatus({ type: 'success', text: `فایل ${file.name} خوانده شد. برای بازیابی، عبارت عبور و تأیید نهایی را وارد کنید.` });
    } catch { setStatus({ type: 'error', text: 'فایل انتخاب‌شده JSON معتبر نیست.' }); }
  };

  const restore = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!restoreJson.trim() || !confirmRestore) { setStatus({ type: 'error', text: 'فایل و تأیید نهایی Restore الزامی است.' }); return; }
    const result = await restoreFromSnapshotJson(restoreJson, restorePassphrase);
    if (result.success) {
      setStatus({ type: 'success', text: 'Restore کامل شد. قبل از بازیابی، Snapshot ایمنی خودکار توسط سیستم ثبت شده است.' });
      setRestoreJson(''); setRestoreFileName(''); setRestorePassphrase(''); setConfirmRestore(false);
    } else setStatus({ type: 'error', text: result.message || 'بازیابی انجام نشد.' });
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-amber-400" />Backup & Restore</h1><p className="text-xs text-slate-400 mt-1">AES-GCM + PBKDF2-SHA-256 + SHA-256 integrity؛ Restore با فایل واقعی و تأیید دو مرحله‌ای.</p></div><div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Pre-Restore Safety Snapshot</div></div>

    {status && <div className={`p-4 rounded-xl border text-xs flex gap-2 ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}>{status.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}{status.text}</div>}

    <div className="grid lg:grid-cols-2 gap-5"><section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"><Download className="w-10 h-10 text-amber-400" /><div><h2 className="text-white font-bold">پشتیبان کامل رمزنگاری‌شده</h2><p className="text-xs text-slate-400 mt-1">عبارت عبور در ERP ذخیره نمی‌شود. بدون آن Restore فایل رمزنگاری‌شده ممکن نیست.</p></div><input type="password" minLength={12} value={backupPassphrase} onChange={(e) => setBackupPassphrase(e.target.value)} placeholder="عبارت عبور حداقل ۱۲ نویسه" className="field w-full" /><button onClick={() => void download()} disabled={backupPassphrase.length < 12} className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs disabled:opacity-40"><Download className="w-4 h-4 inline ml-1" />ایجاد و دانلود Backup</button><div className="text-[10px] text-slate-500">Automatic scheduled backup به مقصد NAS/USB نیازمند سرویس Backend/Windows Scheduler است؛ مرورگر نمی‌تواند بدون تعامل کاربر فایل را خودکار در مسیر دلخواه بنویسد.</div></section>

    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"><Upload className="w-10 h-10 text-blue-400" /><div><h2 className="text-white font-bold">بازیابی از فایل</h2><p className="text-xs text-slate-400 mt-1">دیگر نیازی به Paste کردن JSON نیست؛ فایل پشتیبان را مستقیم انتخاب کنید.</p></div><label className="block border border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer"><FileJson className="w-6 h-6 mx-auto text-blue-400 mb-2" /><span className="text-xs text-slate-300">{restoreFileName || 'انتخاب فایل .json'}</span><input type="file" accept="application/json,.json" onChange={(e) => void loadFile(e.target.files?.[0])} className="hidden" /></label><form onSubmit={restore} className="space-y-3"><input type="password" value={restorePassphrase} onChange={(e) => setRestorePassphrase(e.target.value)} placeholder="عبارت عبور Backup" className="field w-full" /><label className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl"><input type="checkbox" checked={confirmRestore} onChange={(e) => setConfirmRestore(e.target.checked)} className="mt-0.5" /><span>تأیید می‌کنم که Restore وضعیت فعلی ERP را جایگزین می‌کند و قبل از آن Snapshot ایمنی ساخته می‌شود.</span></label><button type="submit" disabled={!restoreJson || !confirmRestore} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs disabled:opacity-40"><Upload className="w-4 h-4 inline ml-1" />Restore تأییدشده</button></form></section></div>

    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="text-sm font-bold text-white mb-3">Snapshotهای ثبت‌شده در ERP</h2>{backups.length ? <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">{backups.slice(0, 12).map((backup) => <div key={backup.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs"><strong className="text-white block truncate">{backup.filename}</strong><span className="text-slate-500 block">{backup.timestamp}</span><span className="text-amber-400">{backup.type}</span><span className="text-[10px] text-slate-600 block font-mono truncate">{backup.checksum}</span></div>)}</div> : <p className="text-xs text-slate-500">هنوز Snapshot ثبت نشده است.</p>}</section>
    <style>{`.field{background:#020617;border:1px solid #334155;border-radius:.75rem;padding:.75rem;color:white}`}</style>
  </div>;
};
