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
import { isFeedFactoryIngredientItem, planFeedProduction } from '../../utils/feedFactoryEngine';

interface IngredientDraft { itemId: string; quantityKg: string; }

function todayPlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const FeedFactoryView: React.FC = () => {
  const { inventory } = useFarm();
  const { hasPermission } = useAuth();
  const { formatCurrency, formatNumber } = useI18n();
  const [formulas, setFormulas] = useState<FeedFormulaRecord[]>([]);
  const [batches, setBatches] = useState<FeedProductionBatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showFormulaForm, setShowFormulaForm] = useState(false);

  const allowedIngredients = useMemo(() => inventory.filter((item) => isFeedFactoryIngredientItem(item)), [inventory]);
  const firstIngredientId = allowedIngredients[0]?.id || '';

  const [formulaCode, setFormulaCode] = useState('');
  const [formulaName, setFormulaName] = useState('');
  const [outputName, setOutputName] = useState('');
  const [outputSkuBase, setOutputSkuBase] = useState('');
  const [outputUnit, setOutputUnit] = useState<'kg' | 'gram'>('kg');
  const [basisOutputKg, setBasisOutputKg] = useState('100');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ itemId: '', quantityKg: '' }]);

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
    setLoading(true);
    setError('');
    try {
      const [nextFormulas, nextBatches] = await Promise.all([listFeedFormulas(), listFeedProductionBatches()]);
      setFormulas(nextFormulas);
      setBatches(nextBatches);
      if (!formulaId && nextFormulas.length) setFormulaId(nextFormulas.find((row) => row.isActive)?.id || nextFormulas[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FEED_FACTORY_LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    setIngredients((rows) => rows.length === 1 && !rows[0].itemId && firstIngredientId ? [{ itemId: firstIngredientId, quantityKg: '' }] : rows);
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
        code: formulaCode.trim(),
        name: formulaName.trim(),
        outputName: outputName.trim(),
        outputSkuBase: outputSkuBase.trim(),
        outputUnit,
        basisOutputKg: Number(basisOutputKg),
        isActive: true,
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
        formulaId: selectedFormula.id,
        batchCode: batchCode.trim(),
        outputKg: Number(batchOutputKg),
        outputSku: batchOutputSku.trim(),
        warehouseLocation: warehouseLocation.trim(),
        expiryDate,
        minimumStockThreshold: Number(minimumStock),
        reorderLevel: Number(reorderLevel),
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
      <div>
        <h1 className="text-xl font-black text-white flex items-center gap-2"><Factory className="w-6 h-6 text-[#D4AF37]" />کارخانه خوراک</h1>
        <p className="text-xs text-[#A1A1AA] mt-1">فرمول‌ها فقط از مواد مجاز کارخانه خوراک ساخته می‌شوند. محصول بعد از QC Release وارد موجودی قابل مصرف می‌شود.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="px-3 py-2 rounded-xl border border-[#27272A] bg-[#18181B] text-[#D4D4D8] text-xs flex items-center gap-2"><RefreshCw className="w-4 h-4" />بازخوانی</button>
        {canCreate && <button type="button" onClick={() => setShowFormulaForm((value) => !value)} className="px-3 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-black flex items-center gap-2"><Plus className="w-4 h-4" />فرمول جدید</button>}
      </div>
    </div>

    <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 text-xs text-blue-100 flex gap-3"><ShieldCheck className="w-5 h-5 text-blue-300 shrink-0" /><div><strong className="block mb-1">کنترل موجودی Fail-Closed</strong><span>Dropdown مواد اولیه اکنون همان قانون Engine را اجرا می‌کند: فقط Feed و Raw Material کارخانه خوراک مجازند؛ دارو، مواد شیمیایی و سایر آیتم‌های جرمی حتی نمایش داده نمی‌شوند.</span></div></div>
    {(error || message) && <div className={`rounded-xl border p-3 text-xs ${error ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>{error || message}</div>}

    {showFormulaForm && <form onSubmit={submitFormula} className="bg-[#121214] border border-[#D4AF37]/30 rounded-2xl p-5 space-y-4">
      <h2 className="font-black text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-[#D4AF37]" />Master Recipe</h2>
      {allowedIngredients.length === 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">ابتدا از پنل مواد اولیه، Lot ماده اولیه کارخانه خوراک یا آیتم Feed معتبر ثبت کنید.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
        <label className="text-[#A1A1AA]">کد فرمول<input value={formulaCode} onChange={(e) => setFormulaCode(e.target.value)} required className="field mt-1 w-full" /></label>
        <label className="text-[#A1A1AA]">نام فرمول<input value={formulaName} onChange={(e) => setFormulaName(e.target.value)} required className="field mt-1 w-full" /></label>
        <label className="text-[#A1A1AA]">نام محصول خروجی<input value={outputName} onChange={(e) => setOutputName(e.target.value)} required className="field mt-1 w-full" /></label>
        <label className="text-[#A1A1AA]">پیشوند SKU خروجی<input value={outputSkuBase} onChange={(e) => setOutputSkuBase(e.target.value)} required className="field mt-1 w-full font-mono" /></label>
        <label className="text-[#A1A1AA]">مبنای خروجی kg<input type="number" min="0.001" step="0.001" value={basisOutputKg} onChange={(e) => setBasisOutputKg(e.target.value)} required className="field mt-1 w-full" /></label>
        <label className="text-[#A1A1AA]">واحد محصول<select value={outputUnit} onChange={(e) => setOutputUnit(e.target.value as 'kg' | 'gram')} className="field mt-1 w-full"><option value="kg">kg</option><option value="gram">gram</option></select></label>
      </div>
      <div className="space-y-2"><div className="flex items-center justify-between"><strong className="text-xs text-white">مواد اولیه مجاز</strong><button type="button" onClick={addIngredient} className="text-xs text-[#D4AF37]">+ ردیف</button></div>{ingredients.map((row, index) => <div key={index} className="grid grid-cols-[1fr_140px_auto] gap-2"><select value={row.itemId} onChange={(e) => updateIngredient(index, { itemId: e.target.value })} required className="field text-xs"><option value="">انتخاب ماده مجاز</option>{allowedIngredients.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.sku} — {item.category} — {item.quantity} {item.unit}</option>)}</select><input type="number" min="0.000001" step="0.001" value={row.quantityKg} onChange={(e) => updateIngredient(index, { quantityKg: e.target.value })} placeholder="kg" required className="field text-xs" /><button type="button" onClick={() => removeIngredient(index)} className="px-3 rounded-xl border border-rose-500/25 text-rose-300">×</button></div>)}</div>
      <div className="flex justify-end"><button disabled={busy || !allowedIngredients.length} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-black disabled:opacity-40">ثبت فرمول</button></div>
    </form>}

    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-black text-white">فرمول‌های تولید</h2><span className="text-xs text-[#71717A]">{formulas.length}</span></div>
        {loading ? <div className="text-xs text-[#71717A]">در حال بارگذاری…</div> : formulas.length === 0 ? <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 text-xs text-[#71717A]">هنوز فرمولی ثبت نشده است.</div> : formulas.map((formula) => <button type="button" key={formula.id} onClick={() => setFormulaId(formula.id)} className={`w-full text-right bg-[#121214] border rounded-2xl p-4 ${formulaId === formula.id ? 'border-[#D4AF37]' : 'border-[#27272A]'}`}><div className="flex justify-between gap-3"><div><strong className="text-white">{formula.name}</strong><div className="text-[11px] text-[#71717A] font-mono">{formula.code} · {formula.outputSkuBase}</div></div><span className={formula.isActive ? 'text-emerald-400 text-xs' : 'text-slate-500 text-xs'}>{formula.isActive ? 'فعال' : 'غیرفعال'}</span></div><div className="mt-3 text-[11px] text-[#A1A1AA]">{formula.ingredients.length} ماده · خروجی مبنا {formatNumber(formula.basisOutputKg)} kg</div>{canEdit && <span onClick={(event) => { event.stopPropagation(); void toggleFormula(formula); }} className="inline-block mt-3 text-[11px] text-[#D4AF37]">{formula.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</span>}</button>)}
      </section>

      <section className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-4">
        <h2 className="font-black text-white flex items-center gap-2"><PackageCheck className="w-5 h-5 text-emerald-400" />Batch تولید و QC</h2>
        <form onSubmit={submitBatch} className="grid md:grid-cols-2 gap-3 text-xs">
          <label className="text-[#A1A1AA]">فرمول<select value={formulaId} onChange={(e) => setFormulaId(e.target.value)} className="field mt-1 w-full" required><option value="">انتخاب فرمول</option>{formulas.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-[#A1A1AA]">کد Batch<input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className="field mt-1 w-full font-mono" required /></label>
          <label className="text-[#A1A1AA]">خروجی kg<input type="number" min="0.001" step="0.001" value={batchOutputKg} onChange={(e) => setBatchOutputKg(e.target.value)} className="field mt-1 w-full" required /></label>
          <label className="text-[#A1A1AA]">SKU محصول<input value={batchOutputSku} onChange={(e) => setBatchOutputSku(e.target.value)} className="field mt-1 w-full font-mono" required /></label>
          <label className="text-[#A1A1AA]">محل انبار<input value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} className="field mt-1 w-full" required /></label>
          <label className="text-[#A1A1AA]">انقضا<input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="field mt-1 w-full" required /></label>
          <label className="text-[#A1A1AA]">حد بحرانی<input type="number" min="0" step="0.001" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className="field mt-1 w-full" /></label>
          <label className="text-[#A1A1AA]">نقطه سفارش<input type="number" min="0" step="0.001" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="field mt-1 w-full" /></label>
          {preview && <div className={`md:col-span-2 rounded-xl border p-3 ${preview.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}>{preview.ok ? `مصرف مواد: ${formatNumber(preview.totalInputKg || 0)} kg · هزینه: ${formatCurrency(preview.totalInputValue || 0, preview.currency)}` : preview.error}</div>}
          <div className="md:col-span-2 flex justify-end"><button disabled={busy || !canCreate || !preview?.ok} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-40">Start Batch / انتقال مواد به WIP</button></div>
        </form>
      </section>
    </div>

    <section className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-3">
      <h2 className="font-black text-white">Batchها</h2>
      <div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="text-[#71717A]"><tr><th className="p-2">Batch</th><th className="p-2">فرمول</th><th className="p-2">خروجی</th><th className="p-2">هزینه</th><th className="p-2">وضعیت</th><th className="p-2">QC</th></tr></thead><tbody className="divide-y divide-[#27272A]">{batches.map((batch) => <tr key={batch.id}><td className="p-2 font-mono text-[#D4AF37]">{batch.batchCode}</td><td className="p-2 text-white">{batch.formulaName}</td><td className="p-2">{formatNumber(batch.outputKg)} kg</td><td className="p-2">{formatCurrency(batch.totalInputValue, batch.currency)}</td><td className="p-2"><span className={`px-2 py-1 rounded-lg border ${statusClass(batch.status)}`}>{batch.status}</span></td><td className="p-2">{batch.status === 'WIP' ? <div className="flex flex-wrap gap-2"><input value={qcNotes[batch.id] || ''} onChange={(e) => setQcNotes((previous) => ({ ...previous, [batch.id]: e.target.value }))} placeholder="یادداشت QC" className="field text-xs min-w-[160px]" /><button disabled={!canApprove || busy} onClick={() => void decideQc(batch, 'RELEASE')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white disabled:opacity-40">Release</button><button disabled={!canApprove || busy} onClick={() => void decideQc(batch, 'REJECT')} className="px-2 py-1 rounded-lg bg-rose-600 text-white disabled:opacity-40">Reject</button></div> : <span className="text-[#71717A]">{batch.qcNotes || '—'}</span>}</td></tr>)}{!batches.length && <tr><td colSpan={6} className="p-6 text-center text-[#71717A]">هنوز Batch تولید ثبت نشده است.</td></tr>}</tbody></table></div>
    </section>
    <style>{`.field{background:#18181B;border:1px solid #3F3F46;border-radius:.75rem;padding:.625rem;color:white;outline:none}.field:focus{border-color:#D4AF37}`}</style>
  </div>;
};
