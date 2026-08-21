import React, { useState } from 'react';
import { nextId } from '../../utils/id';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { DynamicTranslatedText } from '../common/DynamicTranslatedText';
import {
  Egg,
  Fish,
  Search,
  Plus,
  Sparkles,
  GitBranch,
  CheckCircle2,
  Calendar,
  Activity,
  Droplets,
  Layers,
  Thermometer,
} from 'lucide-react';
import { BroodstockFish, FertilizationBatch } from '../../types';

export const HatcheryView: React.FC = () => {
  const { t, formatNumber, formatDate } = useI18n();
  const {
    broodstock,
    fertilizations,
    incubators,
    larvae,
    species,
    addBroodstock,
    recordFertilization,
    processingBatches,
    coldStorage,
  } = useFarm();

  const [activeTab, setActiveTab] = useState<'broodstock' | 'fertilization' | 'incubators' | 'larvae' | 'traceability'>('broodstock');
  const [searchChip, setSearchChip] = useState<string>('');
  const [traceLotCode, setTraceLotCode] = useState<string>('');
  const [traceResult, setTraceResult] = useState<any>(null);

  // New Broodstock Form state
  const [showAddBrood, setShowAddBrood] = useState<boolean>(false);
  const [newChip, setNewChip] = useState<string>('');
  const [newPlate, setNewPlate] = useState<string>('');
  const [newSex, setNewSex] = useState<'Female' | 'Male'>('Female');
  const [newSpeciesId, setNewSpeciesId] = useState<string>('sp_beluga');
  const [newWeight, setNewWeight] = useState<number>(0);
  const [newEggDia, setNewEggDia] = useState<number>(0);
  const [newPI, setNewPI] = useState<number>(0);
  const [newMotility, setNewMotility] = useState<number>(0);

  const handleAddBrood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChip.trim() || !newPlate.trim()) return;
    const sp = species.find((s) => s.id === newSpeciesId);
    if (!sp || !Number.isFinite(newWeight) || newWeight <= 0) return;
    addBroodstock({
      chipNumber: newChip.trim(),
      plateNumber: newPlate.trim(),
      sex: newSex,
      speciesId: newSpeciesId,
      speciesName: sp.faName,
      geneticLine: '',
      origin: '',
      estimatedAgeYears: 0,
      weightKg: Number(newWeight),
      lengthCm: 0,
      maturityStage: 'Not Assessed',
      lastUltrasoundDate: undefined,
      ultrasoundEggDiameterMm: newSex === 'Female' && newEggDia > 0 ? Number(newEggDia) : undefined,
      ultrasoundPolarizationIndex: newSex === 'Female' && newPI > 0 ? Number(newPI) : undefined,
      spermMotilityPercent: newSex === 'Male' && newMotility > 0 ? Number(newMotility) : undefined,
      status: 'Active Broodstock',
      historyNotes: '',
    });
    setShowAddBrood(false);
    setNewChip('');
    setNewPlate('');
  };

  const handleExecuteReverseTrace = (e: React.FormEvent) => {
    e.preventDefault();
    const batch = processingBatches.find((b) => b.batchCode.toLowerCase() === traceLotCode.trim().toLowerCase());
    if (batch) {
      const pallet = coldStorage.find((c) => c.batchCode.toLowerCase() === traceLotCode.trim().toLowerCase());
      const fertilization = fertilizations.find((item) => item.batchCode.toLowerCase() === traceLotCode.trim().toLowerCase());
      const larvalBatch = fertilization ? larvae.find((item) => item.fertilizationBatchId === fertilization.id) : undefined;
      const incubationBatch = fertilization ? incubators.find((item) => item.currentBatchId === fertilization.id) : undefined;
      setTraceResult({
        found: true,
        batch,
        pallet,
        femaleBroodstock: fertilization ? broodstock.find((fish) => fertilization.femaleIds.includes(fish.id)) : undefined,
        maleBroodstock: fertilization ? broodstock.find((fish) => fertilization.maleIds.includes(fish.id)) : undefined,
        incubationBatch,
        larvalBatch,
      });
    } else {
      setTraceResult({ found: false });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Egg className="w-6 h-6 text-amber-400" />
            {t('hatchery.title')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('hatchery.subtitle')}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'broodstock', label: t('hatchery.broodstockTab') },
            { id: 'fertilization', label: t('hatchery.fertilizationTab') },
            { id: 'incubators', label: 'دستگاه‌های انکوباتور' },
            { id: 'larvae', label: t('hatchery.larvaeTab') },
            { id: 'traceability', label: t('hatchery.traceabilityTab') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Broodstock Register */}
      {activeTab === 'broodstock' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="جستجوی کد میکروچیپ RFID یا پلاک..."
                value={searchChip}
                onChange={(e) => setSearchChip(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => setShowAddBrood(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              ثبت مولد نخبه جدید (RFID)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {broodstock
              .filter(
                (b) =>
                  searchChip === '' ||
                  b.chipNumber.includes(searchChip) ||
                  b.plateNumber.toLowerCase().includes(searchChip.toLowerCase())
              )
              .map((fish) => (
                <div
                  key={fish.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-400 block">
                        RFID: {fish.chipNumber}
                      </span>
                      <span className="text-[11px] text-slate-300 font-semibold">
                        پلاک: {fish.plateNumber}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        fish.sex === 'Female'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      {fish.sex === 'Female' ? 'ماده (تخم‌ریز خاویار)' : 'نر (اسپرم‌دهنده)'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white">
                    {fish.speciesName} — <span className="text-slate-400 font-normal">{fish.geneticLine}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      وزن: <strong className="text-slate-200">{fish.weightKg} kg</strong>
                    </div>
                    <div>
                      طول کل: <strong className="text-slate-200">{fish.lengthCm} cm</strong>
                    </div>

                    {fish.sex === 'Female' ? (
                      <>
                        <div>
                          قطر تخمک: <strong className="text-amber-400">{fish.ultrasoundEggDiameterMm} mm</strong>
                        </div>
                        <div>
                          شاخص قطبیت (PI): <strong className="text-emerald-400">{fish.ultrasoundPolarizationIndex}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          تحرک اسپرم: <strong className="text-emerald-400">{fish.spermMotilityPercent}%</strong>
                        </div>
                        <div>
                          تراکم: <strong className="text-blue-300">{fish.spermConcentrationBillionPerMl}B/ml</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    <DynamicTranslatedText
                      text={fish.historyNotes || ''}
                      recordId={fish.id}
                      fieldName="historyNotes"
                      showIndicator={true}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: Fertilization & Spawning */}
      {activeTab === 'fertilization' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            بچ‌های لقاح مصنوعی و تخم‌ریزی
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase border-b border-slate-700">
                <tr>
                  <th className="p-3">کد بچ لقاح</th>
                  <th className="p-3">تاریخ</th>
                  <th className="p-3">گونه</th>
                  <th className="p-3">وزن تخم (kg)</th>
                  <th className="p-3">تعداد تخم تخمینی</th>
                  <th className="p-3">درصد لقاح</th>
                  <th className="p-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fertilizations.map((fert) => (
                  <tr key={fert.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-amber-400">{fert.batchCode}</td>
                    <td className="p-3 text-slate-300">{fert.date}</td>
                    <td className="p-3 font-semibold text-white">{fert.speciesName}</td>
                    <td className="p-3 text-slate-300">{fert.totalEggWeightKg} kg</td>
                    <td className="p-3 text-slate-300">{formatNumber(fert.estimatedEggCount)}</td>
                    <td className="p-3 font-bold text-emerald-400">{fert.fertilizationRatePercent}%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        {fert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Incubators */}
      {activeTab === 'incubators' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incubators.map((inc) => (
            <div
              key={inc.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-white">{inc.code}</span>
                <span className="text-xs text-amber-400 font-mono">{inc.type}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  تخم فعال: <strong className="text-white">{formatNumber(inc.eggCount)}</strong>
                </div>
                <div>
                  دما: <strong className="text-orange-400">{inc.temperatureC}°C</strong>
                </div>
                <div>
                  اکسیژن: <strong className="text-cyan-400">{inc.doMgL} mg/L</strong>
                </div>
                <div>
                  دبی آب: <strong className="text-blue-300">{inc.waterFlowLpm} L/min</strong>
                </div>
                <div>
                  تخم‌های مرده: <strong className="text-rose-400">{formatNumber(inc.deadEggCount)}</strong>
                </div>
                <div>
                  درصد تفریخ: <strong className="text-emerald-400">{inc.estimatedHatchPercent}%</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: Larvae */}
      {activeTab === 'larvae' && (
        <div className="space-y-4">
          {larvae.map((larva) => (
            <div
              key={larva.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <span className="font-mono font-bold text-amber-400 text-sm">{larva.batchCode}</span>
                  <span className="text-xs text-slate-400 mr-2">{larva.speciesName}</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  {larva.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  تعداد لارو: <strong className="text-white">{formatNumber(larva.larvalCount)}</strong>
                </div>
                <div>
                  درصد بقا: <strong className="text-emerald-400">{larva.survivalRatePercent}%</strong>
                </div>
                <div>
                  درصد ناهنجاری: <strong className="text-slate-300">{larva.deformityPercent}%</strong>
                </div>
                <div>
                  خوراک آغازین: <strong className="text-amber-300">{larva.initialFeedType}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: Reverse Traceability Query Engine */}
      {activeTab === 'traceability' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-amber-400" />
              موتور ردیابی معکوس ژنتیک و شجره‌نامه خاویار (Reverse Traceability)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ورود شماره بچ خاویار صادراتی و استخراج بلادرنگ مشخصات مولدین مادر/پدر RFID، انکوباتور، استخر و گواهی سایتس CITES
            </p>
          </div>

          <form onSubmit={handleExecuteReverseTrace} className="flex gap-2 max-w-xl">
            <input
              type="text"
              value={traceLotCode}
              onChange={(e) => setTraceLotCode(e.target.value)}
              placeholder="مثال: CAVIAR-LOT-2026-08-B1"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-amber-500"
              required
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20"
            >
              استعلام شجره‌نامه
            </button>
          </form>

          {traceResult && traceResult.found && (
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{traceResult.femaleBroodstock && traceResult.maleBroodstock && traceResult.incubationBatch && traceResult.larvalBatch && traceResult.pallet ? 'شجره‌نامه ژنتیکی و زنجیره تأمین تأیید شد' : 'بخشی از زنجیره یافت شد؛ داده‌های تکمیلی ثبت نشده است'}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  مجوز سایتس: {traceResult.batch.citesPermitNumber}
                </span>
              </div>

              {/* Chain Steps */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {/* Step 1: Broodstock Parents */}
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-400 block">۱. مولدین والد (RFID)</span>
                  <div>مادر: <strong className="text-white">{traceResult.femaleBroodstock?.chipNumber || 'ثبت نشده'}</strong></div>
                  <div>پدر: <strong className="text-white">{traceResult.maleBroodstock?.chipNumber || 'ثبت نشده'}</strong></div>
                  <div className="text-[10px] text-slate-400">{traceResult.femaleBroodstock?.geneticLine || 'خط ژنتیکی ثبت نشده'}</div>
                </div>

                {/* Step 2: Fertilization & Incubation */}
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-400 block">۲. انکوباسیون و تفریخ</span>
                  <div>دستگاه: <strong className="text-white">{traceResult.incubationBatch?.code || 'ثبت نشده'}</strong></div>
                  <div>درصد تفریخ: <strong className="text-emerald-400">{traceResult.incubationBatch ? `${traceResult.incubationBatch.estimatedHatchPercent}%` : 'ثبت نشده'}</strong></div>
                  <div className="text-[10px] text-slate-400">تاریخ: {traceResult.larvalBatch?.hatchDate || 'ثبت نشده'}</div>
                </div>

                {/* Step 3: Rearing Pond */}
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 block">۳. استخر پرورشی</span>
                  <div>استخر: <strong className="text-white">{traceResult.batch.sourcePondName}</strong></div>
                  <div>بیوماس صید شده: <strong className="text-white">{traceResult.batch.liveBiomassKg} kg</strong></div>
                  <div className="text-[10px] text-slate-400">تعداد: {traceResult.batch.fishCount} قطعه</div>
                </div>

                {/* Step 4: Caviar Extraction & Yield */}
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-400 block">۴. استحصال و قوطی‌گذاری</span>
                  <div>خاویار خالص: <strong className="text-amber-300">{traceResult.batch.caviarYieldKg} kg ({traceResult.batch.caviarYieldPercent}%)</strong></div>
                  <div>گرید: <strong className="text-white">{traceResult.batch.caviarGrade}</strong></div>
                  <div className="text-[10px] text-cyan-300">سردخانه: {traceResult.pallet?.slotCode || 'ثبت نشده'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Broodstock Modal */}
      {showAddBrood && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Egg className="w-5 h-5 text-amber-400" />
              ثبت مولد جدید در شناسنامه ژنتیکی مزرعه
            </h3>

            <form onSubmit={handleAddBrood} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">کد میکروچیپ RFID:</label>
                  <input
                    type="text"
                    value={newChip}
                    onChange={(e) => setNewChip(e.target.value)}
                    placeholder="982000..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">پلاک شناسایی:</label>
                  <input
                    type="text"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="FA-BEL-009"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">جنسیت:</label>
                  <select
                    value={newSex}
                    onChange={(e) => setNewSex(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="Female">ماده (تخم‌ریز خاویار)</option>
                    <option value="Male">نر (اسپرم‌دهنده)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">گونه:</label>
                  <select
                    value={newSpeciesId}
                    onChange={(e) => setNewSpeciesId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    {species.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.faName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">وزن (kg):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>
                {newSex === 'Female' ? (
                  <>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">قطر تخمک (mm):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={newEggDia}
                        onChange={(e) => setNewEggDia(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">شاخص قطبیت (PI):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPI}
                        onChange={(e) => setNewPI(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-slate-300 font-bold mb-1">تحرک اسپرم (%):</label>
                    <input
                      type="number"
                      value={newMotility}
                      onChange={(e) => setNewMotility(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBrood(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  ثبت مولد در سامانه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
