import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, History, Plus, XCircle } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import {
  approveLaboratorySample,
  createLaboratorySample,
  LaboratoryEventRecord,
  listLaboratoryEvents,
  recordLaboratoryResults,
  rejectLaboratorySample,
} from '../../services/laboratoryService';
import type { LabSample } from '../../types';

type OperationalLabSample = LabSample & { sourceId?: string; createdAt?: string; createdBy?: string; resultRecordedAt?: string; resultRecordedBy?: string; approvedAt?: string; rejectedAt?: string; rejectionReason?: string };
type ParameterDraft = { name: string; value: string; unit: string; referenceRange: string; status: 'Normal' | 'Abnormal' | 'Critical' };

const SOURCE_TYPES: LabSample['sourceType'][] = ['Pond', 'Fish Tissue', 'Water Supply', 'Egg/Caviar', 'Feed Batch'];
const TEST_TYPES: LabSample['testType'][] = ['Water Chemistry', 'Microbiology & Bacterial', 'Parasitology', 'Histology', 'Caviar Heavy Metals & Microbiology'];
function localDate(): string { const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const emptyParameter = (): ParameterDraft => ({ name: '', value: '', unit: '', referenceRange: '', status: 'Normal' });

export const LaboratoryView: React.FC = () => {
  const farm = useFarm();
  const { hasPermission, currentUser } = useAuth();
  const { formatDate, formatNumber } = useI18n();
  const [samples, setSamples] = useState<OperationalLabSample[]>(farm.labSamples as OperationalLabSample[]);
  const [selectedId, setSelectedId] = useState(farm.labSamples[0]?.id || '');
  const [events, setEvents] = useState<LaboratoryEventRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sampleCode, setSampleCode] = useState('');
  const [sourceType, setSourceType] = useState<LabSample['sourceType']>('Pond');
  const [sourceId, setSourceId] = useState(farm.ponds[0]?.id || '');
  const [sourceName, setSourceName] = useState('');
  const [collectionDate, setCollectionDate] = useState(localDate());
  const [testType, setTestType] = useState<LabSample['testType']>('Water Chemistry');
  const [parameters, setParameters] = useState<ParameterDraft[]>([emptyParameter()]);
  const [resultSummary, setResultSummary] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  const canCreate = hasPermission('laboratory', 'create');
  const canEdit = hasPermission('laboratory', 'edit');
  const canApprove = hasPermission('laboratory', 'approve');
  const selected = samples.find((row) => row.id === selectedId);

  useEffect(() => setSamples(farm.labSamples as OperationalLabSample[]), [farm.labSamples]);
  useEffect(() => {
    if (!selected) return;
    setParameters(selected.parametersTested?.length ? selected.parametersTested.map((row) => ({ name: row.name, value: String(row.value), unit: row.unit || '', referenceRange: row.referenceRange, status: row.status })) : [emptyParameter()]);
    setResultSummary(selected.resultSummary || '');
    setAttachmentUrl(selected.attachmentUrl || '');
  }, [selectedId]);
  useEffect(() => { void refreshEvents(); }, [selectedId]);

  const refreshEvents = async (id = selectedId) => {
    if (!id) { setEvents([]); return; }
    try { setEvents(await listLaboratoryEvents(id)); } catch { setEvents([]); }
  };
  const applyResult = async (payload: any, text: string) => {
    if (payload?.sample?.id) setSamples((previous) => previous.some((row) => row.id === payload.sample.id) ? previous.map((row) => row.id === payload.sample.id ? payload.sample : row) : [payload.sample, ...previous]);
    if (payload?.sample?.id) setSelectedId(payload.sample.id);
    setMessage(text); setError('');
    await refreshEvents(payload?.sample?.id || selectedId);
  };
  const execute = async (task: () => Promise<any>, text: string) => {
    if (busy) return; setBusy(true); setMessage(''); setError('');
    try { await applyResult(await task(), text); } catch (e) { setError(e instanceof Error ? e.message : 'LABORATORY_REQUEST_FAILED'); } finally { setBusy(false); }
  };

  const stats = useMemo(() => ({
    total: samples.length,
    pending: samples.filter((row) => row.status === 'Pending').length,
    critical: samples.filter((row) => row.parametersTested?.some((parameter) => parameter.status === 'Critical')).length,
    approved: samples.filter((row) => row.status === 'Approved').length,
  }), [samples]);

  const createSample = () => execute(() => createLaboratorySample({
    sampleCode, sourceType, sourceId: sourceType === 'Pond' ? sourceId : undefined, sourceName: sourceType === 'Pond' ? undefined : sourceName,
    collectionDate, collectorName: currentUser?.fullName || '', testType,
  }), 'نمونه با وضعیت Pending ثبت شد.');

  const saveResults = () => selected && execute(() => recordLaboratoryResults(selected.id, {
    parametersTested: parameters.map((row) => ({ ...row, value: row.value.trim() })), resultSummary, attachmentUrl: attachmentUrl || undefined,
  }), 'نتایج ثبت شدند و برای تأیید آماده‌اند.');

  return <div className="space-y-5 pb-12">
    <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5"><h1 className="text-lg font-black text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-[#D4AF37]" />مرکز عملیات آزمایشگاه</h1><p className="text-xs text-[#71717A] mt-1">نمونه → ثبت نتیجه → تأیید/رد → تاریخچه ممیزی. این بخش درمان یا دوز پیشنهاد نمی‌کند.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
      ['کل نمونه‌ها', stats.total], ['Pending', stats.pending], ['Critical findings', stats.critical], ['Approved', stats.approved],
    ].map(([label, value]) => <div key={String(label)} className="bg-[#121214] border border-[#27272A] rounded-2xl p-4"><div className="text-xs text-[#71717A]">{label}</div><div className="text-xl font-black text-white mt-2">{formatNumber(Number(value))}</div></div>)}</div>
    {message && <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-200">{message}</div>}
    {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200">{error}</div>}

    <div className="grid xl:grid-cols-[1fr_1.4fr] gap-5">
      <div className="space-y-5">
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 space-y-3">
          <div className="text-sm font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4" />ثبت نمونه جدید</div>
          <div className="grid grid-cols-2 gap-2"><input value={sampleCode} onChange={(e) => setSampleCode(e.target.value)} placeholder="کد نمونه" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" /><input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" /></div>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as LabSample['sourceType'])} className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs">{SOURCE_TYPES.map((value) => <option key={value}>{value}</option>)}</select>
          {sourceType === 'Pond' ? <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs">{farm.ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.name} · {pond.number}</option>)}</select> : <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="منبع نمونه" className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" />}
          <select value={testType} onChange={(e) => setTestType(e.target.value as LabSample['testType'])} className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs">{TEST_TYPES.map((value) => <option key={value}>{value}</option>)}</select>
          <button disabled={!canCreate || busy} onClick={() => void createSample()} className="w-full px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-bold disabled:opacity-40">ثبت نمونه Pending</button>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden"><div className="p-4 border-b border-[#27272A] text-sm font-bold text-white">نمونه‌ها</div><div className="max-h-[520px] overflow-auto divide-y divide-[#27272A]">{samples.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className={`w-full text-start p-3 text-xs ${selectedId === row.id ? 'bg-[#D4AF37]/10' : 'hover:bg-[#18181B]'}`}><div className="flex justify-between gap-2"><span className="font-bold text-white">{row.sampleCode}</span><span className={row.status === 'Approved' ? 'text-emerald-300' : row.status === 'Rejected' ? 'text-red-300' : 'text-amber-300'}>{row.status}</span></div><div className="text-[#71717A] mt-1">{row.sourceName} · {row.testType}</div>{row.parametersTested?.some((p) => p.status === 'Critical') && <div className="text-red-300 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Critical finding</div>}</button>)}</div></div>
      </div>

      <div className="space-y-5">
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 space-y-4">
          <div className="text-sm font-bold text-white">ثبت/بازبینی نتیجه</div>
          {!selected ? <div className="text-xs text-[#71717A]">نمونه‌ای انتخاب نشده است.</div> : <>
            <div className="rounded-xl bg-[#0C0C0E] border border-[#27272A] p-3 text-xs"><div className="font-bold text-white">{selected.sampleCode} · {selected.sourceName}</div><div className="text-[#71717A] mt-1">{selected.testType} · {formatDate(selected.collectionDate)}</div></div>
            <div className="space-y-2">{parameters.map((row, index) => <div key={index} className="grid grid-cols-2 lg:grid-cols-5 gap-2"><input value={row.name} disabled={selected.status !== 'Pending'} onChange={(e) => setParameters((prev) => prev.map((p, i) => i === index ? { ...p, name: e.target.value } : p))} placeholder="پارامتر" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><input value={row.value} disabled={selected.status !== 'Pending'} onChange={(e) => setParameters((prev) => prev.map((p, i) => i === index ? { ...p, value: e.target.value } : p))} placeholder="مقدار" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><input value={row.unit} disabled={selected.status !== 'Pending'} onChange={(e) => setParameters((prev) => prev.map((p, i) => i === index ? { ...p, unit: e.target.value } : p))} placeholder="واحد" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><input value={row.referenceRange} disabled={selected.status !== 'Pending'} onChange={(e) => setParameters((prev) => prev.map((p, i) => i === index ? { ...p, referenceRange: e.target.value } : p))} placeholder="Reference" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><select value={row.status} disabled={selected.status !== 'Pending'} onChange={(e) => setParameters((prev) => prev.map((p, i) => i === index ? { ...p, status: e.target.value as ParameterDraft['status'] } : p))} className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs"><option>Normal</option><option>Abnormal</option><option>Critical</option></select></div>)}</div>
            {selected.status === 'Pending' && <button type="button" onClick={() => setParameters((prev) => [...prev, emptyParameter()])} className="text-xs text-[#D4AF37]">+ افزودن پارامتر</button>}
            <textarea value={resultSummary} disabled={selected.status !== 'Pending'} onChange={(e) => setResultSummary(e.target.value)} placeholder="خلاصه نتیجه آزمایش" className="w-full min-h-24 bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" />
            <input value={attachmentUrl} disabled={selected.status !== 'Pending'} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="مرجع/URL فایل پیوست (اختیاری)" className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" />
            {selected.status === 'Pending' && <button disabled={!canEdit || busy} onClick={() => void saveResults()} className="w-full px-3 py-2 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold disabled:opacity-40">ثبت نتایج</button>}
            {selected.status === 'Pending' && <div className="grid grid-cols-2 gap-2"><button disabled={!canApprove || busy || !selected.parametersTested?.length} onClick={() => void execute(() => approveLaboratorySample(selected.id, decisionReason), 'نتیجه به‌عنوان نتیجه بررسی‌شده تأیید شد.' )} className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" />Approve</button><button disabled={!canApprove || busy || !decisionReason.trim()} onClick={() => void execute(() => rejectLaboratorySample(selected.id, decisionReason), 'نتیجه رد و دلیل آن ثبت شد.')} className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1"><XCircle className="w-4 h-4" />Reject</button></div>}
            {selected.status === 'Pending' && <input value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} placeholder="یادداشت تأیید یا دلیل رد" className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" />}
            {selected.status !== 'Pending' && <div className="rounded-xl border border-[#3F3F46] p-3 text-xs text-[#A1A1AA]">این نتیجه Finalized است و از این Workflow قابل ویرایش نیست. {selected.rejectionReason ? `دلیل رد: ${selected.rejectionReason}` : ''}</div>}
          </>}
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden"><div className="p-4 border-b border-[#27272A] text-sm font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-[#D4AF37]" />تاریخچه نمونه</div><div className="divide-y divide-[#27272A]">{events.length ? events.map((event) => <div key={event.id} className="p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-bold text-white">{event.eventType}</span><span className="text-[#71717A]">{formatDate(event.timestamp)}</span></div><div className="text-[#A1A1AA] mt-1">{event.actor} · {event.notes || '—'}</div>{Number(event.criticalCount || 0) > 0 && <div className="text-red-300 mt-1">Critical: {event.criticalCount}</div>}</div>) : <div className="p-8 text-center text-xs text-[#71717A]">تاریخچه‌ای ثبت نشده است.</div>}</div></div>
      </div>
    </div>
  </div>;
};
