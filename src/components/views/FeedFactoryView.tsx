import React, { useEffect, useMemo, useState } from 'react';
import { Factory, FlaskConical, PackageCheck, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import {
  createFeedFormula,
  decideFeedProductionQc,
  FeedFormulaRecord,
  FeedProductionBatchRecord,
  listFeedFormulas,
  listFeedProductionBatches,
  reloadFeedFactoryView,
  startFeedProductionBatch,
  updateFeedFormula,
} from '../../services/feedFactoryService';
import { planFeedProduction } from '../../utils/feedFactoryEngine';

interface IngredientDraft { itemId: string; quantityKg: string; }

function todayPlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const FeedFactoryView: React.FC = () => {
  const { inventory } = useFarm();
  const { hasPermission } = useAuth();
  const { formatNumber, formatCurrency } = useI18n();
  const [formulas, setFormulas] = useState<FeedFormulaRecord[]>([]);
  const [batches, setBatches] = useState<FeedProductionBatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showFormulaForm, setShowFormulaForm] = useState(false);

  const massInventory = useMemo(() => inventory.filter((item) => item.unit === 'kg' || item.unit === 'gram'), [inventory]);
  const firstIngredientId = massInventory[0]?.id || '';

  const [formulaCode, setFormulaCode] = useState('');
  const [formulaName, setFormulaName] = useState('');
  const [outputName, setOutputName] = useState('');
  const [outputSkuBase, setOutputSkuBase] = useState('');
  const [outputUnit, setOutputUnit] = useState<'kg' | 'gram'>('kg');
  const [basisOutputKg, setBasisOutputKg] = useState('100');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ itemId: firstIngredientId, quantityKg: '' }]);

  const [formulaId, setFormulaId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [batchOutputKg, setBatchOutputKg] = useState('');
  const [batchOutputSku, setBatchOutputSku] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [expiryDate, setExpiryDate] = useState(todayPlusDays(180));
  const [minimumStock, setMinimumStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [qcNotes, setQcNotes] = useState<Record<string, string>>({});

  const canCreate = hasPermission('feed_factory', 'create');
  const canEdit = hasPermission('feed_factory', 'edit');
  const canApprove = hasPermission('feed_factory', 'approve');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [nextFormulas, nextBatches] = await Promise.all([listFeedFormulas(), listFeedProductionBatches()]);
      setFormulas(nextFormulas); setBatches(nextBatches);
      if (!formulaId && nextFormulas.length) setFormulaId(nextFormulas.find((row) => row.isActive)?.id || nextFormulas[0].id);
    } catch (err) { setError(err instanceof Error ? err.message : 'FEED_FACTORY_LOAD_FAILED'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!ingredients[0]?.itemId && firstIngredientId) setIngredients([{ itemId: firstIngredientId, quantityKg: '' }]);
  }, [firstIngredientId]);

  const selectedFormula = formulas.find((row) => row.id === formulaId);
  const preview = useMemo(() => {
    if (!selectedFormula || !batchOutputKg) return null;
    return planFeedProduction(selectedFormula, Number(batchOutputKg), inventory);
  }, [selectedFormula, batchOutputKg, inventory]);

  useEffect(() => {
    if (!selectedFormula || !batchCode.trim()) return;
    setBatchOutputSku(`${selectedFormula.outputSkuBase}-${batchCode.trim()}`.toUpperCase().replace(/[^A-Z0-9._-]+/g, '-'));
  }, [selectedFormula?.id, batchCode]);

  const addIngredient = () => setIngredients((rows) => [...rows, { itemId: firstIngredientId, quantityKg: '' }]);
  const updateIngredient = (index: number, patch: Partial<IngredientDraft>) => setIngredients((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const removeIngredient = (index: number) => setIngredients((rows) => rows.length <= 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index));

  const submitFormula = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await createFeedFormula({
        code: formulaCode.trim(), name: formulaName.trim(), outputName: outputName.trim(), outputSkuBase: outputSkuBase.trim(), outputUnit,
        basisOutputKg: Number(basisOutputKg), isActive: true,
        ingredients: ingredients.map((row) => ({ itemId: row.itemId, quantityKg: Number(row.quantityKg) })),
      });
      setFormulaCode(''); setFormulaName(''); setOutputName(''); setOutputSkuBase(''); setBasisOutputKg('100');
      setIngredients([{ itemId: firstIngredientId, quantityKg: '' }]); setShowFormulaForm(false); setMessage('فرمول تولید ثبت شد.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'FEED_FORMULA_CREATE_FAILED'); }
    finally { setBusy(false); }
  };

  const toggleFormula = async (formula: FeedFormulaRecord) => {
    if (!canEdit) return;
    setBusy(true); setError('');
    try { await updateFeedFormula(formula.id, { isActive: !formula.isActive }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'FEED_FORMULA_UPDATE_FAILED'); }
    finally { setBusy(false); }
  };

  const submitBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate || !selectedFormula) return;
    if (!preview?.ok) { setError(preview?.error || 'FEED_PRODUCTION_PLAN_INVALID'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await startFeedProductionBatch({
        formulaId: selectedFormula.id, batchCode: batchCode.trim(), outputKg: Number(batchOutputKg), outputSku: batchOutputSku.trim(),
        warehouseLocation: warehouseLocation.trim(), expiryDate, minimumStockThreshold: Number(minimumStock), reorderLevel: Number(reorderLevel),
      });
      reloadFeedFactoryView();
    } catch (err) { setError(err instanceof Error ? err.message : 'FEED_BATCH_START_FAILED'); setBusy(false); }
  };

  const decideQc = async (batch: FeedProductionBatchRecord, decision: 'RELEASE' | 'REJECT') => {
    if (!canApprove) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await decideFeedProductionQc(batch.id, decision, qcNotes[batch.id]?.trim());
      reloadFeedFactoryView();
    } catch (err) { setError(err instanceof Error ? err.message : 'FEED_QC_FAILED'); setBusy(false); }
  };

  const statusClass = (status: FeedProductionBatchRecord['status']) => status === 'RELEASED'
    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : status === 'REJECTED' ? 'text-rose-300 border-rose-500/30 bg-rose-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10';

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Factory className="w-6 h-6 text-[#D4AF37]" />کارخانه خوراک</h1><p className="text-xs text-[#A1A1AA] mt-1">فرمول‌ها فقط از داده ثبت‌شده کاربر استفاده می‌کنند. Start مواد اولیه را به WIP منتقل می‌کند؛ محصول فقط بعد از QC Release وارد موجودی قابل مصرف می‌شود.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading || busy} className="px-3 py-2 rounded-xl border border-[#27272A] bg-[#18181B] text-[#D4D4D8] text-xs flex items-center gap-2"><RefreshCw className="w-4 h-4" />بازخوانی</button>{canCreate && <button type="button" onClick={() => setShowFormulaForm((value) => !value)} className="px-3 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-black flex items-center gap-2"><Plus className="w-4 h-4" />فرمول جدید</button>}</div>
    </div>

    <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 text-xs text-blue-100 flex gap-3"><ShieldCheck className="w-5 h-5 text-blue-300 shrink-0" /><div><strong className="block mb-1">کنترل موجودی Fail-Closed</strong><span>کمبود ماده اولیه، ماده منقضی/روی Hold، ایجاد جرم، هزینه چندارزی بدون تبدیل و SKU خروجی تکراری باعث رد Batch می‌شود. این ماژول هیچ فرمانی به تجهیزات خوراک‌دهی ارسال نمی‌کند.</span></div></div>

    {(error || message) && <div className={`rounded-xl border p-3 text-xs ${error ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>{error || message}</div>}

    {showFormulaForm && <form onSubmit={submitFormula} className="bg-[#121214] border border-[#D4AF37]/30 rounded-2xl p-5 space-y-4">
      <h2 className="font-black text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-[#D4AF37]" />Master Recipe</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
        <label className="text-[#A1A1AA]">کد فرمول<input value={formulaCode} onChange={(e) => setFormulaCode(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label>
        <label className="text-[#A1A1AA]">نام فرمول<input value={formulaName} onChange={(e) => setFormulaName(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label>
        <label className="text-[#A1A1AA]">نام محصول خروجی<input value={outputName} onChange={(e) => setOutputName(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label>
        <label className="text-[#A1A1AA]">پیشوند SKU خروجی<input value={outputSkuBase} onChange={(e) => setOutputSkuBase(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white font-mono" /></label>
        <label className="text-[#A1A1AA]">مبنای خروجی kg<input type="number" min="0.001" step="0.001" value={basisOutputKg} onChange={(e) => setBasisOutputKg(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label>
        <label className="text-[#A1A1AA]">واحد محصول<select value={outputUnit} onChange={(e) => setOutputUnit(e.target.value as 'kg' | 'gram')} className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white"><option value="kg">kg</option><option value="gram">gram</option></select></label>
      </div>
      <div className="space-y-2"><div className="flex items-center justify-between"><strong className="text-xs text-white">مواد اولیه — مقدار بر حسب kg برای مبنای فرمول</strong><button type="button" onClick={addIngredient} className="text-xs text-[#D4AF37]">+ ردیف</button></div>{ingredients.map((row, index) => <div key={index} className="grid grid-cols-[1fr_140px_auto] gap-2"><select value={row.itemId} onChange={(e) => updateIngredient(index, { itemId: e.target.value })} required className="bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-xs text-white"><option value="">انتخاب ماده</option>{massInventory.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.sku} — {item.quantity} {item.unit}</option>)}</select><input type="number" min="0.000001" step="0.001" value={row.quantityKg} onChange={(e) => updateIngredient(index, { quantityKg: e.target.value })} placeholder="kg" required className="bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-xs text-white" /><button type="button" onClick={() => removeIngredient(index)} className="px-3 rounded-xl border border-rose-500/25 text-rose-300">×</button></div>)}</div>
      <div className="flex justify-end"><button disabled={busy || !massInventory.length} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-black disabled:opacity-40">ثبت فرمول</button></div>
    </form>}

    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-6">
      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-black text-white">فرمول‌های تولید</h2><span className="text-xs text-[#71717A]">{formulas.length}</span></div>{loading ? <div className="text-xs text-[#71717A]">در حال بارگذاری…</div> : formulas.length === 0 ? <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 text-xs text-[#71717A]">فرمولی ثبت نشده است.</div> : formulas.map((formula) => <div key={formula.id} className={`bg-[#121214] border rounded-2xl p-4 ${formula.isActive ? 'border-[#27272A]' : 'border-rose-500/20 opacity-70'}`}><div className="flex justify-between gap-3"><div><strong className="text-white">{formula.name}</strong><div className="text-[10px] font-mono text-[#D4AF37] mt-1">{formula.code} → {formula.outputSkuBase}</div></div><span className={`text-[10px] border rounded-full px-2 py-1 ${formula.isActive ? 'text-emerald-300 border-emerald-500/30' : 'text-rose-300 border-rose-500/30'}`}>{formula.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div><div className="grid grid-cols-2 gap-2 mt-3 text-xs text-[#A1A1AA]"><span>خروجی مبنا: {formatNumber(formula.basisOutputKg)} kg</span><span>مواد: {formula.ingredients.length}</span><span>محصول: {formula.outputName}</span><span>واحد: {formula.outputUnit}</span></div>{canEdit && <button type="button" disabled={busy} onClick={() => void toggleFormula(formula)} className="mt-3 text-[11px] text-[#D4AF37]">{formula.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>}</div>)}</section>

      <section className="bg-[#121214] border border-[#27272A] rounded-2xl p-5"><h2 className="font-black text-white flex items-center gap-2"><PackageCheck className="w-5 h-5 text-[#D4AF37]" />شروع Batch تولید</h2><form onSubmit={submitBatch} className="space-y-3 mt-4 text-xs"><label className="text-[#A1A1AA]">فرمول<select value={formulaId} onChange={(e) => setFormulaId(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white"><option value="">انتخاب فرمول</option>{formulas.filter((row) => row.isActive).map((formula) => <option key={formula.id} value={formula.id}>{formula.code} — {formula.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-[#A1A1AA]">کد Batch<input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label><label className="text-[#A1A1AA]">خروجی kg<input type="number" min="0.001" step="0.001" value={batchOutputKg} onChange={(e) => setBatchOutputKg(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label></div><label className="text-[#A1A1AA]">SKU Lot خروجی<input value={batchOutputSku} onChange={(e) => setBatchOutputSku(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white font-mono" /></label><div className="grid grid-cols-2 gap-3"><label className="text-[#A1A1AA]">محل انبار پس از Release<input value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label><label className="text-[#A1A1AA]">تاریخ انقضا<input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label></div><div className="grid grid-cols-2 gap-3"><label className="text-[#A1A1AA]">حد بحرانی<input type="number" min="0" step="0.001" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label><label className="text-[#A1A1AA]">نقطه سفارش<input type="number" min="0" step="0.001" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-white" /></label></div>{preview && <div className={`rounded-xl border p-3 ${preview.ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}>{preview.ok ? <div className="grid grid-cols-2 gap-2"><span>ورودی: {formatNumber(preview.totalInputKg || 0)} kg</span><span>خروجی: {formatNumber(preview.outputKg || 0)} kg</span><span>افت فرایند ثبت‌شده: {formatNumber(preview.processLossKg || 0)} kg</span><span>ارزش مواد: {formatCurrency(preview.totalInputValue || 0, preview.currency || '')}</span></div> : preview.error}</div>}<button disabled={busy || !canCreate || !preview?.ok} className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-black font-black disabled:opacity-40">Start Batch — انتقال مواد به WIP</button></form></section>
    </div>

    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-black text-white">تاریخچه Batch و QC</h2><span className="text-xs text-[#71717A]">{batches.length}</span></div>{batches.length === 0 ? <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 text-xs text-[#71717A]">Batch تولیدی ثبت نشده است.</div> : batches.map((batch) => <div key={batch.id} className="bg-[#121214] border border-[#27272A] rounded-2xl p-4"><div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-white">{batch.batchCode}</strong><span className={`text-[10px] px-2 py-1 rounded-full border ${statusClass(batch.status)}`}>{batch.status}</span></div><div className="text-[10px] text-[#71717A] mt-1">{batch.formulaCode} · {batch.outputName} · SKU {batch.outputSku}</div></div><div className="text-xs text-[#A1A1AA]">{formatNumber(batch.outputKg)} kg خروجی / {formatNumber(batch.totalInputKg)} kg ورودی</div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px] text-[#A1A1AA]"><span>افت: {formatNumber(batch.processLossKg)} kg</span><span>ارزش WIP: {formatCurrency(batch.totalInputValue, batch.currency)}</span><span>انقضا: {batch.expiryDate}</span><span>انبار: {batch.warehouseLocation}</span></div>{batch.status === 'PENDING_QC' && canApprove && <div className="mt-4 border-t border-[#27272A] pt-3 flex flex-col md:flex-row gap-2"><input value={qcNotes[batch.id] || ''} onChange={(e) => setQcNotes((state) => ({ ...state, [batch.id]: e.target.value }))} placeholder="یادداشت QC / علت تصمیم" className="flex-1 bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-xs text-white" /><button disabled={busy} onClick={() => void decideQc(batch, 'RELEASE')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">QC Release</button><button disabled={busy} onClick={() => void decideQc(batch, 'REJECT')} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">Reject</button></div>}{batch.qcAt && <div className="mt-3 text-[10px] text-[#71717A]">QC: {batch.qcBy || '—'} · {batch.qcAt}{batch.qcNotes ? ` · ${batch.qcNotes}` : ''}</div>}</div>)}</section>
  </div>;
};
