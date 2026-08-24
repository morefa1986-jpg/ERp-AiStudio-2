import React, { useEffect, useMemo, useState } from 'react';
import { FileCheck2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { CitesPermitRecord, createCitesPermit, listCitesPermits, setCitesPermitStatus } from '../../services/citesService';

export const CitesRegistryPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const { processingBatches } = useFarm();
  const [permits, setPermits] = useState<CitesPermitRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ batchCode: '', permitNumber: '', speciesName: '', productScope: 'CAVIAR' as CitesPermitRecord['productScope'], destinationCountry: '', issueDate: '', expiryDate: '', issuerReference: '', notes: '' });
  const canWrite = ['Super Admin','Farm Owner','Farm Manager','Processing Manager','Sales Manager'].includes(String(currentUser?.role || ''));
  const batch = processingBatches.find((row) => row.batchCode === form.batchCode);
  const availableBatches = useMemo(() => processingBatches.filter((row) => Boolean(row.citesPermitNumber?.trim())), [processingBatches]);

  const load = async () => {
    try { setPermits(await listCitesPermits()); }
    catch (error) { setMessage(`خواندن CITES Registry انجام نشد: ${error instanceof Error ? error.message : 'UNKNOWN'}`); }
  };
  useEffect(() => { void load(); }, []);

  const selectBatch = (batchCode: string) => {
    const selected = processingBatches.find((row) => row.batchCode === batchCode);
    setForm((previous) => ({ ...previous, batchCode, permitNumber: selected?.citesPermitNumber || '', speciesName: selected?.speciesName || '' }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      await createCitesPermit({
        permitNumber: form.permitNumber.trim(), batchCode: form.batchCode, speciesName: form.speciesName.trim(), productScope: form.productScope,
        destinationCountry: form.destinationCountry.trim() || undefined, issueDate: form.issueDate, expiryDate: form.expiryDate,
        issuerReference: form.issuerReference.trim(), notes: form.notes.trim(),
      });
      setMessage('Permit در Registry داخلی ثبت شد. این ثبت، تأیید آنلاین از مرجع رسمی CITES نیست.');
      setForm({ batchCode: '', permitNumber: '', speciesName: '', productScope: 'CAVIAR', destinationCountry: '', issueDate: '', expiryDate: '', issuerReference: '', notes: '' });
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'CITES_PERMIT_CREATE_FAILED'); }
    finally { setBusy(false); }
  };

  const statusTone = (permit: CitesPermitRecord) => {
    const expired = permit.expiryDate < new Date().toISOString().slice(0, 10);
    if (expired || permit.status === 'REVOKED') return 'text-rose-400';
    if (permit.status === 'SUSPENDED') return 'text-amber-300';
    return 'text-emerald-400';
  };

  return <section className="space-y-4">
    <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><h2 className="text-base font-black text-white flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-emerald-400" />CITES Permit Registry داخلی</h2><p className="text-xs text-slate-400 mt-1">Permit به Processing Batch، گونه، مقصد و بازه اعتبار متصل می‌شود. Dispatch صادراتی قبل از خروج باید از همین Registry تأیید شود.</p></div><div className="text-[10px] text-amber-200 border border-amber-500/20 bg-amber-500/10 px-3 py-2 rounded-xl flex gap-2"><ShieldAlert className="w-4 h-4" />External CITES verification: NOT CONNECTED</div></div>
    {message && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">{message}</div>}
    <div className="grid xl:grid-cols-[420px_1fr] gap-4">
      {canWrite && <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs"><h3 className="text-sm font-bold text-white">ثبت Permit</h3><select className="field" value={form.batchCode} onChange={(e) => selectBatch(e.target.value)} required><option value="">انتخاب Processing Batch</option>{availableBatches.map((row) => <option key={row.id} value={row.batchCode}>{row.batchCode} · {row.speciesName} · {row.citesPermitNumber}</option>)}</select><input className="field font-mono" value={form.permitNumber} onChange={(e) => setForm({ ...form, permitNumber: e.target.value })} placeholder="Permit Number" required /><input className="field" value={form.speciesName} onChange={(e) => setForm({ ...form, speciesName: e.target.value })} placeholder="Species" required /><select className="field" value={form.productScope} onChange={(e) => setForm({ ...form, productScope: e.target.value as CitesPermitRecord['productScope'] })}><option value="CAVIAR">Caviar</option><option value="STURGEON_PRODUCT">Sturgeon Product</option></select><input className="field" value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })} placeholder="کشور مقصد (اختیاری؛ اگر ثبت شود enforce می‌شود)" /><div className="grid grid-cols-2 gap-2"><label className="text-slate-400">تاریخ صدور<input className="field mt-1" type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required /></label><label className="text-slate-400">تاریخ انقضا<input className="field mt-1" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} required /></label></div><input className="field" value={form.issuerReference} onChange={(e) => setForm({ ...form, issuerReference: e.target.value })} placeholder="مرجع/شماره سند صادرکننده" required /><textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="یادداشت" /><button disabled={busy || !batch} className="w-full px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-40">ثبت در Registry</button></form>}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-x-auto"><table className="w-full text-xs text-right"><thead className="text-slate-500"><tr><th className="p-2">Permit</th><th className="p-2">Batch / Species</th><th className="p-2">مقصد</th><th className="p-2">اعتبار</th><th className="p-2">وضعیت</th><th className="p-2">عملیات</th></tr></thead><tbody className="divide-y divide-slate-800">{permits.map((permit) => <tr key={permit.id}><td className="p-2 font-mono text-emerald-300">{permit.permitNumber}</td><td className="p-2 text-white">{permit.batchCode}<span className="block text-[10px] text-slate-500">{permit.speciesName} · {permit.productScope}</span></td><td className="p-2">{permit.destinationCountry || 'هر مقصد ثبت‌شده در پروفرما'}</td><td className="p-2 font-mono text-[10px]">{permit.issueDate} → {permit.expiryDate}</td><td className={`p-2 font-bold ${statusTone(permit)}`}>{permit.status}{permit.expiryDate < new Date().toISOString().slice(0, 10) ? ' · EXPIRED' : ''}</td><td className="p-2">{canWrite && <select disabled={busy} value={permit.status} onChange={(e) => void setCitesPermitStatus(permit.id, e.target.value as CitesPermitRecord['status']).then(load).catch((error) => setMessage(error instanceof Error ? error.message : 'CITES_UPDATE_FAILED'))} className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-[10px] text-white"><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option><option value="REVOKED">REVOKED</option></select>}</td></tr>)}</tbody></table>{!permits.length && <div className="text-center text-xs text-slate-500 py-8">Permit ثبت‌شده‌ای وجود ندارد.</div>}</div>
    </div><style>{`.field{width:100%;background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white;outline:none}.field:focus{border-color:#10b981}`}</style>
  </section>;
};
