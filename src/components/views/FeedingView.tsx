import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Clock, Droplets, Lock, ShieldAlert, ShieldCheck, Sparkles, Thermometer, Utensils } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { DynamicTranslatedText } from '../common/DynamicTranslatedText';

 type DisplayUnit = 'kg' | 'gram' | 'cup250g';
 type AppetiteTag = 'NORMAL' | 'AGGRESSIVE' | 'LETHARGIC' | 'UNTOUCHED';

const kgToDisplay = (kg: number, unit: DisplayUnit): number => {
  if (!Number.isFinite(kg)) return 0;
  if (unit === 'gram') return Math.round(kg * 1000);
  if (unit === 'cup250g') return Number((kg / 0.25).toFixed(1));
  return Number(kg.toFixed(2));
};

const displayToKg = (amount: number, unit: DisplayUnit): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === 'gram') return amount / 1000;
  if (unit === 'cup250g') return amount * 0.25;
  return amount;
};

export const FeedingView: React.FC = () => {
  const { t, formatNumber, formatDate, formatTime } = useI18n();
  const { currentUser } = useAuth();
  const {
    ponds,
    halls,
    species,
    feedingRecords,
    calculateRecommendedFeed,
    recordFeeding,
    inventory,
  } = useFarm();

  const feedItems = useMemo(() => inventory.filter((item) => item.category.includes('Feed')), [inventory]);
  const [selectedPondId, setSelectedPondId] = useState<string>(ponds[0]?.id || '');
  const [selectedUnit, setSelectedUnit] = useState<DisplayUnit>('kg');
  const [feedSku, setFeedSku] = useState<string>(feedItems[0]?.sku || '');
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [operatorName, setOperatorName] = useState<string>(currentUser?.fullName || '');
  const [appetite, setAppetite] = useState<AppetiteTag>('NORMAL');

  const selectedPond = ponds.find((p) => p.id === selectedPondId);
  const selectedFeed = feedItems.find((item) => item.sku === feedSku);
  const selectedHall = halls.find((hall) => hall.id === selectedPond?.hallId);
  const selectedSpecies = species.find((item) => item.id === selectedPond?.speciesId);
  const { recommendedKg, isLocked, lockReason } = calculateRecommendedFeed(selectedPondId);

  useEffect(() => {
    if (!selectedPondId && ponds[0]?.id) setSelectedPondId(ponds[0].id);
  }, [ponds, selectedPondId]);

  useEffect(() => {
    if (!feedSku && feedItems[0]?.sku) setFeedSku(feedItems[0].sku);
  }, [feedItems, feedSku]);

  useEffect(() => {
    setOperatorName((prev) => prev || currentUser?.fullName || '');
  }, [currentUser?.fullName]);

  useEffect(() => {
    setManualAmount(kgToDisplay(recommendedKg, selectedUnit));
  }, [recommendedKg, selectedUnit, selectedPondId]);

  const normalizedAmountKg = displayToKg(manualAmount, selectedUnit);
  const canSubmit = Boolean(
    selectedPond &&
      selectedFeed &&
      operatorName.trim() &&
      !isLocked &&
      Number.isFinite(normalizedAmountKg) &&
      normalizedAmountKg > 0
  );

  const handleSubmitFeeding = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPond || !selectedFeed || !canSubmit) {
      if (isLocked) alert(lockReason || t('feeding.feedingDisabledWarning'));
      return;
    }

    const result = recordFeeding({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      hallName: selectedHall?.name || selectedPond.hallId,
      speciesName: selectedSpecies?.scientificName || selectedSpecies?.faName || selectedPond.speciesId,
      biomassKg: selectedPond.biomassKg,
      recommendedAmountKg: recommendedKg,
      actualAmountKg: Number(normalizedAmountKg.toFixed(4)),
      unit: 'kg',
      feedTypeSku: selectedFeed.sku,
      feedTypeName: selectedFeed.name,
      waterTemperature: selectedPond.waterTemperature,
      dissolvedOxygen: selectedPond.dissolvedOxygen,
      feedingStatus: 'ACTIVE',
      operatorName: operatorName.trim(),
      notes: `appetite=${appetite}; input=${manualAmount} ${selectedUnit}`,
    });

    alert(result.success ? t('registeredSuccess') : result.error || t('error'));
  };

  const switchUnit = (unit: DisplayUnit) => {
    setSelectedUnit(unit);
    setManualAmount(kgToDisplay(recommendedKg, unit));
  };

  const unitLabel = selectedUnit === 'kg' ? t('feeding.unitKg') : selectedUnit === 'gram' ? t('feeding.unitGram') : t('feeding.unitCup');
  const displayRecommended = `${formatNumber(kgToDisplay(recommendedKg, selectedUnit))} ${unitLabel}`;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Utensils className="w-6 h-6 text-amber-400" />
            {t('feeding.title')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{t('feeding.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-semibold">{t('feeding.safetyBadge')}</span>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-200 text-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-300 mb-0.5">{t('feeding.safetyWarningTitle')}</h4>
          <p className="text-[11px] leading-relaxed text-amber-200/90">{t('feeding.safetyWarning')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <h2 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calculator className="w-4 h-4 text-amber-400" />
            {t('feeding.dispatchTitle')}
          </h2>

          <form onSubmit={handleSubmitFeeding} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">{t('feeding.selectPond')}:</label>
              <select
                value={selectedPondId}
                onChange={(e) => setSelectedPondId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold text-sm focus:border-amber-500"
              >
                {ponds.map((pond) => (
                  <option key={pond.id} value={pond.id}>
                    {pond.number} — {pond.name} ({pond.feedingStatus === 'STOPPED' ? `🔴 ${t('pond.stopped')}` : `🟢 ${t('pond.active')}`} | {t('pond.biomass')}: {formatNumber(pond.biomassKg)} kg | DO: {pond.dissolvedOxygen})
                  </option>
                ))}
              </select>
            </div>

            {isLocked && (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-3">
                <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm text-rose-200">{t('feeding.lockedTitle')}</strong>
                  <p className="text-xs text-rose-300 mt-1 flex items-center gap-1">
                    <span>{t('feeding.lockReasonPrefix')}</span>
                    <DynamicTranslatedText
                      text={lockReason || t('feeding.feedingDisabledWarning')}
                      recordId={`lock_${selectedPondId}`}
                      fieldName="lockReason"
                      showIndicator
                      inline
                    />
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">{t('feeding.unitSelection')}</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  {(['kg', 'gram', 'cup250g'] as DisplayUnit[]).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => switchUnit(unit)}
                      className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${selectedUnit === unit ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300'}`}
                    >
                      {unit === 'kg' ? t('feeding.unitKg') : unit === 'gram' ? t('feeding.unitGram') : t('feeding.unitCup')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {t('feeding.recommendedDose')}:
                </span>
                <span className={`text-xl font-black ${isLocked ? 'text-rose-400' : 'text-amber-400'}`}>
                  {isLocked ? `0 ${t('kg')}` : displayRecommended}
                </span>
                <span className="text-[10px] text-slate-400">{t('feeding.recommendationSub', { temp: selectedPond?.waterTemperature || 0 })}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">{t('feeding.actualDose')} ({unitLabel}):</label>
                <input
                  type="number"
                  step={selectedUnit === 'gram' ? '1' : '0.1'}
                  min="0"
                  disabled={isLocked}
                  value={manualAmount}
                  onChange={(e) => setManualAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl p-3 text-white font-bold text-base focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">{t('feeding.feedTypeSku')}</label>
                <select
                  value={feedSku}
                  onChange={(e) => setFeedSku(e.target.value)}
                  disabled={feedItems.length === 0}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-medium focus:border-amber-500 disabled:opacity-40"
                >
                  {feedItems.map((item) => (
                    <option key={item.id} value={item.sku}>
                      {item.name} — {formatNumber(item.quantity)} {item.unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">{t('feeding.operator')}</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">{t('feeding.appetiteBehavior')}</label>
                <select
                  value={appetite}
                  onChange={(e) => setAppetite(e.target.value as AppetiteTag)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-500"
                >
                  <option value="NORMAL">{t('feeding.appetiteNormal')}</option>
                  <option value="AGGRESSIVE">{t('feeding.appetiteAggressive')}</option>
                  <option value="LETHARGIC">{t('feeding.appetiteLethargic')}</option>
                  <option value="UNTOUCHED">{t('feeding.appetiteUntouched')}</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg ${canSubmit ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
            >
              {isLocked ? t('feeding.submitDisabled') : t('feeding.submitFeed')}
            </button>
          </form>
        </div>

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
                <span className="text-[10px] text-slate-400 block mt-0.5">{t('feeding.pondCodeLabel')} {selectedPond.number}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400 mb-1" />
                  <span className="text-[10px] text-slate-400 block">{t('feeding.doLabel')}</span>
                  <span className={`font-black ${selectedPond.dissolvedOxygen < 4 ? 'text-rose-400' : 'text-cyan-300'}`}>{selectedPond.dissolvedOxygen} mg/L</span>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400 mb-1" />
                  <span className="text-[10px] text-slate-400 block">{t('feeding.tempLabel')}</span>
                  <span className="font-black text-amber-300">{selectedPond.waterTemperature}°C</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">{t('feeding.biomassLabel')}</span>
                  <span className="font-bold text-white">{formatNumber(selectedPond.biomassKg)} kg</span>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">{t('feeding.fcrLabel')}</span>
                  <span className="font-bold text-white">{selectedPond.fcr}</span>
                </div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 block">{t('feeding.lastFeedingLabel')}</span>
                  <span className="text-white font-semibold">{formatNumber(selectedPond.lastFeedingKg)} kg</span>
                  <span className="text-[10px] text-slate-500 block">{formatDate(selectedPond.lastFeedingTime)} — {formatTime(selectedPond.lastFeedingTime)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t('feeding.noPondSelected')}</p>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">{t('feeding.ledgerTitle')}</h3>
          <span className="text-[10px] text-slate-500">{t('feeding.recordsCount', { count: feedingRecords.length })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="p-3 text-start">{t('feeding.thPond')}</th>
                <th className="p-3 text-start">{t('feeding.thFeedType')}</th>
                <th className="p-3 text-start">{t('feeding.thRecommended')}</th>
                <th className="p-3 text-start">{t('feeding.thActual')}</th>
                <th className="p-3 text-start">{t('feeding.thDoTemp')}</th>
                <th className="p-3 text-start">{t('feeding.thOperator')}</th>
                <th className="p-3 text-start">{t('feeding.thTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {feedingRecords.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">{t('feeding.noRecords')}</td></tr>
              ) : feedingRecords.slice(0, 50).map((record) => (
                <tr key={record.id} className="text-slate-300">
                  <td className="p-3 font-semibold text-white">{record.pondName}</td>
                  <td className="p-3">{record.feedTypeName}</td>
                  <td className="p-3">{formatNumber(record.recommendedAmountKg)} kg</td>
                  <td className="p-3 font-bold text-amber-300">{formatNumber(record.actualAmountKg)} kg</td>
                  <td className="p-3">{record.dissolvedOxygen} mg/L / {record.waterTemperature}°C</td>
                  <td className="p-3">{record.operatorName}</td>
                  <td className="p-3 whitespace-nowrap">{formatDate(record.timestamp)} {formatTime(record.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
