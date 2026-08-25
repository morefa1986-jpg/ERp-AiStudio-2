import React, { useState } from 'react';
import { ImagePlus, PenLine, Save } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { OfficeBrandingSettings } from '../../types';

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

type BrandingPatch = Partial<Omit<OfficeBrandingSettings, 'id' | 'updatedAt' | 'updatedBy'>>;

export const OfficeBrandingAdminPanel: React.FC = () => {
  const { officeSettings, updateOfficeBranding } = useFarm();
  const current = officeSettings[0];
  const [form, setForm] = useState<BrandingPatch>(current || {});
  const [message, setMessage] = useState('');

  const setImage = async (field: 'logoDataUrl' | 'letterheadDataUrl' | 'signatureDataUrl' | 'stampDataUrl', file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 1_500_000) { setMessage('فایل تصویر باید کمتر از ۱.۵MB باشد.'); return; }
    const dataUrl = await fileToDataUrl(file);
    setForm((previous) => ({ ...previous, [field]: dataUrl }));
  };

  const save = () => {
    const result = updateOfficeBranding(form);
    setMessage(result.success ? 'سربرگ، لوگو و امضای اداری ذخیره شد.' : result.error || 'ذخیره انجام نشد.');
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2"><PenLine className="w-5 h-5 text-amber-400" />تنظیمات سربرگ، لوگو، مهر و امضا</h2>
          <p className="text-[11px] text-slate-400 mt-1">این تنظیمات در نامه‌ها، فاکتور، پیش‌فاکتور و چاپ اسناد استفاده می‌شود. تصاویر کوچک به‌صورت امن در دیتای برنامه ذخیره می‌شوند.</p>
        </div>
        <button onClick={save} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"><Save className="w-4 h-4 inline ml-1" />ذخیره تنظیمات اداری</button>
      </div>
      {message && <div className="text-xs rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 p-3">{message}</div>}
      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <input value={form.companyNameFa || ''} onChange={(e) => setForm({ ...form, companyNameFa: e.target.value })} placeholder="نام فارسی شرکت/مزرعه" className="field" />
        <input value={form.companyNameEn || ''} onChange={(e) => setForm({ ...form, companyNameEn: e.target.value })} placeholder="نام انگلیسی شرکت/مزرعه" className="field" />
        <input value={form.registrationLine || ''} onChange={(e) => setForm({ ...form, registrationLine: e.target.value })} placeholder="شعار/شماره ثبت/شناسه ملی" className="field" />
        <input value={form.addressLine || ''} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} placeholder="آدرس دفتر مرکزی" className="field" />
        <input value={form.phoneLine || ''} onChange={(e) => setForm({ ...form, phoneLine: e.target.value })} placeholder="تلفن" className="field" />
        <input value={form.emailLine || ''} onChange={(e) => setForm({ ...form, emailLine: e.target.value })} placeholder="ایمیل" className="field" />
        <textarea value={form.invoiceFooterNote || ''} onChange={(e) => setForm({ ...form, invoiceFooterNote: e.target.value })} placeholder="متن ثابت پایین فاکتور/پیش‌فاکتور" className="field min-h-[80px]" />
        <textarea value={form.letterFooterNote || ''} onChange={(e) => setForm({ ...form, letterFooterNote: e.target.value })} placeholder="متن ثابت پایین نامه" className="field min-h-[80px]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {[
          ['logoDataUrl', 'لوگو'],
          ['letterheadDataUrl', 'تصویر سربرگ کامل'],
          ['signatureDataUrl', 'امضا'],
          ['stampDataUrl', 'مهر'],
        ].map(([field, label]) => (
          <label key={field} className="bg-slate-950 border border-slate-800 rounded-xl p-3 cursor-pointer">
            <ImagePlus className="w-5 h-5 text-amber-400 mb-2" />
            <span className="text-slate-300">{label}</span>
            {(form as Record<string, string | undefined>)[field] && <span className="block text-[10px] text-emerald-400 mt-1">بارگذاری شده</span>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void setImage(field as 'logoDataUrl' | 'letterheadDataUrl' | 'signatureDataUrl' | 'stampDataUrl', e.target.files?.[0])} />
          </label>
        ))}
      </div>
    </section>
  );
};
