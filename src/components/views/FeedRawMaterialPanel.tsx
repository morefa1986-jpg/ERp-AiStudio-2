import React, { useState } from 'react';
import { Boxes, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { registerFeedRawMaterial, reloadFeedFactoryView } from '../../services/feedFactoryService';

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const FeedRawMaterialPanel: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('feed_factory', 'create');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'kg' | 'gram'>('kg');
  const [purchasePricePerUnit, setPurchasePricePerUnit] = useState('');
  const [currency, setCurrency] = useState('IRR');
  const [expiryDate, setExpiryDate] = useState(futureDate(365));
  const [supplierName, setSupplierName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [minimumStockThreshold, setMinimumStockThreshold] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate || busy) return;
    setBusy(true);
    setError('');
    try {
      await registerFeedRawMaterial({
        sku: sku.trim(),
        name: name.trim(),
        batchNumber: batchNumber.trim(),
        quantity: Number(quantity),
        unit,
        purchasePricePerUnit: Number(purchasePricePerUnit),
        currency: currency.trim(),
        expiryDate,
        supplierName: supplierName.trim(),
        warehouseLocation: warehouseLocation.trim(),
        minimumStockThreshold: Number(minimumStockThreshold),
        reorderLevel: Number(reorderLevel),
      });
      reloadFeedFactoryView();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FEED_RAW_MATERIAL_SAVE_FAILED');
      setBusy(false);
    }
  };

  return <section className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-4">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Boxes className="w-5 h-5 text-[#D4AF37]" />مواد اولیه کارخانه خوراک</h2>
        <p className="text-[11px] text-[#71717A] mt-1">هر Lot به‌صورت Server-authoritative در موجودی و دفتر تراکنش ثبت می‌شود و فقط مواد مجاز کارخانه می‌توانند وارد Master Recipe شوند.</p>
      </div>
      {canCreate && <button type="button" onClick={() => setOpen((value) => !value)} className="px-3 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-black flex items-center justify-center gap-2"><Plus className="w-4 h-4" />ثبت Lot ماده اولیه</button>}
    </div>

    <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-[11px] text-blue-100 flex gap-2"><ShieldCheck className="w-4 h-4 text-blue-300 shrink-0" /><span>ماده اولیه با خوراک نهایی یکی نیست؛ ثبت مستقیم وعده خوراک فقط برای آیتم‌های دسته Feed مجاز می‌ماند. مواد خام ابتدا باید در Batch تولید مصرف و سپس پس از QC Release به خوراک قابل مصرف تبدیل شوند.</span></div>

    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {open && <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
      <label className="text-[#A1A1AA]">SKU<input required value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white font-mono" /></label>
      <label className="text-[#A1A1AA]">نام ماده<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <label className="text-[#A1A1AA]">شماره Batch<input required value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white font-mono" /></label>
      <div className="grid grid-cols-[1fr_100px] gap-2"><label className="text-[#A1A1AA]">مقدار<input required type="number" min="0.000001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label><label className="text-[#A1A1AA]">واحد<select value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'gram')} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-2 py-2.5 text-white"><option value="kg">kg</option><option value="gram">gram</option></select></label></div>
      <label className="text-[#A1A1AA]">قیمت هر واحد<input required type="number" min="0" step="0.01" value={purchasePricePerUnit} onChange={(e) => setPurchasePricePerUnit(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <label className="text-[#A1A1AA]">ارز<input required value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white uppercase" /></label>
      <label className="text-[#A1A1AA]">تاریخ انقضا<input required type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <label className="text-[#A1A1AA]">تأمین‌کننده<input required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <label className="text-[#A1A1AA]">محل انبار<input required value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <label className="text-[#A1A1AA]">حد بحرانی<input required type="number" min="0" step="0.001" value={minimumStockThreshold} onChange={(e) => setMinimumStockThreshold(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <label className="text-[#A1A1AA]">نقطه سفارش<input required type="number" min="0" step="0.001" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="mt-1 w-full bg-[#09090B] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-white" /></label>
      <div className="md:col-span-2 xl:col-span-4 flex justify-end"><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-black disabled:opacity-40">{busy ? 'در حال ثبت…' : 'ثبت Lot و تراکنش ورودی'}</button></div>
    </form>}
  </section>;
};
