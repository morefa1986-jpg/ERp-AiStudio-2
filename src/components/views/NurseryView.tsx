import React, { useState } from 'react';
import { ArrowLeftRight, Baby, Droplets, Fish, Thermometer } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';

export const NurseryView: React.FC = () => {
  const { formatNumber } = useI18n();
  const { currentUser } = useAuth();
  const { nurseryTanks, larvae, ponds, species, executeAtomicTransfer } = useFarm();
  const [showTransfer, setShowTransfer] = useState(false);
  const [sourceMode, setSourceMode] = useState<'Hatchery' | 'Nursery'>('Hatchery');
  const [sourceId, setSourceId] = useState('');
  const [destinationMode, setDestinationMode] = useState<'Nursery' | 'Pond'>('Nursery');
  const [destinationId, setDestinationId] = useState('');
  const [count, setCount] = useState('');
  const [avgWeightKg, setAvgWeightKg] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const hatcherySources = larvae.filter((batch) => !batch.currentTankId && batch.status !== 'Nursery Rearing' && batch.larvalCount > 0 && Number(batch.totalBiomassKg || 0) > 0);
  const nurserySources = nurseryTanks.filter((tank) => tank.status === 'Active' && tank.fishCount > 0);
  const emptyTanks = nurseryTanks.filter((tank) => tank.status !== 'Cleaning' && tank.fishCount === 0 && !tank.currentBatchId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    const fishCount = Number(count); const averageWeight = Number(avgWeightKg);
    if (!Number.isInteger(fishCount) || fishCount <= 0 || !Number.isFinite(averageWeight) || averageWeight <= 0) { setMessage('تعداد و میانگین وزن معتبر لازم است.'); return; }
    const sourceBatch = sourceMode === 'Hatchery' ? larvae.find((batch) => batch.id === sourceId) : undefined;
    const sourceTank = sourceMode === 'Nursery' ? nurseryTanks.find((tank) => tank.id === sourceId) : undefined;
    const speciesId = sourceBatch?.speciesId || sourceTank?.speciesId || '';
    const speciesName = species.find((item) => item.id === speciesId)?.scientificName || species.find((item) => item.id === speciesId)?.faName || speciesId;
    const destinationTank = destinationMode === 'Nursery' ? nurseryTanks.find((tank) => tank.id === destinationId) : undefined;
    const destinationPond = destinationMode === 'Pond' ? ponds.find((pond) => pond.id === destinationId) : undefined;
    const totalBiomassKg = Number((fishCount * averageWeight).toFixed(2));
    const result = executeAtomicTransfer({
      sourceType: sourceMode,
      sourceId,
      sourceName: sourceBatch?.batchCode || sourceTank?.code || '',
      destinationType: destinationMode,
      destinationId,
      destinationName: destinationTank?.code || destinationPond?.name || '',
      speciesId,
      speciesName,
      fishCount,
      averageWeightKg: averageWeight,
      totalBiomassKg,
      date: new Date().toISOString().slice(0, 10),
      operator: currentUser?.fullName || 'Operator',
      reason: reason.trim(),
    });
    if (!result.success) { setMessage(result.error || 'انتقال نرسری انجام نشد.'); return; }
    setMessage('انتقال اتمیک ثبت شد و دفتر تعداد/بیومس مبدا و مقصد همزمان به‌روزرسانی شد.');
    setShowTransfer(false); setSourceId(''); setDestinationId(''); setCount(''); setAvgWeightKg(''); setReason('');
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><Baby className="w-6 h-6 text-amber-400" />نرسری و بچ‌های لاروی</h1><p className="text-xs text-slate-400 mt-1">هر مخزن به Batch Ledger متصل است؛ انتقال از Hatchery یا Nursery فقط با حفاظت تعداد و بیومس انجام می‌شود.</p></div><button onClick={() => { setShowTransfer(true); setMessage(''); }} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold"><ArrowLeftRight className="w-4 h-4 inline ml-1" />انتقال بچ</button></div>
    {message && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200">{message}</div>}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{nurseryTanks.map((tank) => { const batch = larvae.find((item) => item.id === tank.currentBatchId); return <div key={tank.id} className={`bg-slate-900 border rounded-2xl p-5 ${tank.status === 'Cleaning' ? 'border-amber-500/30' : 'border-slate-800'}`}><div className="flex justify-between border-b border-slate-800 pb-3"><div><strong className="text-white block">{tank.code}</strong><span className="text-[10px] text-amber-400">{batch?.batchCode || 'بدون بچ'}</span></div><span className="text-[10px] text-slate-400">{tank.status}</span></div><div className="grid grid-cols-2 gap-2 mt-3 text-xs"><Metric label="تعداد" value={`${formatNumber(tank.fishCount)} قطعه`} icon={<Fish className="w-3 h-3" />} /><Metric label="میانگین وزن" value={`${tank.avgWeightGrams} g`} /><Metric label="بیومس" value={`${formatNumber(tank.totalBiomassGrams)} g`} /><Metric label="خوراک روزانه" value={`${formatNumber(tank.dailyFeedGrams)} g`} /><Metric label="دما" value={`${tank.tempC}°C`} icon={<Thermometer className="w-3 h-3" />} /><Metric label="DO" value={`${tank.doMgL} mg/L`} icon={<Droplets className="w-3 h-3" />} /></div><div className="mt-3 text-[10px] text-slate-500">Mortality today: {tank.mortalityToday} · Volume: {tank.volumeLiters} L</div></div>; })}</div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="text-sm font-bold text-white mb-3">بچ‌های لارو</h2><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">Batch</th><th className="p-3">تفریخ</th><th className="p-3">تعداد</th><th className="p-3">بقا</th><th className="p-3">Deformity</th><th className="p-3">مخزن</th><th className="p-3">وضعیت</th></tr></thead><tbody className="divide-y divide-slate-800">{larvae.map((batch) => <tr key={batch.id} className="text-slate-300"><td className="p-3 font-mono text-amber-400">{batch.batchCode}</td><td className="p-3">{batch.hatchDate}</td><td className="p-3">{formatNumber(batch.larvalCount)}</td><td className="p-3 text-emerald-400">{batch.survivalRatePercent}%</td><td className="p-3">{batch.deformityPercent}%</td><td className="p-3">{nurseryTanks.find((tank) => tank.id === batch.currentTankId)?.code || '—'}</td><td className="p-3">{batch.status}</td></tr>)}</tbody></table></div></div>

    {showTransfer && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-2xl"><h2 className="text-white font-bold mb-4">انتقال اتمیک Hatchery / Nursery</h2><form onSubmit={submit} className="space-y-3 text-xs"><div className="grid grid-cols-2 gap-3"><select value={sourceMode} onChange={(e) => { setSourceMode(e.target.value as 'Hatchery' | 'Nursery'); setSourceId(''); }} className="field"><option value="Hatchery">Hatchery batch</option><option value="Nursery">Nursery tank</option></select><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} required className="field"><option value="">مبدا...</option>{sourceMode === 'Hatchery' ? hatcherySources.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} — {batch.larvalCount} قطعه / {batch.totalBiomassKg} kg</option>) : nurserySources.map((tank) => <option key={tank.id} value={tank.id}>{tank.code} — {tank.fishCount} قطعه / {tank.totalBiomassGrams / 1000} kg</option>)}</select></div><div className="grid grid-cols-2 gap-3"><select value={destinationMode} onChange={(e) => { setDestinationMode(e.target.value as 'Nursery' | 'Pond'); setDestinationId(''); }} className="field"><option value="Nursery">Nursery destination</option><option value="Pond">Pond destination</option></select><select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} required className="field"><option value="">مقصد...</option>{destinationMode === 'Nursery' ? emptyTanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.code} — EMPTY</option>) : ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><input type="number" min="1" step="1" value={count} onChange={(e) => setCount(e.target.value)} placeholder="تعداد" required className="field" /><input type="number" min="0.000001" step="0.000001" value={avgWeightKg} onChange={(e) => setAvgWeightKg(e.target.value)} placeholder="میانگین وزن kg" required className="field" /></div><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="علت انتقال / سورتینگ" required className="field w-full" /><div className="text-[10px] text-slate-500">انتقال جزئی Hatchery و انتقال جزئی Nursery→Nursery در موتور حفاظت موجودی Fail-Closed است؛ در صورت نیاز ابتدا Batch را تفکیک رسمی کنید.</div><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowTransfer(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">ثبت انتقال</button></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}`}</style>
  </div>;
};
const Metric = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5"><span className="text-[10px] text-slate-500 flex items-center gap-1">{icon}{label}</span><strong className="text-white">{value}</strong></div>;
