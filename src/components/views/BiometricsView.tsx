import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Scale, Trash2, TrendingUp } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { pondStockGroups } from '../../utils/pondStockLedger';

interface SampleDraft { weightKg: string; lengthCm: string; }

export const BiometricsView: React.FC = () => {
  const { formatNumber } = useI18n();
  const { ponds, species, biometricSessions, recordBiometry } = useFarm();
  const [selectedPondId, setSelectedPondId] = useState(ponds[0]?.id || '');
  const [stockKey, setStockKey] = useState('');
  const [operator, setOperator] = useState('');
  const [notes, setNotes] = useState('');
  const [samples, setSamples] = useState<SampleDraft[]>([{ weightKg: '', lengthCm: '' }, { weightKg: '', lengthCm: '' }, { weightKg: '', lengthCm: '' }]);
  const [showForm, setShowForm] = useState(false);

  const validSamples = useMemo(() => samples
    .map((sample) => ({ weightKg: Number(sample.weightKg), lengthCm: sample.lengthCm.trim() ? Number(sample.lengthCm) : undefined }))
    .filter((sample) => Number.isFinite(sample.weightKg) && sample.weightKg > 0 && (sample.lengthCm === undefined || (Number.isFinite(sample.lengthCm) && sample.lengthCm > 0))), [samples]);

  const stats = useMemo(() => {
    if (!validSamples.length) return null;
    const weights = validSamples.map((sample) => sample.weightKg);
    const mean = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const variance = weights.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / weights.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean * 100 : 0;
    return { mean, cv, min: Math.min(...weights), max: Math.max(...weights) };
  }, [validSamples]);

  const selectedPond = ponds.find((pond) => pond.id === selectedPondId);
  const stockGroups = useMemo(() => selectedPond ? pondStockGroups(selectedPond).filter((group) => group.count > 0) : [], [selectedPond]);
  const selectedStock = stockGroups.find((group) => `${group.speciesId}|${group.sex}` === stockKey) || stockGroups[0];

  useEffect(() => {
    if (!stockGroups.length) { setStockKey(''); return; }
    if (!stockGroups.some((group) => `${group.speciesId}|${group.sex}` === stockKey)) {
      setStockKey(`${stockGroups[0].speciesId}|${stockGroups[0].sex}`);
    }
  }, [selectedPondId, stockGroups, stockKey]);

  const speciesLabel = (speciesId: string) => {
    const item = species.find((row) => row.id === speciesId);
    return item?.faName || item?.scientificName || speciesId;
  };

  const updateSample = (index: number, field: keyof SampleDraft, value: string) => {
    setSamples((previous) => previous.map((sample, sampleIndex) => sampleIndex === index ? { ...sample, [field]: value } : sample));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPond || !selectedStock || validSamples.length < 1 || !operator.trim()) return;
    recordBiometry({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      speciesId: selectedStock.speciesId,
      stockSex: selectedStock.sex,
      date: new Date().toISOString().split('T')[0],
      sampleCount: validSamples.length,
      samples: validSamples,
      previousAvgWeightKg: selectedStock.averageWeightKg,
      daysSinceLastBiometry: 0,
      operatorName: operator.trim(),
      notes: notes.trim() || `نمونه‌گیری واقعی گروه ${speciesLabel(selectedStock.speciesId)} / ${selectedStock.sex} شامل ${validSamples.length} قطعه؛ طول فقط در صورت اندازه‌گیری مستقیم ثبت شده است.`,
    });
    setSamples([{ weightKg: '', lengthCm: '' }, { weightKg: '', lengthCm: '' }, { weightKg: '', lengthCm: '' }]);
    setNotes('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Scale className="w-6 h-6 text-amber-400" />بیومتری واقعی چندنمونه‌ای</h1><p className="text-xs text-slate-400 mt-1">هر وزن یک نمونه مستقل است؛ در استخرهای مختلط، بیومتری روی گروه دقیق گونه/جنس ثبت می‌شود و جمع استخر از Ledger دوباره محاسبه می‌شود.</p></div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" />ثبت بیومتری</button>
      </div>

      <div className="space-y-3">
        {biometricSessions.map((session) => {
          const weights = session.samples.map((sample) => sample.weightKg).filter((value) => Number.isFinite(value) && value > 0);
          const mean = weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : 0;
          const variance = weights.length ? weights.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / weights.length : 0;
          const cv = mean > 0 ? Math.sqrt(variance) / mean * 100 : null;
          return <div key={session.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div><strong className="text-white">{session.pondName}</strong><span className="text-xs text-slate-500 mr-2">{session.date}</span><span className="text-[10px] text-cyan-300 mr-2">{speciesLabel(session.speciesId)} · {session.stockSex || 'Unknown'}</span></div><span className="text-xs text-slate-400">{session.sampleCount} نمونه · {session.operatorName}</span></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">میانگین وزن</span><strong className="text-amber-400">{formatNumber(session.averageWeightKg)} kg</strong></div>
              <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">کمینه</span><strong className="text-white">{formatNumber(session.minWeightKg)} kg</strong></div>
              <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">بیشینه</span><strong className="text-white">{formatNumber(session.maxWeightKg)} kg</strong></div>
              <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">CV واقعی</span><strong className="text-cyan-400">{cv === null ? '—' : `${cv.toFixed(2)}%`}</strong></div>
              <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">SGR</span><strong className="text-emerald-400">{Number.isFinite(session.sgr) ? `${session.sgr}%/day` : '—'}</strong></div>
            </div>
          </div>;
        })}
      </div>

      {showForm && <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-amber-400" />ثبت نمونه‌های واقعی</h2>
        <form onSubmit={submit} className="space-y-4 text-xs">
          <div className="grid md:grid-cols-3 gap-3"><div><label className="text-slate-400 block mb-1">استخر</label><select value={selectedPondId} onChange={(event) => setSelectedPondId(event.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></div><div><label className="text-slate-400 block mb-1">گروه زیستی</label><select value={selectedStock ? `${selectedStock.speciesId}|${selectedStock.sex}` : ''} onChange={(event) => setStockKey(event.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="">انتخاب...</option>{stockGroups.map((group) => <option key={`${group.speciesId}|${group.sex}`} value={`${group.speciesId}|${group.sex}`}>{speciesLabel(group.speciesId)} · {group.sex} · {group.count} قطعه · {group.averageWeightKg} kg</option>)}</select></div><div><label className="text-slate-400 block mb-1">کارشناس</label><input value={operator} onChange={(event) => setOperator(event.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></div></div>
          <div className="space-y-2"><div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 text-[10px] text-slate-500 px-1"><span>#</span><span>وزن واقعی (kg)</span><span>طول واقعی (cm، اختیاری)</span><span /></div>{samples.map((sample, index) => <div key={index} className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 items-center"><span className="text-slate-500 text-center">{index + 1}</span><input type="number" min="0.001" step="0.001" value={sample.weightKg} onChange={(event) => updateSample(index, 'weightKg', event.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" /><input type="number" min="0.1" step="0.1" value={sample.lengthCm} onChange={(event) => updateSample(index, 'lengthCm', event.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" /><button type="button" disabled={samples.length <= 1} onClick={() => setSamples((previous) => previous.filter((_, i) => i !== index))} className="text-rose-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button></div>)}</div>
          <button type="button" onClick={() => setSamples((previous) => [...previous, { weightKg: '', lengthCm: '' }])} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200">+ افزودن نمونه</button>
          {stats && <div className="grid grid-cols-4 gap-2 bg-slate-950 rounded-xl p-3"><div><span className="text-slate-500 block">تعداد معتبر</span><strong className="text-white">{validSamples.length}</strong></div><div><span className="text-slate-500 block">میانگین</span><strong className="text-amber-400">{stats.mean.toFixed(3)}</strong></div><div><span className="text-slate-500 block">دامنه</span><strong className="text-white">{stats.min.toFixed(3)}–{stats.max.toFixed(3)}</strong></div><div><span className="text-slate-500 block">CV</span><strong className="text-cyan-400">{stats.cv.toFixed(2)}%</strong></div></div>}
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="یادداشت نمونه‌گیری..." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" />
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" disabled={!selectedPond || !selectedStock || validSamples.length < 1 || !operator.trim()} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl disabled:opacity-40">ثبت {validSamples.length} نمونه</button></div>
        </form>
      </div></div>}
    </div>
  );
};
