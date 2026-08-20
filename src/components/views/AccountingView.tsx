import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';

interface DraftLine { accountId: string; debit: number; credit: number; note: string; }

export const AccountingView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate, language } = useI18n();
  const { currentUser } = useAuth();
  const { accounts, journals, createJournalEntry } = useFarm();
  const [activeTab, setActiveTab] = useState<'journals' | 'coa'>('journals');
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const emptyLine = (accountId = accounts[0]?.id || ''): DraftLine => ({ accountId, debit: 0, credit: 0, note: '' });
  const [rows, setRows] = useState<DraftLine[]>([emptyLine(accounts[0]?.id), emptyLine(accounts[1]?.id || accounts[0]?.id)]);

  const totalDebit = useMemo(() => rows.reduce((sum, row) => sum + (Number.isFinite(row.debit) ? row.debit : 0), 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((sum, row) => sum + (Number.isFinite(row.credit) ? row.credit : 0), 0), [rows]);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) <= 0.01;
  const accountName = (id: string) => {
    const account = accounts.find((item) => item.id === id);
    if (!account) return id;
    return language === 'fa' ? account.faName || account.name : account.name;
  };
  const accountType = (value: string) => language === 'fa' ? (value.match(/\((.*)\)/)?.[1] || value) : value.split(' (')[0];

  const updateRow = (index: number, patch: Partial<DraftLine>) => setRows((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const resetForm = () => { setDescription(''); setReference(''); setRows([emptyLine(accounts[0]?.id), emptyLine(accounts[1]?.id || accounts[0]?.id)]); setError(''); };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isBalanced) { setError(t('accounting.validationUnbalanced')); return; }
    const debits = rows.filter((row) => row.debit > 0).map((row) => ({ accountId: row.accountId, accountName: accountName(row.accountId), amount: Number(row.debit) }));
    const credits = rows.filter((row) => row.credit > 0).map((row) => ({ accountId: row.accountId, accountName: accountName(row.accountId), amount: Number(row.credit) }));
    const result = createJournalEntry({ date: new Date().toISOString().slice(0, 10), referenceType: 'Manual', referenceId: reference.trim() || undefined, description: description.trim(), debits, credits, totalDebit, totalCredit, approvedBy: currentUser?.fullName });
    if (!result.success) { setError(t('error')); return; }
    setShowModal(false); resetForm();
  };

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Calculator className="w-6 h-6 text-amber-400" />{t('accounting.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('accounting.subtitle')}</p></div><div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs"><button onClick={() => setActiveTab('journals')} className={`px-4 py-1.5 rounded-lg font-bold ${activeTab === 'journals' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>{t('accounting.tabJournals')} ({formatNumber(journals.length)})</button><button onClick={() => setActiveTab('coa')} className={`px-4 py-1.5 rounded-lg font-bold ${activeTab === 'coa' ? 'bg-blue-500 text-slate-950' : 'text-slate-400'}`}>{t('accounting.tabCoa')} ({formatNumber(accounts.length)})</button></div></div>

    {activeTab === 'journals' ? <div className="space-y-4"><div className="flex justify-end"><button onClick={() => { resetForm(); setShowModal(true); }} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1"><Plus className="w-4 h-4" />{t('accounting.btnNewJournal')}</button></div><div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('accounting.thSanadNo')}</th><th className="p-3">{t('accounting.thDate')}</th><th className="p-3">{t('accounting.thDescription')}</th><th className="p-3">{t('accounting.thDebit')}</th><th className="p-3">{t('accounting.thCredit')}</th><th className="p-3">{t('accounting.thStatus')}</th><th className="p-3">{t('accounting.thApprovedBy')}</th></tr></thead><tbody className="divide-y divide-slate-800">{journals.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : journals.map((entry) => <tr key={entry.id} className="text-slate-300"><td className="p-3 font-mono text-amber-400">{entry.entryNumber}</td><td className="p-3">{formatDate(entry.date)}</td><td className="p-3 text-white">{entry.description}</td><td className="p-3 text-emerald-400">{formatCurrency(entry.totalDebit, accounts[0]?.currency || 'IRR')}</td><td className="p-3 text-rose-400">{formatCurrency(entry.totalCredit, accounts[0]?.currency || 'IRR')}</td><td className="p-3">{entry.isBalanced ? t('accounting.balanced') : t('accounting.unbalanced')}</td><td className="p-3">{entry.approvedBy || '—'}</td></tr>)}</tbody></table></div></div> : <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('accounting.thCoaCode')}</th><th className="p-3">{t('accounting.thCoaName')}</th><th className="p-3">{t('accounting.thCoaType')}</th><th className="p-3">{t('accounting.thCoaBalance')}</th></tr></thead><tbody className="divide-y divide-slate-800">{accounts.map((account) => <tr key={account.id} className="text-slate-300"><td className="p-3 font-mono text-amber-400">{account.code}</td><td className="p-3 text-white">{language === 'fa' ? account.faName || account.name : account.name}</td><td className="p-3">{accountType(account.type)}</td><td className="p-3 font-bold">{formatCurrency(account.balance, account.currency)}</td></tr>)}</tbody></table></div>}

    {showModal && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/40 rounded-2xl max-w-4xl w-full p-6 space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white flex items-center gap-2"><Calculator className="w-5 h-5 text-amber-400" />{t('accounting.modalNewTitle')}</h3><span className={`text-xs px-3 py-1 rounded-full flex gap-1 ${isBalanced ? 'text-emerald-300 bg-emerald-500/10' : 'text-rose-300 bg-rose-500/10'}`}>{isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{isBalanced ? t('accounting.balanced') : t('accounting.unbalanced')}</span></div><p className="text-xs text-slate-400">{t('accounting.modalSubtitle')}</p><form onSubmit={save} className="space-y-4 text-xs">{error && <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">{error}</div>}<div className="grid grid-cols-2 gap-3"><label className="text-slate-300">{t('accounting.fieldSanadDesc')}<input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full field" required /></label><label className="text-slate-300">{t('accounting.fieldSanadRef')}<input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full field" /></label></div><div className="space-y-2 max-h-64 overflow-y-auto">{rows.map((row, index) => <div key={index} className="grid grid-cols-12 gap-2 bg-slate-900 p-2 rounded-xl"><select value={row.accountId} onChange={(e) => updateRow(index, { accountId: e.target.value })} className="col-span-4 field">{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {language === 'fa' ? account.faName || account.name : account.name}</option>)}</select><input type="number" min="0" value={row.debit || ''} onChange={(e) => updateRow(index, { debit: Number(e.target.value) })} placeholder={t('accounting.thRowDebit')} className="col-span-3 field" /><input type="number" min="0" value={row.credit || ''} onChange={(e) => updateRow(index, { credit: Number(e.target.value) })} placeholder={t('accounting.thRowCredit')} className="col-span-3 field" /><button type="button" onClick={() => rows.length > 2 && setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index))} className="col-span-2 text-rose-400"><Trash2 className="w-4 h-4 mx-auto" /></button></div>)}</div><button type="button" onClick={() => setRows((previous) => [...previous, emptyLine(accounts[0]?.id)])} className="text-amber-400">{t('accounting.btnAddRow')}</button><div className="flex justify-between items-center border-t border-slate-800 pt-3"><div className="text-slate-300">{t('accounting.totalDebit')}: {formatNumber(totalDebit)} · {t('accounting.totalCredit')}: {formatNumber(totalCredit)}</div><div className="flex gap-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">{t('accounting.btnSaveEntry')}</button></div></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.65rem;padding:.55rem;color:white}`}</style>
  </div>;
};
