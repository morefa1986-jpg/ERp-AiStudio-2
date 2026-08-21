import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  TrendingUp,
  Scale,
  Plus,
  Calendar,
  Sparkles,
  Layers,
  ArrowUpRight,
  Fish,
} from 'lucide-react';

export const BiometricsView: React.FC = () => {
  const { t, formatNumber, formatDate } = useI18n();
  const {
    ponds,
    biometricSessions,
    recordBiometry,
  } = useFarm();

  const [selectedPondId, setSelectedPondId] = useState<string>(ponds[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form state
  const [sampleSize, setSampleSize] = useState<number>(1);
  const [avgWeightKg, setAvgWeightKg] = useState<number>(0);
  const [operator, setOperator] = useState<string>('');

  const selectedPond = ponds.find((p) => p.id === selectedPondId);
  const observedSessions = biometricSessions.filter((session) => Number.isFinite(session.sgr));
  const averageSgr = observedSessions.length ? observedSessions.reduce((sum, session) => sum + session.sgr, 0) / observedSessions.length : null;
  const latestSamples = biometricSessions[0]?.samples || [];
  const sampleMean = latestSamples.length ? latestSamples.reduce((sum, sample) => sum + sample.weightKg, 0) / latestSamples.length : 0;
  const sampleVariance = latestSamples.length ? latestSamples.reduce((sum, sample) => sum + ((sample.weightKg - sampleMean) ** 2), 0) / latestSamples.length : 0;
  const coefficientOfVariation = sampleMean > 0 ? (Math.sqrt(sampleVariance) / sampleMean) * 100 : null;

  const handleAddBiometry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPond) return;

    if (!Number.isFinite(avgWeightKg) || avgWeightKg <= 0 || !operator.trim()) return;
    const samples = [{ weightKg: Number(avgWeightKg.toFixed(3)), lengthCm: Math.round(avgWeightKg * 14) }];

    recordBiometry({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      speciesId: selectedPond.speciesId,
      date: new Date().toISOString().split('T')[0],
      sampleCount: 1,
      samples,
      previousAvgWeightKg: selectedPond.averageWeightKg,
      daysSinceLastBiometry: 0,
      operatorName: operator,
      notes: 'ثبت یک اندازه‌گیری دستی؛ برای تحلیل نمونه‌های متعدد، هر اندازه‌گیری جداگانه ثبت شود.',
    });

    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-amber-400" />
            بیومتری، نمونه‌گیری اوزان و محاسبه شاخص رشد SGR
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            پایش نرخ رشد ویژه (Specific Growth Rate)، ضریب تبدیل خوراک (FCR)، توزیع یکنواختی گله و سورتینگ
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          ثبت نمونه‌گیری بیومتری جدید
        </button>
      </div>

      {/* SGR Formula Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">فرمول استاندارد SGR:</h4>
            <span className="font-mono text-slate-400 text-[11px]">
              SGR (%/day) = [(ln(W₂ - Final) - ln(W₁ - Initial)) / Days] × 100
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>میانگین رشد گله: <strong className="text-emerald-400 font-bold">{averageSgr === null ? '—' : `+${averageSgr.toFixed(2)}% / روز`}</strong></div>
          <div>شاخص یکنواختی CV: <strong className="text-cyan-400 font-bold">{coefficientOfVariation === null ? '—' : `${coefficientOfVariation.toFixed(2)}%`}</strong></div>
        </div>
      </div>

      {/* Biometry Records List */}
      <div className="space-y-4">
        {biometricSessions.map((rec) => (
          <div
            key={rec.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{rec.pondName}</span>
                <span className="text-xs text-slate-400">تاریخ: {rec.date}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {rec.sampleCount} عدد نمونه
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">کارشناس: {rec.operatorName}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block">میانگین وزن</span>
                <span className="text-base font-black text-amber-400">
                  {rec.averageWeightKg} kg
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">بیومس تخمینی استخر</span>
                <span className="text-base font-bold text-white">{formatNumber(rec.estimatedBiomassKg)} kg</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">نرخ رشد ویژه SGR</span>
                <span className="text-base font-black text-emerald-400">+{rec.sgr}% / روز</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">دامنه اوزان</span>
                <span className="text-xs font-mono text-slate-300">
                  {rec.minWeightKg}kg - {rec.maxWeightKg}kg
                </span>
              </div>
            </div>

            {rec.notes && (
              <p className="text-[11px] text-slate-400">{rec.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Modal: New Biometry */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              ثبت داده‌های بیومتری و نمونه‌گیری وزن
            </h3>

            <form onSubmit={handleAddBiometry} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">استخر پرورشی:</label>
                <select
                  value={selectedPondId}
                  onChange={(e) => setSelectedPondId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {ponds.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">تعداد نمونه (قطعه):</label>
                  <input
                    type="number"
                    value={sampleSize}
                    onChange={(e) => setSampleSize(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">میانگین وزن (kg):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={avgWeightKg}
                    onChange={(e) => setAvgWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">کارشناس ثبت‌کننده:</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  محاسبه SGR و ثبت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
