import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Package, Search } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { InventoryTxType } from '../../types';

export const WarehouseView: React.FC = () => {
  const { formatCurrency, formatNumber } = useI18n();
  const { inventory, inventoryTxs, addInventoryTransaction } = useFarm();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [itemId, setItemId] = useState(inventory[0]?.id || '');
  const [type, setType] = useState<InventoryTxType>('Purchase (خرید)');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => inventory.filter((item) => {
    const needle = query.trim().toLowerCase();
    return !needle || item.name.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle) || item.batchNumber.toLowerCase().includes(needle);
  }), [inventory, query]);

  const lowStock = inventory.filter((item) => item.quantity <= item.reorderLevel);
  const selected = inventory.find((item) => item.id === itemId);

  const signedChange = () => {
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount === 0) return 0;
    if (type === 'Adjustment (تعدیل موجودی)') return amount; // explicit signed correction
    if (type === 'Purchase (خرید)' || type === 'Production (تولید)' || type === 'Return (مرجوعی)') return Math.abs(amount);
    return -Math.abs(amount);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reason.trim()) { setError('کالا و شرح تراکنش الزامی است.'); return; }
    const change = signedChange();
    if (!change) { setError('مقدار تراکنش باید غیرصفر باشد.'); return; }
    const resulting = selected.quantity + change;
    if (resulting < 0) { setError(`موجودی منفی مجاز نیست. موجودی فعلی ${selected.quantity} ${selected.unit} است.`); return; }
    addInventoryTransaction({
      itemId: selected.id,
      itemName: selected.name,
      sku: selected.sku,
      type,
      quantityChange: Number(change.toFixed(4)),
      unit: selected.unit,
      unitPrice: selected.purchasePricePerUnit,
      totalValue: Number((Math.abs(change) * selected.purchasePricePerUnit).toFixed(2)),
      operator: '',
      notes: reason.trim(),
    });
    setQty(''); setReason(''); setError(''); setShowForm(false);
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Package className="w-6 h-6 text-amber-400" />انبار و موجودی</h1><p className="text-xs text-slate-400 mt-1">تعدیل انبارگردانی می‌تواند مثبت یا منفی باشد؛ هیچ تراکنشی اجازه ایجاد موجودی منفی ندارد.</p></div>
      <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"><ArrowDownUp className="w-4 h-4" />تراکنش انبار</button>
    </div>

    {lowStock.length > 0 && <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 flex gap-2"><AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /><span>{lowStock.length} قلم به نقطه سفارش یا پایین‌تر رسیده‌اند.</span></div>}

    <div className="relative"><Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام، SKU، دسته یا Batch..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-3 py-2.5 text-xs text-white" /></div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{filtered.map((item) => { const low = item.quantity <= item.reorderLevel; return <div key={item.id} className={`bg-slate-900 border rounded-2xl p-5 ${low ? 'border-amber-500/35' : 'border-slate-800'}`}><div className="flex justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="text-white block">{item.name}</strong><span className="text-[10px] text-slate-500">{item.category}</span></div><span className="font-mono text-amber-400 text-xs">{item.sku}</span></div><div className="space-y-2 text-xs mt-3"><div className="flex justify-between"><span className="text-slate-500">موجودی</span><strong className={low ? 'text-amber-400' : 'text-emerald-400'}>{formatNumber(item.quantity)} {item.unit}</strong></div><div className="flex justify-between"><span className="text-slate-500">نقطه سفارش</span><span className="text-slate-300">{item.reorderLevel} {item.unit}</span></div><div className="flex justify-between"><span className="text-slate-500">Batch</span><span className="font-mono text-slate-300">{item.batchNumber}</span></div><div className="flex justify-between"><span className="text-slate-500">محل</span><span className="text-slate-300">{item.warehouseLocation}</span></div><div className="flex justify-between"><span className="text-slate-500">قیمت خرید</span><span className="text-slate-300">{formatCurrency(item.purchasePricePerUnit, item.currency)}</span></div></div></div>; })}</div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">زمان</th><th className="p-3">کالا</th><th className="p-3">نوع</th><th className="p-3">تغییر</th><th className="p-3">موجودی پس از ثبت</th><th className="p-3">شرح</th></tr></thead><tbody className="divide-y divide-slate-800">{inventoryTxs.slice(0, 100).map((tx) => <tr key={tx.id} className="text-slate-300"><td className="p-3 text-slate-500">{tx.timestamp}</td><td className="p-3 text-white">{tx.itemName}</td><td className="p-3">{tx.type}</td><td className={`p-3 font-mono font-bold ${tx.quantityChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{tx.quantityChange > 0 ? '+' : ''}{tx.quantityChange} {tx.unit}</td><td className="p-3 font-mono">{tx.resultingQuantity} {tx.unit}</td><td className="p-3">{tx.notes || '—'}</td></tr>)}</tbody></table></div></div>

    {showForm && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"><div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 w-full max-w-lg"><h2 className="text-white font-bold mb-4">ثبت تراکنش انبار</h2><form onSubmit={submit} className="space-y-3 text-xs"><select value={itemId} onChange={(event) => setItemId(event.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{inventory.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku}) — {item.quantity} {item.unit}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value as InventoryTxType)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="Purchase (خرید)">خرید / ورود</option><option value="Production (تولید)">تولید / ورود</option><option value="Return (مرجوعی)">مرجوعی / ورود</option><option value="Consumption (مصرف روزانه)">مصرف / خروج</option><option value="Transfer (انتقال)">انتقال / خروج</option><option value="Sale (فروش)">فروش / خروج</option><option value="Waste (ضایعات)">ضایعات / خروج</option><option value="Adjustment (تعدیل موجودی)">تعدیل امضادار (+ یا -)</option></select><label className="text-slate-400 block">مقدار {type === 'Adjustment (تعدیل موجودی)' ? '(برای کاهش عدد منفی وارد کنید)' : '(عدد مثبت وارد کنید)'}<input type="number" step="0.001" value={qty} onChange={(event) => setQty(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" required /></label>{selected && qty && <div className="bg-slate-950 rounded-xl p-3 text-slate-400">پیش‌نمایش: {selected.quantity} → <strong className={selected.quantity + signedChange() < 0 ? 'text-rose-400' : 'text-emerald-400'}>{Number((selected.quantity + signedChange()).toFixed(4))} {selected.unit}</strong></div>}<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="علت / مرجع تراکنش" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" required />{error && <div className="text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2">{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl">ثبت</button></div></form></div></div>}
  </div>;
};
