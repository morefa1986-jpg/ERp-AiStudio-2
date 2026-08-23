import React, { useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Camera, Plus, Skull, Stethoscope } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { TreatmentRecord } from '../../types';

type Mode = 'mortality' | 'treatments' | 'transfers';
export const LivestockOperationsView: React.FC<{ mode: Mode }> = ({ mode }) => {
  const { formatNumber, formatDate } = useI18n();
  const { currentUser } = useAuth();
  const { ponds, halls, species, nurseryTanks, mortalityRecords, treatments, transfers, recordMortality, recordTreatment, executeAtomicTransfer } = useFarm();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const [pondId, setPondId] = useState(ponds[0]?.id || '');
  const [count, setCount] = useState('1');
  const [mortalityWeight, setMortalityWeight] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [diagnosis, setDiagnosis] = useState('');
  const [drugName, setDrugName] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState<TreatmentRecord['doseUnit']>('mg/L');
  const [administrationMethod, setAdministrationMethod] = useState<TreatmentRecord['administrationMethod']>('Bath (حمام)');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextDoseDate, setNextDoseDate] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('0');
  const [veterinarian, setVeterinarian] = useState(currentUser?.fullName || '');

  const [destinationType, setDestinationType] = useState<'Pond' | 'Nursery'>('Pond');
  const [destinationId, setDestinationId] = useState('');
  const [transferCount, setTransferCount] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const selectedPond = ponds.find((pond) => pond.id === pondId);
  const selectedSpecies = species.find((item) => item.id === selectedPond?.speciesId);

  const loadPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('فایل تلفات باید تصویر باشد.'); return; }
    if (file.size > 2_000_000) { setError('حجم عکس برای ثبت داخل رکورد باید کمتر از ۲ مگابایت باشد.'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setError('خواندن عکس انجام نشد.');
    reader.readAsDataURL(file);
  };

  const submitMortality = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!selectedPond) return;
    const mortalityCount = Number(count); const weight = Number(mortalityWeight);
    if (!Number.isInteger(mortalityCount) || mortalityCount <= 0 || mortalityCount > selectedPond.fishCount) { setError('تعداد تلفات باید عدد صحیح مثبت و کمتر از موجودی استخر باشد.'); return; }
    if (!Number.isFinite(weight) || weight < 0 || weight > selectedPond.biomassKg) { setError('وزن تخمینی تلفات نامعتبر است.'); return; }
    if (!reason.trim() || !description.trim()) { setError('علت و شرح تلفات الزامی است.'); return; }
    recordMortality({ pondId: selectedPond.id, pondName: selectedPond.name, speciesId: selectedPond.speciesId, speciesName: selectedSpecies?.scientificName || selectedSpecies?.faName || selectedPond.speciesId, count: mortalityCount, estimatedWeightKg: weight, reason: reason.trim(), description: description.trim(), photoUrl: photoUrl || undefined, recordedBy: currentUser?.fullName || 'Operator' });
    setShowForm(false); setCount('1'); setMortalityWeight(''); setReason(''); setDescription(''); setPhotoUrl('');
  };

  const submitTreatment = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!selectedPond) return;
    const numericDose = Number(dose); const withdrawal = Number(withdrawalDays);
    if (!diagnosis.trim() || !drugName.trim() || !veterinarian.trim() || !Number.isFinite(numericDose) || numericDose <= 0) { setError('تشخیص، دارو، دوز و دامپزشک الزامی است.'); return; }
    if (!Number.isInteger(withdrawal) || withdrawal < 0) { setError('دوره منع مصرف باید عدد صحیح غیرمنفی باشد.'); return; }
    const start = new Date(startDate); const end = new Date(endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) { setError('بازه درمان نامعتبر است.'); return; }
    const withdrawalEnd = new Date(end.getTime() + withdrawal * 86_400_000).toISOString().slice(0, 10);
    recordTreatment({ pondId: selectedPond.id, pondName: selectedPond.name, speciesName: selectedSpecies?.scientificName || selectedSpecies?.faName || selectedPond.speciesId, diagnosis: diagnosis.trim(), drugName: drugName.trim(), dose: numericDose, doseUnit, administrationMethod, startDate, endDate, nextDoseDate: nextDoseDate || undefined, veterinarian: veterinarian.trim(), withdrawalPeriodDays: withdrawal, withdrawalEndDate: withdrawalEnd, status: 'ACTIVE', notes: '', reminderActive: Boolean(nextDoseDate) });
    setShowForm(false); setDiagnosis(''); setDrugName(''); setDose(''); setWithdrawalDays('0'); setNextDoseDate('');
  };

  const submitTransfer = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!selectedPond) return;
    const amount = Number(transferCount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > selectedPond.fishCount) { setError('تعداد انتقال نامعتبر است.'); return; }
    if (!destinationId || !transferReason.trim()) { setError('مقصد و علت انتقال الزامی است.'); return; }
    const destinationPond = destinationType === 'Pond' ? ponds.find((pond) => pond.id === destinationId) : undefined;
    const destinationTank = destinationType === 'Nursery' ? nurseryTanks.find((tank) => tank.id === destinationId) : undefined;
    const destinationName = destinationPond?.name || destinationTank?.code || '';
    const biomass = Number((amount * selectedPond.averageWeightKg).toFixed(2));
    const result = executeAtomicTransfer({ sourceType: 'Pond', sourceId: selectedPond.id, sourceName: selectedPond.name, destinationType, destinationId, destinationName, speciesId: selectedPond.speciesId, speciesName: selectedSpecies?.scientificName || selectedSpecies?.faName || selectedPond.speciesId, fishCount: amount, averageWeightKg: selectedPond.averageWeightKg, totalBiomassKg: biomass, date: new Date().toISOString().slice(0, 10), operator: currentUser?.fullName || 'Operator', reason: transferReason.trim() });
    if (!result.success) { setError(result.error || 'انتقال انجام نشد.'); return; }
    setShowForm(false); setTransferCount(''); setTransferReason(''); setDestinationId('');
  };

  const meta = mode === 'mortality'
    ? { title: 'ثبت و پایش تلفات', subtitle: 'تعداد، وزن، علت، شرح و عکس تلفات با اثر مستقیم بر موجودی استخر', icon: Skull, button: 'ثبت تلفات' }
    : mode === 'treatments'
      ? { title: 'درمان، دارو و Withdrawal', subtitle: 'شروع درمان فعال تغذیه را متوقف و دوره منع مصرف را برای فرآوری قفل می‌کند', icon: Stethoscope, button: 'ثبت درمان' }
      : { title: 'انتقال اتمیک ماهی و بیومس', subtitle: 'فقط مقصدهای دارای دفتر موجودی معتبر (استخر/نرسری) از این گردش‌کار قابل انتخاب‌اند', icon: ArrowLeftRight, button: 'ثبت انتقال' };
  const Icon = meta.icon;

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><Icon className="w-6 h-6 text-amber-400" />{meta.title}</h1><p className="text-xs text-slate-400 mt-1">{meta.subtitle}</p></div><button onClick={() => { setError(''); setShowForm(true); }} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold"><Plus className="w-4 h-4 inline ml-1" />{meta.button}</button></div>

    {mode === 'mortality' && <div className="space-y-3">{mortalityRecords.map((record) => <div key={record.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4"><div className="w-20 h-20 bg-slate-950 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">{record.photoUrl ? <img src={record.photoUrl} alt="mortality" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-slate-700" />}</div><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-white">{record.pondName} · {formatNumber(record.count)} قطعه</strong><span className="text-xs text-slate-500">{formatDate(record.timestamp)}</span></div><p className="text-xs text-rose-300 mt-2">{record.reason}</p><p className="text-xs text-slate-400 mt-1">{record.description}</p><span className="text-[10px] text-slate-500">وزن {record.estimatedWeightKg} kg · ثبت: {record.recordedBy}</span></div></div>)}</div>}

    {mode === 'treatments' && <div className="space-y-3">{treatments.map((treatment) => <div key={treatment.id} className={`bg-slate-900 border rounded-2xl p-5 ${treatment.status === 'ACTIVE' ? 'border-rose-500/40' : 'border-slate-800'}`}><div className="flex flex-wrap justify-between gap-2"><div><strong className="text-white">{treatment.pondName} · {treatment.drugName}</strong><p className="text-xs text-slate-400 mt-1">{treatment.diagnosis}</p></div><span className={treatment.status === 'ACTIVE' ? 'text-rose-400 text-xs font-bold' : 'text-emerald-400 text-xs font-bold'}>{treatment.status}</span></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3"><div className="bg-slate-950 p-2 rounded-lg"><span className="text-slate-500 block">دوز</span><strong className="text-white">{treatment.dose} {treatment.doseUnit}</strong></div><div className="bg-slate-950 p-2 rounded-lg"><span className="text-slate-500 block">پایان درمان</span><strong className="text-white">{treatment.endDate}</strong></div><div className="bg-slate-950 p-2 rounded-lg"><span className="text-slate-500 block">پایان Withdrawal</span><strong className="text-amber-400">{treatment.withdrawalEndDate}</strong></div><div className="bg-slate-950 p-2 rounded-lg"><span className="text-slate-500 block">دوز بعدی</span><strong className="text-cyan-400">{treatment.nextDoseDate || '—'}</strong></div></div></div>)}</div>}

    {mode === 'transfers' && <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">تاریخ</th><th className="p-3">مسیر</th><th className="p-3">تعداد</th><th className="p-3">بیومس</th><th className="p-3">اپراتور</th><th className="p-3">علت</th></tr></thead><tbody className="divide-y divide-slate-800">{transfers.map((transfer) => <tr key={transfer.id} className="text-slate-300"><td className="p-3">{transfer.date}</td><td className="p-3 text-white">{transfer.sourceName} → {transfer.destinationName}</td><td className="p-3">{formatNumber(transfer.fishCount)}</td><td className="p-3">{transfer.totalBiomassKg} kg</td><td className="p-3">{transfer.operator}</td><td className="p-3">{transfer.reason}</td></tr>)}</tbody></table></div></div>}

    {showForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-auto"><h2 className="text-white font-bold mb-4">{meta.button}</h2>{mode === 'mortality' ? <form onSubmit={submitMortality} className="space-y-3 text-xs"><PondSelect ponds={ponds} halls={halls} value={pondId} onChange={setPondId} /><div className="grid grid-cols-2 gap-3"><label className="text-slate-400">تعداد<input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} required className="mt-1 w-full field" /></label><label className="text-slate-400">وزن کل تخمینی kg<input type="number" min="0" step="0.001" value={mortalityWeight} onChange={(e) => setMortalityWeight(e.target.value)} required className="mt-1 w-full field" /></label></div><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="علت / تشخیص اولیه" required className="w-full field" /><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح مشاهده، علائم و اقدام انجام‌شده" required className="w-full field" /><label className="block text-slate-400">عکس تلفات (اختیاری، حداکثر ۲MB)<input type="file" accept="image/*" onChange={(e) => loadPhoto(e.target.files?.[0])} className="mt-1 w-full text-slate-300" /></label>{photoUrl && <img src={photoUrl} alt="preview" className="w-28 h-28 object-cover rounded-xl" />}<FormFooter error={error} onCancel={() => setShowForm(false)} /></form> : mode === 'treatments' ? <form onSubmit={submitTreatment} className="space-y-3 text-xs"><PondSelect ponds={ponds} halls={halls} value={pondId} onChange={setPondId} /><div className="grid grid-cols-2 gap-3"><input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="تشخیص" required className="field" /><input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="نام دارو / ماده مؤثره" required className="field" /></div><div className="grid grid-cols-3 gap-3"><input type="number" min="0.001" step="0.001" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="دوز" required className="field" /><select value={doseUnit} onChange={(e) => setDoseUnit(e.target.value as TreatmentRecord['doseUnit'])} className="field"><option>mg/L</option><option>g/m3</option><option>g/kg feed</option><option>ml/m3</option><option>ppm</option></select><select value={administrationMethod} onChange={(e) => setAdministrationMethod(e.target.value as TreatmentRecord['administrationMethod'])} className="field"><option>Bath (حمام)</option><option>Oral (خوراکی)</option><option>Injection (تزریقی)</option><option>Continuous Flow</option></select></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><label className="text-slate-400">شروع<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full field" /></label><label className="text-slate-400">پایان<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full field" /></label><label className="text-slate-400">دوز بعدی<input type="date" value={nextDoseDate} onChange={(e) => setNextDoseDate(e.target.value)} className="mt-1 w-full field" /></label><label className="text-slate-400">Withdrawal روز<input type="number" min="0" step="1" value={withdrawalDays} onChange={(e) => setWithdrawalDays(e.target.value)} className="mt-1 w-full field" /></label></div><input value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} placeholder="دامپزشک / مسئول" required className="w-full field" /><FormFooter error={error} onCancel={() => setShowForm(false)} /></form> : <form onSubmit={submitTransfer} className="space-y-3 text-xs"><PondSelect ponds={ponds} halls={halls} value={pondId} onChange={setPondId} /><div className="grid grid-cols-2 gap-3"><select value={destinationType} onChange={(e) => { setDestinationType(e.target.value as 'Pond' | 'Nursery'); setDestinationId(''); }} className="field"><option value="Pond">استخر</option><option value="Nursery">نرسری</option></select><select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} required className="field"><option value="">انتخاب مقصد...</option>{destinationType === 'Pond' ? ponds.filter((pond) => pond.id !== pondId).map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>) : nurseryTanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.code} — {tank.status}</option>)}</select></div><input type="number" min="1" step="1" value={transferCount} onChange={(e) => setTransferCount(e.target.value)} placeholder="تعداد ماهی" required className="w-full field" /><input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="علت انتقال" required className="w-full field" />{selectedPond && <div className="bg-slate-900 rounded-xl p-3 text-slate-400">مبدا: {selectedPond.fishCount} قطعه · {selectedPond.biomassKg} kg · میانگین {selectedPond.averageWeightKg} kg</div>}<FormFooter error={error} onCancel={() => setShowForm(false)} /></form>}</div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}.field:focus{outline:none;border-color:#d4af37}`}</style>
  </div>;
};

const PondSelect = ({ ponds, halls, value, onChange }: { ponds: any[]; halls: any[]; value: string; onChange: (value: string) => void }) => <label className="block text-xs text-slate-400">استخر<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full field">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name} / {halls.find((hall) => hall.id === pond.hallId)?.name || pond.hallId}</option>)}</select></label>;
const FormFooter = ({ error, onCancel }: { error: string; onCancel: () => void }) => <>{error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">ثبت قطعی</button></div></>;
