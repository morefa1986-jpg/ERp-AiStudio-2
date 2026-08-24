import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Printer } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { buildReceivablesAging } from '../../utils/receivablesAging';
import { downloadXlsx } from '../../utils/xlsxExport';
import { ComparativeAnalyticsView } from './ComparativeAnalyticsView';

type ScopeMode = 'farm' | 'multiHall' | 'hall' | 'pond';
type ReportType = 'ponds' | 'feeding' | 'water' | 'mortality' | 'treatments' | 'transfers' | 'inventory' | 'processing' | 'sales' | 'receivables' | 'accounting' | 'payroll' | 'audit';
type ReportRow = Record<string, string | number | boolean | null | undefined>;

const REPORT_LABELS: Record<ReportType, string> = {
  ponds: 'وضعیت استخرها', feeding: 'خوراک‌دهی', water: 'کیفیت آب', mortality: 'تلفات', treatments: 'درمان‌ها', transfers: 'انتقالات',
  inventory: 'انبار', processing: 'فرآوری', sales: 'فروش', receivables: 'مطالبات و سررسید', accounting: 'حسابداری', payroll: 'حقوق', audit: 'Audit Trail',
};

const SCOPED_REPORTS = new Set<ReportType>(['ponds', 'feeding', 'water', 'mortality', 'treatments', 'transfers', 'processing', 'sales', 'receivables']);
const DATED_REPORTS = new Set<ReportType>(['feeding', 'water', 'mortality', 'treatments', 'transfers', 'processing', 'sales', 'receivables', 'accounting', 'payroll', 'audit']);
const CURRENT_SNAPSHOT_REPORTS = new Set<ReportType>(['ponds', 'inventory']);

function csvCell(value: unknown): string { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

const ReportsTablePanel: React.FC = () => {
  const farm = useFarm();
  const { formatNumber } = useI18n();
  const [reportType, setReportType] = useState<ReportType>('ponds');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('farm');
  const [hallId, setHallId] = useState('');
  const [pondId, setPondId] = useState('');
  const [hallIds, setHallIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const scopeSupported = SCOPED_REPORTS.has(reportType);
  const dateSupported = DATED_REPORTS.has(reportType);

  useEffect(() => { if (!scopeSupported && scopeMode !== 'farm') setScopeMode('farm'); }, [scopeMode, scopeSupported]);

  const scopedPondIds = useMemo(() => {
    if (!scopeSupported) return new Set(farm.ponds.map((pond) => pond.id));
    if (scopeMode === 'pond') return new Set(farm.ponds.filter((pond) => pond.id === pondId).map((pond) => pond.id));
    if (scopeMode === 'hall') return new Set(farm.ponds.filter((pond) => pond.hallId === hallId).map((pond) => pond.id));
    if (scopeMode === 'multiHall') {
      const selected = new Set(hallIds);
      return new Set(farm.ponds.filter((pond) => selected.has(pond.hallId)).map((pond) => pond.id));
    }
    return new Set(farm.ponds.map((pond) => pond.id));
  }, [farm.ponds, scopeSupported, scopeMode, pondId, hallId, hallIds]);

  const inDateRange = (value?: string) => {
    if (!dateSupported || !value) return true;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return false;
    if (fromDate && ts < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && ts > new Date(`${toDate}T23:59:59.999`).getTime()) return false;
    return true;
  };

  const proformaTouchesScope = (proforma: (typeof farm.proformas)[number]) => {
    if (!scopeSupported || scopeMode === 'farm') return true;
    return proforma.items.some((item) => {
      if (!item.processingBatchId) return false;
      const batch = farm.processingBatches.find((candidate) => candidate.id === item.processingBatchId);
      return Boolean(batch && scopedPondIds.has(batch.sourcePondId));
    });
  };

  const rows = useMemo<ReportRow[]>((() => {
    switch (reportType) {
      case 'ponds': return farm.ponds.filter((pond) => scopedPondIds.has(pond.id)).map((pond) => ({ pond: pond.name, number: pond.number, hall: farm.halls.find((hall) => hall.id === pond.hallId)?.name || pond.hallId, fishCount: pond.fishCount, biomassKg: pond.biomassKg, averageWeightKg: pond.averageWeightKg, fcr: pond.fcr, feedingStatus: pond.feedingStatus, sensorQuality: pond.sensorQuality || '', telemetryAt: pond.lastTelemetryTimestamp || '' }));
      case 'feeding': return farm.feedingRecords.filter((row) => scopedPondIds.has(row.pondId) && inDateRange(row.timestamp)).map((row) => ({ timestamp: row.timestamp, pond: row.pondName, amountKg: row.actualAmountKg, recommendedKg: row.recommendedAmountKg, feed: row.feedTypeName, operator: row.operatorName, telemetryAt: row.telemetryTimestamp || '' }));
      case 'water': return farm.waterLogs.filter((row) => scopedPondIds.has(row.pondId) && inDateRange(row.timestamp)).map((row) => ({ timestamp: row.timestamp, pond: row.pondName, hall: row.hallName, DO: row.dissolvedOxygen, temperature: row.temperature, pH: row.ph, NH3: row.ammonia, NO2: row.nitrite, sourceStatus: row.sensorStatus, severity: row.severity, operator: row.operator }));
      case 'mortality': return farm.mortalityRecords.filter((row) => scopedPondIds.has(row.pondId) && inDateRange(row.timestamp)).map((row) => ({ timestamp: row.timestamp, pond: row.pondName, species: row.speciesName, sex: row.stockSex || 'Unknown', count: row.count, estimatedWeightKg: row.estimatedWeightKg, chips: row.chipNumbers?.join(' | ') || '', reason: row.reason, recordedBy: row.recordedBy }));
      case 'treatments': return farm.treatments.filter((row) => scopedPondIds.has(row.pondId) && inDateRange(row.startDate)).map((row) => ({ pond: row.pondName, startDate: row.startDate, endDate: row.endDate, status: row.status, withdrawalEndDate: row.withdrawalEndDate, responsible: row.veterinarian }));
      case 'transfers': return farm.transfers.filter((row) => (scopedPondIds.has(row.sourceId) || scopedPondIds.has(row.destinationId)) && inDateRange(row.date)).map((row) => ({ date: row.date, source: row.sourceName, destination: row.destinationName, species: row.speciesName, sex: row.stockSex || 'Unknown', chips: row.chipNumbers?.join(' | ') || '', fishCount: row.fishCount, biomassKg: row.totalBiomassKg, operator: row.operator, reason: row.reason, status: row.status }));
      case 'inventory': return farm.inventory.map((row) => ({ sku: row.sku, name: row.name, category: row.category, batch: row.batchNumber, quantity: row.quantity, unit: row.unit, expiryDate: row.expiryDate || '', supplier: row.supplierName, location: row.warehouseLocation, status: row.status }));
      case 'processing': return farm.processingBatches.filter((row) => scopedPondIds.has(row.sourcePondId) && inDateRange(row.date)).map((row) => ({ batch: row.batchCode, date: row.date, pond: row.sourcePondName, species: row.speciesName, fishCount: row.fishCount, liveBiomassKg: row.liveBiomassKg, caviarKg: row.caviarYieldKg, filletKg: row.filletMeatYieldKg, qualityScore: row.qualityScore, status: row.status }));
      case 'sales': return farm.proformas.filter((row) => proformaTouchesScope(row) && inDateRange(row.date)).map((row) => ({ invoice: row.invoiceNumber, date: row.date, customer: row.customerName, country: row.customerCountry, currency: row.currency, total: row.grandTotal, stage: row.stage, fulfilledAt: row.fulfilledAt || '', sourceLots: row.items.map((item) => item.coldStorageLotId || '').filter(Boolean).join(' | ') }));
      case 'receivables': return buildReceivablesAging(farm.proformas.filter((row) => proformaTouchesScope(row)), toDate || new Date().toISOString().slice(0, 10)).filter((row) => inDateRange(row.dueDate)).map((row) => ({ invoice: row.invoiceNumber, dueDate: row.dueDate, customer: row.customerName, company: row.customerCompany, country: row.customerCountry, currency: row.currency, amountDue: row.amountDue, daysOverdue: row.daysOverdue, bucket: row.bucket, stage: row.stage, status: row.status }));
      case 'accounting': return farm.journals.filter((row) => inDateRange(row.date)).map((row) => ({ entryNumber: row.entryNumber, date: row.date, referenceType: row.referenceType, referenceId: row.referenceId || '', description: row.description, totalDebit: row.totalDebit, totalCredit: row.totalCredit, approvedBy: row.approvedBy, balanced: row.isBalanced }));
      case 'payroll': return farm.payrolls.filter((row) => inDateRange(`${row.payrollMonth}-01`)).map((row) => ({ month: row.payrollMonth, employee: row.employeeName, department: row.department, gross: row.grossSalary, deductions: row.socialSecurityInsurance + row.incomeTax + row.loanDeduction, net: row.netPay, currency: row.currency, status: row.paymentStatus }));
      case 'audit': return farm.auditLogs.filter((row) => inDateRange(row.timestamp)).map((row) => ({ timestamp: row.timestamp, user: row.userName, role: row.userRole, action: row.action, entity: row.entity, entityId: row.entityId, details: row.details, transactionId: row.transactionId || '', ipAddress: row.ipAddress || '' }));
      default: return [];
    }
  }), [reportType, farm, scopedPondIds, fromDate, toDate, scopeMode, scopeSupported, dateSupported]);

  const columns = useMemo(() => rows.length ? Object.keys(rows[0]) : [], [rows]);
  const exportCsv = () => {
    const csv = [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `fathi-erp-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const exportXlsx = () => downloadXlsx(`fathi-erp-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`, REPORT_LABELS[reportType], rows, columns);
  const toggleHall = (id: string) => setHallIds((previous) => previous.includes(id) ? previous.filter((row) => row !== id) : [...previous, id]);

  const semantics = !scopeSupported ? 'این گزارش ذاتاً سراسری است؛ Scope سالن/استخر برای آن غیرفعال شده تا خروجی گمراه‌کننده تولید نشود.' : reportType === 'sales' && scopeMode !== 'farm' ? 'Scope فروش از Processing Batch و Lotهای صریح هر خط فروش استخراج می‌شود.' : reportType === 'receivables' ? 'مطالبات فقط از پیش‌فاکتورهای تسویه‌نشده و لغونشده ساخته می‌شود؛ سررسید از expiryDate محاسبه می‌شود.' : CURRENT_SNAPSHOT_REPORTS.has(reportType) ? 'این گزارش Snapshot وضعیت فعلی است و فیلتر تاریخ برای آن معنا ندارد.' : 'Scope و بازه زمانی روی رکوردهای این گزارش اعمال می‌شود.';

  return <div className="space-y-5">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2"><FileText className="w-6 h-6 text-amber-400" />مرکز گزارش‌های عملیاتی</h1><p className="text-xs text-slate-400 mt-1">Scope فقط جایی نمایش داده می‌شود که به‌طور واقعی قابل انتساب باشد؛ گزارش‌های سراسری با Scope جعلی نمایش داده نمی‌شوند.</p></div><div className="flex gap-2"><button disabled={!rows.length} onClick={exportCsv} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Download className="w-4 h-4" />CSV</button><button disabled={!rows.length} onClick={exportXlsx} className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Download className="w-4 h-4" />XLSX</button><button disabled={!rows.length} onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Printer className="w-4 h-4" />چاپ / PDF</button></div></div>
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] text-cyan-100">{semantics}</div>
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid md:grid-cols-2 xl:grid-cols-5 gap-3 text-xs">
      <label className="text-slate-400">نوع گزارش<select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="field mt-1 w-full">{Object.entries(REPORT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="text-slate-400">Scope<select value={scopeSupported ? scopeMode : 'farm'} disabled={!scopeSupported} onChange={(e) => setScopeMode(e.target.value as ScopeMode)} className="field mt-1 w-full disabled:opacity-50"><option value="farm">کل مجموعه</option>{scopeSupported && <><option value="multiHall">چند سالن</option><option value="hall">یک سالن</option><option value="pond">یک استخر</option></>}</select></label>
      {scopeSupported && scopeMode === 'hall' ? <label className="text-slate-400">سالن<select value={hallId} onChange={(e) => setHallId(e.target.value)} className="field mt-1 w-full"><option value="">انتخاب...</option>{farm.halls.map((hall) => <option key={hall.id} value={hall.id}>{hall.number} — {hall.name}</option>)}</select></label> : scopeSupported && scopeMode === 'pond' ? <label className="text-slate-400">استخر<select value={pondId} onChange={(e) => setPondId(e.target.value)} className="field mt-1 w-full"><option value="">انتخاب...</option>{farm.ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label> : <div />}
      <label className="text-slate-400">از تاریخ<input type="date" disabled={!dateSupported} value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="field mt-1 w-full disabled:opacity-50" /></label><label className="text-slate-400">تا تاریخ<input type="date" disabled={!dateSupported} value={toDate} onChange={(e) => setToDate(e.target.value)} className="field mt-1 w-full disabled:opacity-50" /></label>
    </div>
    {scopeSupported && scopeMode === 'multiHall' && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-2">{farm.halls.map((hall) => <label key={hall.id} className={`px-3 py-2 rounded-lg border text-[11px] cursor-pointer ${hallIds.includes(hall.id) ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-slate-800 text-slate-400'}`}><input type="checkbox" checked={hallIds.includes(hall.id)} onChange={() => toggleHall(hall.id)} className="ml-2" />{hall.number} — {hall.name}</label>)}</div>}
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="p-3 border-b border-slate-800 flex justify-between text-xs"><strong className="text-white">{REPORT_LABELS[reportType]}</strong><span className="text-slate-400">{formatNumber(rows.length)} رکورد</span></div><div className="overflow-auto max-h-[60vh]"><table className="w-full text-xs"><thead className="bg-slate-950 sticky top-0 text-slate-500"><tr>{columns.map((column) => <th key={column} className="p-3 text-start whitespace-nowrap">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.length ? rows.map((row, index) => <tr key={index} className="text-slate-300">{columns.map((column) => <td key={column} className="p-3 whitespace-nowrap max-w-sm overflow-hidden text-ellipsis">{String(row[column] ?? '')}</td>)}</tr>) : <tr><td colSpan={Math.max(1, columns.length)} className="p-10 text-center text-slate-500">داده‌ای برای این فیلتر وجود ندارد.</td></tr>}</tbody></table></div></div>
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}@media print{button,select,input{display:none!important}body{background:white!important;color:black!important}}`}</style>
  </div>;
};

export const ReportsView: React.FC = () => {
  const [tab, setTab] = useState<'table' | 'analytics'>('table');
  return <div className="space-y-5 pb-12 animate-fadeIn">
    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-2 text-xs">
      <button onClick={() => setTab('table')} className={`px-4 py-2 rounded-xl font-bold ${tab === 'table' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}><FileText className="w-4 h-4 inline ml-1" />گزارش جدولی</button>
      <button onClick={() => setTab('analytics')} className={`px-4 py-2 rounded-xl font-bold ${tab === 'analytics' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}><BarChart3 className="w-4 h-4 inline ml-1" />نمودارهای مقایسه‌ای</button>
    </div>
    {tab === 'table' ? <ReportsTablePanel /> : <ComparativeAnalyticsView />}
  </div>;
};
