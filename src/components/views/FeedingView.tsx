import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { DynamicTranslatedText } from '../common/DynamicTranslatedText';
import {
  Utensils,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Droplets,
  Thermometer,
  Clock,
  Sparkles,
  Calculator,
} from 'lucide-react';

export const FeedingView: React.FC = () => {
  const { t, formatNumber, formatDate, formatTime } = useI18n();
  const { currentUser } = useAuth();
  const {
    ponds,
    feedingRecords,
    calculateRecommendedFeed,
    recordFeeding,
    inventory,
  } = useFarm();

  const [selectedPondId, setSelectedPondId] = useState<string>(ponds[0]?.id || '');
  const [selectedUnit, setSelectedUnit] = useState<'kg' | 'g' | 'cup'>('kg');
  const [feedSku, setFeedSku] = useState<string>('FEED-EXT-4.5MM');
  const [manualDoseKg, setManualDoseKg] = useState<number>(0);
  const [operatorName, setOperatorName] = useState<string>(currentUser?.fullName || 'علی رمضانی (تکنسین)');
  const [feedingStatusTag, setFeedingStatusTag] = useState<'NORMAL' | 'AGGRESSIVE' | 'LETHARGIC' | 'UNTOUCHED'>('NORMAL');

  const selectedPond = ponds.find((p) => p.id === selectedPondId);
  const { recommendedKg, isLocked, lockReason } = calculateRecommendedFeed(selectedPondId);

  // Sync manual dose when pond changes
  React.useEffect(() => {
    setManualDoseKg(recommendedKg);
  }, [selectedPondId, recommendedKg]);

  const handleSubmitFeeding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPond) return;

    if (isLocked) {
      alert(lockReason || t('feeding.feedingDisabledWarning'));
      return;
    }

    const res = recordFeeding({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      hallName: 'سالن ۱ - پرورش ماهیان خاویاری',
      speciesName: 'Huso huso (فیل‌ماهی بلوگا)',
      biomassKg: selectedPond.biomassKg,
      feedTypeSku: feedSku,
      feedTypeName: 'اکسترودر پلت ۴.۵ میلی‌متر رویال',
      recommendedAmountKg: recommendedKg,
      actualAmountKg: Number(manualDoseKg),
      unit: selectedUnit,
      operatorName,
      dissolvedOxygen: selectedPond.dissolvedOxygen,
      waterTemperature: selectedPond.waterTemperature,
      feedingStatus: feedingStatusTag,
    });

    if (res.success) {
      alert(`وعده غذایی ${manualDoseKg} kg در ${selectedPond.name} با موفقیت ثبت شد.`);
    } else {
      alert(res.error || 'خطا در ثبت');
    }
  };

  // Convert displayed dose for unit
  const displayRecommended =
    selectedUnit === 'kg'
      ? `${recommendedKg} kg`
      : selectedUnit === 'g'
      ? `${Math.round(recommendedKg * 1000)} g`
      : `${(recommendedKg / 0.25).toFixed(1)} پیمانه (250g)`;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Utensils className="w-6 h-6 text-amber-400" />
            {t('feeding.title')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('feeding.subtitle')}
          </p>
        </div>

        {/* Safety Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-semibold">{t('feeding.safetyBadge')}</span>
        </div>
      </div>

      {/* Critical Safety Warning Box */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-200 text-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-300 mb-0.5">{t('feeding.safetyWarningTitle')}</h4>
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            {t('feeding.safetyWarning')}
          </p>
        </div>
      </div>

      {/* Main Form & Calculation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Precision Feeding Dispatch Form */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <h2 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calculator className="w-4 h-4 text-amber-400" />
            {t('feeding.dispatchTitle')}
          </h2>

          <form onSubmit={handleSubmitFeeding} className="space-y-4 text-xs">
            {/* Pond Selection */}
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                {t('feeding.selectPond')}:
              </label>
              <select
                value={selectedPondId}
                onChange={(e) => setSelectedPondId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold text-sm focus:border-amber-500"
              >
                {ponds.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} — {p.name} ({p.feedingStatus === 'STOPPED' ? `🔴 ${t('pond.stopped')}` : `🟢 ${t('pond.active')}`} | {t('pond.biomass')}: {formatNumber(p.biomassKg)} kg | DO: {p.dissolvedOxygen})
                  </option>
                ))}
              </select>
            </div>

            {/* If Locked, show Warning Banner */}
            {isLocked && (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-3">
                <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm text-rose-200">
                    {t('feeding.lockedTitle')}
                  </strong>
                  <p className="text-xs text-rose-300 mt-1 flex items-center gap-1">
                    <span>{t('feeding.lockReasonPrefix')}</span>
                    <DynamicTranslatedText
                      text={lockReason || 'محدودیت ایمنی'}
                      recordId={`lock_${selectedPondId}`}
                      fieldName="lockReason"
                      showIndicator={true}
                      inline={true}
                    />
                  </p>
                </div>
              </div>
            )}

            {/* Units & Recommended Dose */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Unit Toggle */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  {t('feeding.unitSelection')}
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedUnit('kg')}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedUnit === 'kg' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300'
                    }`}
                  >
                    {t('feeding.unitKg')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUnit('g')}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedUnit === 'g' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300'
                    }`}
                  >
                    {t('feeding.unitGram')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUnit('cup')}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedUnit === 'cup' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300'
                    }`}
                  >
                    {t('feeding.unitCup')}
                  </button>
                </div>
              </div>

              {/* Algorithm Recommendation Card */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {t('feeding.recommendedDose')}:
                </span>
                <span className={`text-xl font-black ${isLocked ? 'text-rose-400' : 'text-amber-400'}`}>
                  {isLocked ? '0.00 kg' : displayRecommended}
                </span>
                <span className="text-[10px] text-slate-400">
                  {t('feeding.recommendationSub', { temp: selectedPond?.waterTemperature || 0 })}
                </span>
              </div>
            </div>

            {/* Actual Dose & Feed SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  {t('feeding.actualDose')} ({t('kg')}):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isLocked}
                  value={manualDoseKg}
                  onChange={(e) => setManualDoseKg(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl p-3 text-white font-bold text-base focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  {t('feeding.feedTypeSku')}
                </label>
                <select
                  value={feedSku}
                  onChange={(e) => setFeedSku(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-medium focus:border-amber-500"
                >
                  {inventory
                    .filter((i) => i.category.includes('Feed'))
                    .map((item) => (
                      <option key={item.id} value={item.sku}>
                        {item.name} ({formatNumber(item.quantity)} {item.unit} موجودی)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Operator & Appetite Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  {t('feeding.operator')}
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  {t('feeding.appetiteBehavior')}
                </label>
                <select
                  value={feedingStatusTag}
                  onChange={(e) => setFeedingStatusTag(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-500"
                >
                  <option value="NORMAL">{t('feeding.appetiteNormal')}</option>
                  <option value="AGGRESSIVE">{t('feeding.appetiteAggressive')}</option>
                  <option value="LETHARGIC">{t('feeding.appetiteLethargic')}</option>
                  <option value="UNTOUCHED">{t('feeding.appetiteUntouched')}</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLocked}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer ${
                isLocked
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isLocked ? t('feeding.submitDisabled') : t('feeding.submitFeed')}
            </button>
          </form>
        </div>

        {/* Right Col: Selected Pond Live Health Twin */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Droplets className="w-4 h-4 text-cyan-400" />
            {t('feeding.telemetryTitle')}
          </h3>

          {selectedPond ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="text-[11px] text-slate-400 block">{t('feeding.pondNameLabel')}</span>
                <span className="font-bold text-white text-sm">{selectedPond.name}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {t('feeding.pondCodeLabel')} {selectedPond.number}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[11px] text-slate-400 block">{t('feeding.doLabel')}</span>
                  <span className={`text-base font-black ${selectedPond.dissolvedOxygen < 4 ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {selectedPond.dissolvedOxygen} mg/L
                  </span>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[11px] text-slate-400 block">{t('feeding.tempLabel')}</span>
                  <span className="text-base font-black text-orange-400">
                    {selectedPond.waterTemperature}°C
                  </span>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[11px] text-slate-400 block">{t('feeding.biomassLabel')}</span>
                  <span className="text-base font-black text-white">
                    {formatNumber(selectedPond.biomassKg)} kg
                  </span>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[11px] text-slate-400 block">{t('feeding.fcrLabel')}</span>
                  <span className="text-base font-black text-emerald-400">
                    {selectedPond.fcr}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>{t('feeding.lastFeedingLabel')}</span>
                  <strong className="text-slate-200">{selectedPond.lastFeedingKg} kg</strong>
                </div>
                <div className="flex justify-between">
                  <span>{t('feeding.lastFeedingTimeLabel')}</span>
                  <strong className="text-slate-300">{formatDate(selectedPond.lastFeedingTime || '')}</strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t('feeding.noPondSelected')}</p>
          )}
        </div>
      </div>

      {/* Feeding Records History Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            {t('feeding.ledgerTitle')}
          </h3>
          <span className="text-xs text-slate-400">
            {t('feeding.recordsCount', { count: feedingRecords.length })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase border-b border-slate-700">
              <tr>
                <th className="p-3">{t('feeding.thPond')}</th>
                <th className="p-3">{t('feeding.thFeedType')}</th>
                <th className="p-3">{t('feeding.thRecommended')}</th>
                <th className="p-3">{t('feeding.thActual')}</th>
                <th className="p-3">{t('feeding.thDoTemp')}</th>
                <th className="p-3">{t('feeding.thOperator')}</th>
                <th className="p-3">{t('feeding.thTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {feedingRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">
                    {t('feeding.noRecords')}
                  </td>
                </tr>
              ) : (
                feedingRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{rec.pondName}</td>
                    <td className="p-3 text-slate-300 font-mono text-[11px]">{rec.feedTypeSku}</td>
                    <td className="p-3 text-slate-400">{rec.recommendedAmountKg} kg</td>
                    <td className="p-3 font-bold text-amber-400">{rec.actualAmountKg} kg</td>
                    <td className="p-3 text-cyan-300">
                      {rec.dissolvedOxygen} mg/L | {rec.waterTemperature}°C
                    </td>
                    <td className="p-3 text-slate-300">{rec.operatorName}</td>
                    <td className="p-3 text-slate-400">{formatDate(rec.timestamp)} {formatTime(rec.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
