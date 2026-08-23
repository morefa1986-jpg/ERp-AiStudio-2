import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Building2, Fish, Scale, Skull, Utensils, Waves } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { SENSOR_MAX_AGE_MINUTES } from '../../utils/sensorValidation';

interface Props { onSelectNav: (viewId: string) => void; }
type ScopeMode = 'farm' | 'hall' | 'pond';

function trustedLog(log: any, now: number): boolean {
  if (!log || log.sensorStatus !== 'VALID') return false;
  const ts = new Date(log.timestamp).getTime();
  if (!Number.isFinite(ts) || ts > now + 15 * 60_000 || now - ts > SENSOR_MAX_AGE_MINUTES * 60_000) return false;
  return Number.isFinite(log.dissolvedOxygen) && log.dissolvedOxygen > 0
    && Number.isFinite(log.temperature)
    && Number.isFinite(log.ph) && log.ph > 0 && log.ph <= 14
    && Number.isFinite(log.ammonia) && Number.isFinite(log.nitrite);
}

export const SafeDashboardView: React.FC<Props> = ({ onSelectNav }) => {
  const { formatNumber } = useI18n();
  const { halls, ponds, feedingRecords, mortalityRecords, waterLogs, treatments, inventory } = useFarm();
  const [scopeMode, setScopeMode] = useState<ScopeMode>('farm');
  const [selectedHallId, setSelectedHallId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const now = Date.now();
  const periodStart = now - 7 * 86_400_000;

  const scopedPonds = useMemo(() => {
    if (scopeMode === 'pond') return ponds.filter((pond) => pond.id === selectedPondId);
    if (scopeMode === 'hall') return ponds.filter((pond) => pond.hallId === selectedHallId);
    return ponds;
  }, [ponds, scopeMode, selectedHallId, selectedPondId]);

  const pondIds = useMemo(() => new Set(scopedPonds.map((pond) => pond.id)), [scopedPonds]);
  const latestByPond = useMemo(() => {
    const map = new Map<string, any>();
    for (const log of waterLogs) {
      if (!pondIds.has(log.pondId)) continue;
      const current = map.get(log.pondId);
      if (!current || new Date(log.timestamp).getTime() > new Date(current.timestamp).getTime()) map.set(log.pondId, log);
    }
    return map;
  }, [waterLogs, pondIds]);

  const totalFish = scopedPonds.reduce((sum, pond) => sum + pond.fishCount, 0);
  const totalBiomass = scopedPonds.reduce((sum, pond) => sum + pond.biomassKg, 0);
  const recentFeed = feedingRecords.filter((row) => pondIds.has(row.pondId) && new Date(row.timestamp).getTime() >= periodStart).reduce((sum, row) => sum + row.actualAmountKg, 0);
  const recentMortality = mortalityRecords.filter((row) => pondIds.has(row.pondId) && new Date(row.timestamp).getTime() >= periodStart).reduce((sum, row) => sum + row.count, 0);
  const activeTreatments = treatments.filter((row) => pondIds.has(row.pondId) && row.status === 'ACTIVE').length;
  const stopped = scopedPonds.filter((pond) => pond.feedingStatus === 'STOPPED').length;
  const trusted = scopedPonds.filter((pond) => trustedLog(latestByPond.get(pond.id), now));
  const critical = scopedPonds.filter((pond) => {
    const log = latestByPond.get(pond.id);
    if (!trustedLog(log, now)) return true;
    return log.dissolvedOxygen < 4 || log.temperature < 4 || log.temperature > 25 || log.ph < 6 || log.ph > 9 || log.ammonia > 0.02 || log.nitrite > 0.2;
  });
  const avgDo = trusted.length ? trusted.reduce((sum, pond) => sum + latestByPond.get(pond.id).dissolvedOxygen, 0) / trusted.length : null;
  const feedReserveKg = inventory.filter((item) => item.category.includes('Feed')).reduce((sum, item) => sum + (item.unit === 'gram' ? item.quantity / 1000 : item.unit === 'kg' ? item.quantity : 0), 0);

  const scopeLabel = scopeMode === 'farm'
    ? 'کل مجموعه'
    : scopeMode === 'hall'
      ? halls.find((hall) => hall.id === selectedHallId)?.name || 'سالن انتخاب نشده'
      : ponds.find((pond) => pond.id === selectedPondId)?.name || 'استخر انتخاب نشده';

  const cards = [
    { label: 'بیومس', value: `${formatNumber(totalBiomass)} kg`, icon: Scale, tone: 'text-amber-400' },
    { label: 'تعداد ماهی', value: formatNumber(totalFish), icon: Fish, tone: 'text-cyan-400' },
    { label: 'خوراک ۷ روز', value: `${formatNumber(recentFeed)} kg`, icon: Utensils, tone: 'text-emerald-400' },
    { label: 'تلفات ۷ روز', value: formatNumber(recentMortality), icon: Skull, tone: recentMortality ? 'text-rose-400' : 'text-slate-300' },
    { label: 'تله‌متری معتبر', value: `${trusted.length}/${scopedPonds.length}`, icon: Activity, tone: trusted.length === scopedPonds.length ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'میانگین DO معتبر', value: avgDo === null ? '—' : `${avgDo.toFixed(2)} mg/L`, icon: Waves, tone: avgDo !== null && avgDo < 5 ? 'text-rose-400' : 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">داشبورد عملیاتی امن — {scopeLabel}</h1>
          <p className="text-xs text-slate-400 mt-1">تله‌متری بیش از {SENSOR_MAX_AGE_MINUTES} دقیقه قدیمی، معتبر محسوب نمی‌شود و به‌صورت Fail-Closed هشدار می‌گیرد.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={scopeMode} onChange={(event) => setScopeMode(event.target.value as ScopeMode)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
            <option value="farm">کل مجموعه</option><option value="hall">یک سالن</option><option value="pond">یک استخر</option>
          </select>
          {scopeMode === 'hall' && <select value={selectedHallId} onChange={(event) => setSelectedHallId(event.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"><option value="">انتخاب سالن</option>{halls.map((hall) => <option key={hall.id} value={hall.id}>{hall.number} — {hall.name}</option>)}</select>}
          {scopeMode === 'pond' && <select value={selectedPondId} onChange={(event) => setSelectedPondId(event.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"><option value="">انتخاب استخر</option>{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><Icon className={`w-5 h-5 mb-2 ${tone}`} /><span className="text-[11px] text-slate-400 block">{label}</span><strong className={`text-lg ${tone}`}>{value}</strong></div>)}
      </div>

      {(critical.length > 0 || stopped > 0 || activeTreatments > 0) && <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-200 flex gap-3 items-start"><AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" /><div><strong className="block text-rose-300">نیاز به توجه عملیاتی</strong><span>{critical.length} استخر با داده نامعتبر/بحرانی، {stopped} استخر با تغذیه متوقف و {activeTreatments} درمان فعال.</span></div></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-bold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" />وضعیت استخرها</h2><button onClick={() => onSelectNav('ponds')} className="text-xs text-amber-400">باز کردن استخرها</button></div>
          <div className="space-y-2 max-h-80 overflow-auto">
            {scopedPonds.map((pond) => { const log = latestByPond.get(pond.id); const ok = trustedLog(log, now); return <div key={pond.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs"><div><strong className="text-white">{pond.number} — {pond.name}</strong><span className="block text-[10px] text-slate-500">{formatNumber(pond.fishCount)} قطعه · {formatNumber(pond.biomassKg)} kg</span></div><div className="text-left"><span className={ok ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{ok ? 'داده معتبر' : 'داده نامعتبر/قدیمی'}</span><span className="block text-[10px] text-slate-500">DO: {ok ? `${log.dissolvedOxygen} mg/L` : '—'}</span></div></div>; })}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">ذخیره خوراک و کنترل عملیات</h2>
          <div className="text-3xl font-black text-amber-400">{formatNumber(feedReserveKg)} <span className="text-sm text-slate-500">kg</span></div>
          <p className="text-xs text-slate-400 mt-2">خوراک قابل محاسبه فقط از اقلام انبار با واحد kg یا gram جمع می‌شود.</p>
          <div className="grid grid-cols-2 gap-2 mt-5"><button onClick={() => onSelectNav('feeding')} className="py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold">مدیریت تغذیه</button><button onClick={() => onSelectNav('waterQuality')} className="py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold">کیفیت آب</button></div>
        </div>
      </div>
    </div>
  );
};
