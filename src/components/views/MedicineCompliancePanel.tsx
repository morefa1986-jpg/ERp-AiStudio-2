import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, PackagePlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import {
  createMedicineLot, listMedicineAdministrations, listMedicineLots, MedicineAdministrationRecord,
  MedicineLotRecord, recordMedicineAdministration, setMedicineLotActive,
} from '../../services/medicineLedgerService';

export const MedicineCompliancePanel: React.FC = () => {
  const { currentUser } = useAuth();
  const { treatments } = useFarm();
  const [lots, setLots] = useState<MedicineLotRecord[]>([]);
  const [administrations, setAdministrations] = useState<MedicineAdministrationRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lotForm, setLotForm] = useState({ medicineName: '', lotNumber: '', expiryDate: '', supplier: '', receivedQuantity: '', unit: '' });
  const [adminForm, setAdminForm] = useState({ treatmentId: '', lotId: '', quantityRecorded: '', notes: '' });

  const canLotWrite = ['Super Admin', 'Farm Owner', 'Farm Manager', 'Veterinarian', 'Warehouse Manager'].includes(String(currentUser?.role || ''));
  const canAdminWrite = ['Super Admin', 'Farm Owner', 'Farm Manager', 'Veterinarian'].includes(String(currentUser?.role || ''));
  const selectedTreatment = treatments.find((row) => row.id === adminForm.treatmentId);
  const compatibleLots = useMemo(() => lots.filter((lot) => lot.isActive && (!selectedTreatment || lot.medicineName.trim().toLowerCase() === selectedTreatment.drugName.trim().toLowerCase())), [lots, selectedTreatment]);
  const selectedLot = lots.find((row) => row.id === adminForm.lotId);

  const load = async () => {
    try {
      const [lotRows, adminRows] = await Promise.all([listMedicineLots(), listMedicineAdministrations()]);
      setLots(lotRows); setAdministrations(adminRows);
    } catch (error) { setMessage(`خواندن دفتر دارو انجام نشد: ${error instanceof Error ? error.message : 'UNKNOWN'}`); }
  };
  useEffect(() => { void load(); }, []);

  const submitLot = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      await createMedicineLot({ ...lotForm, receivedQuantity: Number(lotForm.receivedQuantity) });
      setLotForm({ medicineName: '', lotNumber: '', expiryDate: '', supplier: '', receivedQuantity: '', unit: '' });
      setMessage('لات دارو در دفتر Compliance ثبت شد.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'MEDICINE_LOT_CREATE_FAILED'); }
    finally { setBusy(false); }
  };

  const submitAdministration = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!selectedTreatment || !selectedLot) { setMessage('Treatment و Lot معتبر انتخاب کنید.'); return; }
    setBusy(true);
    try {
      await recordMedicineAdministration({ treatmentId: selectedTreatment.id, lotId: selectedLot.id, quantityRecorded: Number(adminForm.quantityRecorded), unit: selectedLot.unit, notes: adminForm.notes.trim() });
      setAdminForm({ treatmentId: '', lotId: '', quantityRecorded: '', notes: '' });
      setMessage('مصرف ثبت‌شده به Treatment و Lot متصل شد. این بخش فقط ثبت اداری است و هیچ دوزی پیشنهاد یا محاسبه نمی‌کند.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'MEDICINE_ADMINISTRATION_FAILED'); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div className="bg-slate-900 border border-violet-500/20 rounded-2xl p-5"><h2 className="text-base font-black text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-violet-400" />دفتر ردیابی دارو و Lot</h2><p className="text-xs text-slate-400 mt-1">ثبت اداری موجودی Lot، انقضا، تأمین‌کننده و مصرف ثبت‌شده متصل به Treatment. این بخش برای محاسبه یا پیشنهاد مقدار درمان استفاده نمی‌شود.</p></div>
    {message && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">{message}</div>}

    <div className="grid xl:grid-cols-2 gap-4">
      {canLotWrite && <form onSubmit={submitLot} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs"><h3 className="font-bold text-white flex items-center gap-2"><PackagePlus className="w-4 h-4 text-violet-400" />ثبت Lot جدید</h3><div className="grid md:grid-cols-2 gap-2"><input className="field" value={lotForm.medicineName} onChange={(e) => setLotForm({ ...lotForm, medicineName: e.target.value })} placeholder="نام دارو مطابق پرونده" required /><input className="field" value={lotForm.lotNumber} onChange={(e) => setLotForm({ ...lotForm, lotNumber: e.target.value })} placeholder="Lot / Batch No." required /><input className="field" type="date" value={lotForm.expiryDate} onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })} required /><input className="field" value={lotForm.supplier} onChange={(e) => setLotForm({ ...lotForm, supplier: e.target.value })} placeholder="تأمین‌کننده" required /><input className="field" type="number" min="0" step="0.0001" value={lotForm.receivedQuantity} onChange={(e) => setLotForm({ ...lotForm, receivedQuantity: e.target.value })} placeholder="مقدار دریافت‌شده" required /><input className="field" value={lotForm.unit} onChange={(e) => setLotForm({ ...lotForm, unit: e.target.value })} placeholder="واحد ثبت انبار" required /></div><button disabled={busy} className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold disabled:opacity-40">ثبت Lot</button></form>}

      {canAdminWrite && <form onSubmit={submitAdministration} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs"><h3 className="font-bold text-white flex items-center gap-2"><ClipboardList className="w-4 h-4 text-violet-400" />ثبت مصرف از سند درمان</h3><select className="field" value={adminForm.treatmentId} onChange={(e) => setAdminForm({ ...adminForm, treatmentId: e.target.value, lotId: '' })} required><option value="">انتخاب Treatment</option>{treatments.map((t) => <option key={t.id} value={t.id}>{t.pondName} · {t.drugName} · {t.status}</option>)}</select><select className="field" value={adminForm.lotId} onChange={(e) => setAdminForm({ ...adminForm, lotId: e.target.value })} required><option value="">Lot سازگار</option>{compatibleLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · باقی‌مانده {lot.remainingQuantity} {lot.unit} · انقضا {lot.expiryDate}</option>)}</select><input className="field" type="number" min="0" step="0.0001" value={adminForm.quantityRecorded} onChange={(e) => setAdminForm({ ...adminForm, quantityRecorded: e.target.value })} placeholder={selectedLot ? `مقدار مصرف ثبت‌شده (${selectedLot.unit})` : 'مقدار مصرف ثبت‌شده'} required /><textarea className="field min-h-20" value={adminForm.notes} onChange={(e) => setAdminForm({ ...adminForm, notes: e.target.value })} placeholder="یادداشت/شماره سند دامپزشک (بدون محاسبه دوز)" /><button disabled={busy} className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold disabled:opacity-40">ثبت در Ledger</button></form>}
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-x-auto"><h3 className="text-sm font-bold text-white mb-3">Lotها</h3><table className="w-full text-xs text-right"><thead className="text-slate-500"><tr><th className="p-2">دارو/Lot</th><th className="p-2">انقضا</th><th className="p-2">دریافت</th><th className="p-2">ثبت مصرف</th><th className="p-2">باقی‌مانده</th><th className="p-2">وضعیت</th></tr></thead><tbody className="divide-y divide-slate-800">{lots.map((lot) => <tr key={lot.id}><td className="p-2 text-white">{lot.medicineName}<span className="block font-mono text-violet-300">{lot.lotNumber}</span></td><td className="p-2">{lot.expiryDate}</td><td className="p-2">{lot.receivedQuantity} {lot.unit}</td><td className="p-2">{lot.administeredQuantity} {lot.unit}</td><td className="p-2 font-bold">{lot.remainingQuantity} {lot.unit}</td><td className="p-2"><button disabled={!canLotWrite || busy} onClick={() => void setMedicineLotActive(lot.id, !lot.isActive).then(load)} className={lot.isActive ? 'text-emerald-400' : 'text-slate-500'}>{lot.isActive ? 'فعال' : 'غیرفعال'}</button></td></tr>)}</tbody></table></div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-x-auto"><h3 className="text-sm font-bold text-white mb-3">Administration Ledger</h3><table className="w-full text-xs text-right"><thead className="text-slate-500"><tr><th className="p-2">زمان</th><th className="p-2">Treatment</th><th className="p-2">دارو/Lot</th><th className="p-2">مقدار ثبت‌شده</th><th className="p-2">Withdrawal تا</th><th className="p-2">ثبت‌کننده</th></tr></thead><tbody className="divide-y divide-slate-800">{administrations.map((row) => <tr key={row.id}><td className="p-2 font-mono text-slate-400">{new Date(row.timestamp).toLocaleString()}</td><td className="p-2 font-mono">{row.treatmentId}</td><td className="p-2 text-white">{row.medicineName}<span className="block font-mono text-violet-300">{row.lotNumber}</span></td><td className="p-2">{row.quantityRecorded} {row.unit}</td><td className="p-2 text-amber-300">{row.withdrawalEndDate || '—'}</td><td className="p-2">{row.recordedBy}</td></tr>)}</tbody></table></div>
    <style>{`.field{width:100%;background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white;outline:none}.field:focus{border-color:#7c3aed}`}</style>
  </section>;
};
