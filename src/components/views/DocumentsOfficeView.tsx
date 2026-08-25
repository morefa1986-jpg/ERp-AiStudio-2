import React, { useMemo, useState } from 'react';
import { Archive, FileCheck2, FileText, Plus, Search, UploadCloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { OfficeDocument, OfficeDocumentAttachment } from '../../types';
import { nextId } from '../../utils/id';

type Draft = {
  direction: OfficeDocument['direction'];
  type: OfficeDocument['type'];
  documentNumber: string;
  documentDate: string;
  subject: string;
  sender: string;
  receiver: string;
  confidentiality: OfficeDocument['confidentiality'];
  priority: OfficeDocument['priority'];
  status: OfficeDocument['status'];
  relatedCustomerId: string;
  relatedProformaId: string;
  assignedTo: string;
  dueDate: string;
  tags: string;
  summary: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  direction: 'Incoming (وارده)',
  type: 'Letter (نامه)',
  documentNumber: '',
  documentDate: new Date().toISOString().slice(0, 10),
  subject: '',
  sender: '',
  receiver: 'دفتر مرکزی مزرعه فتحی',
  confidentiality: 'Normal',
  priority: 'Normal',
  status: 'Registered',
  relatedCustomerId: '',
  relatedProformaId: '',
  assignedTo: '',
  dueDate: '',
  tags: '',
  summary: '',
  notes: '',
};

function fileToAttachment(file: File, kind: OfficeDocumentAttachment['kind']): OfficeDocumentAttachment {
  return {
    id: nextId('att'),
    kind,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    addedAt: new Date().toISOString(),
  };
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export const DocumentsOfficeView: React.FC = () => {
  const { officeDocuments, customers, proformas, addOfficeDocument, updateOfficeDocumentStatus } = useFarm();
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [attachments, setAttachments] = useState<OfficeDocumentAttachment[]>([]);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return officeDocuments;
    return officeDocuments.filter((document) => [
      document.indicatorNumber, document.documentNumber, document.subject, document.sender, document.receiver,
      document.summary, document.tags.join(' '), document.attachments.map((file) => file.fileName).join(' '),
    ].join(' ').toLowerCase().includes(q));
  }, [officeDocuments, query]);

  const stats = useMemo(() => ({
    total: officeDocuments.length,
    incoming: officeDocuments.filter((row) => row.direction === 'Incoming (وارده)').length,
    outgoing: officeDocuments.filter((row) => row.direction === 'Outgoing (صادره)').length,
    withPdf: officeDocuments.filter((row) => row.attachments.some((file) => file.kind === 'PDF Copy (نسخه PDF)')).length,
  }), [officeDocuments]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const result = addOfficeDocument({
      ...draft,
      relatedCustomerId: draft.relatedCustomerId || undefined,
      relatedProformaId: draft.relatedProformaId || undefined,
      assignedTo: draft.assignedTo || undefined,
      dueDate: draft.dueDate || undefined,
      tags: draft.tags.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean),
      attachments,
    });
    if (!result.success) { setError(result.error || 'ثبت سند انجام نشد'); return; }
    setDraft(EMPTY_DRAFT); setAttachments([]); setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Archive className="w-6 h-6 text-amber-400" />دبیرخانه، اندیکاتور و آرشیو اسناد</h1>
          <p className="text-xs text-slate-400 mt-1">ثبت نامه‌های وارده/صادره، شماره اندیکاتور، فایل اصل، نسخه PDF و ارتباط با مشتری، فاکتور و پیش‌فاکتور.</p>
        </div>
        <button disabled={!hasPermission('documents', 'create')} onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold disabled:opacity-40"><Plus className="w-4 h-4 inline ml-1" />ثبت سند جدید</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['کل اسناد', stats.total], ['نامه وارده', stats.incoming], ['نامه صادره', stats.outgoing], ['دارای PDF', stats.withPdf]].map(([label, value]) => (
          <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[10px] text-slate-500">{label}</span><strong className="block text-2xl text-white mt-1">{value}</strong></div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute top-3 right-3 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در شماره اندیکاتور، موضوع، فرستنده، گیرنده، فایل‌ها..." className="field w-full pr-10" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.length === 0 ? <div className="text-xs text-slate-500 p-6">هنوز سندی ثبت نشده است.</div> : filtered.map((document) => (
            <div key={document.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between gap-3 border-b border-slate-800 pb-3">
                <div><strong className="text-amber-400 font-mono">{document.indicatorNumber}</strong><p className="text-sm text-white mt-1">{document.subject}</p><span className="text-[10px] text-slate-500">{document.documentNumber || 'بدون شماره نامه'} · {document.documentDate}</span></div>
                <span className="text-[10px] text-slate-300">{document.direction}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-300">
                <span>از: {document.sender}</span><span>به: {document.receiver}</span><span>نوع: {document.type}</span><span>وضعیت: {document.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-3 line-clamp-2">{document.summary || document.notes || '—'}</p>
              <div className="mt-3 space-y-1">{document.attachments.map((file) => <div key={file.id} className="flex justify-between text-[10px] bg-slate-900 rounded-lg px-2 py-1"><span className="text-slate-300">{file.kind}: {file.fileName}</span><span className="text-slate-500">{sizeLabel(file.sizeBytes)}</span></div>)}</div>
              <select disabled={!hasPermission('documents', 'edit')} value={document.status} onChange={(event) => updateOfficeDocumentStatus(document.id, event.target.value as OfficeDocument['status'])} className="field w-full mt-3 text-xs">
                {['Registered', 'In Review', 'Referred', 'Answered', 'Archived', 'Cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {showForm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <form onSubmit={submit} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-auto space-y-4 text-xs">
          <div className="flex justify-between items-center"><h2 className="text-white font-bold flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-amber-400" />ثبت سند در دفتر اندیکاتور</h2><button type="button" onClick={() => setShowForm(false)} className="text-slate-400">بستن</button></div>
          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-xl p-3">{error}</div>}
          <div className="grid md:grid-cols-4 gap-3">
            <select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as Draft['direction'] })} className="field"><option value="Incoming (وارده)">وارده</option><option value="Outgoing (صادره)">صادره</option><option value="Internal (داخلی)">داخلی</option></select>
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft['type'] })} className="field"><option value="Letter (نامه)">نامه</option><option value="Invoice (فاکتور)">فاکتور</option><option value="Proforma (پیش‌فاکتور)">پیش‌فاکتور</option><option value="Contract (قرارداد)">قرارداد</option><option value="Receipt (رسید)">رسید</option><option value="Other (سایر)">سایر</option></select>
            <input value={draft.documentNumber} onChange={(e) => setDraft({ ...draft, documentNumber: e.target.value })} placeholder="شماره نامه/فاکتور" className="field" />
            <input type="date" value={draft.documentDate} onChange={(e) => setDraft({ ...draft, documentDate: e.target.value })} required className="field" />
          </div>
          <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="موضوع سند" required className="field w-full" />
          <div className="grid md:grid-cols-2 gap-3"><input value={draft.sender} onChange={(e) => setDraft({ ...draft, sender: e.target.value })} placeholder="فرستنده" required className="field" /><input value={draft.receiver} onChange={(e) => setDraft({ ...draft, receiver: e.target.value })} placeholder="گیرنده" required className="field" /></div>
          <div className="grid md:grid-cols-4 gap-3">
            <select value={draft.confidentiality} onChange={(e) => setDraft({ ...draft, confidentiality: e.target.value as Draft['confidentiality'] })} className="field"><option value="Normal">عادی</option><option value="Confidential">محرمانه</option><option value="Secret">سری</option></select>
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Draft['priority'] })} className="field"><option value="Low">کم</option><option value="Normal">عادی</option><option value="High">بالا</option><option value="Urgent">فوری</option></select>
            <select value={draft.relatedCustomerId} onChange={(e) => setDraft({ ...draft, relatedCustomerId: e.target.value })} className="field"><option value="">ارتباط با مشتری...</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.companyName}</option>)}</select>
            <select value={draft.relatedProformaId} onChange={(e) => setDraft({ ...draft, relatedProformaId: e.target.value })} className="field"><option value="">ارتباط با فاکتور...</option>{proformas.map((proforma) => <option key={proforma.id} value={proforma.id}>{proforma.invoiceNumber} · {proforma.customerName}</option>)}</select>
          </div>
          <div className="grid md:grid-cols-3 gap-3"><input value={draft.assignedTo} onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })} placeholder="ارجاع به" className="field" /><input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} className="field" /><input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="برچسب‌ها با ویرگول" className="field" /></div>
          <textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="خلاصه محتوا" className="field w-full min-h-[90px]" />
          <div className="grid md:grid-cols-2 gap-3">
            <label className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer"><UploadCloud className="w-5 h-5 text-amber-400 mb-2" />فایل اصل نامه/فاکتور<input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setAttachments((prev) => [...prev, fileToAttachment(file, 'Original File (اصل فایل)')]); }} /></label>
            <label className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer"><FileText className="w-5 h-5 text-emerald-400 mb-2" />نسخه PDF<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setAttachments((prev) => [...prev, fileToAttachment(file, 'PDF Copy (نسخه PDF)')]); }} /></label>
          </div>
          <div className="space-y-1">{attachments.map((file) => <div key={file.id} className="flex justify-between bg-slate-900 rounded-lg px-3 py-2 text-slate-300"><span>{file.kind}: {file.fileName}</span><span>{sizeLabel(file.sizeBytes)}</span></div>)}</div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">ثبت در اندیکاتور</button></div>
        </form>
      </div>}
    </div>
  );
};
