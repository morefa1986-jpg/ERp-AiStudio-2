import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Database, RefreshCw, WifiOff } from 'lucide-react';
import { getStoredSessionToken, useAuth } from '../../context/AuthContext';
import { loadDurableEntries, replayDurableEntries } from '../../utils/durableOutbox';

type RecoveryState =
  | { mode: 'ready'; pending: 0; error?: undefined }
  | { mode: 'checking'; pending: number; error?: undefined }
  | { mode: 'offline'; pending: number; error?: string }
  | { mode: 'blocked'; pending: number; error?: string };

export const DurableOutboxGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [recovery, setRecovery] = useState<RecoveryState>({ mode: 'ready', pending: 0 });
  const running = useRef(false);
  const generation = useRef(0);

  const recover = useCallback(async () => {
    const userId = currentUser?.id;
    if (!userId || running.current) return;
    running.current = true;
    try {
      const entries = await loadDurableEntries(userId);
      if (!entries.length) {
        setRecovery({ mode: 'ready', pending: 0 });
        return;
      }
      setRecovery({ mode: 'checking', pending: entries.length });
      const token = getStoredSessionToken();
      if (!token) {
        setRecovery({ mode: 'blocked', pending: entries.length, error: 'AUTH_REQUIRED' });
        return;
      }
      const result = await replayDurableEntries(userId, token);
      if (result.status === 'replayed' || result.status === 'empty') {
        generation.current += 1;
        setRecovery({ mode: 'ready', pending: 0 });
      } else if (result.status === 'offline') {
        setRecovery({ mode: 'offline', pending: result.remaining, error: result.error });
      } else {
        setRecovery({ mode: 'blocked', pending: result.remaining, error: result.error });
      }
    } catch (error) {
      setRecovery({ mode: 'blocked', pending: 1, error: error instanceof Error ? error.message : 'OUTBOX_RECOVERY_FAILED' });
    } finally {
      running.current = false;
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setRecovery({ mode: 'ready', pending: 0 });
      return;
    }
    void recover();
  }, [currentUser?.id, recover]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const handleOnline = () => { if (recovery.mode === 'offline') void recover(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUser?.id, recovery.mode, recover]);

  if (!currentUser || recovery.mode === 'ready') {
    return <React.Fragment key={generation.current}>{children}</React.Fragment>;
  }

  const offline = recovery.mode === 'offline';
  return <div dir="rtl" className="min-h-screen bg-[#09090B] text-slate-200 flex items-center justify-center p-6">
    <div className="w-full max-w-xl rounded-2xl border border-amber-500/30 bg-slate-950 p-6 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-500/10 p-3">{offline ? <WifiOff className="w-6 h-6 text-amber-400" /> : recovery.mode === 'checking' ? <Database className="w-6 h-6 text-cyan-400" /> : <AlertTriangle className="w-6 h-6 text-rose-400" />}</div>
        <div className="flex-1">
          <h1 className="font-black text-white">بازیابی امن تغییرات آفلاین</h1>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            {recovery.mode === 'checking'
              ? `در حال بازپخش ${recovery.pending} عملیات ذخیره‌شده قبل از بارگذاری ERP هستیم.`
              : offline
                ? `${recovery.pending} عملیات ذخیره‌شده در IndexedDB محفوظ است. با برگشت شبکه، بازیابی خودکار ادامه پیدا می‌کند.`
                : `بازیابی ${recovery.pending} عملیات متوقف شده تا از overwrite یا از دست رفتن داده جلوگیری شود.`}
          </p>
          {recovery.error && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-2 font-mono text-[10px] text-slate-500">{recovery.error}</div>}
        </div>
      </div>
      {recovery.mode !== 'checking' && <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-amber-300">داده را پاک نکنید؛ صف به حساب کاربری فعلی متصل است.</span>
        <button type="button" onClick={() => void recover()} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950"><RefreshCw className="w-4 h-4" />تلاش مجدد</button>
      </div>}
    </div>
  </div>;
};
