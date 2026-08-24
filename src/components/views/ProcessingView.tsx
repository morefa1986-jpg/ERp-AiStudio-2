import React, { useMemo, useState } from 'react';
import { AlertTriangle, Scissors, ShieldCheck, Snowflake, Thermometer } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { ProcessingBatch } from '../../types';

export const ProcessingView: React.FC = () => {
  const { formatNumber } = useI18n();
  const { processingBatches, coldStorage, ponds, species, treatments, createProcessingBatch } = useFarm();
  const [tab, setTab] = useState<'processing' | 'coldStorage'>('processing');
  const [showForm, setShowForm] = useState(false);
  const [sourcePondId, setSourcePondId] = useState('');
  const [processDate, setProcessDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [fishCount, setFishCount] = useState('');
  const [liveBiomassKg, setLiveBiomassKg] = useState('');
  const [caviarYieldKg, setCaviarYieldKg] = useState('');
  const [filletYieldKg, setFilletYieldKg] = useState('');
  const [smokedYieldKg, setSmokedYieldKg] = useState('');
  const [qualityScore, setQualityScore] = useState('');
  const [caviarGrade, setCaviarGrade] = useState<ProcessingBatch['caviarGrade']>('Imperial Beluga (50g/100g)');
  const [operatorName, setOperatorName] = useState('');
  const [citesNumber, setCitesNumber] = useState('');
  const [error, setError] = useState('');

  const sourcePond = ponds.find((pond) => pond.id === sourcePondId);
  const sourceSpecies = species.find((item) => item.id === sourcePond?.speciesId);
  const processTs = new Date(processDate).getTime();
  const blockingTreatment = useMemo(() => treatments.find((treatment) => {
    if (!sourcePondId || treatment.pondId !== sourcePondId) return false;
    if (treatment.status === 'ACTIVE') return true;
    const withdrawalEnd = new Date(treatment.withdrawalEndDate).getTime();
    return Number.isFinite(processTs) && Number.isFinite(withdrawalEnd) && withdrawalEnd >= processTs;
  }), [treatments, sourcePondId, processTs]);

  const live = Number(liveBiomassKg || 0);
  const caviar = Number(caviarYieldKg || 0);
  const fillet = Number(filletYieldKg || 0);
  const smoked = Number(smokedYieldKg || 0);
  const waste = Number(Math.max(0, live - caviar - fillet - smoked).toFixed(3));
  const outputTotal = caviar + fillet + smoked + waste;
  const massBalanced = live > 0 && Math.abs(outputTotal - live) <= 0.05;

  const totalCaviar = coldStorage.filter((lot) => lot.productType === 'Caviar (Cans/Jars)').reduce((sum, lot) => sum + lot.weightKg, 0);
  const totalMeat = coldStorage.filter((lot) => lot.productType === 'Vacuumed Fillet' || lot.productType === 'Smoked Sturgeon').reduce((sum, lot) => sum + lot.weightKg, 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!sourcePond || !sourceSpecies) { setError('استخر و گونه مبدا باید معتبر باشند.'); return; }
    if (sourcePond.activeTreatmentId || blockingTreatment) {
      setError(`فرآوری مسدود است: ${blockingTreatment?.drugName || 'درمان فعال'} تا پایان دوره منع مصرف/Withdrawal مجاز نیست.`);
      return;
    }
    if (!massBalanced) { setError('موازنه جرم معتبر نیست؛ مجموع خاویار، گوشت، دودی و ضایعات باید با وزن زنده برابر باشد.'); return; }
    const score = Number(qualityScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) { setError('امتیاز کیفی باید بین ۰ تا ۱۰۰ باشد.'); return; }
    if (!expiryDate || new Date(expiryDate).getTime() < processTs) { setError('تاریخ انقضا باید معتبر و بعد از تاریخ فرآوری باشد.'); return; }

    const result = createProcessingBatch({
      batchCode: `PROC-${processDate.replace(/-/g, '')}-${String(processingBatches.length + 1).padStart(3, '0')}`,
      date: processDate,
      sourcePondId: sourcePond.id,
      sourcePondName: sourcePond.name,
      speciesName: sourceSpecies.scientificName || sourceSpecies.faName,
      fishCount: Number(fishCount),
      liveBiomassKg: live,
      caviarYieldKg: caviar,
      caviarGrade,
      filletMeatYieldKg: fillet,
      smokedMeatYieldKg: smoked,
      byProductAndWasteKg: waste,
      operatorName: operatorName.trim(),
      qualityScore: score,
      citesPermitNumber: citesNumber.trim() || undefined,
      status: 'Stored In Cold Room',
      outputExpiryDate: expiryDate,
    } as any);
    if (!result.success) { setError(result.error || 'ثبت بچ فرآوری انجام نشد.'); return; }
    setShowForm(false);
    setSourcePondId(''); setFishCount(''); setLiveBiomassKg(''); setCaviarYieldKg(''); setFilletYieldKg(''); setSmokedYieldKg(''); setQualityScore(''); setExpiryDate(''); setOperatorName(''); setCitesNumber('');
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Scissors className="w-6 h-6 text-amber-400" />فرآوری و سردخانه</h1><p className="text-xs text-slate-400 mt-1">ورود به فرآوری با Treatment/Withdrawal فعال Fail-Closed است، گونه از استخر مبدا گرفته می‌شود و تاریخ انقضا باید صریح ثبت شود.</p></div>
      <div className="flex gap-2 text-xs"><button onClick={() => setTab('processing')} className={`px-3 py-2 rounded-xl font-bold ${tab === 'processing' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>فرآوری ({processingBatches.length})</button><button onClick={() => setTab('coldStorage')} className={`px-3 py-2 rounded-xl font-bold ${tab === 'coldStorage' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>سردخانه ({coldStorage.length})</button></div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[11px] text-slate-500 block">خاویار سردخانه</span><strong className="text-xl text-amber-400">{formatNumber(totalCaviar)} kg</strong></div><div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[11px] text-slate-500 block">گوشت/دودی</span><strong className="text-xl text-cyan-400">{formatNumber(totalMeat)} kg</strong></div><div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[11px] text-slate-500 block">بچ دارای CITES ثبت‌شده</span><strong className="text-xl text-emerald-400">{processingBatches.filter((batch) => batch.citesPermitNumber?.trim()).length}/{processingBatches.length}</strong></div><div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[11px] text-slate-500 block">لات منقضی</span><strong className="text-xl text-rose-400">{coldStorage.filter((lot) => new Date(lot.expiryDate).getTime() < Date.now()).length}</strong></div></div>

    {tab === 'processing' ? <div className="space-y-4"><div className="flex justify-end"><button onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">ثبت عملیات فرآوری</button></div>{processingBatches.map((batch) => <div key={batch.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex flex-wrap justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="font-mono text-amber-400">{batch.batchCode}</strong><span className="text-xs text-slate-500 mr-2">{batch.date}</span><p className="text-xs text-white mt-1">{batch.sourcePondName} · {batch.speciesName}</p></div><div className="text-left"><span className="text-xs text-emerald-400 font-bold">QC {batch.qualityScore}/100</span><span className="block text-[10px] text-slate-500">CITES: {batch.citesPermitNumber || 'ثبت نشده'}</span></div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs"><div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">ورودی زنده</span><strong className="text-white">{batch.liveBiomassKg} kg / {batch.fishCount} قطعه</strong></div><div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">خاویار</span><strong className="text-amber-400">{batch.caviarYieldKg} kg ({batch.caviarYieldPercent}%)</strong></div><div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">فیله</span><strong className="text-cyan-400">{batch.filletMeatYieldKg} kg</strong></div><div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">ضایعات/محصول جانبی</span><strong className="text-slate-300">{batch.byProductAndWasteKg} kg</strong></div></div></div>)}</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{coldStorage.map((lot) => { const expired = new Date(lot.expiryDate).getTime() < Date.now(); return <div key={lot.id} className={`bg-slate-900 border rounded-2xl p-5 ${expired ? 'border-rose-500/40' : 'border-slate-800'}`}><div className="flex justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="text-white block">{lot.productType}</strong><span className="font-mono text-[10px] text-amber-400">{lot.sku || lot.batchCode}</span></div><span className="text-cyan-400 text-xs flex items-center gap-1"><Thermometer className="w-4 h-4" />{lot.temperatureC}°C</span></div><div className="space-y-2 text-xs mt-3"><div className="flex justify-between"><span className="text-slate-500">وزن</span><strong className="text-white">{lot.weightKg} kg</strong></div><div className="flex justify-between"><span className="text-slate-500">انقضا</span><strong className={expired ? 'text-rose-400' : 'text-emerald-400'}>{lot.expiryDate}</strong></div><div className="flex justify-between"><span className="text-slate-500">Slot</span><span className="font-mono text-slate-300">{lot.slotCode}</span></div></div></div>; })}</div>}

    {showForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-auto"><h2 className="text-white font-bold mb-4">ثبت بچ فرآوری</h2><form onSubmit={submit} className="space-y-3 text-xs"><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">استخر مبدا<select value={sourcePondId} onChange={(event) => setSourcePondId(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="">انتخاب...</option>{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name} / {species.find((item) => item.id === pond.speciesId)?.faName || pond.speciesId}</option>)}</select></label><label className="text-slate-400">اپراتور<input value={operatorName} onChange={(event) => setOperatorName(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label></div>{(sourcePond?.activeTreatmentId || blockingTreatment) && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>این استخر تا پایان Withdrawal درمان {blockingTreatment?.drugName || ''} اجازه فرآوری ندارد.</span></div>}<div className="grid md:grid-cols-3 gap-3"><label className="text-slate-400">تاریخ فرآوری<input type="date" value={processDate} onChange={(event) => setProcessDate(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label><label className="text-slate-400">تاریخ انقضای خروجی<input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label><label className="text-slate-400">امتیاز QC<input type="number" min="0" max="100" value={qualityScore} onChange={(event) => setQualityScore(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label></div><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{[['fishCount','تعداد ماهی','1'],['live','وزن زنده kg','0.001'],['caviar','خاویار kg','0.001'],['fillet','فیله kg','0.001'],['smoked','دودی kg','0.001']] .map(([key,label,step]) => <label key={key} className="text-slate-400">{label}<input type="number" min="0" step={step} value={key === 'fishCount' ? fishCount : key === 'live' ? liveBiomassKg : key === 'caviar' ? caviarYieldKg : key === 'fillet' ? filletYieldKg : smokedYieldKg} onChange={(event) => key === 'fishCount' ? setFishCount(event.target.value) : key === 'live' ? setLiveBiomassKg(event.target.value) : key === 'caviar' ? setCaviarYieldKg(event.target.value) : key === 'fillet' ? setFilletYieldKg(event.target.value) : setSmokedYieldKg(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label>)}</div><div className={`rounded-xl p-3 border ${massBalanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}>موازنه جرم: ورودی {live.toFixed(3)} kg = خروجی {outputTotal.toFixed(3)} kg (ضایعات محاسبه‌شده {waste.toFixed(3)} kg)</div><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">گرید خاویار<select value={caviarGrade} onChange={(event) => setCaviarGrade(event.target.value as ProcessingBatch['caviarGrade'])} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="Imperial Beluga (50g/100g)">Imperial Beluga</option><option value="Royal Beluga">Royal Beluga</option><option value="Classic Baerii">Classic Baerii</option><option value="Asetra Gold">Asetra Gold</option></select></label><label className="text-slate-400">CITES (در صورت صدور)<input value={citesNumber} onChange={(event) => setCitesNumber(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono" /></label></div>{error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-200">{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" disabled={Boolean(sourcePond?.activeTreatmentId || blockingTreatment) || !massBalanced} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl disabled:opacity-40"><ShieldCheck className="w-4 h-4 inline ml-1" />ثبت اتمیک و انتقال به سردخانه</button></div></form></div></div>}
  </div>;
};
