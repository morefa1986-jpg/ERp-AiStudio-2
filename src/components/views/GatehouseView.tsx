import React, { useState } from 'react';
import { DoorOpen, Plus, Printer, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { GatePassRecord } from '../../types';

const EMPTY = {
  direction: 'Exit (خروج)' as GatePassRecord['direction'],
  vehiclePlateNumber: '', vehicleType: '', driverName: '', driverNationalId: '', driverPhone: '',
  cargoOwnerName: '', cargoOwnerNationalId: '', cargoOwnerPhone: '', cargoType: '', cargoVolume: '', cargoQuality: '',
  waybillNumber: '', dispatchOrderNumber: '', transportPermitNumber: '', originAddress: '', destinationAddress: '',
  relatedDocumentId: '', relatedProformaId: '', notes: '',
};

export const GatehouseView: React.FC = () => {
  const { hasPermission } = useAuth();
  const { gatePasses, officeSettings, officeDocuments, proformas, addGatePass, updateGatePassStatus } = useFarm();
  const branding = officeSettings[0];
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [message, setMessage] = useState('');
  const [printPass, setPrintPass] = useState<GatePassRecord | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    const result = addGatePass({ ...draft, relatedDocumentId: draft.relatedDocumentId || undefined, relatedProformaId: draft.relatedProformaId || undefined });
    if (!result.success) { setMessage(result.error || 'ثبت انجام نشد'); return; }
    setDraft(EMPTY); setShowForm(false);
  };

  return <div className="space-y-6 pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><DoorOpen className="w-6 h-6 text-amber-400" />نگهبانی، ورود/خروج خودرو و برگه خروج</h1><p className="text-xs text-slate-400 mt-1">ثبت اولیه بار، راننده، صاحب کالا، بارنامه، حواله، مجوز حمل، مبدا/مقصد و چاپ برگه خروج با سربرگ شرکت.</p></div>
      <button disabled={!hasPermission('gatehouse', 'create')} onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold disabled:opacity-40"><Plus className="w-4 h-4 inline ml-1" />ثبت ورود/خروج</button>
    </div>
    {message && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-xl p-3 text-xs">{message}</div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {gatePasses.length === 0 ? <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl p-6">هنوز برگه نگهبانی ثبت نشده است.</div> : gatePasses.map((pass) => <div key={pass.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex justify-between border-b border-slate-800 pb-3"><div><strong className="font-mono text-amber-400">{pass.passNumber}</strong><p className="text-white text-sm mt-1">{pass.vehiclePlateNumber} · {pass.vehicleType}</p></div><span className="text-[10px] text-slate-400">{pass.status}</span></div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-300"><span>راننده: {pass.driverName}</span><span>تلفن: {pass.driverPhone}</span><span>صاحب کالا: {pass.cargoOwnerName}</span><span>کالا: {pass.cargoType}</span><span>حجم: {pass.cargoVolume}</span><span>کیفیت: {pass.cargoQuality}</span><span>بارنامه: {pass.waybillNumber || '—'}</span><span>مجوز حمل: {pass.transportPermitNumber || '—'}</span></div>
        <div className="mt-3 text-[10px] text-slate-500">مبدا: {pass.originAddress} · مقصد: {pass.destinationAddress}</div>
        <div className="flex gap-2 mt-4"><select disabled={!hasPermission('gatehouse', 'edit')} value={pass.status} onChange={(e) => updateGatePassStatus(pass.id, e.target.value as GatePassRecord['status'])} className="field flex-1 text-xs">{['Draft','Registered','Approved for Exit','Exited','Cancelled'].map((s) => <option key={s}>{s}</option>)}</select><button disabled={!hasPermission('gatehouse', 'print')} onClick={() => setPrintPass(pass)} className="px-3 rounded-xl bg-slate-800 text-slate-200 disabled:opacity-40"><Printer className="w-4 h-4" /></button></div>
      </div>)}
    </div>
    {showForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-auto space-y-4 text-xs">
      <div className="flex justify-between"><h2 className="text-white font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-amber-400" />ثبت نگهبانی</h2><button type="button" onClick={() => setShowForm(false)} className="text-slate-400">بستن</button></div>
      <div className="grid md:grid-cols-4 gap-3"><select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as GatePassRecord['direction'] })} className="field"><option>Entry (ورود)</option><option>Exit (خروج)</option></select><input value={draft.vehiclePlateNumber} onChange={(e) => setDraft({ ...draft, vehiclePlateNumber: e.target.value })} placeholder="شماره ماشین حمل" required className="field" /><input value={draft.vehicleType} onChange={(e) => setDraft({ ...draft, vehicleType: e.target.value })} placeholder="نوع خودرو" required className="field" /><input value={draft.cargoType} onChange={(e) => setDraft({ ...draft, cargoType: e.target.value })} placeholder="نوع کالا" required className="field" /></div>
      <div className="grid md:grid-cols-3 gap-3"><input value={draft.cargoVolume} onChange={(e) => setDraft({ ...draft, cargoVolume: e.target.value })} placeholder="حجم/وزن کالا" required className="field" /><input value={draft.cargoQuality} onChange={(e) => setDraft({ ...draft, cargoQuality: e.target.value })} placeholder="کیفیت کالا" required className="field" /><input value={draft.waybillNumber} onChange={(e) => setDraft({ ...draft, waybillNumber: e.target.value })} placeholder="شماره بارنامه" className="field" /></div>
      <div className="grid md:grid-cols-3 gap-3"><input value={draft.dispatchOrderNumber} onChange={(e) => setDraft({ ...draft, dispatchOrderNumber: e.target.value })} placeholder="شماره حواله" className="field" /><input value={draft.transportPermitNumber} onChange={(e) => setDraft({ ...draft, transportPermitNumber: e.target.value })} placeholder="شماره مجوز حمل" className="field" /><select value={draft.relatedProformaId} onChange={(e) => setDraft({ ...draft, relatedProformaId: e.target.value })} className="field"><option value="">ارتباط با فاکتور/پیش‌فاکتور</option>{proformas.map((p) => <option key={p.id} value={p.id}>{p.invoiceNumber} · {p.customerName}</option>)}</select></div>
      <div className="grid md:grid-cols-3 gap-3"><input value={draft.driverName} onChange={(e) => setDraft({ ...draft, driverName: e.target.value })} placeholder="نام راننده" required className="field" /><input value={draft.driverNationalId} onChange={(e) => setDraft({ ...draft, driverNationalId: e.target.value })} placeholder="کد ملی راننده" required className="field" /><input value={draft.driverPhone} onChange={(e) => setDraft({ ...draft, driverPhone: e.target.value })} placeholder="تلفن راننده" required className="field" /></div>
      <div className="grid md:grid-cols-3 gap-3"><input value={draft.cargoOwnerName} onChange={(e) => setDraft({ ...draft, cargoOwnerName: e.target.value })} placeholder="نام صاحب کالا" required className="field" /><input value={draft.cargoOwnerNationalId} onChange={(e) => setDraft({ ...draft, cargoOwnerNationalId: e.target.value })} placeholder="کد ملی صاحب کالا" required className="field" /><input value={draft.cargoOwnerPhone} onChange={(e) => setDraft({ ...draft, cargoOwnerPhone: e.target.value })} placeholder="تلفن صاحب کالا" required className="field" /></div>
      <div className="grid md:grid-cols-2 gap-3"><textarea value={draft.originAddress} onChange={(e) => setDraft({ ...draft, originAddress: e.target.value })} placeholder="آدرس مبدا" required className="field min-h-[80px]" /><textarea value={draft.destinationAddress} onChange={(e) => setDraft({ ...draft, destinationAddress: e.target.value })} placeholder="آدرس مقصد" required className="field min-h-[80px]" /></div>
      <select value={draft.relatedDocumentId} onChange={(e) => setDraft({ ...draft, relatedDocumentId: e.target.value })} className="field w-full"><option value="">ارتباط با نامه/سند دبیرخانه</option>{officeDocuments.map((d) => <option key={d.id} value={d.id}>{d.indicatorNumber} · {d.subject}</option>)}</select>
      <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="توضیحات نگهبانی" className="field w-full min-h-[80px]" />
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">ثبت و آماده چاپ</button></div>
    </form></div>}
    {printPass && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-white text-slate-950 rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-auto">
      <div className="flex justify-between border-b pb-4">{branding?.letterheadDataUrl ? <img src={branding.letterheadDataUrl} alt="Letterhead" className="max-h-24 object-contain" /> : <div><h2 className="text-xl font-black">{branding?.companyNameFa || 'مزرعه فتحی'}</h2><div className="text-xs text-slate-500">{branding?.registrationLine}</div></div>}<button onClick={() => setPrintPass(null)} className="print:hidden text-slate-500">×</button></div>
      <h3 className="text-center text-lg font-black mt-4">برگه خروج / ورود نگهبانی</h3>
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm"><div>شماره برگه: <strong className="font-mono">{printPass.passNumber}</strong></div><div>وضعیت: {printPass.status}</div><div>شماره خودرو: {printPass.vehiclePlateNumber}</div><div>نوع خودرو: {printPass.vehicleType}</div><div>راننده: {printPass.driverName}</div><div>کد ملی راننده: {printPass.driverNationalId}</div><div>تلفن راننده: {printPass.driverPhone}</div><div>صاحب کالا: {printPass.cargoOwnerName}</div><div>کد ملی صاحب کالا: {printPass.cargoOwnerNationalId}</div><div>تلفن صاحب کالا: {printPass.cargoOwnerPhone}</div><div>کالا: {printPass.cargoType}</div><div>حجم/کیفیت: {printPass.cargoVolume} · {printPass.cargoQuality}</div><div>بارنامه: {printPass.waybillNumber || '—'}</div><div>حواله: {printPass.dispatchOrderNumber || '—'}</div><div>مجوز حمل: {printPass.transportPermitNumber || '—'}</div><div>ثبت‌کننده: {printPass.registeredBy}</div><div className="col-span-2">مبدا: {printPass.originAddress}</div><div className="col-span-2">مقصد: {printPass.destinationAddress}</div></div>
      <div className="mt-8 flex justify-between items-end text-xs"><div>{branding?.letterFooterNote}</div><div className="flex gap-4 items-end">{branding?.stampDataUrl && <img src={branding.stampDataUrl} className="w-20 h-20 object-contain" alt="Stamp" />}{branding?.signatureDataUrl && <div className="text-center"><img src={branding.signatureDataUrl} className="w-28 h-16 object-contain" alt="Signature" /><div className="border-t pt-1">امضا مجاز خروج</div></div>}</div></div>
      <div className="mt-6 flex justify-end gap-2 print:hidden"><button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white rounded-lg">چاپ / PDF</button><button onClick={() => setPrintPass(null)} className="px-4 py-2 bg-slate-200 rounded-lg">بستن</button></div>
    </div></div>}
  </div>;
};
