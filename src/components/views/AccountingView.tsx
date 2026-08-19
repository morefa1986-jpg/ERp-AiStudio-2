import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  Calculator,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowDownUp,
  DollarSign,
} from 'lucide-react';
import { JournalEntry } from '../../types';

export const AccountingView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const {
    accounts,
    journals,
    createJournalEntry,
  } = useFarm();

  const [activeTab, setActiveTab] = useState<'sanads' | 'coa'>('sanads');
  const [showNewSanadModal, setShowNewSanadModal] = useState<boolean>(false);

  // New Sanad form rows
  const [sanadDesc, setSanadDesc] = useState<string>('خرید محموله غذای اکسترود فرانسوی');
  const [sanadRef, setSanadRef] = useState<string>('INV-9942');
  const [rows, setRows] = useState<
    Array<{ accountCode: string; accountName: string; debit: number; credit: number; note: string }>
  >([
    { accountCode: '1110', accountName: 'موجودی انبار دان و غذا', debit: 450000000, credit: 0, note: 'خرید ۵ تن دان' },
    { accountCode: '1020', accountName: 'بانک ملت ارزی/ریالی', debit: 0, credit: 450000000, note: 'انتقال وجه ساتنا' },
  ]);

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleAddRow = () => {
    setRows([
      ...rows,
      { accountCode: '5010', accountName: 'بهای تمام شده غذای مصرفی', debit: 0, credit: 0, note: '' },
    ]);
  };

  const handleUpdateRow = (index: number, field: string, value: any) => {
    const updated = [...rows];
    if (field === 'accountCode') {
      const acc = accounts.find((a) => a.code === value);
      updated[index].accountCode = value;
      if (acc) updated[index].accountName = acc.name;
    } else {
      (updated[index] as any)[field] = value;
    }
    setRows(updated);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 2) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleSaveSanad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('سند تراز نیست! جمع بدهکار و بستانکار باید دقیقاً برابر باشد.');
      return;
    }

    createJournalEntry({
      date: new Date().toISOString().split('T')[0],
      referenceType: 'Purchase',
      referenceId: sanadRef,
      description: sanadDesc,
      debits: rows.filter((r) => r.debit > 0).map((r) => ({ accountId: r.accountCode, accountName: r.accountName, amount: Number(r.debit) })),
      credits: rows.filter((r) => r.credit > 0).map((r) => ({ accountId: r.accountCode, accountName: r.accountName, amount: Number(r.credit) })),
      totalDebit,
      totalCredit,
      approvedBy: 'مدیر مالی و اداری',
    });

    setShowNewSanadModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Calculator className="w-6 h-6 text-amber-400" />
            حسابداری دوبل و دفتر کل مالی (General Ledger)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سیستم حسابداری مالی و صنعتی مزرعه با تراز اتوماتیک بدهکار/بستانکار، کدینگ جامع حساب‌ها و ثبت اسناد
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('sanads')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'sanads'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            اسناد حسابداری ({journals.length})
          </button>
          <button
            onClick={() => setActiveTab('coa')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'coa'
                ? 'bg-blue-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            کدینگ حساب‌ها COA ({accounts.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Journal Entries */}
      {activeTab === 'sanads' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewSanadModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              ثبت سند حسابداری جدید (دوبل)
            </button>
          </div>

          <div className="space-y-4">
            {journals.map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {entry.entryNumber}
                    </span>
                    <span className="text-xs text-slate-400 mr-2">
                      تاریخ: {entry.date} {entry.referenceId ? `| عطف: ${entry.referenceId}` : ''}
                    </span>
                    <p className="text-xs font-semibold text-white mt-1">
                      {entry.description}
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold self-start sm:self-auto">
                    {entry.isBalanced ? 'تراز شده (Approved)' : 'عدم تراز'}
                  </span>
                </div>

                {/* Lines Table */}
                <table className="w-full text-xs text-right text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 text-[11px]">
                    <tr>
                      <th className="p-2">کد حساب</th>
                      <th className="p-2">عنوان حساب</th>
                      <th className="p-2">بدهکار (ریال)</th>
                      <th className="p-2">بستانکار (ریال)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {entry.debits.map((deb, idx) => (
                      <tr key={`deb_${idx}`}>
                        <td className="p-2 font-mono text-slate-400">{deb.accountId}</td>
                        <td className="p-2 font-bold text-white">{deb.accountName}</td>
                        <td className="p-2 text-emerald-400 font-mono">
                          {formatCurrency(deb.amount)}
                        </td>
                        <td className="p-2 text-slate-500 font-mono">-</td>
                      </tr>
                    ))}
                    {entry.credits.map((cred, idx) => (
                      <tr key={`cred_${idx}`}>
                        <td className="p-2 font-mono text-slate-400">{cred.accountId}</td>
                        <td className="p-2 font-bold text-white">{cred.accountName}</td>
                        <td className="p-2 text-slate-500 font-mono">-</td>
                        <td className="p-2 text-rose-400 font-mono">
                          {formatCurrency(cred.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-950/90 font-bold border-t border-slate-800">
                      <td colSpan={2} className="p-2 text-left text-slate-400">جمع کل سند:</td>
                      <td className="p-2 text-emerald-400 font-mono">{formatCurrency(entry.totalDebit)}</td>
                      <td className="p-2 text-rose-400 font-mono">{formatCurrency(entry.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Chart of Accounts */}
      {activeTab === 'coa' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <table className="w-full text-xs text-right text-slate-300">
            <thead className="bg-slate-800 text-slate-400 text-[11px] uppercase">
              <tr>
                <th className="p-3">کد حساب</th>
                <th className="p-3">نام سرفصل حساب</th>
                <th className="p-3">طبقه‌بندی</th>
                <th className="p-3">مانده فعلی (ریال)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-amber-400">{acc.code}</td>
                  <td className="p-3 font-bold text-white">{acc.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {acc.type}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-white">
                    {formatCurrency(acc.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: New Journal Entry */}
      {showNewSanadModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-950 border border-amber-500/40 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-400" />
                ثبت سند حسابداری دوبل (Auto Balancing)
              </h3>
              <div
                className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                  isBalanced
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    سند تراز است
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    عدم توازن: اختلاف {formatCurrency(Math.abs(totalDebit - totalCredit))}
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveSanad} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">شرح کلی سند:</label>
                  <input
                    type="text"
                    value={sanadDesc}
                    onChange={(e) => setSanadDesc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">شماره عطف / فاکتور:</label>
                  <input
                    type="text"
                    value={sanadRef}
                    onChange={(e) => setSanadRef(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    required
                  />
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800 items-center"
                  >
                    <div className="col-span-4">
                      <select
                        value={row.accountCode}
                        onChange={(e) => handleUpdateRow(idx, 'accountCode', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-[11px]"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.code} value={acc.code}>
                            {acc.code} — {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="بدهکار"
                        value={row.debit || ''}
                        onChange={(e) => handleUpdateRow(idx, 'debit', Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-emerald-400 font-mono font-bold text-xs"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="بستانکار"
                        value={row.credit || ''}
                        onChange={(e) => handleUpdateRow(idx, 'credit', Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-rose-400 font-mono font-bold text-xs"
                      />
                    </div>

                    <div className="col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                >
                  + افزودن ردیف
                </button>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>بدهکار کل: <strong className="text-emerald-400">{formatCurrency(totalDebit)}</strong></div>
                  <div>بستانکار کل: <strong className="text-rose-400">{formatCurrency(totalCredit)}</strong></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewSanadModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className={`px-5 py-2 rounded-xl font-bold transition-all ${
                    isBalanced
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  ثبت قطعی سند حسابداری
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
