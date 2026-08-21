import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Building2, Droplets, Fish, Package, Thermometer, Utensils } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';

interface DashboardViewProps { onSelectNav: (viewId: string) => void; }
type Period = 'today' | 'week' | 'month' | 'year';

function periodStart(period: Period, now = new Date()): number {
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setTime(now.getTime() - 7 * 86_400_000);
  if (period === 'month') { start.setDate(1); start.setHours(0, 0, 0, 0); }
  if (period === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  return start.getTime();
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectNav }) => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const { ponds, halls, feedingRecords, mortalityRecords, proformas, treatments, inventory, waterLogs, auditLogs } = useFarm();
  const [timeFilter, setTimeFilter] = useState<Period>('week');
  const startTime = periodStart(timeFilter);
  const now = Date.now();

  const filteredFeeding = useMemo(() => feedingRecords.filter((row) => {
    const time = new Date(row.timestamp).getTime();
    return Number.isFinite(time) && time >= startTime && time <= now;
  }), [feedingRecords, startTime, now]);
  const filteredMortality = useMemo(() => mortalityRecords.filter((row) => {
    const time = new Date(row.timestamp).getTime();
    return Number.isFinite(time) && time >= startTime && time <= now;
  }), [mortalityRecords, startTime, now]);
  const filteredProformas = useMemo(() => proformas.filter((row) => {
    const time = new Date(row.date).getTime();
    // Revenue cards use fulfilled orders only; drafts and quotations are not cash realization.
    return Boolean(row.fulfilledAt) && row.status !== 'Cancelled' && Number.isFinite(time) && time >= startTime && time <= now;
  }), [proformas, startTime, now]);

  const totalBiomassKg = ponds.reduce((sum, pond) => sum + (Number.isFinite(pond.biomassKg) ? pond.biomassKg : 0), 0);
  const totalFishCount = ponds.reduce((sum, pond) => sum + (Number.isFinite(pond.fishCount) ? pond.fishCount : 0), 0);
  const periodFeedKg = filteredFeeding.reduce((sum, row) => sum + (Number.isFinite(row.actualAmountKg) ? row.actualAmountKg : 0), 0);
  const mortalityCount = filteredMortality.reduce((sum, row) => sum + (Number.isFinite(row.count) ? row.count : 0), 0);
  const mortalityDenominator = totalFishCount + mortalityCount;
  const mortalityRate = mortalityDenominator > 0 ? (mortalityCount / mortalityDenominator) * 100 : 0;
  const stoppedPonds = ponds.filter((pond) => pond.feedingStatus === 'STOPPED');
  const activeTreatments = treatments.filter((row) => row.status === 'ACTIVE').length;
  const activeHalls = halls.filter((hall) => hall.isActive).length;
  const trustedTelemetryPonds = ponds.filter((pond) => {
    const latest = waterLogs.filter((log) => log.pondId === pond.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const ageHours = latest ? (Date.now() - new Date(latest.timestamp).getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
    return latest?.sensorStatus === 'VALID' && ageHours >= -0.25 && ageHours <= 6
      && Number.isFinite(latest.dissolvedOxygen) && latest.dissolvedOxygen > 0
      && Number.isFinite(latest.temperature) && Number.isFinite(latest.ph) && latest.ph > 0;
  });
  const avgDO = trustedTelemetryPonds.length ? trustedTelemetryPonds.reduce((sum, pond) => sum + pond.dissolvedOxygen, 0) / trustedTelemetryPonds.length : null;
  const avgTemp = trustedTelemetryPonds.length ? trustedTelemetryPonds.reduce((sum, pond) => sum + pond.waterTemperature, 0) / trustedTelemetryPonds.length : null;
  const measuredFcrPonds = ponds.filter((pond) => Number.isFinite(pond.fcr) && pond.fcr > 0);
  const avgFCR = measuredFcrPonds.length ? measuredFcrPonds.reduce((sum, pond) => sum + pond.fcr, 0) / measuredFcrPonds.length : null;
  const feedReserveKg = inventory.filter((row) => row.category.includes('Feed')).reduce((sum, row) => sum + (row.unit === 'gram' ? row.quantity / 1000 : row.unit === 'kg' ? row.quantity : 0), 0);

  const salesByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of filteredProformas) {
      if (row.status === 'Cancelled') continue;
      totals.set(row.currency, (totals.get(row.currency) || 0) + row.grandTotal);
    }
    return Array.from(totals.entries());
  }, [filteredProformas]);

  const chartBuckets = useMemo(() => {
    const bucketCount = 7;
    const duration = Math.max(1, now - startTime);
    const bucketSize = duration / bucketCount;
    const sums = Array.from({ length: bucketCount }, () => 0);
    for (const record of filteredFeeding) {
      const time = new Date(record.timestamp).getTime();
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((time - startTime) / bucketSize)));
      sums[index] += record.actualAmountKg;
    }
    const max = Math.max(...sums, 0);
    return sums.map((feedKg, index) => {
      const center = new Date(startTime + bucketSize * (index + 0.5));
      const label = timeFilter === 'today'
        ? center.toLocaleTimeString([], { hour: '2-digit' })
        : timeFilter === 'year'
          ? center.toLocaleDateString([], { month: 'short' })
          : center.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label, feedKg, height: max > 0 ? (feedKg / max) * 100 : 0 };
    });
  }, [filteredFeeding, startTime, now, timeFilter]);

  const cards = [
    { label: t('dashboard.totalBiomass'), value: `${formatNumber(totalBiomassKg)} kg`, sub: `${formatNumber(totalFishCount)} ${t('unit')}`, icon: Fish },
    { label: t('nav.feeding'), value: `${formatNumber(periodFeedKg)} kg`, sub: t(`dashboard.${timeFilter}`), icon: Utensils },
    { label: t('dashboard.mortalityRate'), value: `${formatNumber(mortalityRate, { maximumFractionDigits: 3 })}%`, sub: `${formatNumber(mortalityCount)} ${t('unit')}`, icon: Activity },
    { label: t('dashboard.fcrAverage'), value: avgFCR === null ? '—' : formatNumber(avgFCR, { maximumFractionDigits: 2 }), sub: avgDO === null ? t('noData') : `DO ${formatNumber(avgDO, { maximumFractionDigits: 2 })} mg/L`, icon: Droplets },
    { label: t('dashboard.avgTemp'), value: avgTemp === null ? '—' : `${formatNumber(avgTemp, { maximumFractionDigits: 1 })}°C`, sub: `${formatNumber(stoppedPonds.length)} ${t('dashboard.criticalAlerts')}`, icon: Thermometer },
    { label: t('dashboard.activeHalls'), value: formatNumber(activeHalls), sub: `${formatNumber(ponds.length)} ${t('nav.ponds')}`, icon: Building2 },
    { label: t('dashboard.activeTreatments'), value: formatNumber(activeTreatments), sub: t('nav.treatments'), icon: AlertTriangle },
    { label: t('dashboard.feedStockReserve'), value: `${formatNumber(feedReserveKg)} kg`, sub: t('nav.warehouse'), icon: Package },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1F1F22] pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif italic text-white">{t('dashboard.title')}</h1>
          <p className="text-[#71717A] mt-1 text-xs">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#18181B] border border-[#27272A] p-1 rounded-lg">
            {(['today', 'week', 'month', 'year'] as Period[]).map((period) => (
              <button key={period} type="button" onClick={() => setTimeFilter(period)} className={`px-3 py-1 rounded-md text-xs ${timeFilter === period ? 'bg-[#27272A] text-[#D4AF37] font-bold' : 'text-[#A1A1AA]'}`}>
                {t(`dashboard.${period}`)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onSelectNav('feeding')} className="bg-[#D4AF37] text-black px-4 py-2 rounded-lg text-xs font-bold">{t('dashboard.quickActionBtn')}</button>
          <button type="button" onClick={() => onSelectNav('reports')} className="bg-[#18181B] text-white px-4 py-2 border border-[#27272A] rounded-lg text-xs">{t('dashboard.exportReportBtn')}</button>
        </div>
      </div>

      {stoppedPonds.length > 0 && (
        <button type="button" onClick={() => onSelectNav('ponds')} className="w-full text-start bg-[#18181B] border border-rose-500/40 rounded-2xl p-4 text-rose-300">
          <div className="font-bold text-xs text-white">{t('dashboard.criticalPondsAlert', { count: stoppedPonds.length })}</div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">{stoppedPonds.map((pond) => `${pond.name}: ${pond.stopFeedingReason || 'STOPPED'}`).join(' • ')}</div>
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="bg-[#121214] border border-[#1F1F22] p-5 rounded-2xl">
            <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-[#71717A] uppercase tracking-widest">{label}</span><Icon className="w-4 h-4 text-[#D4AF37]" /></div>
            <div className="text-2xl font-light text-white mt-2">{value}</div>
            <div className="text-[10px] text-[#A1A1AA] mt-2">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#121214] border border-[#1F1F22] rounded-2xl p-6">
          <div className="flex justify-between gap-3 mb-5">
            <div><div className="text-sm font-medium text-white">{t('dashboard.feedTrendTitle')}</div><div className="text-[10px] text-[#71717A]">{t(`dashboard.${timeFilter}`)}</div></div>
            <div className="text-xs text-[#D4AF37]">{formatNumber(periodFeedKg)} kg</div>
          </div>
          {periodFeedKg <= 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-[#71717A]">{t('noData')}</div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {chartBuckets.map((bucket) => (
                <div key={bucket.label} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                  <div className="w-full flex-1 flex items-end bg-[#18181B] rounded-t-md overflow-hidden" title={`${formatNumber(bucket.feedKg)} kg`}>
                    <div className="w-full bg-[#D4AF37]/60 border-t border-[#D4AF37]" style={{ height: `${bucket.height}%` }} />
                  </div>
                  <span className="text-[9px] text-[#71717A] truncate max-w-full">{bucket.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
          <h3 className="text-sm font-medium text-white">{t('dashboard.monthlySales')}</h3>
          <div className="mt-4 space-y-2">
            {salesByCurrency.length === 0 ? <div className="text-xs text-[#71717A]">{t('noData')}</div> : salesByCurrency.map(([currency, amount]) => (
              <div key={currency} className="flex justify-between gap-3 text-xs bg-[#18181B] rounded-lg p-3"><span className="text-[#A1A1AA]">{currency}</span><span className="text-white font-bold">{formatCurrency(amount, currency)}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#1F1F22] text-sm text-white font-medium">{t('nav.ponds')}</div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#0C0C0E] text-[#71717A]"><tr><th className="p-3 text-start">{t('name')}</th><th className="p-3 text-start">DO</th><th className="p-3 text-start">{t('pond.waterTemp')}</th><th className="p-3 text-start">{t('status')}</th></tr></thead><tbody className="divide-y divide-[#1F1F22]">{ponds.slice(0, 12).map((pond) => { const trusted = trustedTelemetryPonds.some((item) => item.id === pond.id); return <tr key={pond.id}><td className="p-3 text-white">{pond.name}</td><td className={`p-3 ${trusted && pond.dissolvedOxygen < 4 ? 'text-rose-400' : 'text-cyan-300'}`}>{trusted ? `${formatNumber(pond.dissolvedOxygen)} mg/L` : '—'}</td><td className="p-3 text-[#D4D4D8]">{trusted ? `${formatNumber(pond.waterTemperature)}°C` : '—'}</td><td className={`p-3 ${pond.feedingStatus === 'STOPPED' ? 'text-rose-400' : 'text-emerald-400'}`}>{pond.feedingStatus === 'STOPPED' ? t('pond.stopped') : t('pond.active')}</td></tr>; })}</tbody></table></div>
        </div>

        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
          <h3 className="text-sm text-white font-medium mb-3">{t('nav.reports')}</h3>
          <div className="space-y-2">{auditLogs.length === 0 ? <div className="text-xs text-[#71717A]">{t('noData')}</div> : auditLogs.slice(0, 8).map((log) => <div key={log.id} className="bg-[#18181B] rounded-lg p-3"><div className="flex justify-between gap-3"><span className="text-xs text-white font-medium">{log.action} · {log.entity}</span><span className="text-[9px] text-[#71717A]">{formatDate(log.timestamp)}</span></div><p className="text-[10px] text-[#A1A1AA] mt-1 line-clamp-2">{log.details}</p></div>)}</div>
        </div>
      </div>
    </div>
  );
};
