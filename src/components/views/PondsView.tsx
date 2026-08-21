import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { DynamicTranslatedText } from '../common/DynamicTranslatedText';
import {
  Fish,
  AlertTriangle,
  Utensils,
  TrendingUp,
  Activity,
  Skull,
  ArrowLeftRight,
  ShieldAlert,
  Play,
  Square,
  Droplets,
  Thermometer,
  Layers,
  Search,
  Filter,
  Plus,
} from 'lucide-react';
import { Pond } from '../../types';

interface PondsViewProps {
  onSelectNav: (viewId: string) => void;
}

export const PondsView: React.FC<PondsViewProps> = ({ onSelectNav }) => {
  const { t, formatNumber, formatDate } = useI18n();
  const { currentUser } = useAuth();
  const {
    ponds,
    halls,
    species,
    inventory,
    calculateRecommendedFeed,
    stopPondFeeding,
    resumePondFeeding,
    recordFeeding,
    recordMortality,
    recordWaterTest,
    executeAtomicTransfer,
  } = useFarm();

  const [selectedHall, setSelectedHall] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [stopModalPond, setStopModalPond] = useState<Pond | null>(null);
  const [stopReason, setStopReason] = useState<Pond['stopFeedingReason']>('Handling');
  const [stopDetails, setStopDetails] = useState<string>('');

  const [feedModalPond, setFeedModalPond] = useState<Pond | null>(null);
  const [feedAmountKg, setFeedAmountKg] = useState<number>(0);
  const [feedOperator, setFeedOperator] = useState<string>(currentUser?.fullName || '');

  const [mortalityModalPond, setMortalityModalPond] = useState<Pond | null>(null);
  const [mortalityCount, setMortalityCount] = useState<number>(0);
  const [mortalityWeightKg, setMortalityWeightKg] = useState<number>(0);
  const [mortalityReason, setMortalityReason] = useState<string>('');

  const [transferModalPond, setTransferModalPond] = useState<Pond | null>(null);
  const [destPondId, setDestPondId] = useState<string>('');
  const [transferCount, setTransferCount] = useState<number>(0);
  const [transferReason, setTransferReason] = useState<string>('');

  const filteredPonds = ponds.filter((p) => {
    const matchHall = selectedHall === 'all' || p.hallId === selectedHall;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchHall && matchSearch;
  });

  const handleConfirmStop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopModalPond) return;
    stopPondFeeding(stopModalPond.id, stopReason, stopDetails, currentUser?.fullName || 'اپراتور');
    setStopModalPond(null);
    setStopDetails('');
  };

  const handleConfirmFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedModalPond) return;
    const feedItem = inventory.find((item) => item.category.includes('Feed') && (item.unit === 'kg' || item.unit === 'gram'));
    if (!feedItem) {
      alert('خوراک معتبر در انبار ثبت نشده است.');
      return;
    }
    const res = recordFeeding({
      pondId: feedModalPond.id,
      pondName: feedModalPond.name,
      hallName: halls.find((hall) => hall.id === feedModalPond.hallId)?.name || '',
      speciesName: species.find((item) => item.id === feedModalPond.speciesId)?.enName || '',
      biomassKg: feedModalPond.biomassKg,
      feedTypeSku: feedItem.sku,
      feedTypeName: feedItem.name,
      recommendedAmountKg: feedAmountKg,
      actualAmountKg: feedAmountKg,
      unit: 'kg',
      operatorName: feedOperator,
      dissolvedOxygen: feedModalPond.dissolvedOxygen,
      waterTemperature: feedModalPond.waterTemperature,
      feedingStatus: 'ACTIVE',
    });
    if (!res.success) {
      alert(res.error);
    } else {
      setFeedModalPond(null);
    }
  };

  const handleConfirmMortality = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mortalityModalPond) return;
    recordMortality({
      pondId: mortalityModalPond.id,
      pondName: mortalityModalPond.name,
      speciesId: mortalityModalPond.speciesId,
      speciesName: species.find((item) => item.id === mortalityModalPond.speciesId)?.enName || '',
      count: mortalityCount,
      estimatedWeightKg: mortalityWeightKg,
      reason: mortalityReason,
      description: mortalityReason.trim(),
      recordedBy: currentUser?.fullName || '',
    });
    setMortalityModalPond(null);
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalPond || !destPondId) return;
    const destPond = ponds.find((p) => p.id === destPondId);
    if (!destPond) return;

    const res = executeAtomicTransfer({
      sourceType: 'Pond',
      sourceId: transferModalPond.id,
      sourceName: transferModalPond.name,
      destinationType: 'Pond',
      destinationId: destPond.id,
      destinationName: destPond.name,
      speciesId: transferModalPond.speciesId,
      speciesName: species.find((item) => item.id === transferModalPond.speciesId)?.enName || '',
      fishCount: transferCount,
      averageWeightKg: transferModalPond.averageWeightKg,
      totalBiomassKg: transferCount * transferModalPond.averageWeightKg,
      reason: transferReason,
      date: new Date().toISOString().split('T')[0],
      operator: currentUser?.fullName || '',
    });

    if (!res.success) {
      alert(res.error);
    } else {
      setTransferModalPond(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Fish className="w-6 h-6 text-amber-400" />
            {t('pond.digitalTwin')} ({ponds.length} استخر پرورشی)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            دوقلوی دیجیتال استخرها، مدیریت قطع/وصل تغذیه، ثبت بیومتری، کنترل اکسیژن و انتقال اتمیک ماهی
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hall selector */}
          <select
            value={selectedHall}
            onChange={(e) => setSelectedHall(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="all">همه سالن‌های پرورش</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی استخر..."
              className="bg-slate-800 border border-slate-700 text-white rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-amber-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Ponds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredPonds.map((pond) => {
          const isStopped = pond.feedingStatus === 'STOPPED';
          const isLowDO = pond.dissolvedOxygen < 4.0;
          const sp = species.find((s) => s.id === pond.speciesId);
          const hall = halls.find((h) => h.id === pond.hallId);

          return (
            <div
              key={pond.id}
              className={`rounded-2xl border transition-all shadow-md overflow-hidden flex flex-col justify-between ${
                isStopped
                  ? 'bg-gradient-to-b from-rose-950/20 via-slate-900 to-slate-900 border-rose-500/40 shadow-rose-900/10'
                  : isLowDO
                  ? 'bg-gradient-to-b from-amber-950/20 via-slate-900 to-slate-900 border-amber-500/40'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                      {pond.number}
                    </span>
                    <h3 className="font-bold text-sm text-white truncate max-w-[180px]">
                      {pond.name}
                    </h3>
                  </div>

                  {/* Feeding Status Pill */}
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                      isStopped
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {isStopped ? (
                      <>
                        <Square className="w-3 h-3 fill-rose-400" />
                        {t('pond.stopped')}
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-emerald-400" />
                        {t('pond.active')}
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>سالن: <strong className="text-slate-300">{hall?.number || 'H-01'}</strong></span>
                  <span>گونه: <strong className="text-amber-400">{sp?.faName || 'ثبت نشده'}</strong></span>
                </div>
              </div>

              {/* Digital Twin Metrics Grid */}
              <div className="p-4 space-y-3 flex-1">
                {/* Stopped Warning Notice */}
                {isStopped && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-rose-200">
                        دلیل قطع خوراک: {pond.stopFeedingReason || 'توقف دستی'}
                      </strong>
                      <div className="text-[11px] text-rose-300/80 mt-0.5">
                        <DynamicTranslatedText
                          text={pond.stopFeedingDetails || 'بدون جزئیات ثبت شده'}
                          recordId={pond.id}
                          fieldName="stopFeedingDetails"
                          showIndicator={true}
                          inline={true}
                        />
                        <span className="opacity-70 mr-1 ml-1">({pond.stopFeedingUser || 'مسئول'})</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Biomass */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.biomass')}</span>
                    <span className="text-sm font-black text-white">
                      {formatNumber(pond.biomassKg)} <span className="text-[10px] text-slate-400">kg</span>
                    </span>
                  </div>

                  {/* Fish Count */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.count')}</span>
                    <span className="text-sm font-black text-white">
                      {formatNumber(pond.fishCount)} <span className="text-[10px] text-slate-400">قطعه</span>
                    </span>
                  </div>

                  {/* Average Weight */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.avgWeight')}</span>
                    <span className="text-sm font-black text-amber-400">
                      {pond.averageWeightKg} <span className="text-[10px] text-slate-400">kg</span>
                    </span>
                  </div>

                  {/* FCR */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.fcr')}</span>
                    <span className={`text-sm font-black ${pond.fcr > 1.3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {pond.fcr}
                    </span>
                  </div>
                </div>

                {/* IoT Telemetry Strip */}
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400 text-[11px]">اکسیژن (DO):</span>
                    <strong className={`font-bold ${pond.dissolvedOxygen < 4 ? 'text-rose-400' : 'text-cyan-300'}`}>
                      {pond.dissolvedOxygen} mg/L
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-400 text-[11px]">دما:</span>
                    <strong className="font-bold text-orange-300">{pond.waterTemperature}°C</strong>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>pH:</span>
                    <strong className="text-slate-200">{pond.ph}</strong>
                  </div>
                </div>
              </div>

              {/* Card Action Footer */}
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
                {/* Stop / Resume Button */}
                {isStopped ? (
                  <button
                    onClick={() => resumePondFeeding(pond.id, currentUser?.fullName || 'مدیر مزرعه')}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('pond.resumeFeedingBtn')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setStopModalPond(pond);
                      setStopReason('Handling');
                      setStopDetails('');
                    }}
                    className="flex-1 py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{t('pond.stopFeedingBtn')}</span>
                  </button>
                )}

                {/* Quick Action Icons */}
                <div className="flex items-center gap-1">
                  {/* Quick Feed */}
                  <button
                    disabled={calculateRecommendedFeed(pond.id).isLocked}
                    onClick={() => {
                      const recommendation = calculateRecommendedFeed(pond.id);
                      if (recommendation.isLocked) return;
                      setFeedModalPond(pond);
                      setFeedAmountKg(recommendation.recommendedKg);
                    }}
                    title={calculateRecommendedFeed(pond.id).lockReason || t('pond.quickFeed')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-400 rounded-xl transition-colors cursor-pointer border border-slate-700"
                  >
                    <Utensils className="w-4 h-4" />
                  </button>

                  {/* Quick Mortality */}
                  <button
                    onClick={() => {
                      setMortalityModalPond(pond);
                      setMortalityCount(1);
                      setMortalityWeightKg(pond.averageWeightKg);
                    }}
                    title={t('pond.quickMortality')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl transition-colors cursor-pointer border border-slate-700"
                  >
                    <Skull className="w-4 h-4" />
                  </button>

                  {/* Quick Transfer */}
                  <button
                    onClick={() => {
                      setTransferModalPond(pond);
                      setTransferCount(10);
                      const otherPonds = ponds.filter((p) => p.id !== pond.id);
                      if (otherPonds.length > 0) setDestPondId(otherPonds[0].id);
                    }}
                    title={t('pond.quickTransfer')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl transition-colors cursor-pointer border border-slate-700"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Emergency Feeding Cutoff */}
      {stopModalPond && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/20">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  توقف اضطراری تغذیه در {stopModalPond.name}
                </h3>
                <p className="text-xs text-rose-300">
                  ثبت رسمی در سیاهه لاگ امنیتی (Safety Audit)
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmStop} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  علت قطع تغذیه:
                </label>
                <select
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-rose-500"
                >
                  <option value="Low Oxygen (افت اکسیژن)">افت شدید اکسیژن (Low Oxygen)</option>
                  <option value="Treatment (درمان و دارو)">حمام دارویی و درمان (Treatment)</option>
                  <option value="Handling (سونوگرافی و بیومتری)">سونوگرافی / بیومتری (Handling)</option>
                  <option value="Fish Transfer (جابجایی ماهی)">جابجایی و سورتینگ (Fish Transfer)</option>
                  <option value="Low Water Temperature (افت دما)">افت دمای آب (Low Water Temperature)</option>
                  <option value="Disease Outbreak (بیماری)">مشاهده علائم بیماری (Disease)</option>
                  <option value="Manual Operator Decision (تصمیم دستی)">تصمیم کارشناس کشیک (Manual Decision)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  توضیحات و دستورالعمل اجرایی:
                </label>
                <textarea
                  rows={3}
                  value={stopDetails}
                  onChange={(e) => setStopDetails(e.target.value)}
                  placeholder="علت دقیق، اقدامات انجام شده و زمان پیش‌بینی بازگشت به جیره..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStopModalPond(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  تأیید و قطع قطعی تغذیه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Feed Modal */}
      {feedModalPond && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  ثبت خوراک در {feedModalPond.name}
                </h3>
                <p className="text-xs text-amber-300">
                  کسر خودکار از انبار مرکزی خوراک
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmFeed} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  مقدار خوراک (کیلوگرم):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={feedAmountKg}
                  onChange={(e) => setFeedAmountKg(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-base focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  تکنسین مسئول:
                </label>
                <input
                  type="text"
                  value={feedOperator}
                  onChange={(e) => setFeedOperator(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeedModalPond(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer shadow-lg shadow-amber-500/30"
                >
                  ثبت تغذیه در سیستم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Quick Mortality Modal */}
      {mortalityModalPond && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/20">
                <Skull className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  ثبت تلفات در {mortalityModalPond.name}
                </h3>
                <p className="text-xs text-rose-300">
                  کسر خودکار قطعه و بیوماس از موجودی زنده
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmMortality} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    تعداد تلفات (قطعه):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={mortalityCount}
                    onChange={(e) => setMortalityCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    وزن تخمینی کل (kg):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={mortalityWeightKg}
                    onChange={(e) => setMortalityWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  علت تلفات / تشخیص اولیه:
                </label>
                <input
                  type="text"
                  value={mortalityReason}
                  onChange={(e) => setMortalityReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMortalityModalPond(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  ثبت تلفات و کسر از آمار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Quick Atomic Transfer Modal */}
      {transferModalPond && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-blue-400">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  انتقال اتمیک ماهی از {transferModalPond.name}
                </h3>
                <p className="text-xs text-blue-300">
                  تضمین همگامی همزمان مبدا و مقصد در یک تراکنش
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  استخر مقصد:
                </label>
                <select
                  value={destPondId}
                  onChange={(e) => setDestPondId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-blue-500"
                  required
                >
                  {ponds
                    .filter((p) => p.id !== transferModalPond.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} — {p.name} ({p.fishCount} قطعه فعلی)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  تعداد ماهیان انتقالی (قطعه):
                </label>
                <input
                  type="number"
                  min="1"
                  max={transferModalPond.fishCount}
                  value={transferCount}
                  onChange={(e) => setTransferCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-blue-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  وزن بیوماس کل انتقالی: {(transferCount * transferModalPond.averageWeightKg).toFixed(1)} kg
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  دلیل انتقال:
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalPond(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  اجرای انتقال اتمیک
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
