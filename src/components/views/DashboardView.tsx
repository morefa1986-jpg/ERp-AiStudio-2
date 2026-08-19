import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  TrendingUp,
  Activity,
  Fish,
  Utensils,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShieldAlert,
  Clock,
  Layers,
  Thermometer,
  Droplets,
  Building2,
  Package,
  Bot,
  Sparkles,
} from 'lucide-react';

interface DashboardViewProps {
  onSelectNav: (viewId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectNav }) => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const {
    ponds,
    halls,
    feedingRecords,
    mortalityRecords,
    processingBatches,
    coldStorage,
    proformas,
    accounts,
    auditLogs,
  } = useFarm();

  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'year'>('week');

  // Aggregated KPIs
  const totalBiomassKg = ponds.reduce((sum, p) => sum + p.biomassKg, 0);
  const totalFishCount = ponds.reduce((sum, p) => sum + p.fishCount, 0);
  const activePondsCount = ponds.length;
  const stoppedPonds = ponds.filter((p) => p.feedingStatus === 'STOPPED');

  const avgDO = ponds.length > 0 ? (ponds.reduce((sum, p) => sum + p.dissolvedOxygen, 0) / ponds.length).toFixed(2) : '0';
  const avgTemp = ponds.length > 0 ? (ponds.reduce((sum, p) => sum + p.waterTemperature, 0) / ponds.length).toFixed(1) : '0';
  const avgFCR = ponds.length > 0 ? (ponds.reduce((sum, p) => sum + p.fcr, 0) / ponds.length).toFixed(2) : '1.12';

  const todayFeedKg = ponds.reduce((sum, p) => sum + (p.lastFeedingKg || 0), 0);
  const totalCaviarStockKg = coldStorage.filter((c) => c.productType.includes('Caviar')).reduce((sum, c) => sum + c.weightKg, 0);

  // Financial summary
  const revenueAccount = accounts.find((a) => a.code === '4010');
  const totalSalesAmount = revenueAccount ? revenueAccount.balance : 19800000000;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1F1F22] pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-white tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-[#71717A] mt-1 text-xs tracking-wide">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time Filter Pills */}
          <div className="flex items-center bg-[#18181B] border border-[#27272A] p-1 rounded-lg text-xs">
            {(['today', 'week', 'month', 'year'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setTimeFilter(filterKey)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  timeFilter === filterKey
                    ? 'bg-[#27272A] text-[#D4AF37] font-bold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                {t(`dashboard.${filterKey}`)}
              </button>
            ))}
          </div>

          <button
            onClick={() => onSelectNav('feeding')}
            className="bg-[#D4AF37] hover:bg-[#c5a030] text-black px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            {t('dashboard.quickActionBtn')}
          </button>
          <button
            onClick={() => onSelectNav('reports')}
            className="bg-[#18181B] hover:bg-[#1F1F22] text-white px-4 py-2 border border-[#27272A] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            {t('dashboard.exportReportBtn')}
          </button>
        </div>
      </div>

      {/* Critical Alert Banner if feeding stopped */}
      {stoppedPonds.length > 0 && (
        <div className="bg-[#18181B] border border-rose-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-300">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <div>
              <h4 className="font-bold text-xs text-white">
                {t('dashboard.criticalPondsAlert', { count: stoppedPonds.length })}
              </h4>
              <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                {stoppedPonds.map((p) => `${p.name} (${p.stopFeedingReason || 'DO < 4.0 mg/L'})`).join(' • ')}
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectNav('ponds')}
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            {t('nav.ponds')}
          </button>
        </div>
      )}

      {/* 4-Column Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Biomass */}
        <div className="bg-[#121214] border border-[#1F1F22] p-5 rounded-2xl">
          <div className="text-[10px] text-[#71717A] uppercase tracking-widest mb-1">
            {t('dashboard.totalBiomass')}
          </div>
          <div className="text-3xl font-light text-white">
            {(totalBiomassKg / 1000).toFixed(1)}{' '}
            <span className="text-sm font-normal text-[#71717A]">Tons ({formatNumber(totalBiomassKg)} kg)</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-2 font-mono flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +2.4% • {formatNumber(totalFishCount)} {t('unit')}
          </div>
        </div>

        {/* Metric 2: FCR */}
        <div className="bg-[#121214] border border-[#1F1F22] p-5 rounded-2xl">
          <div className="text-[10px] text-[#71717A] uppercase tracking-widest mb-1">
            {t('dashboard.fcrAverage')}
          </div>
          <div className="text-3xl font-light text-white">
            {avgFCR} <span className="text-sm font-normal text-[#71717A]">FCR</span>
          </div>
          <div className="text-[10px] text-blue-400 mt-2 font-mono">
            {t('dashboard.feedToday')}: {formatNumber(todayFeedKg)} kg
          </div>
        </div>

        {/* Metric 3: Water Quality Index */}
        <div className="bg-[#121214] border border-[#1F1F22] p-5 rounded-2xl">
          <div className="text-[10px] text-[#71717A] uppercase tracking-widest mb-1">
            {t('dashboard.avgDo')}
          </div>
          <div className="text-3xl font-light text-white">
            {avgDO} <span className="text-sm font-normal text-[#71717A]">mg/L</span>
          </div>
          <div className="text-[10px] text-cyan-400 mt-2 font-mono">
            {t('dashboard.avgTemp')}: {avgTemp}°C
          </div>
        </div>

        {/* Metric 4: AI Farm Agent */}
        <div className="bg-[#121214] border border-[#D4AF37]/30 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-1.5 px-2.5 text-[8px] bg-[#D4AF37] text-black font-bold uppercase tracking-widest rounded-br-lg">
            AI AGENT
          </div>
          <div className="text-[10px] text-[#D4AF37] uppercase tracking-widest mb-1 mt-1">
            {t('nav.aiAssistant')}
          </div>
          <div className="text-sm font-medium leading-relaxed text-white mt-2">
            {stoppedPonds.length > 0
              ? t('dashboard.criticalPondsAlert', { count: stoppedPonds.length })
              : t('systemStatus')}
          </div>
        </div>
      </div>

      {/* Main Content Split: Digital Twin & Trends (2 Cols) + Operations & AI Insights (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Water Quality Trends & Digital Twin */}
        <div className="lg:col-span-2 space-y-5">
          {/* Water Quality Simulation Chart */}
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-sm font-medium text-white">{t('dashboard.waterQualityTrend')}</div>
                <p className="text-[11px] text-[#71717A]">{t('waterQuality.subtitle')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[10px] flex items-center text-[#A1A1AA]">
                  <div className="w-2 h-2 bg-[#D4AF37] rounded-full mr-1.5 ml-1.5" /> {t('waterQuality.temp')}
                </div>
                <div className="text-[10px] flex items-center text-[#A1A1AA]">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-1.5 ml-1.5" /> {t('waterQuality.do')}
                </div>
              </div>
            </div>

            {/* Custom Bar Visualization */}
            <div className="flex items-end space-x-3 rtl:space-x-reverse px-2 pb-2 h-36">
              {[
                { day: 'Mon', h: 60, temp: 16.1 },
                { day: 'Tue', h: 75, temp: 16.2 },
                { day: 'Wed', h: 68, temp: 16.0 },
                { day: 'Thu', h: 88, temp: 16.3 },
                { day: 'Fri', h: 80, temp: 16.2 },
                { day: 'Sat', h: 92, temp: 16.4 },
                { day: 'Sun', h: 85, temp: 16.3 },
              ].map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full bg-[#18181B] rounded-t-sm h-full flex items-end overflow-hidden">
                    <div
                      className="w-full bg-blue-500/20 border-t border-blue-400 transition-all"
                      style={{ height: `${item.h}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#71717A] uppercase font-mono">{item.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Twin Ponds Grid */}
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fish className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
                  {t('pond.digitalTwin')} ({formatNumber(ponds.length)} {t('unit')})
                </h3>
              </div>
              <button
                onClick={() => onSelectNav('ponds')}
                className="text-xs text-[#D4AF37] hover:underline font-semibold cursor-pointer"
              >
                {t('all')} {t('nav.ponds')} →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {ponds.slice(0, 6).map((pond) => {
                const isStopped = pond.feedingStatus === 'STOPPED';
                const isLowDO = pond.dissolvedOxygen < 4.0;

                return (
                  <div
                    key={pond.id}
                    onClick={() => onSelectNav('ponds')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isStopped
                        ? 'bg-[#18181B] border-rose-500/40 hover:border-rose-500'
                        : isLowDO
                        ? 'bg-[#18181B] border-[#D4AF37]/40 hover:border-[#D4AF37]'
                        : 'bg-[#18181B] border-[#27272A] hover:border-[#3F3F46]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-xs text-white">{pond.number}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          isStopped
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isStopped ? t('pond.stopped') : t('pond.active')}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#A1A1AA] font-medium truncate mb-2.5">
                      {pond.name}
                    </p>

                    <div className="grid grid-cols-2 gap-1 text-[10px] text-[#71717A] bg-[#121214] p-2 rounded-lg font-mono">
                      <div>{t('pond.biomass')}: <strong className="text-white">{formatNumber(pond.biomassKg)}k</strong></div>
                      <div>{t('pond.count')}: <strong className="text-white">{formatNumber(pond.fishCount)}</strong></div>
                      <div>DO: <strong className={pond.dissolvedOxygen < 5 ? 'text-[#D4AF37]' : 'text-cyan-400'}>{pond.dissolvedOxygen}</strong></div>
                      <div>Temp: <strong className="text-orange-300">{pond.waterTemperature}°C</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Critical Notifications, AI Prediction & Quick Actions */}
        <div className="space-y-5 flex flex-col">
          {/* Critical Notifications */}
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5 flex flex-col flex-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#71717A] mb-4">
              {t('dashboard.criticalAlerts')}
            </h3>

            <div className="space-y-3 flex-1">
              <div className="flex items-start space-x-3 rtl:space-x-reverse pb-3 border-b border-[#1F1F22]">
                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">DO &lt; 4.0 mg/L (Alert)</div>
                  <div className="text-[10px] text-[#71717A]">Pond P-104</div>
                </div>
              </div>

              <div className="flex items-start space-x-3 rtl:space-x-reverse pb-3 border-b border-[#1F1F22]">
                <div className="w-2 h-2 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">{t('biometrics.title')}</div>
                  <div className="text-[10px] text-[#71717A]">Cycle check</div>
                </div>
              </div>

              <div className="flex items-start space-x-3 rtl:space-x-reverse pb-3 border-b border-[#1F1F22]">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">{t('warehouse.title')}</div>
                  <div className="text-[10px] text-[#71717A]">Lot Gold 4mm</div>
                </div>
              </div>
            </div>

            {/* AI Prediction Widget */}
            <div className="mt-4 bg-[#18181B] p-4 rounded-xl border border-[#27272A]">
              <div className="text-[10px] uppercase tracking-widest text-[#71717A] mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                {t('dashboard.growthCurveTitle')}
              </div>
              <div className="text-xs leading-relaxed text-[#E4E4E7] italic">
                {t('dashboard.financialSummary')}
              </div>
            </div>
          </div>

          {/* Quick Module Navigation */}
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#71717A] mb-3">
              {t('dashboard.quickActionTitle')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectNav('feeding')}
                className="p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-lg text-xs text-[#E4E4E7] font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <Utensils className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{t('nav.feeding')}</span>
              </button>
              <button
                onClick={() => onSelectNav('processing')}
                className="p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-lg text-xs text-[#E4E4E7] font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <Package className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{t('nav.processing')}</span>
              </button>
              <button
                onClick={() => onSelectNav('sales')}
                className="p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-lg text-xs text-[#E4E4E7] font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('nav.sales')}</span>
              </button>
              <button
                onClick={() => onSelectNav('aiAssistant')}
                className="p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-lg text-xs text-[#E4E4E7] font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('nav.aiAssistant')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
