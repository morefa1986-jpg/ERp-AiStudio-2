import React, { useMemo, useState } from 'react';
import { Building2, CircleDot, Fish, Plus, Save, ShieldAlert } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { createHallMaster, createPondMaster, createSpeciesMaster, updateHallMaster, updatePondMaster } from '../../services/masterDataService';

type Tab = 'halls' | 'ponds' | 'species';
type PondShape = 'Rectangular' | 'Circular' | 'Other';
type StockSex = 'Female' | 'Male' | 'Unknown';

type StockDraft = {
  speciesId: string;
  sex: StockSex;
  count: string;
  averageWeightKg: string;
  chipNumbers: string;
};

const emptyStock = (): StockDraft => ({ speciesId: '', sex: 'Unknown', count: '0', averageWeightKg: '0', chipNumbers: '' });

export const MasterDataAdminPanel: React.FC = () => {
  const { halls, ponds, species, syncStatus } = useFarm();
  const [tab, setTab] = useState<Tab>('halls');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [hallForm, setHallForm] = useState({ number: '', name: '', description: '' });
  const [pondForm, setPondForm] = useState({ hallId: '', number: '', name: '', shape: 'Rectangular' as PondShape, lengthMeters: '', widthMeters: '', depthMeters: '', diameterMeters: '', capacityCubicMeters: '', notes: '' });
  const [stocks, setStocks] = useState<StockDraft[]>([emptyStock()]);
  const [speciesForm, setSpeciesForm] = useState({ faName: '', enName: '', scientificName: '', origin: '', geneticLine: '', description: '', optimumTempMin: '14', optimumTempMax: '18.5', optimumDOMin: '6', optimumpHMin: '7', optimumpHMax: '8.2', standardFCR: '1.1', feedingProfileCoeff: '1', caviarMaturityYears: '8' });

  const hasPendingSync = syncStatus.pendingChangesCount > 0 || syncStatus.status === 'SYNCING' || syncStatus.status === 'PENDING_CHANGES';
  const activeHalls = useMemo(() => halls.filter((hall) => hall.isActive !== false), [halls]);

  const guarded = async (action: () => Promise<unknown>, successText: string) => {
    setMessage('');
    if (hasPendingSync) {
      setMessage('ابتدا تغییرات آفلاین/درحال‌همگام‌سازی را کامل کنید؛ تغییر ساختار Master Data تا صفر شدن صف Sync مجاز نیست.');
      return;
    }
    setBusy(true);
    try {
      await action();
      setMessage(successText);
      // Structural changes are server-authoritative. Reload only after a clean outbox so every context receives the same state/version.
      window.location.reload();
    } catch (error) {
      setMessage(`ذخیره انجام نشد: ${error instanceof Error ? error.message : 'MASTER_DATA_FAILED'}`);
      setBusy(false);
    }
  };

  const submitHall = (event: React.FormEvent) => {
    event.preventDefault();
    void guarded(
      () => createHallMaster({ number: hallForm.number.trim(), name: hallForm.name.trim(), description: hallForm.description.trim() }),
      'سالن روی Server ثبت شد.',
    );
  };

  const submitPond = (event: React.FormEvent) => {
    event.preventDefault();
    const stockGroups = stocks
      .filter((row) => row.speciesId || Number(row.count) > 0 || row.chipNumbers.trim())
      .map((row) => ({
        speciesId: row.speciesId,
        sex: row.sex,
        count: Number(row.count),
        averageWeightKg: Number(row.averageWeightKg),
        chipNumbers: row.chipNumbers.split(',').map((item) => item.trim()).filter(Boolean),
      }));
    const numeric = (value: string) => value.trim() === '' ? undefined : Number(value);
    void guarded(
      () => createPondMaster({
        hallId: pondForm.hallId,
        number: pondForm.number.trim(),
        name: pondForm.name.trim(),
        shape: pondForm.shape,
        lengthMeters: numeric(pondForm.lengthMeters),
        widthMeters: numeric(pondForm.widthMeters),
        depthMeters: numeric(pondForm.depthMeters),
        diameterMeters: numeric(pondForm.diameterMeters),
        capacityCubicMeters: numeric(pondForm.capacityCubicMeters),
        stockGroups,
        notes: pondForm.notes.trim(),
      }),
      'استخر و موجودی اولیه روی Server ثبت شد.',
    );
  };

  const submitSpecies = (event: React.FormEvent) => {
    event.preventDefault();
    void guarded(
      () => createSpeciesMaster({
        faName: speciesForm.faName.trim(), enName: speciesForm.enName.trim(), scientificName: speciesForm.scientificName.trim(),
        origin: speciesForm.origin.trim(), geneticLine: speciesForm.geneticLine.trim(), description: speciesForm.description.trim(),
        optimumTempMin: Number(speciesForm.optimumTempMin), optimumTempMax: Number(speciesForm.optimumTempMax), optimumDOMin: Number(speciesForm.optimumDOMin),
        optimumpHMin: Number(speciesForm.optimumpHMin), optimumpHMax: Number(speciesForm.optimumpHMax), standardFCR: Number(speciesForm.standardFCR),
        feedingProfileCoeff: Number(speciesForm.feedingProfileCoeff), caviarMaturityYears: Number(speciesForm.caviarMaturityYears),
      }),
      'گونه روی Server ثبت شد.',
    );
  };

  const deactivateHall = (id: string) => void guarded(() => updateHallMaster(id, { isActive: false }), 'سالن غیرفعال شد.');
  const deactivatePond = (id: string) => void guarded(() => updatePondMaster(id, { isActive: false }), 'استخر غیرفعال شد.');

  return <section className="space-y-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white">Master Data مزرعه</h2>
          <p className="text-xs text-slate-400 mt-1">سالن، استخر، ابعاد/حجم، موجودی اولیه و گونه‌ها مستقیماً روی Server ثبت می‌شوند. حذف فیزیکی انجام نمی‌شود؛ سوابق با غیرفعال‌سازی حفظ می‌شوند.</p>
        </div>
        <div className={`text-[11px] px-3 py-2 rounded-xl border ${hasPendingSync ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
          {hasPendingSync ? `Master Data Locked · ${syncStatus.pendingChangesCount} تغییر در صف Sync` : 'Server-authoritative · آماده تغییر ساختاری'}
        </div>
      </div>
    </div>

    {message && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200">{message}</div>}

    <div className="flex flex-wrap gap-2">
      <button onClick={() => setTab('halls')} className={`tab ${tab === 'halls' ? 'tab-on' : ''}`}><Building2 className="w-4 h-4" />سالن‌ها</button>
      <button onClick={() => setTab('ponds')} className={`tab ${tab === 'ponds' ? 'tab-on' : ''}`}><CircleDot className="w-4 h-4" />استخرها</button>
      <button onClick={() => setTab('species')} className={`tab ${tab === 'species' ? 'tab-on' : ''}`}><Fish className="w-4 h-4" />گونه‌ها</button>
    </div>

    {tab === 'halls' && <div className="grid xl:grid-cols-[420px_1fr] gap-4">
      <form onSubmit={submitHall} className="card space-y-3">
        <h3 className="title"><Plus className="w-4 h-4 text-amber-400" />سالن جدید</h3>
        <input className="field" value={hallForm.number} onChange={(e) => setHallForm({ ...hallForm, number: e.target.value })} placeholder="کد/شماره سالن" required />
        <input className="field" value={hallForm.name} onChange={(e) => setHallForm({ ...hallForm, name: e.target.value })} placeholder="نام سالن" required />
        <textarea className="field min-h-24" value={hallForm.description} onChange={(e) => setHallForm({ ...hallForm, description: e.target.value })} placeholder="توضیحات" />
        <button disabled={busy || hasPendingSync} className="save"><Save className="w-4 h-4" />ثبت روی Server</button>
      </form>
      <div className="card overflow-x-auto"><table className="w-full text-xs text-right"><thead className="text-slate-500"><tr><th className="p-2">سالن</th><th className="p-2">استخر</th><th className="p-2">ماهی</th><th className="p-2">بیومس</th><th className="p-2">وضعیت</th><th className="p-2"></th></tr></thead><tbody className="divide-y divide-slate-800">{halls.map((hall) => <tr key={hall.id}><td className="p-2 text-white">{hall.number} · {hall.name}</td><td className="p-2">{hall.pondCount}</td><td className="p-2">{hall.totalFishCount.toLocaleString()}</td><td className="p-2">{hall.totalBiomassKg.toLocaleString()} kg</td><td className="p-2">{hall.isActive === false ? 'غیرفعال' : 'فعال'}</td><td className="p-2">{hall.isActive !== false && <button disabled={busy || hasPendingSync} onClick={() => deactivateHall(hall.id)} className="danger">غیرفعال</button>}</td></tr>)}</tbody></table></div>
    </div>}

    {tab === 'ponds' && <div className="space-y-4">
      <form onSubmit={submitPond} className="card space-y-4">
        <div className="flex items-center justify-between"><h3 className="title"><Plus className="w-4 h-4 text-amber-400" />استخر جدید</h3><span className="text-[10px] text-amber-300">استخر جدید با Feeding=STOPPED و Sensor=OFFLINE ساخته می‌شود.</span></div>
        <div className="grid md:grid-cols-4 gap-3"><select className="field" value={pondForm.hallId} onChange={(e) => setPondForm({ ...pondForm, hallId: e.target.value })} required><option value="">انتخاب سالن</option>{activeHalls.map((hall) => <option key={hall.id} value={hall.id}>{hall.number} · {hall.name}</option>)}</select><input className="field" value={pondForm.number} onChange={(e) => setPondForm({ ...pondForm, number: e.target.value })} placeholder="شماره استخر" required /><input className="field" value={pondForm.name} onChange={(e) => setPondForm({ ...pondForm, name: e.target.value })} placeholder="نام استخر" required /><select className="field" value={pondForm.shape} onChange={(e) => setPondForm({ ...pondForm, shape: e.target.value as PondShape })}><option value="Rectangular">مستطیلی</option><option value="Circular">دایره‌ای</option><option value="Other">سایر / حجم دستی</option></select></div>
        {pondForm.shape === 'Rectangular' && <div className="grid md:grid-cols-3 gap-3"><input className="field" type="number" min="0" step="0.001" value={pondForm.lengthMeters} onChange={(e) => setPondForm({ ...pondForm, lengthMeters: e.target.value })} placeholder="طول متر" required /><input className="field" type="number" min="0" step="0.001" value={pondForm.widthMeters} onChange={(e) => setPondForm({ ...pondForm, widthMeters: e.target.value })} placeholder="عرض متر" required /><input className="field" type="number" min="0" step="0.001" value={pondForm.depthMeters} onChange={(e) => setPondForm({ ...pondForm, depthMeters: e.target.value })} placeholder="عمق متر" required /></div>}
        {pondForm.shape === 'Circular' && <div className="grid md:grid-cols-2 gap-3"><input className="field" type="number" min="0" step="0.001" value={pondForm.diameterMeters} onChange={(e) => setPondForm({ ...pondForm, diameterMeters: e.target.value })} placeholder="قطر متر" required /><input className="field" type="number" min="0" step="0.001" value={pondForm.depthMeters} onChange={(e) => setPondForm({ ...pondForm, depthMeters: e.target.value })} placeholder="عمق متر" required /></div>}
        {pondForm.shape === 'Other' && <input className="field" type="number" min="0" step="0.001" value={pondForm.capacityCubicMeters} onChange={(e) => setPondForm({ ...pondForm, capacityCubicMeters: e.target.value })} placeholder="حجم متر مکعب" required />}
        <div className="space-y-2"><div className="flex items-center justify-between"><strong className="text-xs text-white">موجودی اولیه بر اساس گونه / جنسیت</strong><button type="button" onClick={() => setStocks((prev) => [...prev, emptyStock()])} className="mini"><Plus className="w-3 h-3" />گروه</button></div>{stocks.map((row, index) => <div key={index} className="grid md:grid-cols-5 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3"><select className="field" value={row.speciesId} onChange={(e) => setStocks((prev) => prev.map((item, i) => i === index ? { ...item, speciesId: e.target.value } : item))}><option value="">گونه</option>{species.map((item) => <option key={item.id} value={item.id}>{item.faName} · {item.scientificName}</option>)}</select><select className="field" value={row.sex} onChange={(e) => setStocks((prev) => prev.map((item, i) => i === index ? { ...item, sex: e.target.value as StockSex } : item))}><option value="Unknown">نامشخص</option><option value="Female">ماده</option><option value="Male">نر</option></select><input className="field" type="number" min="0" step="1" value={row.count} onChange={(e) => setStocks((prev) => prev.map((item, i) => i === index ? { ...item, count: e.target.value } : item))} placeholder="تعداد" /><input className="field" type="number" min="0" step="0.001" value={row.averageWeightKg} onChange={(e) => setStocks((prev) => prev.map((item, i) => i === index ? { ...item, averageWeightKg: e.target.value } : item))} placeholder="میانگین وزن kg" /><input className="field" value={row.chipNumbers} onChange={(e) => setStocks((prev) => prev.map((item, i) => i === index ? { ...item, chipNumbers: e.target.value } : item))} placeholder="Chipها با ," /></div>)}</div>
        <textarea className="field min-h-20" value={pondForm.notes} onChange={(e) => setPondForm({ ...pondForm, notes: e.target.value })} placeholder="یادداشت" />
        <button disabled={busy || hasPendingSync} className="save"><Save className="w-4 h-4" />ثبت استخر روی Server</button>
      </form>
      <div className="card overflow-x-auto"><table className="w-full text-xs text-right"><thead className="text-slate-500"><tr><th className="p-2">استخر</th><th className="p-2">سالن</th><th className="p-2">حجم</th><th className="p-2">تعداد</th><th className="p-2">بیومس</th><th className="p-2">خوراک</th><th className="p-2"></th></tr></thead><tbody className="divide-y divide-slate-800">{ponds.map((pond: any) => <tr key={pond.id}><td className="p-2 text-white">{pond.number} · {pond.name}</td><td className="p-2">{halls.find((hall) => hall.id === pond.hallId)?.name || pond.hallId}</td><td className="p-2">{pond.capacityCubicMeters} m³</td><td className="p-2">{pond.fishCount.toLocaleString()}</td><td className="p-2">{pond.biomassKg.toLocaleString()} kg</td><td className="p-2">{pond.feedingStatus}</td><td className="p-2">{pond.isActive !== false && <button disabled={busy || hasPendingSync} onClick={() => deactivatePond(pond.id)} className="danger">غیرفعال</button>}</td></tr>)}</tbody></table></div>
    </div>}

    {tab === 'species' && <div className="grid xl:grid-cols-[520px_1fr] gap-4">
      <form onSubmit={submitSpecies} className="card space-y-3"><h3 className="title"><Plus className="w-4 h-4 text-amber-400" />گونه جدید</h3><div className="grid grid-cols-2 gap-2"><input className="field" value={speciesForm.faName} onChange={(e) => setSpeciesForm({ ...speciesForm, faName: e.target.value })} placeholder="نام فارسی" required /><input className="field" value={speciesForm.enName} onChange={(e) => setSpeciesForm({ ...speciesForm, enName: e.target.value })} placeholder="English name" required /></div><input className="field" value={speciesForm.scientificName} onChange={(e) => setSpeciesForm({ ...speciesForm, scientificName: e.target.value })} placeholder="Scientific name" required /><div className="grid grid-cols-2 gap-2"><input className="field" value={speciesForm.origin} onChange={(e) => setSpeciesForm({ ...speciesForm, origin: e.target.value })} placeholder="منشأ" /><input className="field" value={speciesForm.geneticLine} onChange={(e) => setSpeciesForm({ ...speciesForm, geneticLine: e.target.value })} placeholder="خط ژنتیکی" /></div><textarea className="field min-h-20" value={speciesForm.description} onChange={(e) => setSpeciesForm({ ...speciesForm, description: e.target.value })} placeholder="توضیحات" /><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{(['optimumTempMin','optimumTempMax','optimumDOMin','optimumpHMin','optimumpHMax','standardFCR','feedingProfileCoeff','caviarMaturityYears'] as const).map((key) => <label key={key} className="text-[10px] text-slate-500">{key}<input className="field w-full mt-1" type="number" step="0.01" min="0" value={speciesForm[key]} onChange={(e) => setSpeciesForm({ ...speciesForm, [key]: e.target.value })} required /></label>)}</div><button disabled={busy || hasPendingSync} className="save"><Save className="w-4 h-4" />ثبت گونه روی Server</button></form>
      <div className="card space-y-2">{species.map((item) => <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3"><div className="flex justify-between gap-3"><div><strong className="text-white text-xs">{item.faName} · {item.enName}</strong><span className="block text-[10px] text-amber-400 font-mono mt-1">{item.scientificName}</span></div><span className="text-[10px] text-slate-500">FCR {item.standardFCR}</span></div><div className="mt-2 text-[10px] text-slate-400">Temp {item.optimumTempMin}–{item.optimumTempMax}°C · DO ≥ {item.optimumDOMin} · pH {item.optimumpHMin}–{item.optimumpHMax}</div></div>)}</div>
    </div>}

    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200 flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" />تغییر ساختاری فقط برای Super Admin/Farm Owner و فقط روی State همگام‌شده انجام می‌شود. این صفحه هیچ داده‌ای را با LocalStorage به‌عنوان منبع اصلی نگهداری نمی‌کند.</div>
    <style>{`.card{background:#0f172a;border:1px solid #1e293b;border-radius:1rem;padding:1rem}.title{display:flex;align-items:center;gap:.4rem;color:white;font-size:.8rem;font-weight:800}.field{background:#020617;border:1px solid #334155;border-radius:.75rem;padding:.65rem .75rem;color:white;font-size:.72rem;outline:none}.field:focus{border-color:#d4af37}.save{display:flex;align-items:center;justify-content:center;gap:.4rem;background:#d4af37;color:#020617;padding:.7rem 1rem;border-radius:.75rem;font-size:.72rem;font-weight:900}.save:disabled{opacity:.35;cursor:not-allowed}.tab{display:flex;align-items:center;gap:.35rem;background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:.75rem;padding:.55rem .8rem;font-size:.72rem;font-weight:700}.tab-on{background:#d4af37;color:#020617;border-color:#d4af37}.danger{background:#7f1d1d;color:#fecaca;border-radius:.55rem;padding:.35rem .55rem;font-size:.65rem}.mini{display:flex;align-items:center;gap:.25rem;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:.55rem;padding:.35rem .55rem;font-size:.65rem}`}</style>
  </section>;
};
