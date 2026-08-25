import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Calculator, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { localIsoDate, postFxConversion } from '../../services/fxAccountingService';

interface JournalRow { accountId: string; debit: string; credit: string; note: string; }
const EMPTY_ROW = (): JournalRow => ({ accountId: '', debit: '', credit: '', note: '' });

export const AccountingView: React.FC = () => {
  const { formatCurrency } = useI18n();
  const { currentUser } = useAuth();
  const { accounts, journals, createJournalEntry } = useFarm();
  const [tab, setTab] = useState<'journals' | 'coa'>('journals');
  const [showForm, setShowForm] = useState(false);
  const [showFxForm, setShowFxForm] = useState(false);
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [rows, setRows] = useState<JournalRow[]>([EMPTY_ROW(), EMPTY_ROW()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fx, setFx] = useState({ date: localIsoDate(), description: '', referenceId: '', sourceAccountId: '', targetAccountId: '', sourceAmount: '', rate: '' });

  const totals = useMemo(() => rows.reduce((acc, row) => ({ debit: acc.debit + Number(row.debit || 0), credit: acc.credit + Number(row.credit || 0) }), { debit: 0, credit: 0 }), [rows]);
  const isBalanced = totals.debit > 0 && totals.credit > 0 && Math.abs(totals.debit - totals.credit) <= 0.01;
  const validLines = rows.every((row) => {
    const debit = Number(row.debit || 0); const credit = Number(row.credit || 0);
    return Boolean(row.accountId) && Number.isFinite(debit) && Number.isFinite(credit) && debit >= 0 && credit >= 0 && ((debit > 0) !== (credit > 0));
  });
  const assetAccounts = accounts.filter((account) => account.type.startsWith('Asset') && !(account as any).isSystem);
  const fxSource = accounts.find((account) => account.id === fx.sourceAccountId);
  const fxTarget = accounts.find((account) => account.id === fx.targetAccountId);
  const fxTargetAmount = Number(fx.sourceAmount || 0) * Number(fx.rate || 0);

  const updateRow = (index: number, patch: Partial<JournalRow>) => setRows((previous) => previous.map((row, i) => i === index ? { ...row, ...patch } : row));
  const lineCurrency = (accountId: string) => accounts.find((account) => account.id === accountId)?.currency;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isBalanced || !validLines || !description.trim()) { setError('هر ردیف باید یک حساب معتبر و فقط یکی از بدهکار/بستانکار داشته باشد و سند تراز باشد.'); return; }
    const debits = rows.filter((row) => Number(row.debit) > 0).map((row) => { const account = accounts.find((item) => item.id === row.accountId)!; return { accountId: account.id, accountName: account.faName || account.name, amount: Number(row.debit) }; });
    const credits = rows.filter((row) => Number(row.credit) > 0).map((row) => { const account = accounts.find((item) => item.id === row.accountId)!; return { accountId: account.id, accountName: account.faName || account.name, amount: Number(row.credit) }; });
    const currencies = new Set([...debits, ...credits].map((line) => accounts.find((item) => item.id === line.accountId)?.currency));
    if (currencies.size > 1) { setError('سند دستی چندارزی مجاز نیست؛ از فرم «تبدیل ارز» استفاده کنید.'); return; }
    const result = createJournalEntry({
      date: localIsoDate(),
      referenceType: 'Manual',
      referenceId: referenceId.trim() || undefined,
      description: description.trim(),
      debits,
      credits,
      totalDebit: Number(totals.debit.toFixed(2)),
      totalCredit: Number(totals.credit.toFixed(2)),
      approvedBy: currentUser?.fullName || currentUser?.username || 'ERP User',
    });
    if (!result.success) { setError(result.error || 'ثبت سند انجام نشد.'); return; }
    setDescription(''); setReferenceId(''); setRows([EMPTY_ROW(), EMPTY_ROW()]); setError(''); setShowForm(false);
  };

  const submitFx = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const sourceAmount = Number(fx.sourceAmount); const rate = Number(fx.rate);
    if (!fxSource || !fxTarget || fxSource.id === fxTarget.id || fxSource.currency === fxTarget.currency) { setError('حساب مبدأ و مقصد باید دو حساب دارایی با ارز متفاوت باشند.'); return; }
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0 || !Number.isFinite(rate) || rate <= 0) { setError('مقدار مبدأ و نرخ تبدیل باید عدد مثبت معتبر باشند.'); return; }
    if (sourceAmount > fxSource.balance) { setError('مانده حساب مبدأ برای این تبدیل کافی نیست.'); return; }
    setBusy(true);
    try {
      await postFxConversion({ date: fx.date, description: fx.description.trim(), sourceAccountId: fx.sourceAccountId, targetAccountId: fx.targetAccountId, sourceAmount, sourceToTargetRate: rate, referenceId: fx.referenceId.trim() || undefined });
      setFx({ date: localIsoDate(), description: '', referenceId: '', sourceAccountId: '', targetAccountId: '', sourceAmount: '', rate: '' });
      setShowFxForm(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FX_POSTING_FAILED'); setBusy(false);
    }
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Calculator className="w-6 h-6 text-amber-400" />حسابداری دوبل و دفتر کل</h1><p className="text-xs text-slate-400 mt-1">سند دستی تک‌ارزی است. تبدیل ارز از workflow سروری FX انجام می‌شود و به دو سند متوازن تک‌ارزی با FX Position سیستمی شکسته می‌شود.</p></div>
      <div className="flex gap-2"><button onClick={() => setTab('journals')} className={`px-3 py-2 rounded-xl text-xs font-bold ${tab === 'journals' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>اسناد</button><button onClick={() => setTab('coa')} className={`px-3 py-2 rounded-xl text-xs font-bold ${tab === 'coa' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'}`}>کدینگ</button></div>
    </div>

    {error && <div className="text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs">{error}</div>}

    {tab === 'journals' ? <>
      <div className="flex flex-wrap justify-end gap-2"><button onClick={() => { setError(''); setShowFxForm(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" />تبدیل ارز</button><button onClick={() => { setError(''); setShowForm(true); }} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" />سند دستی جدید</button></div>
      <div className="space-y-3">{journals.map((entry) => <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex flex-wrap justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="text-amber-400 font-mono">{entry.entryNumber}</strong><span className="text-xs text-slate-500 mr-2">{entry.date}</span><p className="text-xs text-white mt-1">{entry.description}</p>{(entry as any).fxGroupId && <span className="text-[10px] text-blue-400 font-mono">FX group: {(entry as any).fxGroupId}</span>}</div><span className={entry.isBalanced ? 'text-emerald-400 text-xs font-bold' : 'text-rose-400 text-xs font-bold'}>{entry.isBalanced ? 'تراز' : 'عدم تراز'}</span></div><div className="grid grid-cols-2 gap-4 mt-3 text-xs"><div><span className="text-slate-500 block mb-1">بدهکار</span>{entry.debits.map((line, i) => <div key={i} className="flex justify-between gap-2"><span className="text-slate-300">{line.accountName}</span><strong className="text-emerald-400">{formatCurrency(line.amount, lineCurrency(line.accountId))}</strong></div>)}</div><div><span className="text-slate-500 block mb-1">بستانکار</span>{entry.credits.map((line, i) => <div key={i} className="flex justify-between gap-2"><span className="text-slate-300">{line.accountName}</span><strong className="text-rose-400">{formatCurrency(line.amount, lineCurrency(line.accountId))}</strong></div>)}</div></div></div>)}</div>
    </> : <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">ID داخلی</th><th className="p-3">کد</th><th className="p-3">حساب</th><th className="p-3">نوع</th><th className="p-3">ارز</th><th className="p-3">مانده</th></tr></thead><tbody className="divide-y divide-slate-800">{accounts.map((account) => <tr key={account.id} className="text-slate-300"><td className="p-3 font-mono text-[10px] text-slate-600">{account.id}</td><td className="p-3 font-mono text-amber-400">{account.code}</td><td className="p-3 text-white font-bold">{account.faName || account.name}{(account as any).systemPurpose === 'FX_POSITION' && <span className="mr-2 text-[9px] text-blue-400">SYSTEM FX</span>}</td><td className="p-3">{account.type}</td><td className="p-3">{account.currency}</td><td className="p-3 font-mono">{formatCurrency(account.balance, account.currency)}</td></tr>)}</tbody></table></div></div>}

    {showFxForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-blue-500/30 rounded-2xl p-6 w-full max-w-2xl"><h2 className="text-white font-bold mb-4 flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-blue-400" />تبدیل ارز — Server FX Workflow</h2><form onSubmit={submitFx} className="space-y-3 text-xs"><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">تاریخ<input type="date" value={fx.date} onChange={(e) => setFx({ ...fx, date: e.target.value })} required className="field mt-1" /></label><label className="text-slate-400">شماره عطف<input value={fx.referenceId} onChange={(e) => setFx({ ...fx, referenceId: e.target.value })} placeholder="اختیاری ولی ترجیحاً یکتا" className="field mt-1" /></label></div><input value={fx.description} onChange={(e) => setFx({ ...fx, description: e.target.value })} placeholder="شرح تبدیل ارز" required className="field" /><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">حساب مبدأ<select value={fx.sourceAccountId} onChange={(e) => setFx({ ...fx, sourceAccountId: e.target.value, targetAccountId: fx.targetAccountId === e.target.value ? '' : fx.targetAccountId })} required className="field mt-1"><option value="">انتخاب حساب</option>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.faName || account.name} · {account.currency} · {account.balance.toLocaleString()}</option>)}</select></label><label className="text-slate-400">حساب مقصد<select value={fx.targetAccountId} onChange={(e) => setFx({ ...fx, targetAccountId: e.target.value })} required className="field mt-1"><option value="">انتخاب حساب</option>{assetAccounts.filter((account) => account.id !== fx.sourceAccountId && (!fxSource || account.currency !== fxSource.currency)).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.faName || account.name} · {account.currency}</option>)}</select></label></div><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">مبلغ مبدأ {fxSource ? `(${fxSource.currency})` : ''}<input type="number" min="0" step="0.01" value={fx.sourceAmount} onChange={(e) => setFx({ ...fx, sourceAmount: e.target.value })} required className="field mt-1" /></label><label className="text-slate-400">نرخ 1 {fxSource?.currency || 'SOURCE'} → {fxTarget?.currency || 'TARGET'}<input type="number" min="0" step="0.000001" value={fx.rate} onChange={(e) => setFx({ ...fx, rate: e.target.value })} required className="field mt-1" /></label></div><div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-blue-200">مبلغ مقصد: <strong className="font-mono">{Number.isFinite(fxTargetAmount) && fxTargetAmount > 0 ? formatCurrency(fxTargetAmount, fxTarget?.currency) : '—'}</strong><br /><span className="text-[10px] text-slate-400">ERP دو سند تک‌ارزی ایجاد می‌کند؛ یک سند برای خروج ارز مبدأ و یک سند برای ورود ارز مقصد. حساب‌های FX Position سیستمی به‌صورت خودکار و فقط در Server ساخته می‌شوند.</span></div><div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setShowFxForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-40">ثبت تبدیل ارز</button></div></form></div></div>}

    {showForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto"><div className="flex items-center justify-between mb-4"><h2 className="text-white font-bold">ثبت سند دستی دوبل</h2><span className={`text-xs font-bold ${isBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>{isBalanced ? <><CheckCircle2 className="inline w-4 h-4" /> تراز</> : <><AlertTriangle className="inline w-4 h-4" /> اختلاف {formatCurrency(Math.abs(totals.debit - totals.credit))}</>}</span></div><form onSubmit={submit} className="space-y-4 text-xs"><div className="grid md:grid-cols-2 gap-3"><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="شرح سند" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="شماره عطف (اختیاری)" className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></div><div className="space-y-2">{rows.map((row, index) => <div key={index} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-xl border border-slate-800"><select value={row.accountId} onChange={(event) => updateRow(index, { accountId: event.target.value })} className="col-span-5 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"><option value="">انتخاب حساب</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.faName || account.name} ({account.currency})</option>)}</select><input type="number" min="0" step="0.01" placeholder="بدهکار" value={row.debit} onChange={(event) => updateRow(index, { debit: event.target.value, credit: event.target.value && Number(event.target.value) > 0 ? '' : row.credit })} className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg p-2 text-emerald-400" /><input type="number" min="0" step="0.01" placeholder="بستانکار" value={row.credit} onChange={(event) => updateRow(index, { credit: event.target.value, debit: event.target.value && Number(event.target.value) > 0 ? '' : row.debit })} className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg p-2 text-rose-400" /><button type="button" disabled={rows.length <= 2} onClick={() => setRows((previous) => previous.filter((_, i) => i !== index))} className="col-span-1 text-rose-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button></div>)}</div><button type="button" onClick={() => setRows((previous) => [...previous, EMPTY_ROW()])} className="px-3 py-2 bg-slate-800 rounded-lg text-slate-300">+ ردیف</button><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" disabled={!isBalanced || !validLines} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl disabled:opacity-40">ثبت قطعی</button></div></form></div></div>}
    <style>{`.field{display:block;width:100%;background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white;outline:none}.field:focus{border-color:#3b82f6}`}</style>
  </div>;
};
