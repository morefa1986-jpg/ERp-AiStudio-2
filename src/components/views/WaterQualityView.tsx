import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Droplets, Plus, Thermometer } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { SENSOR_MAX_AGE_MINUTES } from '../../utils/sensorValidation';
import { WaterQualityLog } from '../../types';

interface Draft {
  dissolvedOxygen: string;
  temperature: string;
  ph: string;
  ammonia: string;
  nitrite: string;
  nitrate: string;
  salinity: string;
  tester: string;
}

const EMPTY: Draft = { dissolvedOxygen: '', temperature: '', ph: '', ammonia: '', nitrite: '', nitrate: '', salinity: '', tester: '' };

function isFresh(log: WaterQualityLog): boolean {
  const ts = new Date(log.timestamp).getTime();
  const age = (Date.now() - ts) / 60_000;
  return log.sensorStatus === 'VALID' && Number.isFinite(age) && age >= -15 && age <= SENSOR_MAX_AGE_MINUTES;
}

export const WaterQualityView: React.FC = () => {
  const { formatNumber, formatDate, formatTime } = useI18n();
  const { ponds, halls, waterLogs, recordWaterTest } = useFarm();
  const [selectedPondId, setSelectedPondId] = useState(ponds[0]?.id || '');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const latestLogs = useMemo(() => {
    const byPond = new Map<string, WaterQualityLog>();
    for (const log of waterLogs) {
      const previous = byPond.get(log.pondId);
      if (!previous || new Date(log.timestamp).getTime() > new Date(previous.timestamp).getTime()) byPond.set(log.pondId, log);
    }
    return Array.from(byPond.values()).filter(isFresh);
  }, [waterLogs]);

  const average = (field: keyof Pick<WaterQualityLog, 'dissolvedOxygen' | 'temperature' | 'ph' | 'ammonia'>) => {
    const values = latestLogs.map((log) => Number(log[field])).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  const validate = () => {
    const values = {
      do: Number(draft.dissolvedOxygen), temp: Number(draft.temperature), ph: Number(draft.ph), ammonia: Number(draft.ammonia), nitrite: Number(draft.nitrite), nitrate: Number(draft.nitrate), salinity: Number(draft.salinity),
    };
    if (!draft.tester.trim() || Object.values(values).some((value) => !Number.isFinite(value))) return 'همه فیلدهای عددی و نام ثبت‌کننده الزامی است.';
    if (values.do <= 0 || values.do > 25) return 'DO باید بیشتر از صفر و حداکثر 25 mg/L باشد.';
    if (values.temp < -1 || values.temp > 40) return 'دمای آب خارج از محدوده فیزیکی معتبر است.';
    if (values.ph <= 0 || values.ph > 14) return 'pH باید بین 0 و 14 و بزرگ‌تر از صفر باشد.';
    if (values.ammonia < 0 || values.nitrite < 0 || values.nitrate < 0 || values.salinity < 0) return 'مقادیر شیمیایی نمی‌توانند منفی باشند.';
    return '';
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = validate();
    if (message) { setError(message); return; }
    const pond = ponds.find((item) => item.id === selectedPondId);
    if (!pond) { setError('استخر انتخاب‌شده یافت نشد.'); return; }
    const hall = halls.find((item) => item.id === pond.hallId);
    const doValue = Number(draft.dissolvedOxygen);
    const tempValue = Number(draft.temperature);
    const phValue = Number(draft.ph);
    const ammonia = Number(draft.ammonia);
    const nitrite = Number(draft.nitrite);
    const critical = doValue < 4 || tempValue < 4 || tempValue > 25 || phValue < 6 || phValue > 9 || ammonia >= 0.05 || nitrite >= 0.5;
    const warning = !critical && (doValue < 5.5 || ammonia > 0.02 || nitrite > 0.2);
    recordWaterTest({
      pondId: pond.id,
      pondName: pond.name,
      hallName: hall?.name || hall?.number || pond.hallId,
      dissolvedOxygen: doValue,
      temperature: tempValue,
      ph: phValue,
      ammonia,
      nitrite,
      nitrate: Number(draft.nitrate),
      salinity: Number(draft.salinity),
      operator: draft.tester.trim(),
      sensorStatus: 'VALID',
      severity: critical ? 'CRITICAL' : warning ? 'WARNING' : 'INFO',
    });
    setDraft(EMPTY);
    setError('');
    setShowForm(false);
  };

  const freshCount = latestLogs.length;
  const cards = [
    { label: 'میانگین DO معتبر', value: average('dissolvedOxygen'), unit: 'mg/L', icon: Droplets, tone: 'text-cyan-400' },
    { label: 'میانگین دما', value: average('temperature'), unit: '°C', icon: Thermometer, tone: 'text-orange-400' },
    { label: 'میانگین pH', value: average('ph'), unit: '', icon: Activity, tone: 'text-emerald-400' },
    { label: 'میانگین آمونیاک', value: average('ammonia'), unit: 'mg/L', icon: AlertTriangle, tone: 'text-amber-400' },
  ];

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Droplets className="w-6 h-6 text-cyan-400" />کیفیت آب و تله‌متری معتبر</h1><p className="text-xs text-slate-400 mt-1">فقط داده حداکثر {SENSOR_MAX_AGE_MINUTES} دقیقه‌ای در KPIهای زنده پذیرفته می‌شود. ورود دستی با سالن واقعی همان استخر ثبت می‌شود.</p></div>
      <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" />ثبت تست آب</button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(({ label, value, unit, icon: Icon, tone }) => <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><Icon className={`w-5 h-5 mb-2 ${tone}`} /><span className="text-[11px] text-slate-500 block">{label}</span><strong className={`text-xl ${tone}`}>{value === null ? '—' : `${formatNumber(value)} ${unit}`}</strong></div>)}</div>

    {freshCount < ponds.length && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" /><span>فقط {freshCount} از {ponds.length} استخر دارای آخرین داده معتبر در بازه {SENSOR_MAX_AGE_MINUTES} دقیقه هستند. سایر استخرها برای تصمیم تغذیه Fail-Closed محسوب می‌شوند.</span></div>}

    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">استخر / سالن</th><th className="p-3">زمان</th><th className="p-3">DO</th><th className="p-3">دما</th><th className="p-3">pH</th><th className="p-3">NH3</th><th className="p-3">NO2</th><th className="p-3">وضعیت</th><th className="p-3">ثبت‌کننده</th></tr></thead><tbody className="divide-y divide-slate-800">{waterLogs.map((log) => <tr key={log.id} className="text-slate-300"><td className="p-3"><strong className="text-white block">{log.pondName}</strong><span className="text-[10px] text-slate-500">{log.hallName}</span></td><td className="p-3">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td><td className="p-3 text-cyan-400 font-bold">{log.dissolvedOxygen}</td><td className="p-3">{log.temperature}</td><td className="p-3">{log.ph}</td><td className="p-3">{log.ammonia ?? '—'}</td><td className="p-3">{log.nitrite ?? '—'}</td><td className={`p-3 font-bold ${isFresh(log) ? 'text-emerald-400' : 'text-amber-400'}`}>{isFresh(log) ? 'معتبر' : log.sensorStatus === 'VALID' ? 'قدیمی' : log.sensorStatus}</td><td className="p-3">{log.operator}</td></tr>)}</tbody></table></div></div>

    {showForm && <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-xl"><h2 className="font-bold text-white mb-4">ثبت اندازه‌گیری آب</h2><form onSubmit={submit} className="space-y-3 text-xs">
      <select value={selectedPondId} onChange={(event) => setSelectedPondId(event.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name} / {halls.find((hall) => hall.id === pond.hallId)?.name || pond.hallId}</option>)}</select>
      <div className="grid grid-cols-2 gap-2">{([['dissolvedOxygen','DO mg/L','0.1'],['temperature','دما °C','0.1'],['ph','pH','0.01'],['ammonia','NH3 mg/L','0.001'],['nitrite','NO2 mg/L','0.001'],['nitrate','NO3 mg/L','0.1'],['salinity','شوری','0.01']] as const).map(([key,label,step]) => <label key={key} className="text-slate-400">{label}<input type="number" step={step} value={draft[key]} onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" required /></label>)}</div>
      <label className="text-slate-400 block">ثبت‌کننده<input value={draft.tester} onChange={(event) => setDraft((previous) => ({ ...previous, tester: event.target.value }))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" required /></label>
      {error && <div className="text-rose-300 bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg">{error}</div>}
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl">ثبت و اعتبارسنجی</button></div>
    </form></div></div>}
  </div>;
};
