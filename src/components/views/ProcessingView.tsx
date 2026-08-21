import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  Scissors,
  Snowflake,
  Plus,
  ShieldCheck,
  Package,
  Layers,
  Thermometer,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export const ProcessingView: React.FC = () => {
  const { t, formatNumber, formatDate } = useI18n();
  const {
    processingBatches,
    coldStorage,
    ponds,
    createProcessingBatch,
  } = useFarm();

  const [activeTab, setActiveTab] = useState<'processing' | 'coldStorage'>('processing');
  const [showNewBatchModal, setShowNewBatchModal] = useState<boolean>(false);

  // Form state
  const [sourcePondId, setSourcePondId] = useState<string>('');
  const [fishCount, setFishCount] = useState<number>(0);
  const [liveBiomassKg, setLiveBiomassKg] = useState<number>(0);
  const [caviarYieldKg, setCaviarYieldKg] = useState<number>(0);
  const [filletYieldKg, setFilletYieldKg] = useState<number>(0);
  const [smokedYieldKg, setSmokedYieldKg] = useState<number>(0);
  const [caviarGrade, setCaviarGrade] = useState<string>('Imperial Beluga (50g/100g)');
  const [operatorName, setOperatorName] = useState<string>('');
  const [citesNumber, setCitesNumber] = useState<string>('');

  const totalCaviarStockKg = coldStorage.filter((c) => c.productType.includes('Caviar')).reduce((s, c) => s + c.weightKg, 0);
  const totalMeatStockKg = coldStorage.filter((c) => c.productType.includes('Fillet')).reduce((s, c) => s + c.weightKg, 0);
  const batchesWithYield = processingBatches.filter((batch) => batch.liveBiomassKg > 0);
  const averageCaviarYield = batchesWithYield.length ? batchesWithYield.reduce((sum, batch) => sum + (batch.caviarYieldKg / batch.liveBiomassKg) * 100, 0) / batchesWithYield.length : null;
  const citesCount = processingBatches.filter((batch) => Boolean(batch.citesPermitNumber?.trim())).length;

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const sourcePond = ponds.find((p) => p.id === sourcePondId);
    const waste = Math.max(0, liveBiomassKg - (caviarYieldKg + filletYieldKg + smokedYieldKg));

    const result = createProcessingBatch({
      batchCode: `CAVIAR-LOT-${new Date().toISOString().slice(0, 7)}-B${processingBatches.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      sourcePondId: sourcePond?.id || '',
      sourcePondName: sourcePond?.name || '',
      speciesName: '',
      fishCount: Number(fishCount),
      liveBiomassKg: Number(liveBiomassKg),
      caviarYieldKg: Number(caviarYieldKg),
      caviarGrade,
      filletMeatYieldKg: Number(filletYieldKg),
      smokedMeatYieldKg: Number(smokedYieldKg),
      byProductAndWasteKg: Number(waste.toFixed(1)),
      operatorName,
      qualityScore: 0,
      citesPermitNumber: citesNumber,
      status: 'Stored In Cold Room',
    });

    if (result.success) setShowNewBatchModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Scissors className="w-6 h-6 text-amber-400" />
            فرآوری خاویار، گوشت و سردخانه زیر صفر
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            استحصال خاویار رویال و امپریال، محاسبه راندمان بازدهی، بسته‌بندی، مجوز سایتس CITES و پالت‌های سردخانه
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'processing'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            بچ‌های فرآوری و استحصال ({processingBatches.length})
          </button>
          <button
            onClick={() => setActiveTab('coldStorage')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'coldStorage'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            پالت‌های سردخانه ({coldStorage.length})
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block mb-1">موجودی خاویار آماده در سردخانه</span>
          <span className="text-xl font-black text-amber-400">
            {formatNumber(totalCaviarStockKg)} <span className="text-xs text-slate-400">kg</span>
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">
            دمای نگهداری استاندارد: -2.8°C
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block mb-1">موجودی فیله وکیوم گوشت</span>
          <span className="text-xl font-black text-cyan-400">
            {formatNumber(totalMeatStockKg)} <span className="text-xs text-slate-400">kg</span>
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">
            فریزر انجماد سریع: -18°C
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block mb-1">میانگین راندمان خاویار</span>
          <span className="text-xl font-black text-emerald-400">{averageCaviarYield === null ? '—' : `${averageCaviarYield.toFixed(2)}%`}</span>
          <span className="text-[11px] text-slate-400 block mt-1">
            از وزن زنده فیل‌ماهی
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block mb-1">وضعیت گواهینامه‌های CITES</span>
          <span className="text-xl font-black text-white flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            {processingBatches.length ? `${citesCount}/${processingBatches.length}` : '—'}
          </span>
          <span className="text-[11px] text-emerald-400 block mt-1">
            وضعیت مجوز بر اساس پرونده‌های ثبت‌شده
          </span>
        </div>
      </div>

      {/* TAB 1: Processing Batches */}
      {activeTab === 'processing' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewBatchModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              ثبت عملیات جدید استحصال خاویار و کشتار
            </button>
          </div>

          <div className="space-y-4">
            {processingBatches.map((batch) => (
              <div
                key={batch.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {batch.batchCode}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        امتیاز کیفی: {batch.qualityScore}/100
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      تاریخ فرآوری: {batch.date} | منبع: {batch.sourcePondName} ({batch.speciesName})
                    </span>
                  </div>

                  <span className="text-xs font-mono text-cyan-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    مجوز سایتس: {batch.citesPermitNumber}
                  </span>
                </div>

                {/* Yield Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">وزن زنده ماهیان</span>
                    <span className="text-base font-bold text-white">
                      {formatNumber(batch.liveBiomassKg)} kg ({batch.fishCount} قطعه)
                    </span>
                  </div>

                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                    <span className="text-[11px] text-amber-300 block">خاویار استحصال شده</span>
                    <span className="text-base font-black text-amber-400">
                      {batch.caviarYieldKg} kg ({batch.caviarYieldPercent}%)
                    </span>
                    <span className="text-[10px] text-amber-200 block truncate">{batch.caviarGrade}</span>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">فیله گوشت تازه</span>
                    <span className="text-base font-bold text-cyan-400">
                      {batch.filletMeatYieldKg} kg ({batch.filletYieldPercent}%)
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">سرممیز فرآوری</span>
                    <span className="text-xs font-semibold text-slate-200 block truncate">
                      {batch.operatorName}
                    </span>
                    <span className="text-[10px] text-emerald-400">{batch.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Cold Storage Pallets */}
      {activeTab === 'coldStorage' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coldStorage.map((pallet) => (
            <div
              key={pallet.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono font-bold text-white text-sm">{pallet.slotCode}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                    pallet.temperatureC > -10
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  <Thermometer className="w-3.5 h-3.5" />
                  {pallet.temperatureC}°C
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">نوع محصول:</span>
                  <strong className="text-white">{pallet.productType}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">کد بچ مادر:</span>
                  <span className="font-mono text-amber-400">{pallet.batchCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">وزن کل پالت:</span>
                  <strong className="text-white">{pallet.weightKg} kg</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">تعداد قوطی / بسته:</span>
                  <strong className="text-white">{pallet.unitsCount} ({pallet.packagingUnit})</strong>
                </div>
                {pallet.ownerCustomer && (
                  <div className="flex justify-between text-amber-300 pt-1 border-t border-slate-800">
                    <span>مشتری رزرو کننده:</span>
                    <strong className="truncate max-w-[160px]">{pallet.ownerCustomer}</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Processing Batch */}
      {showNewBatchModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Scissors className="w-5 h-5 text-amber-400" />
              ثبت بچ جدید فرآوری و استحصال خاویار
            </h3>

            <form onSubmit={handleCreateBatch} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">استخر مبدا ماهی:</label>
                  <select
                    value={sourcePondId}
                    onChange={(e) => setSourcePondId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    {ponds.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">تعداد ماهی کشتار شده:</label>
                  <input
                    type="number"
                    min="1"
                    value={fishCount}
                    onChange={(e) => setFishCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">وزن زنده کل (kg):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={liveBiomassKg}
                    onChange={(e) => setLiveBiomassKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">خاویار خالص (kg):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={caviarYieldKg}
                    onChange={(e) => setCaviarYieldKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">فیله گوشت (kg):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={filletYieldKg}
                    onChange={(e) => setFilletYieldKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-cyan-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">گرید و درجه خاویار:</label>
                <select
                  value={caviarGrade}
                  onChange={(e) => setCaviarGrade(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="Imperial Beluga (50g/100g)">امپریال بلوگا (دانه‌بندی بالای ۳.۴ میلی‌متر)</option>
                  <option value="Royal Beluga">رویال بلوگا</option>
                  <option value="Asetra Gold (Persian/Russian)">استرا طلایی (تاس‌ماهی ایرانی)</option>
                  <option value="Baerii Classic">سیبری کلاسیک</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">شماره مجوز سایتس CITES:</label>
                <input
                  type="text"
                  value={citesNumber}
                  onChange={(e) => setCitesNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBatchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  ثبت بچ و انتقال به سردخانه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
