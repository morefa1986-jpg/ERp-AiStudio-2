import React, { useMemo, useState } from 'react';
import { Activity, BarChart3, CalendarDays, LineChart } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { aggregateSeries, compareAggregates, COMPARISON_PERIODS, defaultDateRange, Grain, shiftedRange } from '../../utils/analyticsEngine';

type MetricId = 'feedingKg' | 'waterDoAvg' | 'mortalityCount' | 'biometryAvgWeight' | 'processingBiomass' | 'salesTotal' | 'incidentCount' | 'inventoryConsumption';

type MetricDef = { id: MetricId; label: string; unit: string; mode: 'sum' | 'avg' };

const METRICS: MetricDef[] = [
  { id: 'feedingKg', label: 'خوراک مصرفی', unit: 'kg', mode: 'sum' },
  { id: 'waterDoAvg', label: 'میانگین اکسیژن محلول', unit: 'mg/L', mode: 'avg' },
  { id: 'mortalityCount', label: 'تلفات', unit: 'عدد', mode: 'sum' },
  { id: 'biometryAvgWeight', label: 'میانگین وزن بیومتری', unit: 'kg', mode: 'avg' },
  { id: 'processingBiomass', label: 'بیوماس فرآوری‌شده', unit: 'kg', mode: 'sum' },
  { id: 'salesTotal', label: 'فروش فاکتور/پیش‌فاکتور', unit: 'مبلغ', mode: 'sum' },
  { id: 'inventoryConsumption', label: 'مصرف انبار', unit: 'واحد انبار', mode: 'sum' },
  { id: 'incidentCount', label: 'رخدادهای عملیاتی', unit: 'رخداد', mode: 'sum' },
];

function dateOnly(value?: string): string { return String(value || '').slice(0, 10); }
function safeNumber(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }

const MiniBars: React.FC<{ current: number[]; previous: number[] }> = ({ current, previous }) => {
  const max = Math.max(1, ...current, ...previous);
  return <div className="h-52 flex items-end gap-1 border-b border-slate-800 pt-4">
    {current.map((value, index) => <div key={index} className="flex-1 flex items-end gap-0.5 h-full min-w-[6px]">
      <div title={`previous ${previous[index] || 0}`} className="w-1/2 rounded-t bg-slate-700" style={{ height: `${Math.max(2, ((previous[index] || 0) / max) * 100)}%` }} />
      <div title={`current ${value}`} className="w-1/2 rounded-t bg-amber-500" style={{ height: `${Math.max(2, (value / max) * 100)}%` }} />
    </div>)}
  </div>;
};

export const ComparativeAnalyticsView: React.FC = () => {
  const farm = useFarm();
  const { formatNumber } = useI18n();
  const initial = defaultDateRange();
  const [metricId, setMetricId] = useState<MetricId>('feedingKg');
  const [grain, setGrain] = useState<Grain>('daily');
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [comparisonId, setComparisonId] = useState('same-last-year');
  const [scopeMode, setScopeMode] = useState<'farm' | 'hall' | 'pond'>('farm');
  const [hallId, setHallId] = useState('');
  const [pondId, setPondId] = useState('');

  const scopedPondIds = useMemo(() => {
    if (scopeMode === 'pond') return new Set(pondId ? [pondId] : []);
    if (scopeMode === 'hall') return new Set(farm.ponds.filter((pond) => pond.hallId === hallId).map((pond) => pond.id));
    return new Set(farm.ponds.map((pond) => pond.id));
  }, [scopeMode, hallId, pondId, farm.ponds]);

  const metric = METRICS.find((item) => item.id === metricId) || METRICS[0];
  const comparison = COMPARISON_PERIODS.find((item) => item.id === comparisonId) || COMPARISON_PERIODS[0];

  const rawPoints = useMemo(() => {
    switch (metricId) {
      case 'feedingKg': return farm.feedingRecords.filter((row) => scopedPondIds.has(row.pondId)).map((row) => ({ date: row.timestamp, value: safeNumber(row.actualAmountKg), label: row.pondName }));
      case 'waterDoAvg': return farm.waterLogs.filter((row) => scopedPondIds.has(row.pondId)).map((row) => ({ date: row.timestamp, value: safeNumber(row.dissolvedOxygen), label: row.pondName }));
      case 'mortalityCount': return farm.mortalityRecords.filter((row) => scopedPondIds.has(row.pondId)).map((row) => ({ date: row.timestamp, value: safeNumber(row.count), label: row.pondName }));
      case 'biometryAvgWeight': return farm.biometricSessions.filter((row) => scopedPondIds.has(row.pondId)).map((row) => ({ date: row.date, value: safeNumber(row.averageWeightKg), label: row.pondName }));
      case 'processingBiomass': return farm.processingBatches.filter((row) => scopedPondIds.has(row.sourcePondId)).map((row) => ({ date: row.date, value: safeNumber(row.liveBiomassKg), label: row.sourcePondName }));
      case 'salesTotal': return farm.proformas.map((row) => ({ date: row.date, value: safeNumber(row.grandTotal), label: row.customerName }));
      case 'inventoryConsumption': return farm.inventoryTxs.filter((row) => safeNumber(row.quantityChange) < 0).map((row) => ({ date: row.timestamp, value: Math.abs(safeNumber(row.quantityChange)), label: row.sku }));
      case 'incidentCount': return farm.auditLogs.filter((row) => /Incident/i.test(String(row.entity || row.details || ''))).map((row) => ({ date: row.timestamp, value: 1, label: row.entity }));
      default: return [];
    }
  }, [metricId, farm, scopedPondIds]);

  const currentRows = useMemo(() => aggregateSeries(rawPoints, grain, fromDate, toDate), [rawPoints, grain, fromDate, toDate]);
  const previousRange = shiftedRange(fromDate, toDate, comparison);
  const previousRows = useMemo(() => aggregateSeries(rawPoints, grain, previousRange.from, previousRange.to), [rawPoints, grain, previousRange.from, previousRange.to]);
  const comparisonRows = useMemo(() => compareAggregates(currentRows, previousRows), [currentRows, previousRows]);
  const total = comparisonRows.reduce((sum, row) => sum + row.value, 0);
  const previousTotal = comparisonRows.reduce((sum, row) => sum + row.previousValue, 0);
  const totalDelta = total - previousTotal;
  const totalDeltaPct = previousTotal === 0 ? null : (totalDelta / previousTotal) * 100;

  return <div className="space-y-5 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><LineChart className="w-6 h-6 text-amber-400" />تحلیل آماری و مقایسه نمودارها</h1><p className="text-xs text-slate-400 mt-1">مقایسه روزانه، هفتگی، ماهانه و سالانه؛ از امروز با هفته قبل تا همین روز در دو سال گذشته.</p></div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800"><span className="text-slate-500 block">دوره فعلی</span><strong className="text-amber-300 text-lg">{formatNumber(Number(total.toFixed(2)))}</strong></div>
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800"><span className="text-slate-500 block">دوره مقایسه</span><strong className="text-slate-200 text-lg">{formatNumber(Number(previousTotal.toFixed(2)))}</strong></div>
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800"><span className="text-slate-500 block">تغییر</span><strong className={totalDelta >= 0 ? 'text-emerald-400 text-lg' : 'text-rose-400 text-lg'}>{formatNumber(Number(totalDelta.toFixed(2)))} {totalDeltaPct === null ? '' : `(${totalDeltaPct.toFixed(1)}%)`}</strong></div>
      </div>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid md:grid-cols-2 xl:grid-cols-7 gap-3 text-xs">
      <label className="text-slate-400">شاخص<select value={metricId} onChange={(e) => setMetricId(e.target.value as MetricId)} className="field mt-1 w-full">{METRICS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-slate-400">دانه‌بندی<select value={grain} onChange={(e) => setGrain(e.target.value as Grain)} className="field mt-1 w-full"><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option><option value="yearly">سالانه</option></select></label>
      <label className="text-slate-400">مقایسه با<select value={comparisonId} onChange={(e) => setComparisonId(e.target.value)} className="field mt-1 w-full">{COMPARISON_PERIODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-slate-400">Scope<select value={scopeMode} onChange={(e) => setScopeMode(e.target.value as 'farm' | 'hall' | 'pond')} className="field mt-1 w-full"><option value="farm">کل مجموعه</option><option value="hall">سالن</option><option value="pond">استخر</option></select></label>
      {scopeMode === 'hall' ? <label className="text-slate-400">سالن<select value={hallId} onChange={(e) => setHallId(e.target.value)} className="field mt-1 w-full"><option value="">انتخاب...</option>{farm.halls.map((hall) => <option key={hall.id} value={hall.id}>{hall.number} — {hall.name}</option>)}</select></label> : scopeMode === 'pond' ? <label className="text-slate-400">استخر<select value={pondId} onChange={(e) => setPondId(e.target.value)} className="field mt-1 w-full"><option value="">انتخاب...</option>{farm.ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label> : <div />}
      <label className="text-slate-400">از<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="field mt-1 w-full" /></label>
      <label className="text-slate-400">تا<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="field mt-1 w-full" /></label>
    </div>

    <div className="grid xl:grid-cols-12 gap-5">
      <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between text-xs mb-2"><strong className="text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-amber-400" />{metric.label}</strong><span className="text-slate-500">واحد: {metric.unit} · روش: {metric.mode === 'sum' ? 'جمع' : 'میانگین/مشاهده'}</span></div>
        <MiniBars current={comparisonRows.map((row) => row.value)} previous={comparisonRows.map((row) => row.previousValue)} />
        <div className="flex gap-4 text-[10px] text-slate-400 mt-3"><span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" />دوره فعلی</span><span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-700" />{comparison.label}</span></div>
      </div>

      <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-blue-400" />بازه‌های مقایسه</h2>
        <div className="text-xs text-slate-400 space-y-2">
          <div className="flex justify-between"><span>بازه فعلی</span><strong className="text-white font-mono">{fromDate} → {toDate}</strong></div>
          <div className="flex justify-between"><span>{comparison.label}</span><strong className="text-white font-mono">{previousRange.from} → {previousRange.to}</strong></div>
          <div className="flex justify-between"><span>تعداد bucket</span><strong className="text-white">{comparisonRows.length}</strong></div>
        </div>
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] text-blue-200 leading-6"><Activity className="w-4 h-4 inline ml-1" />این صفحه داده را تفسیر مدیریتی می‌کند، نه اینکه تصمیم عملیاتی خودکار بگیرد. تغذیه همچنان دستی است و قفل‌های ایمنی Server جداگانه اعمال می‌شوند.</div>
      </div>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-800 text-xs flex justify-between"><strong className="text-white">جدول مقایسه</strong><span className="text-slate-500">{comparisonRows.length} ردیف</span></div>
      <div className="overflow-auto max-h-[50vh]"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-500 sticky top-0"><tr><th className="p-3 text-start">دوره</th><th className="p-3 text-start">شروع</th><th className="p-3 text-start">پایان</th><th className="p-3 text-start">فعلی</th><th className="p-3 text-start">مقایسه</th><th className="p-3 text-start">تغییر</th><th className="p-3 text-start">٪</th></tr></thead><tbody className="divide-y divide-slate-800">{comparisonRows.map((row) => <tr key={row.key} className="text-slate-300"><td className="p-3 whitespace-nowrap">{row.label}</td><td className="p-3 font-mono">{dateOnly(row.start)}</td><td className="p-3 font-mono">{dateOnly(row.end)}</td><td className="p-3 text-amber-300 font-bold">{formatNumber(row.value)}</td><td className="p-3 text-slate-400">{formatNumber(row.previousValue)}</td><td className={row.delta >= 0 ? 'p-3 text-emerald-400' : 'p-3 text-rose-400'}>{formatNumber(row.delta)}</td><td className="p-3">{row.deltaPercent === null ? '—' : `${row.deltaPercent}%`}</td></tr>)}</tbody></table></div>
    </div>
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}`}</style>
  </div>;
};
