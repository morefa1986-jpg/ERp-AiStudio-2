import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Camera, CheckCircle2, Plus, Skull, Stethoscope } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { TreatmentRecord } from '../../types';
import { pondStockGroups } from '../../utils/pondStockLedger';

type Mode = 'mortality' | 'treatments' | 'transfers';

function parseChips(value: string): string[] {
  return [...new Set(value.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean))];
}

export const LivestockOperationsView: React.FC<{ mode: Mode }> = ({ mode }) => {
  const { formatNumber, formatDate } = useI18n();
  const { currentUser } = useAuth();
  const {
    ponds, species, nurseryTanks, mortalityRecords, treatments, transfers,
    recordMortality, recordTreatment, completeTreatment, executeAtomicTransfer,
  } = useFarm();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const [pondId, setPondId] = useState(ponds[0]?.id || '');
  const [stockKey, setStockKey] = useState('');
  const [chipSelection, setChipSelection] = useState('');
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
  const stockGroups = useMemo(() => selectedPond ? pondStockGroups(selectedPond).filter((group) => group.count > 0) : [], [selectedPond]);
  const selectedStock = stockGroups.find((group) => `${group.speciesId}|${group.sex}` === stockKey) || stockGroups[0];
  const selectedSpecies = species.find((item) => item.id === selectedStock?.speciesId || item.id === selectedPond?.speciesId);

  useEffect(() => {
    if (!stockGroups.length) { setStockKey(''); return; }
    if (!stockGroups.some((group) => `${group.speciesId}|${group.sex}` === stockKey)) setStockKey(`${stockGroups[0].speciesId}|${stockGroups[0].sex}`);
    setChipSelection('');
  }, [pondId, stockGroups, stockKey]);

  const speciesLabel = (speciesId: string) => {
    const row = species.find((item) => item.id === speciesId);
    return row?.faName || row?.scientificName || speciesId;
  };

  const validateChipRemoval = (removeCount: number): { ok: boolean; chips: string[]; error?: string } => {
    if (!selectedStock) return { ok: false, chips: [], error: 'گروه زیستی انتخاب نشده است.' };
    const chips = parseChips(chipSelection);
    const registered = selectedStock.chipNumbers || [];
    if (chips.some((chip) => !registered.includes(chip))) return { ok: false, chips, error: 'حداقل یک شماره Chip در گروه انتخاب‌شده ثبت نشده است.' };
    if (chips.length > removeCount) return { ok: false, chips, error: 'تعداد Chipهای انتخاب‌شده از تعداد ماهی عملیات بیشتر است.' };
    if (registered.length - chips.length > selectedStock.count - removeCount) return { ok: false, chips, error: 'برای حفظ دفترچه Chip، شماره Chip ماهیان خارج‌شونده را مشخص کنید.' };
    return { ok: true, chips };
  };

  const loadPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage('فایل تلفات باید تصویر باشد.'); return; }
    if (file.size > 2_000_000) { setMessage('حجم عکس برای ثبت داخل رکورد باید کمتر از ۲ مگابایت باشد.'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setMessage('خواندن عکس انجام نشد.');
    reader.readAsDataURL(file);
  };

  const submitMortality = (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!selectedPond || !selectedStock) return;
    const mortalityCount = Number(count); const weight = Number(mortalityWeight);
    if (!Number.isInteger(mortalityCount) || mortalityCount <= 0 || mortalityCount > selectedStock.count) { setMessage('تعداد تلفات باید عدد صحیح مثبت و حداکثر موجودی گروه انتخاب‌شده باشد.'); return; }
    const groupBiomass = selectedStock.count * selectedStock.averageWeightKg;
    if (!Number.isFinite(weight) || weight < 0 || weight > groupBiomass + 0.05) { setMessage('وزن تخمینی تلفات از بیومس گروه انتخاب‌شده بیشتر است یا مقدار معتبر نیست.'); return; }
    if (!reason.trim() || !description.trim()) { setMessage('علت و شرح تلفات الزامی است.'); return; }
    const chipCheck = validateChipRemoval(mortalityCount);
    if (!chipCheck.ok) { setMessage(chipCheck.error || 'انتخاب Chip نامعتبر است.'); return; }
    recordMortality({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      speciesId: selectedStock.speciesId,
      speciesName: speciesLabel(selectedStock.speciesId),
      stockSex: selectedStock.sex,
      chipNumbers: chipCheck.chips.length ? chipCheck.chips : undefined,
      count: mortalityCount,
      estimatedWeightKg: weight,
      reason: reason.trim(),
      description: description.trim(),
      photoUrl: photoUrl || undefined,
      recordedBy: currentUser?.fullName || 'Operator',
    });
    setShowForm(false); setCount('1'); setMortalityWeight(''); setReason(''); setDescription(''); setPhotoUrl(''); setChipSelection('');
    setMessage('تلفات روی گروه دقیق گونه/جنس ثبت شد و Ledger استخر به‌روزرسانی شد.');
  };

  const submitTreatment = (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!selectedPond) return;
    const numericDose = Number(dose); const withdrawal = Number(withdrawalDays);
    if (!diagnosis.trim() || !drugName.trim() || !veterinarian.trim() || !Number.isFinite(numericDose) || numericDose <= 0) { setMessage('تشخیص، نام دارو، مقدار ثبت‌شده و دامپزشک الزامی است.'); return; }
    if (!Number.isInteger(withdrawal) || withdrawal < 0) { setMessage('دوره منع مصرف باید عدد صحیح غیرمنفی باشد.'); return; }
    const start = new Date(startDate); const end = new Date(endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) { setMessage('بازه درمان نامعتبر است.'); return; }
    const withdrawalEnd = new Date(end.getTime() + withdrawal * 86_400_000).toISOString().slice(0, 10);
    recordTreatment({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      speciesName: stockGroups.length > 1 ? 'Mixed stock / چندگروهی' : selectedSpecies?.scientificName || selectedSpecies?.faName || selectedPond.speciesId,
      diagnosis: diagnosis.trim(),
      drugName: drugName.trim(),
      dose: numericDose,
      doseUnit,
      administrationMethod,
      startDate,
      endDate,
      nextDoseDate: nextDoseDate || undefined,
      veterinarian: veterinarian.trim(),
      withdrawalPeriodDays: withdrawal,
      withdrawalEndDate: withdrawalEnd,
      status: 'ACTIVE',
      notes: 'ثبت اداری درمان؛ این رکورد جایگزین دستور بالینی یا محاسبه دوز نیست.',
      reminderActive: Boolean(nextDoseDate),
    });
    setShowForm(false); setDiagnosis(''); setDrugName(''); setDose(''); setWithdrawalDays('0'); setNextDoseDate('');
    setMessage('رکورد اداری درمان ثبت شد؛ خوراک‌دهی متوقف و Hold دوره منع مصرف فعال شد.');
  };

  const finishTreatment = (treatmentId: string) => {
    setMessage('');
    const result = completeTreatment(treatmentId);
    setMessage(result.success
      ? 'درمان تکمیل شد؛ خوراک‌دهی تا تأیید جداگانه و داده معتبر بررسی آنلاین پارامترهای آب متوقف می‌ماند.'
      : result.error || 'تکمیل درمان انجام نشد.');
  };

  const submitTransfer = (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!selectedPond || !selectedStock) return;
    const amount = Number(transferCount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > selectedStock.count) { setMessage('تعداد انتقال باید در محدوده موجودی گروه انتخاب‌شده باشد.'); return; }
    if (!destinationId || !transferReason.trim()) { setMessage('مقصد و علت انتقال الزامی است.'); return; }
    const destinationPond = destinationType === 'Pond' ? ponds.find((pond) => pond.id === destinationId) : undefined;
    const destinationTank = destinationType === 'Nursery' ? nurseryTanks.find((tank) => tank.id === destinationId) : undefined;
    const destinationName = destinationPond?.name || destinationTank?.code || '';
    if (!destinationName || destinationId === selectedPond.id) { setMessage('مقصد انتقال معتبر نیست.'); return; }
    const chipCheck = validateChipRemoval(amount);
    if (!chipCheck.ok) { setMessage(chipCheck.error || 'انتخاب Chip نامعتبر است.'); return; }
    const biomass = Number((amount * selectedStock.averageWeightKg).toFixed(3));
    const result = executeAtomicTransfer({
      sourceType: 'Pond',
      sourceId: selectedPond.id,
      sourceName: selectedPond.name,
      destinationType,
      destinationId,
      destinationName,
      speciesId: selectedStock.speciesId,
      speciesName: speciesLabel(selectedStock.speciesId),
      stockSex: selectedStock.sex,
      chipNumbers: chipCheck.chips.length ? chipCheck.chips : undefined,
      fishCount: amount,
      averageWeightKg: selectedStock.averageWeightKg,
      totalBiomassKg: biomass,
      date: new Date().toISOString().slice(0, 10),
      operator: currentUser?.fullName || 'Operator',
      reason: transferReason.trim(),
    });
    if (!result.success) { setMessage(result.error || 'انتقال انجام نشد.'); return; }
    setShowForm(false); setTransferCount(''); setTransferReason(''); setDestinationId(''); setChipSelection('');
    setMessage('انتقال اتمیک گروه گونه/جنس ثبت شد.');
  };

  const meta = mode === 'mortality'
    ? { title: 'ثبت و پایش تلفات', subtitle: 'تلفات بر اساس گروه دقیق گونه/جنس و در صورت وجود Chip ثبت می‌شود', icon: Skull, button: 'ثبت تلفات' }
    : mode === 'treatments'
      ? { title: 'درمان و دوره منع مصرف', subtitle: 'رکورد اداری درمان؛ بدون پیشنهاد یا محاسبه دوز توسط ERP', icon: Stethoscope, button: 'ثبت درمان' }
      : { title: 'انتقال اتمیک ماهی و بیومس', subtitle: 'گونه، جنس، تعداد، بیومس و Chip در Ledger مبدا/مقصد با هم جابه‌جا می‌شوند', icon: ArrowLeftRight, button: 'ثبت انتقال' };
  const Icon = meta.icon;

  const stockSelector = (mode === 'mortality' || mode === 'transfers') && selectedPond ? <>
    <label className="text-slate-400">گروه زیستی<select value={selectedStock ? `${selectedStock.speciesId}|${selectedStock.sex}` : ''} onChange={(event) => { setStockKey(event.target.value); setChipSelection(''); }} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="">انتخاب...</option>{stockGroups.map((group) => <option key={`${group.speciesId}|${group.sex}`} value={`${group.speciesId}|${group.sex}`}>{speciesLabel(group.speciesId)} · {group.sex} · {group.count} قطعه · {group.averageWeightKg} kg</option>)}</select></label>
    {selectedStock?.chipNumbers?.length ? <label className="text-slate-400 md:col-span-2">Chipهای ماهیان خارج‌شونده<input value={chipSelection} onChange={(event) => setChipSelection(event.target.value)} placeholder={selectedStock.chipNumbers.join(', ')} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono" /><span className="block text-[10px] text-slate-500 mt-1">Chipهای ثبت‌شده گروه: {selectedStock.chipNumbers.join(' · ')}</span></label> : null}
  </> : null;

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Icon className="w-6 h-6 text-amber-400" />{meta.title}</h1><p className="text-xs text-slate-400 mt-1">{meta.subtitle}</p></div>
      <button onClick={() => { setMessage(''); setShowForm(true); }} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold"><Plus className="w-4 h-4 inline ml-1" />{meta.button}</button>
    </div>

    {message && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">{message}</div>}

    {mode === 'mortality' && <div className="space-y-3">{mortalityRecords.map((record) => <div key={record.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4"><div className="w-20 h-20 bg-slate-950 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">{record.photoUrl ? <img src={record.photoUrl} alt="mortality" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-slate-700" />}</div><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-white">{record.pondName} · {formatNumber(record.count)} قطعه</strong><span className="text-xs text-slate-500">{formatDate(record.timestamp)}</span></div><div className="text-[10px] text-cyan-300 mt-1">{record.speciesName} · {record.stockSex || 'Unknown'}{record.chipNumbers?.length ? ` · Chip: ${record.chipNumbers.join(', ')}` : ''}</div><p className="text-xs text-rose-300 mt-2">{record.reason}</p><p className="text-xs text-slate-400 mt-1">{record.description}</p><span className="text-[10px] text-slate-500">وزن {record.estimatedWeightKg} kg · ثبت: {record.recordedBy}</span></div></div>)}</div>}

    {mode === 'treatments' && <div className="space-y-3">{treatments.map((treatment) => <div key={treatment.id} className={`bg-slate-900 border rounded-2xl p-5 ${treatment.status === 'ACTIVE' ? 'border-rose-500/40' : 'border-slate-800'}`}><div className="flex flex-wrap justify-between gap-3"><div><strong className="text-white">{treatment.pondName} · {treatment.drugName}</strong><p className="text-xs text-slate-400 mt-1">{treatment.diagnosis}</p></div><div className="flex items-center gap-2"><span className={treatment.status === 'ACTIVE' ? 'text-rose-400 text-xs font-bold' : 'text-emerald-400 text-xs font-bold'}>{treatment.status}</span>{treatment.status === 'ACTIVE' && <button type="button" onClick={() => finishTreatment(treatment.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />تکمیل درمان</button>}</div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3"><Info label="مقدار ثبت‌شده" value={`${treatment.dose} ${treatment.doseUnit}`} /><Info label="پایان درمان" value={treatment.endDate} /><Info label="پایان دوره منع مصرف" value={treatment.withdrawalEndDate} accent /><Info label="ثبت بعدی" value={treatment.nextDoseDate || '—'} /></div><div className="mt-3 text-[10px] text-slate-500">این بخش فقط ثبت و انطباق اداری است و توصیه درمانی یا محاسبه مقدار مصرف ارائه نمی‌کند.</div></div>)}</div>}

    {mode === 'transfers' && <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">تاریخ</th><th className="p-3">مسیر</th><th className="p-3">گروه</th><th className="p-3">تعداد</th><th className="p-3">بیومس</th><th className="p-3">اپراتور</th></tr></thead><tbody className="divide-y divide-slate-800">{transfers.map((transfer) => <tr key={transfer.id} className="text-slate-300"><td className="p-3">{transfer.date}</td><td className="p-3 text-white">{transfer.sourceName} → {transfer.destinationName}</td><td className="p-3">{transfer.speciesName} · {transfer.stockSex || 'Unknown'}</td><td className="p-3">{formatNumber(transfer.fishCount)}</td><td className="p-3">{transfer.totalBiomassKg} kg</td><td className="p-3">{transfer.operator}</td></tr>)}</tbody></table></div></div>}

    {showForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-auto"><h2 className="text-white font-bold mb-4">{meta.button}</h2>
      {(mode === 'mortality' || mode === 'transfers') && <div className="grid md:grid-cols-2 gap-3 text-xs mb-4"><label className="text-slate-400">استخر مبدا<select value={pondId} onChange={(event) => { setPondId(event.target.value); setDestinationId(''); }} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label>{stockSelector}</div>}
      {mode === 'treatments' && <div className="grid md:grid-cols-2 gap-3 text-xs mb-4"><label className="text-slate-400">استخر<select value={pondId} onChange={(event) => setPondId(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label><div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-[10px] text-slate-400">ثبت درمان در سطح استخر انجام می‌شود؛ محاسبه یا پیشنهاد مقدار مصرف توسط ERP انجام نمی‌شود.</div></div>}

      {mode === 'mortality' && <form onSubmit={submitMortality} className="space-y-3 text-xs"><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">تعداد<input type="number" min="1" max={selectedStock?.count || 1} value={count} onChange={(event) => setCount(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label><label className="text-slate-400">وزن تخمینی کل تلفات kg<input type="number" min="0" step="0.001" value={mortalityWeight} onChange={(event) => setMortalityWeight(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label></div><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="علت" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="شرح" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input type="file" accept="image/*" onChange={(event) => loadPhoto(event.target.files?.[0])} className="w-full text-slate-400" /><Actions onCancel={() => setShowForm(false)} submit="ثبت تلفات" /></form>}

      {mode === 'transfers' && <form onSubmit={submitTransfer} className="space-y-3 text-xs"><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">نوع مقصد<select value={destinationType} onChange={(event) => { setDestinationType(event.target.value as 'Pond' | 'Nursery'); setDestinationId(''); }} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="Pond">استخر</option><option value="Nursery">نرسری</option></select></label><label className="text-slate-400">مقصد<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="">انتخاب...</option>{destinationType === 'Pond' ? ponds.filter((pond) => pond.id !== selectedPond?.id).map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>) : nurseryTanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.code} · {tank.status}</option>)}</select></label></div><label className="text-slate-400">تعداد<input type="number" min="1" max={selectedStock?.count || 1} value={transferCount} onChange={(event) => setTransferCount(event.target.value)} required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label><textarea value={transferReason} onChange={(event) => setTransferReason(event.target.value)} placeholder="علت انتقال" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><Actions onCancel={() => setShowForm(false)} submit="ثبت انتقال اتمیک" /></form>}

      {mode === 'treatments' && <form onSubmit={submitTreatment} className="space-y-3 text-xs"><div className="grid md:grid-cols-2 gap-3"><input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="تشخیص ثبت‌شده" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={drugName} onChange={(event) => setDrugName(event.target.value)} placeholder="نام دارو/ماده ثبت‌شده" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input type="number" min="0.0001" step="any" value={dose} onChange={(event) => setDose(event.target.value)} placeholder="مقدار طبق دستور دامپزشک" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><select value={doseUnit} onChange={(event) => setDoseUnit(event.target.value as TreatmentRecord['doseUnit'])} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option>mg/L</option><option>g/m3</option><option>g/kg feed</option><option>ml/m3</option><option>ppm</option></select><select value={administrationMethod} onChange={(event) => setAdministrationMethod(event.target.value as TreatmentRecord['administrationMethod'])} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option>Bath (حمام)</option><option>Oral (خوراکی)</option><option>Injection (تزریقی)</option><option>Continuous Flow</option></select><input value={veterinarian} onChange={(event) => setVeterinarian(event.target.value)} placeholder="دامپزشک/مسئول ثبت" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></div><div className="grid md:grid-cols-4 gap-3"><label className="text-slate-400">شروع<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white" /></label><label className="text-slate-400">پایان<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white" /></label><label className="text-slate-400">ثبت بعدی<input type="date" value={nextDoseDate} onChange={(event) => setNextDoseDate(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white" /></label><label className="text-slate-400">دوره منع مصرف (روز)<input type="number" min="0" step="1" value={withdrawalDays} onChange={(event) => setWithdrawalDays(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white" /></label></div><Actions onCancel={() => setShowForm(false)} submit="ثبت رکورد اداری درمان" /></form>}
    </div></div>}
  </div>;
};

const Info: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-500 block">{label}</span><strong className={accent ? 'text-amber-400' : 'text-white'}>{value}</strong></div>;
const Actions: React.FC<{ onCancel: () => void; submit: string }> = ({ onCancel, submit }) => <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">{submit}</button></div>;
