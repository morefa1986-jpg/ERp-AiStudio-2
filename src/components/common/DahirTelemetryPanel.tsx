import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Droplets, Link2, RefreshCw, Settings2, Waves } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import {
  clearDahirSession,
  DahirConfig,
  DahirPondDeviceMapping,
  DahirTelemetryPoint,
  fetchDahirPondLevels,
  fetchDahirTreatmentPlant,
  hasDahirSession,
  loadDahirConfig,
  loginToDahir,
  saveDahirConfig,
  setDahirApiKeyForSession,
} from '../../services/dahirApi';

type Mode = 'pondLevels' | 'treatmentPlant';

interface Props { mode: Mode; }

const LABELS: Record<string, { fa: string; unit: string }> = {
  temperature: { fa: 'دما', unit: '°C' },
  dissolvedOxygen: { fa: 'اکسیژن محلول', unit: 'mg/L' },
  ph: { fa: 'pH', unit: '' },
  ammonia: { fa: 'آمونیاک', unit: 'mg/L' },
  nitrite: { fa: 'نیتریت', unit: 'mg/L' },
  tds: { fa: 'TDS', unit: 'ppm' },
  turbidity: { fa: 'کدورت', unit: 'NTU' },
  orp: { fa: 'ORP', unit: 'mV' },
  conductivity: { fa: 'هدایت الکتریکی', unit: 'µS/cm' },
  flowRate: { fa: 'دبی', unit: 'L/min' },
  waterLevel: { fa: 'ارتفاع آب', unit: 'cm' },
};

function pointStatus(point?: DahirTelemetryPoint): { text: string; cls: string } {
  if (!point) return { text: 'بدون داده', cls: 'text-slate-500' };
  if (!point.isFresh) return { text: `قدیمی · ${point.ageMinutes} دقیقه`, cls: 'text-rose-400' };
  return { text: `آنلاین · ${point.ageMinutes} دقیقه`, cls: 'text-emerald-400' };
}

function mappingToText(rows: DahirPondDeviceMapping[]): string {
  return rows.map((row) => `${row.pondId}=${row.deviceId}|${row.levelKey || 'waterLevel'}|${row.unit || 'cm'}`).join('\n');
}

function parseMapping(text: string): DahirPondDeviceMapping[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [pondIdRaw, restRaw = ''] = line.split('=');
    const [deviceId = '', levelKey = 'waterLevel', unit = 'cm'] = restRaw.split('|');
    return { pondId: pondIdRaw.trim(), deviceId: deviceId.trim(), levelKey: levelKey.trim() || 'waterLevel', unit: unit.trim() || 'cm' };
  }).filter((row) => row.pondId && row.deviceId);
}

export const DahirTelemetryPanel: React.FC<Props> = ({ mode }) => {
  const { currentUser } = useAuth();
  const { ponds } = useFarm();
  const canConfigure = currentUser?.role === 'Super Admin' || currentUser?.role === 'Farm Owner';
  const [config, setConfig] = useState<DahirConfig>(loadDahirConfig);
  const [mappingText, setMappingText] = useState(() => mappingToText(loadDahirConfig().pondDevices));
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(hasDahirSession());
  const [pondReadings, setPondReadings] = useState<Awaited<ReturnType<typeof fetchDahirPondLevels>>>([]);
  const [treatment, setTreatment] = useState<Record<string, DahirTelemetryPoint>>({});

  const refresh = async () => {
    if (!hasDahirSession()) { setConnected(false); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'pondLevels') setPondReadings(await fetchDahirPondLevels(config));
      else setTreatment(await fetchDahirTreatmentPlant(config));
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DAHIR_READ_FAILED');
      setConnected(hasDahirSession());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), Math.max(10, config.pollSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [mode, config.baseUrl, config.treatmentDeviceId, config.pollSeconds, JSON.stringify(config.pondDevices), config.treatmentKeys.join(',')]);

  const save = () => {
    const next = saveDahirConfig({ ...config, pondDevices: parseMapping(mappingText) });
    setConfig(next); setMappingText(mappingToText(next.pondDevices)); setError('');
  };

  const connect = async () => {
    setLoading(true); setError('');
    try {
      if (config.authMode === 'apiKey') setDahirApiKeyForSession(secret);
      else await loginToDahir(config.baseUrl, username, secret);
      setSecret(''); setConnected(true); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'DAHIR_CONNECT_FAILED'); setConnected(false); }
    finally { setLoading(false); }
  };

  const pondCards = useMemo(() => pondReadings.map((row) => ({ ...row, pondName: ponds.find((pond) => pond.id === row.pondId)?.name || row.pondId })), [pondReadings, ponds]);

  return (
    <section className="mb-5 bg-slate-900 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Activity className="w-5 h-5 text-cyan-400" /></div>
          <div><h2 className="text-sm font-black text-white">{mode === 'pondLevels' ? 'Dahir API · ارتفاع آنلاین آب استخرها' : 'Dahir API · سنسورهای آنلاین آب تصفیه‌خانه'}</h2><p className="text-[11px] text-slate-400">Telemetry مستقیم از داهیر · Freshness حداکثر ۱۵ دقیقه</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>{connected ? '● متصل' : '● نیاز به اتصال'}</span>
          <button type="button" onClick={() => void refresh()} disabled={loading || !connected} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300 disabled:opacity-40" title="بروزرسانی"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          {canConfigure && <button type="button" onClick={() => setShowSettings((value) => !value)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-amber-300" title="تنظیم اتصال"><Settings2 className="w-4 h-4" /></button>}
        </div>
      </div>

      {error && <div className="mx-4 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

      {showSettings && canConfigure && <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3 text-xs">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="space-y-1"><span className="text-slate-400">آدرس Dahir / ThingsPod</span><input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono" /></label>
          <label className="space-y-1"><span className="text-slate-400">روش احراز هویت</span><select value={config.authMode} onChange={(e) => setConfig({ ...config, authMode: e.target.value as DahirConfig['authMode'] })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"><option value="jwt">Username / Password → JWT</option><option value="apiKey">API Key</option></select></label>
          <label className="space-y-1"><span className="text-slate-400">Polling (ثانیه)</span><input type="number" min={10} max={300} value={config.pollSeconds} onChange={(e) => setConfig({ ...config, pollSeconds: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" /></label>
        </div>
        {mode === 'pondLevels' ? <label className="space-y-1 block"><span className="text-slate-400">Mapping استخر → Device ID (هر خط: pondId=deviceId|waterLevel|cm)</span><textarea rows={4} value={mappingText} onChange={(e) => setMappingText(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-[11px]" placeholder="pond_1=DEVICE_UUID|waterLevel|cm" /></label> : <div className="grid md:grid-cols-2 gap-3"><label className="space-y-1"><span className="text-slate-400">Device ID تصفیه‌خانه</span><input value={config.treatmentDeviceId} onChange={(e) => setConfig({ ...config, treatmentDeviceId: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono" /></label><label className="space-y-1"><span className="text-slate-400">Telemetry keys</span><input value={config.treatmentKeys.join(',')} onChange={(e) => setConfig({ ...config, treatmentKeys: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono" /></label></div>}
        <div className="grid md:grid-cols-3 gap-3 items-end">
          {config.authMode === 'jwt' && <label className="space-y-1"><span className="text-slate-400">نام کاربری داهیر</span><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" /></label>}
          <label className="space-y-1"><span className="text-slate-400">{config.authMode === 'jwt' ? 'رمز عبور (فقط همین نشست)' : 'API Key (فقط همین نشست)'}</span><input type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" /></label>
          <div className="flex gap-2"><button type="button" onClick={save} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white">ذخیره Mapping</button><button type="button" onClick={() => void connect()} disabled={loading || !secret} className="px-3 py-2 rounded-lg bg-cyan-600 disabled:opacity-40 text-white font-bold flex gap-1.5"><Link2 className="w-4 h-4" />اتصال</button><button type="button" onClick={() => { clearDahirSession(); setConnected(false); }} className="px-3 py-2 rounded-lg bg-slate-800 text-rose-300">قطع</button></div>
        </div>
        <p className="text-[10px] text-slate-500">رمز عبور و API Key در LocalStorage ذخیره نمی‌شوند؛ Credential فقط در SessionStorage همان مرورگر نگهداری می‌شود.</p>
      </div>}

      <div className="p-4">
        {mode === 'pondLevels' ? (
          config.pondDevices.length === 0 ? <div className="text-xs text-slate-500 text-center py-5">هنوز Device ID ارتفاع آب برای استخرها Mapping نشده است.</div> :
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{pondCards.map((row) => { const status = pointStatus(row.point); return <div key={`${row.pondId}-${row.deviceId}`} className={`rounded-xl border p-3 ${row.point?.isFresh ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-slate-950 border-slate-800'}`}><div className="flex items-center justify-between"><span className="text-xs font-bold text-white">{row.pondName}</span><Waves className="w-4 h-4 text-cyan-400" /></div><div className="mt-2 text-2xl font-black text-cyan-300">{row.point?.numericValue ?? '—'} <span className="text-xs text-slate-400">{row.unit}</span></div><div className={`text-[10px] mt-1 ${status.cls}`}>{row.error ? `خطا: ${row.error}` : status.text}</div><div className="text-[9px] text-slate-600 font-mono mt-1 truncate">{row.deviceId}</div></div>; })}</div>
        ) : (
          Object.keys(treatment).length === 0 ? <div className="text-xs text-slate-500 text-center py-5">{config.treatmentDeviceId ? 'داده آنلاین هنوز دریافت نشده است.' : 'Device ID تصفیه‌خانه در تنظیمات داهیر ثبت نشده است.'}</div> :
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{config.treatmentKeys.map((key) => { const point = treatment[key]; const meta = LABELS[key] || { fa: key, unit: '' }; const status = pointStatus(point); return <div key={key} className={`rounded-xl border p-3 ${point?.isFresh ? 'bg-slate-950 border-slate-800' : 'bg-rose-500/5 border-rose-500/20'}`}><div className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-cyan-400" /><span className="text-[10px] text-slate-400">{meta.fa}</span></div><div className="text-lg font-black text-white mt-1">{point?.numericValue ?? point?.value ?? '—'} <span className="text-[10px] text-slate-500">{meta.unit}</span></div><div className={`text-[9px] ${status.cls}`}>{point?.isFresh ? <CheckCircle2 className="inline w-3 h-3 ml-1" /> : <AlertTriangle className="inline w-3 h-3 ml-1" />}{status.text}</div></div>; })}</div>
        )}
      </div>
    </section>
  );
};
