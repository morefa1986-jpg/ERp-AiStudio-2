import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Building2, Database, Droplets, Fish, Package, Thermometer, Utensils } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { AnalyticsPeriod, buildFarmAnalytics } from '../../utils/farmAnalytics';

interface DashboardViewProps { onSelectNav: (viewId: string) => void; }

function toggleSelection(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((item) => item !== id) : [...values, id];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectNav }) => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const {
    ponds,
    halls,
    feedingRecords,
    mortalityRecords,
    biometricSessions,
    proformas,
    treatments,
    inventory,
    waterLogs,
    auditLogs,
    syncStatus,
  } = useFarm();
  const [timeFilter, setTimeFilter] = useState<AnalyticsPeriod>('week');
  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([]);
  const [selectedPondIds, setSelectedPondIds] = useState<string[]>([]);

  const analytics = useMemo(() => buildFarmAnalytics({
    ponds,
    halls,
    feedingRecords,
    mortalityRecords,
    biometricSessions,
    proformas,
    treatments,
    inventory,
    waterLogs,
    selectedHallIds,
    selectedPondIds,
    period: timeFilter,
  }), [ponds, halls, feedingRecords, mortalityRecords, biometricSessions, proformas, treatments, inventory, waterLogs, selectedHallIds, selectedPondIds, timeFilter]);

  const scopeLabel = selectedPondIds.length > 0
    ? t('dashboard.scopeSelectedPonds', { count: selectedPondIds.length })
    : selectedHallIds.length > 0
      ? t('dashboard.scopeSelectedHalls', { count: selectedHallIds.length })
      : t('dashboard.scopeAllFarm');

  const maxFeedBucket = Math.max(...analytics.feedBuckets.map((bucket) => bucket.feedKg), 0);
  const fcrValue = analytics.periodFcr ?? analytics.weightedFcr;
  const criticalPondRows = analytics.pondRows.filter((row) => row.isWaterCritical || row.pond.feedingStatus === 'STOPPED');

  const cards = [
    { label: t('dashboard.totalBiomass'), value: `${formatNumber(analytics.totalBiomassKg)} kg`, sub: `${formatNumber(analytics.totalFishCount)} ${t('unit')}`, icon: Fish },
    { label: t('dashboard.avgWeightWeighted'), value: analytics.averageWeightKg === null ? '—' : `${formatNumber(analytics.averageWeightKg, { maximumFractionDigits: 3 })} kg`, sub: scopeLabel, icon: BarChart3 },
    { label: t('nav.feeding'), value: `${formatNumber(analytics.periodFeedKg)} kg`, sub: t(`dashboard.${timeFilter}`), icon: Utensils },
    { label: t('dashboard.mortalityRate'), value: `${formatNumber(analytics.mortalityRatePct, { maximumFractionDigits: 3 })}%`, sub: `${formatNumber(analytics.mortalityCount)} ${t('unit')}`, icon: Activity },
    { label: t('dashboard.fcrAverage'), value: fcrValue === null ? '—' : formatNumber(fcrValue, { maximumFractionDigits: 3 }), sub: analytics.periodFcr === null ? t('dashboard.weightedCurrent') : `${formatNumber(analytics.periodBiomassGainKg)} kg ${t('dashboard.biomassGain')}`, icon: Droplets },
    { label: t('dashboard.minDo'), value: analytics.minDO === null ? '—' : `${formatNumber(analytics.minDO, { maximumFractionDigits: 2 })} mg/L`, sub: `${formatNumber(analytics.trustedTelemetryPondsCount)} ${t('dashboard.validTelemetry')}`, icon: Thermometer },
    { label: t('dashboard.waterCriticalPonds'), value: formatNumber(analytics.waterCriticalPondsCount), sub: t('dashboard.criticalAlerts'), icon: AlertTriangle },
    { label: t('dashboard.feedStockReserve'), value: `${formatNumber(analytics.feedReserveKg)} kg`, sub: t('nav.warehouse'), icon: Package },
  ];

  const domainCards = [
    { label: t('dashboard.breedingDashboard'), value: `${formatNumber(analytics.scopedPonds.length)} ${t('nav.ponds')}`, nav: 'ponds', icon: Fish },
    { label: t('dashboard.feedingDashboard'), value: `${formatNumber(analytics.stoppedPondsCount)} ${t('pond.stopped')}`, nav: 'feeding', icon: Utensils },
    { label: t('dashboard.waterDashboard'), value: analytics.avgDO === null ? '—' : `DO ${formatNumber(analytics.avgDO, { maximumFractionDigits: 2 })}`, nav: 'waterQuality', icon: Droplets },
    { label: t('dashboard.financeDashboard'), value: analytics.salesByCurrency.length ? analytics.salesByCurrency.map((row) => row.currency).join(' / ') : '—', nav: 'accounting', icon: Building2 },
    { label: t('dashboard.systemDashboard'), value: syncStatus.status, nav: 'backup', icon: Database },
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
            {(['today', 'week', 'month', 'year'] as AnalyticsPeriod[]).map((period) => (
              <button key={period} type="button" onClick={() => setTimeFilter(period)} className={`px-3 py-1 rounded-md text-xs ${timeFilter === period ? 'bg-[#27272A] text-[#D4AF37] font-bold' : 'text-[#A1A1AA]'}`}>
                {t(`dashboard.${period}`)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onSelectNav('feeding')} className="bg-[#D4AF37] text-black px-4 py-2 rounded-lg text-xs font-bold">{t('dashboard.quickActionBtn')}</button>
          <button type="button" onClick={() => onSelectNav('reports')} className="bg-[#18181B] text-white px-4 py-2 border border-[#27272A] rounded-lg text-xs">{t('dashboard.exportReportBtn')}</button>
        </div>
      </div>

      <section className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{t('dashboard.scopeTitle')}</div>
            <div className="text-[11px] text-[#71717A] mt-1">{t('dashboard.scopeLabel')}: <span className="text-[#D4AF37]">{scopeLabel}</span></div>
          </div>
          {(selectedHallIds.length > 0 || selectedPondIds.length > 0) && (
            <button type="button" onClick={() => { setSelectedHallIds([]); setSelectedPondIds([]); }} className="self-start lg:self-auto px-3 py-2 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white">
              {t('dashboard.clearScope')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#71717A] mb-2">{t('dashboard.selectHalls')}</div>
            <div className="flex flex-wrap gap-2">
              {halls.map((hall) => (
                <button key={hall.id} type="button" onClick={() => setSelectedHallIds((previous) => toggleSelection(previous, hall.id))} className={`px-3 py-1.5 rounded-lg border text-xs ${selectedHallIds.includes(hall.id) ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A]'}`}>
                  {hall.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#71717A] mb-2">{t('dashboard.selectPonds')}</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
              {ponds.map((pond) => (
                <button key={pond.id} type="button" onClick={() => setSelectedPondIds((previous) => toggleSelection(previous, pond.id))} className={`px-3 py-1.5 rounded-lg border text-xs ${selectedPondIds.includes(pond.id) ? 'bg-cyan-400 text-black border-cyan-400' : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A]'}`}>
                  {pond.number}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {criticalPondRows.length > 0 && (
        <button type="button" onClick={() => onSelectNav('ponds')} className="w-full text-start bg-[#18181B] border border-rose-500/40 rounded-2xl p-4 text-rose-300">
          <div className="font-bold text-xs text-white">{t('dashboard.criticalPondsAlert', { count: criticalPondRows.length })}</div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">{criticalPondRows.slice(0, 8).map((row) => `${row.pond.name}: ${row.criticalReason || row.pond.stopFeedingReason || 'STOPPED'}`).join(' • ')}</div>
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
            <div><div className="text-sm font-medium text-white">{t('dashboard.feedTrendTitle')}</div><div className="text-[10px] text-[#71717A]">{scopeLabel} · {t(`dashboard.${timeFilter}`)}</div></div>
            <div className="text-xs text-[#D4AF37]">{formatNumber(analytics.periodFeedKg)} kg</div>
          </div>
          {analytics.periodFeedKg <= 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-[#71717A]">{t('noData')}</div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {analytics.feedBuckets.map((bucket) => (
                <div key={`${bucket.start}-${bucket.end}`} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                  <div className="w-full flex-1 flex items-end bg-[#18181B] rounded-t-md overflow-hidden" title={`${formatNumber(bucket.feedKg)} kg`}>
                    <div className="w-full bg-[#D4AF37]/60 border-t border-[#D4AF37]" style={{ height: `${maxFeedBucket > 0 ? (bucket.feedKg / maxFeedBucket) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[9px] text-[#71717A] truncate max-w-full">{formatDate(bucket.start)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
          <h3 className="text-sm font-medium text-white">{t('dashboard.domainDashboards')}</h3>
          <div className="mt-4 space-y-2">
            {domainCards.map(({ label, value, nav, icon: Icon }) => (
              <button key={label} type="button" onClick={() => onSelectNav(nav)} className="w-full flex items-center justify-between gap-3 text-xs bg-[#18181B] hover:bg-[#1F1F22] rounded-lg p-3 text-start">
                <span className="flex items-center gap-2 text-white"><Icon className="w-4 h-4 text-[#D4AF37]" />{label}</span>
                <span className="text-[#A1A1AA] font-mono">{value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#1F1F22] flex items-center justify-between gap-3">
            <span className="text-sm text-white font-medium">{t('dashboard.hallCompareTitle')}</span>
            <span className="text-[10px] text-[#71717A]">{t('dashboard.compareHalls')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0C0C0E] text-[#71717A]">
                <tr><th className="p-3 text-start">{t('pond.hall')}</th><th className="p-3 text-start">{t('pond.biomass')}</th><th className="p-3 text-start">{t('nav.feeding')}</th><th className="p-3 text-start">FCR</th><th className="p-3 text-start">{t('dashboard.criticalAlerts')}</th></tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F22]">
                {analytics.hallRows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-[#71717A]">{t('noData')}</td></tr> : analytics.hallRows.map((row) => (
                  <tr key={row.hall.id}>
                    <td className="p-3 text-white">{row.hall.name}</td>
                    <td className="p-3 text-[#D4D4D8]">{formatNumber(row.biomassKg)} kg</td>
                    <td className="p-3 text-[#D4D4D8]">{formatNumber(row.feedKg)} kg</td>
                    <td className="p-3 text-[#D4D4D8]">{row.weightedFcr === null ? '—' : formatNumber(row.weightedFcr, { maximumFractionDigits: 3 })}</td>
                    <td className={row.criticalPonds > 0 ? 'p-3 text-rose-400' : 'p-3 text-emerald-400'}>{formatNumber(row.criticalPonds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#1F1F22] text-sm text-white font-medium">{t('dashboard.scopePondTable')}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0C0C0E] text-[#71717A]"><tr><th className="p-3 text-start">{t('name')}</th><th className="p-3 text-start">DO</th><th className="p-3 text-start">{t('pond.waterTemp')}</th><th className="p-3 text-start">{t('status')}</th></tr></thead>
              <tbody className="divide-y divide-[#1F1F22]">
                {analytics.pondRows.slice(0, 20).map((row) => (
                  <tr key={row.pond.id}>
                    <td className="p-3 text-white">{row.pond.name}</td>
                    <td className={`p-3 ${row.isWaterCritical ? 'text-rose-400' : 'text-cyan-300'}`}>{row.hasTrustedTelemetry && row.latestWaterLog ? `${formatNumber(row.latestWaterLog.dissolvedOxygen)} mg/L` : '—'}</td>
                    <td className="p-3 text-[#D4D4D8]">{row.hasTrustedTelemetry && row.latestWaterLog ? `${formatNumber(row.latestWaterLog.temperature)}°C` : '—'}</td>
                    <td className={`p-3 ${row.pond.feedingStatus === 'STOPPED' || row.isWaterCritical ? 'text-rose-400' : 'text-emerald-400'}`}>{row.pond.feedingStatus === 'STOPPED' ? t('pond.stopped') : row.isWaterCritical ? (row.criticalReason || t('critical')) : t('pond.active')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
          <h3 className="text-sm font-medium text-white">{t('dashboard.monthlySales')}</h3>
          <div className="mt-4 space-y-2">
            {analytics.salesByCurrency.length === 0 ? <div className="text-xs text-[#71717A]">{t('noData')}</div> : analytics.salesByCurrency.map(({ currency, amount }) => (
              <div key={currency} className="flex justify-between gap-3 text-xs bg-[#18181B] rounded-lg p-3"><span className="text-[#A1A1AA]">{currency}</span><span className="text-white font-bold">{formatCurrency(amount, currency)}</span></div>
            ))}
          </div>
        </div>

        <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
          <h3 className="text-sm text-white font-medium mb-3">{t('nav.reports')}</h3>
          <div className="space-y-2">{auditLogs.length === 0 ? <div className="text-xs text-[#71717A]">{t('noData')}</div> : auditLogs.slice(0, 8).map((log) => <div key={log.id} className="bg-[#18181B] rounded-lg p-3"><div className="flex justify-between gap-3"><span className="text-xs text-white font-medium">{log.action} · {log.entity}</span><span className="text-[9px] text-[#71717A]">{formatDate(log.timestamp)}</span></div><p className="text-[10px] text-[#A1A1AA] mt-1 line-clamp-2">{log.details}</p></div>)}</div>
        </div>
      </div>
    </div>
  );
};
