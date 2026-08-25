import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Link2, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import {
  createWaterTelemetryMapping,
  ingestWaterTelemetryMapping,
  listWaterTelemetryMappings,
  setWaterTelemetryMappingActive,
  WaterTelemetryKeyMap,
  WaterTelemetryMapping,
} from '../../services/waterTelemetryService';

const DEFAULT_KEYS: WaterTelemetryKeyMap = {
  dissolvedOxygen: 'dissolvedOxygen',
  temperature: 'temperature',
  ph: 'ph',
  ammonia: 'ammonia',
  nitrite: 'nitrite',
};

export const WaterTelemetryAdminPanel: React.FC = () => {
  const { halls, ponds, syncStatus } = useFarm();
  const [mappings, setMappings] = useState<WaterTelemetryMapping[]>([]);
  const [pondId, setPondId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [keys, setKeys] = useState<WaterTelemetryKeyMap>(DEFAULT_KEYS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const pendingState = syncStatus.pendingChangesCount > 0 || syncStatus.status === 'SYNCING' || syncStatus.status === 'PENDING_CHANGES';
  const activePonds = useMemo(() => ponds.filter((pond: any) => pond.isActive !== false), [ponds]);
  const pondById = (id: string) => ponds.find((pond) => pond.id === id);
  const hallName = (id: string) => halls.find((hall) => hall.id === id)?.name || id;

  const load = async () => {
    try {
      setMappings(await listWaterTelemetryMappings());
    } catch (error) {
      setMessage(`خواندن Mapping انجام نشد: ${error instanceof Error ? error.message : 'UNKNOWN'}`);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      await createWaterTelemetryMapping({ pondId, deviceId: deviceId.trim(), keys });
      setMessage('نگاشت Sensor → Pond روی Server ثبت شد. برای Authoritative شدن داده، «دریافت و ثبت الآن» را اجرا کنید.');
      setPondId(''); setDeviceId(''); setKeys(DEFAULT_KEYS);
      await load();
    } catch (error) {
      setMessage(`ثبت Mapping انجام نشد: ${error instanceof Error ? error.message : 'UNKNOWN'}`);
    } finally { setBusy(false); }
  };

  const toggle = async (mapping: WaterTelemetryMapping) => {
    setMessage(''); setBusy(true);
    try {
      await setWaterTelemetryMappingActive(mapping.id, !mapping.isActive);
      setMessage(mapping.isActive ? 'Mapping غیرفعال شد.' : 'Mapping فعال شد.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'WATER_MAPPING_UPDATE_FAILED');
    } finally { setBusy(false); }
  };

  const ingest = async (mapping: WaterTelemetryMapping) => {
    setMessage('');
    if (pendingState) {
      setMessage('ابتدا صف Sync محلی را صفر کنید؛ ثبت تله‌متری authoritative هنگام وجود تغییرات محلی معلق مسدود است.');
      return;
    }
    setBusy(true);
    try {
      const result = await ingestWaterTelemetryMapping(mapping.id);
      const log = result.log as any;
      setMessage(`تله‌متری معتبر ثبت شد: DO=${log.dissolvedOxygen} mg/L، دما=${log.temperature}°C، pH=${log.ph}. State از Server دوباره بارگذاری می‌شود.`);
      window.location.reload();
    } catch (error) {
      setMessage(`Ingest انجام نشد: ${error instanceof Error ? error.message : 'WATER_TELEMETRY_INGESTION_FAILED'}`);
      setBusy(false);
    }
  };

  const keyField = (field: keyof WaterTelemetryKeyMap, label: string) => (
    <label className="text-[11px] text-slate-400">{label}<input value={keys[field]} onChange={(event) => setKeys((previous) => ({ ...previous, [field]: event.target.value }))} className="mt-1 w-full field font-mono" required /></label>
  );

  return <section className="space-y-4">
    <div className="bg-slate-900 border border-cyan-500/20 rounded-2xl p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div><h2 className="text-base font-black text-white flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" />نگاشت سنسور به استخر و ثبت Authoritative</h2><p className="text-xs text-slate-400 mt-1 leading-relaxed">Credential فقط روی Server نگهداری می‌شود. هر استخر حداکثر یک Mapping فعال دارد. پنج پارامتر DO، دما، pH، آمونیاک و نیتریت باید تازه، عددی و از نظر زمانی همگام باشند.</p></div>
        <div className={`text-[11px] px-3 py-2 rounded-xl border ${pendingState ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{pendingState ? `Ingest Locked · ${syncStatus.pendingChangesCount} pending` : 'State clean · Ingest enabled'}</div>
      </div>
    </div>

    {message && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200">{message}</div>}

    <div className="grid xl:grid-cols-[420px_1fr] gap-4">
      <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Link2 className="w-4 h-4 text-cyan-400" />Mapping جدید</h3>
        <select value={pondId} onChange={(event) => setPondId(event.target.value)} className="field w-full" required><option value="">انتخاب استخر</option>{activePonds.map((pond) => <option key={pond.id} value={pond.id}>{hallName(pond.hallId)} · {pond.number} · {pond.name}</option>)}</select>
        <input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="Device ID روی سامانه تله‌متری" className="field w-full font-mono" required />
        <div className="grid grid-cols-2 gap-2">{keyField('dissolvedOxygen', 'کلید DO')}{keyField('temperature', 'کلید دما')}{keyField('ph', 'کلید pH')}{keyField('ammonia', 'کلید آمونیاک')}{keyField('nitrite', 'کلید نیتریت')}</div>
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[10px] text-amber-200"><ShieldAlert className="w-4 h-4 shrink-0" /><span>ساخت Mapping به‌تنهایی Feeding را فعال نمی‌کند. فقط داده تازه و معتبر وارد waterLogs می‌شود؛ داده بحرانی Feeding را STOP می‌کند و Resume خودکار انجام نمی‌شود.</span></div>
        <button disabled={busy} className="w-full px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4" />ثبت Mapping روی Server</button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-xs text-right"><thead className="text-slate-500"><tr><th className="p-2">استخر</th><th className="p-2">Device</th><th className="p-2">کلیدها</th><th className="p-2">وضعیت</th><th className="p-2">عملیات</th></tr></thead><tbody className="divide-y divide-slate-800">{mappings.map((mapping) => { const pond = pondById(mapping.pondId); return <tr key={mapping.id}><td className="p-2 text-white">{pond ? `${hallName(pond.hallId)} · ${pond.number} · ${pond.name}` : mapping.pondId}</td><td className="p-2 font-mono text-cyan-300">{mapping.deviceId}</td><td className="p-2 font-mono text-[10px] text-slate-400">{Object.values(mapping.keys).join(' · ')}</td><td className="p-2"><span className={mapping.isActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{mapping.isActive ? 'فعال' : 'غیرفعال'}</span></td><td className="p-2"><div className="flex flex-wrap gap-2"><button disabled={busy || !mapping.isActive || pendingState} onClick={() => void ingest(mapping)} className="px-2 py-1.5 rounded-lg bg-blue-600 disabled:opacity-40 text-white font-bold flex items-center gap-1"><RefreshCw className="w-3 h-3" />دریافت و ثبت الآن</button><button disabled={busy} onClick={() => void toggle(mapping)} className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300">{mapping.isActive ? 'غیرفعال' : 'فعال'}</button></div></td></tr>; })}{!mappings.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">هنوز Mapping سروری ثبت نشده است.</td></tr>}</tbody></table>
      </div>
    </div>
    <style>{`.field{background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white;outline:none}.field:focus{border-color:#0891b2}`}</style>
  </section>;
};
