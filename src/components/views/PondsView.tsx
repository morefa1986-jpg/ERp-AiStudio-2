import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { DynamicTranslatedText } from '../common/DynamicTranslatedText';
import { PondManualSnapshotModal } from './PondManualSnapshotModal';
import {
  Fish,
  AlertTriangle,
  Utensils,
  Skull,
  ArrowLeftRight,
  Play,
  Square,
  Droplets,
  Thermometer,
  Search,
  ClipboardPen,
} from 'lucide-react';
import { Pond } from '../../types';
import { pondWithManualSnapshot, PondManualSnapshotInput } from '../../types/pondSnapshot';
import { pondStockGroups } from '../../utils/pondStockLedger';

function stockKey(speciesId: string, sex: string): string {
  return `${speciesId}|${sex}`;
}

function parseChips(value: string): string[] {
  return [...new Set(value.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean))];
}

interface PondsViewProps {
  onSelectNav: (viewId: string) => void;
}

export const PondsView: React.FC<PondsViewProps> = ({ onSelectNav: _onSelectNav }) => {
  const { t, formatNumber, formatDate } = useI18n();
  const { currentUser, hasPermission } = useAuth();
  const {
    ponds,
    halls,
    species,
    inventory,
    calculateRecommendedFeed,
    stopPondFeeding,
    resumePondFeeding,
    updatePondManualSnapshot,
    recordFeeding,
    recordMortality,
    executeAtomicTransfer,
  } = useFarm();

  const [selectedHall, setSelectedHall] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [snapshotModalPond, setSnapshotModalPond] = useState<Pond | null>(null);
  const [stopModalPond, setStopModalPond] = useState<Pond | null>(null);
  const [stopReason, setStopReason] = useState<Pond['stopFeedingReason']>('Handling');
  const [stopDetails, setStopDetails] = useState<string>('');

  const [feedModalPond, setFeedModalPond] = useState<Pond | null>(null);
  const [feedAmountKg, setFeedAmountKg] = useState<number>(0);
  const [feedOperator, setFeedOperator] = useState<string>(currentUser?.fullName || '');

  const [mortalityModalPond, setMortalityModalPond] = useState<Pond | null>(null);
  const [mortalityStockKey, setMortalityStockKey] = useState<string>('');
  const [mortalityChipSelection, setMortalityChipSelection] = useState<string>('');
  const [mortalityCount, setMortalityCount] = useState<number>(0);
  const [mortalityWeightKg, setMortalityWeightKg] = useState<number>(0);
  const [mortalityReason, setMortalityReason] = useState<string>('');

  const [transferModalPond, setTransferModalPond] = useState<Pond | null>(null);
  const [transferStockKey, setTransferStockKey] = useState<string>('');
  const [transferChipSelection, setTransferChipSelection] = useState<string>('');
  const [destPondId, setDestPondId] = useState<string>('');
  const [transferCount, setTransferCount] = useState<number>(0);
  const [transferReason, setTransferReason] = useState<string>('');

  const mortalityStockGroups = useMemo(() => mortalityModalPond ? pondStockGroups(mortalityModalPond).filter((group) => group.count > 0) : [], [mortalityModalPond]);
  const selectedMortalityStock = mortalityStockGroups.find((group) => stockKey(group.speciesId, group.sex) === mortalityStockKey) || mortalityStockGroups[0];
  const transferStockGroups = useMemo(() => transferModalPond ? pondStockGroups(transferModalPond).filter((group) => group.count > 0) : [], [transferModalPond]);
  const selectedTransferStock = transferStockGroups.find((group) => stockKey(group.speciesId, group.sex) === transferStockKey) || transferStockGroups[0];

  const speciesLabel = (speciesId: string) => {
    const row = species.find((item) => item.id === speciesId);
    return row?.faName || row?.enName || row?.scientificName || speciesId;
  };

  const validateChipRemoval = (chipsText: string, registered: string[] | undefined, groupCount: number, removeCount: number) => {
    const chips = parseChips(chipsText);
    const registeredChips = registered || [];
    if (chips.some((chip) => !registeredChips.includes(chip))) return { ok: false, chips, error: 'حداقل یک شماره Chip در گروه انتخاب‌شده ثبت نشده است.' };
    if (chips.length > removeCount) return { ok: false, chips, error: 'تعداد Chipهای انتخاب‌شده از تعداد ماهی عملیات بیشتر است.' };
    if (registeredChips.length - chips.length > groupCount - removeCount) {
      return { ok: false, chips, error: 'برای حفظ دفترچه Chip، شماره Chip ماهیان خارج‌شونده را مشخص کنید.' };
    }
    return { ok: true, chips };
  };

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
    if (!mortalityModalPond || !selectedMortalityStock) return;
    if (mortalityCount > selectedMortalityStock.count) {
      alert('تعداد تلفات بیشتر از موجودی گروه انتخاب‌شده است.');
      return;
    }
    const chipCheck = validateChipRemoval(mortalityChipSelection, selectedMortalityStock.chipNumbers, selectedMortalityStock.count, mortalityCount);
    if (!chipCheck.ok) {
      alert(chipCheck.error);
      return;
    }
    recordMortality({
      pondId: mortalityModalPond.id,
      pondName: mortalityModalPond.name,
      speciesId: selectedMortalityStock.speciesId,
      speciesName: speciesLabel(selectedMortalityStock.speciesId),
      stockSex: selectedMortalityStock.sex,
      chipNumbers: chipCheck.chips.length ? chipCheck.chips : undefined,
      count: mortalityCount,
      estimatedWeightKg: mortalityWeightKg,
      reason: mortalityReason,
      description: mortalityReason.trim(),
      recordedBy: currentUser?.fullName || '',
    });
    setMortalityModalPond(null);
    setMortalityStockKey('');
    setMortalityChipSelection('');
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalPond || !destPondId || !selectedTransferStock) return;
    const destPond = ponds.find((p) => p.id === destPondId);
    if (!destPond) return;
    if (transferCount > selectedTransferStock.count) {
      alert('تعداد انتقال بیشتر از موجودی گروه انتخاب‌شده است.');
      return;
    }
    const chipCheck = validateChipRemoval(transferChipSelection, selectedTransferStock.chipNumbers, selectedTransferStock.count, transferCount);
    if (!chipCheck.ok) {
      alert(chipCheck.error);
      return;
    }
    const biomassKg = Number((transferCount * selectedTransferStock.averageWeightKg).toFixed(3));

    const res = executeAtomicTransfer({
      sourceType: 'Pond',
      sourceId: transferModalPond.id,
      sourceName: transferModalPond.name,
      destinationType: 'Pond',
      destinationId: destPond.id,
      destinationName: destPond.name,
      speciesId: selectedTransferStock.speciesId,
      speciesName: speciesLabel(selectedTransferStock.speciesId),
      stockSex: selectedTransferStock.sex,
      chipNumbers: chipCheck.chips.length ? chipCheck.chips : undefined,
      fishCount: transferCount,
      averageWeightKg: selectedTransferStock.averageWeightKg,
      totalBiomassKg: biomassKg,
      reason: transferReason,
      date: new Date().toISOString().split('T')[0],
      operator: currentUser?.fullName || '',
    });

    if (!res.success) {
      alert(res.error);
    } else {
      setTransferModalPond(null);
      setTransferStockKey('');
      setTransferChipSelection('');
    }
  };

  const handleManualSnapshotSave = (pond: Pond, input: PondManualSnapshotInput) => {
    return updatePondManualSnapshot(pond.id, input);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Fish className="w-6 h-6 text-amber-400" />
            {t('pond.digitalTwin')} ({ponds.length} استخر پرورشی)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            دوقلوی دیجیتال استخرها، ثبت آمار دستی، ترکیب گونه/جنسیت، چیپ، ابعاد، قطع خوراک و عملیات روزانه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredPonds.map((pond) => {
          const isStopped = pond.feedingStatus === 'STOPPED';
          const isLowDO = pond.dissolvedOxygen < 4.0;
          const sp = species.find((s) => s.id === pond.speciesId);
          const hall = halls.find((h) => h.id === pond.hallId);
          const manual = pondWithManualSnapshot(pond);
          const manualGroups = manual.speciesMix || [];
          const manualMale = manualGroups.reduce((sum, group) => sum + (group.maleCount || 0), 0);
          const manualFemale = manualGroups.reduce((sum, group) => sum + (group.femaleCount || 0), 0);
          const manualUnknown = manualGroups.reduce((sum, group) => sum + (group.unknownSexCount || 0), 0);
          const manualChips = manualGroups.reduce((sum, group) => sum + (group.chipNumbers?.length || 0), 0);
          const canEditPond = hasPermission('ponds', 'edit', pond.id);
          const dimensions = manual.pondShape === 'Circular'
            ? `Ø ${manual.diameterMeters ?? '—'} × ${manual.depthMeters ?? '—'} m`
            : manual.pondShape === 'Rectangular' || manual.pondShape === 'Raceway'
              ? `${manual.lengthMeters ?? '—'} × ${manual.widthMeters ?? '—'} × ${manual.depthMeters ?? '—'} m`
              : '—';

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
                  <span>سالن: <strong className="text-slate-300">{hall?.number || '—'}</strong></span>
                  <span>گونه اصلی: <strong className="text-amber-400">{sp?.faName || 'ثبت نشده'}</strong></span>
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1">
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
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.biomass')}</span>
                    <span className="text-sm font-black text-white">
                      {formatNumber(pond.biomassKg)} <span className="text-[10px] text-slate-400">kg</span>
                    </span>
                  </div>

                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.count')}</span>
                    <span className="text-sm font-black text-white">
                      {formatNumber(pond.fishCount)} <span className="text-[10px] text-slate-400">قطعه</span>
                    </span>
                  </div>

                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.avgWeight')}</span>
                    <span className="text-sm font-black text-amber-400">
                      {pond.averageWeightKg} <span className="text-[10px] text-slate-400">kg</span>
                    </span>
                  </div>

                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">{t('pond.fcr')}</span>
                    <span className={`text-sm font-black ${pond.fcr > 1.3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {pond.fcr}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400 text-[11px]">DO:</span>
                    <strong className={`font-bold ${pond.dissolvedOxygen < 4 ? 'text-rose-400' : 'text-cyan-300'}`}>
                      {pond.dissolvedOxygen} mg/L
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-400 text-[11px]">سنسور:</span>
                    <strong className="font-bold text-orange-300">{pond.waterTemperature}°C</strong>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>pH:</span>
                    <strong className="text-slate-200">{pond.ph}</strong>
                  </div>
                </div>

                {manual.lastManualSnapshotAt && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-amber-300 flex items-center gap-1"><ClipboardPen className="w-3.5 h-3.5" /> آخرین آمار دستی</span>
                      <span className="text-[10px] text-slate-500">{formatDate(manual.lastManualSnapshotAt)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                      <span className="text-slate-400">دمای دستی: <strong className="text-orange-200">{manual.manualWaterTemperature ?? '—'}°C</strong></span>
                      <span className="text-slate-400">گونه‌ها: <strong className="text-white">{manualGroups.length || 1}</strong></span>
                      <span className="text-slate-400">نر / ماده: <strong className="text-white">{manualMale} / {manualFemale}</strong></span>
                      <span className="text-slate-400">نامشخص: <strong className="text-white">{manualUnknown}</strong></span>
                      <span className="text-slate-400">چیپ: <strong className="text-cyan-200">{manualChips}</strong></span>
                      <span className="text-slate-400">ابعاد: <strong className="text-violet-200">{dimensions}</strong></span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate" title={manual.manualSnapshotNotes}>{manual.manualSnapshotNotes}</div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
                {isStopped ? (
                  <button
                    onClick={() => {
                      const result = resumePondFeeding(pond.id, currentUser?.fullName || 'مدیر مزرعه');
                      if (!result.success && result.error) alert(result.error);
                    }}
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

                <div className="flex items-center gap-1">
                  <button
                    disabled={!canEditPond}
                    onClick={() => setSnapshotModalPond(pond)}
                    title="ثبت آمار دستی استخر"
                    className="p-2 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-amber-300 rounded-xl transition-colors cursor-pointer border border-amber-500/30"
                  >
                    <ClipboardPen className="w-4 h-4" />
                  </button>

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

                  <button
                    onClick={() => {
                      const groups = pondStockGroups(pond).filter((group) => group.count > 0);
                      const firstGroup = groups[0];
                      setMortalityModalPond(pond);
                      setMortalityStockKey(firstGroup ? stockKey(firstGroup.speciesId, firstGroup.sex) : '');
                      setMortalityChipSelection('');
                      setMortalityCount(1);
                      setMortalityWeightKg(firstGroup?.averageWeightKg || pond.averageWeightKg);
                    }}
                    title={t('pond.quickMortality')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl transition-colors cursor-pointer border border-slate-700"
                  >
                    <Skull className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      const groups = pondStockGroups(pond).filter((group) => group.count > 0);
                      const firstGroup = groups[0];
                      setTransferModalPond(pond);
                      setTransferStockKey(firstGroup ? stockKey(firstGroup.speciesId, firstGroup.sex) : '');
                      setTransferChipSelection('');
                      setTransferCount(Math.min(10, firstGroup?.count || pond.fishCount));
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

      {snapshotModalPond && (
        <PondManualSnapshotModal
          pond={snapshotModalPond}
          species={species}
          onClose={() => setSnapshotModalPond(null)}
          onSave={(input) => handleManualSnapshotSave(snapshotModalPond, input)}
        />
      )}

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
                  onChange={(e) => setStopReason(e.target.value as Pond['stopFeedingReason'])}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-rose-500"
                >
                  <option value="Low Oxygen">افت شدید اکسیژن (Low Oxygen)</option>
                  <option value="Treatment">حمام دارویی و درمان (Treatment)</option>
                  <option value="Handling">سونوگرافی / بیومتری (Handling)</option>
                  <option value="Transfer">جابجایی و سورتینگ (Transfer)</option>
                  <option value="Low Temperature">افت دمای آب (Low Temperature)</option>
                  <option value="Disease">مشاهده علائم بیماری (Disease)</option>
                  <option value="Manual Decision">تصمیم کارشناس کشیک (Manual Decision)</option>
                  <option value="Other">سایر</option>
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
                  min="0.001"
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
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  گروه گونه / جنسیت:
                </label>
                <select
                  value={selectedMortalityStock ? stockKey(selectedMortalityStock.speciesId, selectedMortalityStock.sex) : ''}
                  onChange={(e) => {
                    setMortalityStockKey(e.target.value);
                    setMortalityChipSelection('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-rose-500"
                  required
                >
                  {mortalityStockGroups.map((group) => (
                    <option key={stockKey(group.speciesId, group.sex)} value={stockKey(group.speciesId, group.sex)}>
                      {speciesLabel(group.speciesId)} · {group.sex} · {group.count} قطعه · {group.averageWeightKg} kg
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    تعداد تلفات (قطعه):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedMortalityStock?.count || mortalityModalPond.fishCount}
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
                    min="0"
                    max={mortalityModalPond.biomassKg}
                    step="0.1"
                    value={mortalityWeightKg}
                    onChange={(e) => setMortalityWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              {selectedMortalityStock?.chipNumbers?.length ? (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Chip ماهیان تلف‌شده:
                  </label>
                  <textarea
                    rows={2}
                    value={mortalityChipSelection}
                    onChange={(e) => setMortalityChipSelection(e.target.value)}
                    placeholder={selectedMortalityStock.chipNumbers.join(', ')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Chipهای ثبت‌شده این گروه: {selectedMortalityStock.chipNumbers.join(' · ')}
                  </span>
                </div>
              ) : null}

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
                  گروه گونه / جنسیت:
                </label>
                <select
                  value={selectedTransferStock ? stockKey(selectedTransferStock.speciesId, selectedTransferStock.sex) : ''}
                  onChange={(e) => {
                    setTransferStockKey(e.target.value);
                    setTransferChipSelection('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-blue-500"
                  required
                >
                  {transferStockGroups.map((group) => (
                    <option key={stockKey(group.speciesId, group.sex)} value={stockKey(group.speciesId, group.sex)}>
                      {speciesLabel(group.speciesId)} · {group.sex} · {group.count} قطعه · {group.averageWeightKg} kg
                    </option>
                  ))}
                </select>
              </div>

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
                  max={selectedTransferStock?.count || transferModalPond.fishCount}
                  value={transferCount}
                  onChange={(e) => setTransferCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-blue-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  وزن بیوماس کل انتقالی: {(transferCount * (selectedTransferStock?.averageWeightKg || transferModalPond.averageWeightKg)).toFixed(1)} kg
                </span>
              </div>

              {selectedTransferStock?.chipNumbers?.length ? (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Chip ماهیان انتقالی:
                  </label>
                  <textarea
                    rows={2}
                    value={transferChipSelection}
                    onChange={(e) => setTransferChipSelection(e.target.value)}
                    placeholder={selectedTransferStock.chipNumbers.join(', ')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Chipهای ثبت‌شده این گروه: {selectedTransferStock.chipNumbers.join(' · ')}
                  </span>
                </div>
              ) : null}

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
