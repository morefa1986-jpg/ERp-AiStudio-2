import React, { useState } from 'react';
import { Activity, AlertTriangle, ArrowLeftRight, Droplets, Fish, Play, Skull, Square, Thermometer, Utensils } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { Pond } from '../../types';
import { SENSOR_MAX_AGE_MINUTES } from '../../utils/sensorValidation';

interface Props { onSelectNav: (viewId: string) => void; }
const STOP_REASONS: Array<{ value: NonNullable<Pond['stopFeedingReason']>; label: string }> = [
  { value: 'Low Oxygen', label: 'افت اکسیژن' }, { value: 'Treatment', label: 'درمان / دارو' }, { value: 'Handling', label: 'بیومتری / سونوگرافی' },
  { value: 'Transfer', label: 'انتقال / سورتینگ' }, { value: 'Low Temperature', label: 'افت دما' }, { value: 'Disease', label: 'بیماری' },
  { value: 'Manual Decision', label: 'تصمیم کارشناس' }, { value: 'Other', label: 'سایر' },
];

function telemetryAge(timestamp?: string): { minutes: number | null; fresh: boolean } {
  if (!timestamp) return { minutes: null, fresh: false };
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return { minutes: null, fresh: false };
  const minutes = (Date.now() - time) / 60_000;
  return { minutes, fresh: minutes >= -15 && minutes <= SENSOR_MAX_AGE_MINUTES };
}

export const PondDigitalTwinView: React.FC<Props> = ({ onSelectNav }) => {
  const { formatNumber, formatDate, formatTime } = useI18n();
  const { currentUser } = useAuth();
  const { ponds, halls, species, stopPondFeeding, resumePondFeeding, calculateRecommendedFeed } = useFarm();
  const [hallId, setHallId] = useState('all');
  const [search, setSearch] = useState('');
  const [stopPond, setStopPond] = useState<Pond | null>(null);
  const [stopReason, setStopReason] = useState<NonNullable<Pond['stopFeedingReason']>>('Manual Decision');
  const [stopDetails, setStopDetails] = useState('');
  const [message, setMessage] = useState('');

  const filtered = ponds.filter((pond) => (hallId === 'all' || pond.hallId === hallId) && (!search.trim() || `${pond.number} ${pond.name}`.toLowerCase().includes(search.toLowerCase())));

  const submitStop = (event: React.FormEvent) => {
    event.preventDefault();
    if (!stopPond || !stopDetails.trim()) return;
    stopPondFeeding(stopPond.id, stopReason, stopDetails.trim(), currentUser?.fullName || 'Operator');
    setStopPond(null); setStopDetails('');
  };

  const resume = (pond: Pond) => {
    const result = resumePondFeeding(pond.id, currentUser?.fullName || 'Operator');
    setMessage(result.success ? `تغذیه ${pond.name} فقط پس از عبور از قفل‌های ایمنی فعال شد.` : result.error || 'فعال‌سازی تغذیه مجاز نیست.');
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><Fish className="w-6 h-6 text-amber-400" />Digital Twin استخرها</h1><p className="text-xs text-slate-400 mt-1">وضعیت تله‌متری، آخرین زمان داده، موجودی زنده، FCR و قفل تغذیه در یک کارت عملیاتی.</p></div><div className="flex gap-2"><select value={hallId} onChange={(e) => setHallId(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"><option value="all">همه سالن‌ها</option>{halls.map((hall) => <option key={hall.id} value={hall.id}>{hall.number} — {hall.name}</option>)}</select><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی استخر" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white w-40" /></div></div>

    {message && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200">{message}</div>}

    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((pond) => {
      const hall = halls.find((item) => item.id === pond.hallId); const sp = species.find((item) => item.id === pond.speciesId);
      const age = telemetryAge(pond.lastTelemetryTimestamp); const trusted = pond.sensorQuality === 'VALID' && age.fresh;
      const recommendation = calculateRecommendedFeed(pond.id); const stopped = pond.feedingStatus === 'STOPPED';
      return <article key={pond.id} className={`bg-slate-900 border rounded-2xl overflow-hidden ${!trusted ? 'border-amber-500/40' : stopped ? 'border-rose-500/40' : 'border-slate-800'}`}>
        <div className="p-4 border-b border-slate-800 flex justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono text-xs text-amber-400">{pond.number}</span><strong className="text-white">{pond.name}</strong></div><span className="text-[10px] text-slate-500">{hall?.name || pond.hallId} · {sp?.faName || pond.speciesId}</span></div><span className={`text-[10px] font-bold px-2 py-1 rounded-full h-fit ${stopped ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{stopped ? 'تغذیه متوقف' : 'تغذیه فعال'}</span></div>
        <div className="p-4 space-y-3"><div className="grid grid-cols-2 gap-2 text-xs"><Metric label="تعداد" value={`${formatNumber(pond.fishCount)} قطعه`} /><Metric label="بیومس" value={`${formatNumber(pond.biomassKg)} kg`} /><Metric label="میانگین وزن" value={`${pond.averageWeightKg} kg`} /><Metric label="FCR" value={String(pond.fcr)} /><Metric label="آخرین خوراک" value={`${pond.lastFeedingKg || 0} kg`} /><Metric label="حجم/ظرفیت" value={`${pond.capacityCubicMeters} m³`} /></div>
          <div className={`rounded-xl border p-3 ${trusted ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-amber-500/10 border-amber-500/30'}`}><div className="flex justify-between gap-2 mb-2"><span className={`text-xs font-bold ${trusted ? 'text-cyan-300' : 'text-amber-300'}`}>{trusted ? 'تله‌متری معتبر' : 'تله‌متری قدیمی/نامعتبر'}</span><span className="text-[10px] text-slate-500">{age.minutes === null ? 'بدون زمان' : `${Math.max(0, Math.round(age.minutes))} دقیقه قبل`}</span></div><div className="grid grid-cols-3 gap-2 text-[11px]"><span className="text-cyan-300"><Droplets className="inline w-3 h-3" /> DO {trusted ? pond.dissolvedOxygen : '—'}</span><span className="text-orange-300"><Thermometer className="inline w-3 h-3" /> {trusted ? `${pond.waterTemperature}°C` : '—'}</span><span className="text-slate-300"><Activity className="inline w-3 h-3" /> pH {trusted ? pond.ph : '—'}</span><span className="text-slate-400">NH3 {trusted ? pond.ammonia ?? '—' : '—'}</span><span className="text-slate-400">NO2 {trusted ? pond.nitrite ?? '—' : '—'}</span><span className="text-slate-500">{pond.sensorQuality || 'UNKNOWN'}</span></div>{pond.lastTelemetryTimestamp && <div className="text-[9px] text-slate-600 mt-2">{formatDate(pond.lastTelemetryTimestamp)} {formatTime(pond.lastTelemetryTimestamp)}</div>}</div>
          {stopped && <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-200"><strong>{pond.stopFeedingReason || 'توقف'}</strong><p className="text-[11px] mt-1">{pond.stopFeedingDetails || 'بدون شرح'}</p></div>}
          {!stopped && recommendation.isLocked && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200"><AlertTriangle className="inline w-4 h-4 ml-1" />{recommendation.lockReason}</div>}
        </div>
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-wrap gap-2">{stopped ? <button onClick={() => resume(pond)} className="action text-emerald-300"><Play className="w-4 h-4" />وصل خوراک</button> : <button onClick={() => { setStopPond(pond); setStopReason('Manual Decision'); setStopDetails(''); }} className="action text-rose-300"><Square className="w-4 h-4" />قطع خوراک</button>}<button onClick={() => onSelectNav('feeding')} disabled={recommendation.isLocked} className="action text-amber-300 disabled:opacity-30"><Utensils className="w-4 h-4" />تغذیه</button><button onClick={() => onSelectNav('mortality')} className="action text-rose-300"><Skull className="w-4 h-4" />تلفات</button><button onClick={() => onSelectNav('transfers')} className="action text-blue-300"><ArrowLeftRight className="w-4 h-4" />انتقال</button><button onClick={() => onSelectNav('waterQuality')} className="action text-cyan-300"><Droplets className="w-4 h-4" />آب</button></div>
      </article>;
    })}</div>

    {stopPond && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-rose-500/30 rounded-2xl p-6 w-full max-w-lg"><h2 className="text-white font-bold mb-4">قطع تغذیه — {stopPond.name}</h2><form onSubmit={submitStop} className="space-y-3 text-xs"><label className="text-slate-400 block">علت<select value={stopReason} onChange={(e) => setStopReason(e.target.value as NonNullable<Pond['stopFeedingReason']>)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{STOP_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label><textarea value={stopDetails} onChange={(e) => setStopDetails(e.target.value)} required placeholder="علت دقیق و اقدام اجرایی" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setStopPond(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl">قطع قطعی</button></div></form></div></div>}
    <style>{`.action{display:flex;align-items:center;gap:.35rem;padding:.5rem .65rem;background:#1e293b;border:1px solid #334155;border-radius:.7rem;font-size:.7rem;font-weight:700}`}</style>
  </div>;
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5"><span className="text-[10px] text-slate-500 block">{label}</span><strong className="text-white">{value}</strong></div>;
