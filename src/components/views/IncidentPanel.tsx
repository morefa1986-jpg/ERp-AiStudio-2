import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellOff, CheckCircle2, ChevronUp, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getIncidentCapabilities, OperationalIncidentRecord, syncOperationalIncidents, updateOperationalIncident } from '../../services/incidentService';

export const IncidentPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [incidents, setIncidents] = useState<OperationalIncidentRecord[]>([]);
  const [externalConfigured, setExternalConfigured] = useState(false);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [resolveId, setResolveId] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const canEscalate = ['Super Admin','Farm Owner','Farm Manager','Hall Manager','Veterinarian'].includes(String(currentUser?.role || ''));
  const canResolve = canEscalate;
  const active = useMemo(() => incidents.filter((row) => row.status !== 'RESOLVED'), [incidents]);

  const refresh = async () => {
    try {
      const [rows, capabilities] = await Promise.all([syncOperationalIncidents(), getIncidentCapabilities()]);
      setIncidents(rows); setExternalConfigured(Boolean(capabilities.externalNotifications?.configured));
    } catch (error) { setMessage(`همگام‌سازی Incident انجام نشد: ${error instanceof Error ? error.message : 'UNKNOWN'}`); }
  };
  useEffect(() => { void refresh(); }, []);

  const action = async (id: string, next: 'ACKNOWLEDGE' | 'ESCALATE' | 'RESOLVE', note?: string) => {
    setBusyId(id); setMessage('');
    try {
      await updateOperationalIncident(id, next, note); await refresh();
      if (next === 'RESOLVE') { setResolveId(''); setResolutionNote(''); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'INCIDENT_UPDATE_FAILED'); }
    finally { setBusyId(''); }
  };

  const tone = (severity: OperationalIncidentRecord['severity']) => severity === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/10' : severity === 'HIGH' ? 'border-amber-500/30 bg-amber-500/10' : 'border-blue-500/20 bg-blue-500/5';
  const severityText = (severity: OperationalIncidentRecord['severity']) => severity === 'CRITICAL' ? 'text-rose-400' : severity === 'HIGH' ? 'text-amber-300' : 'text-blue-300';

  return <section className="space-y-3">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div><h2 className="text-sm font-black text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" />Incident & Escalation Center</h2><p className="text-[11px] text-slate-400 mt-1">رخدادها از State authoritative استخراج می‌شوند. Ack/Resolve/Escalate داخلی فعال است؛ ارسال بیرونی فقط پس از اتصال provider واقعی فعال می‌شود.</p></div>
      <div className="flex items-center gap-2"><span className={`text-[10px] px-2.5 py-1.5 rounded-lg border ${externalConfigured ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700 bg-slate-800'}`}>{externalConfigured ? <><ShieldCheck className="inline w-3 h-3" /> provider فعال</> : <><BellOff className="inline w-3 h-3" /> SMS/Email: غیرفعال واقعی</>}</span><button onClick={() => void refresh()} className="p-2 rounded-lg bg-slate-800 text-cyan-300" title="Sync incidents"><RefreshCw className="w-4 h-4" /></button></div>
    </div>
    {message && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">{message}</div>}
    {active.length === 0 ? <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Incident فعال در Scope فعلی وجود ندارد.</div> : <div className="space-y-2">{active.slice(0, 12).map((incident) => <article key={incident.id} className={`border rounded-xl p-3 ${tone(incident.severity)}`}><div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-white">{incident.title}</strong><span className={`text-[10px] font-black ${severityText(incident.severity)}`}>{incident.severity}</span><span className="text-[9px] text-slate-500 font-mono">L{incident.escalationLevel}</span><span className="text-[9px] text-slate-500">{incident.status}</span></div><p className="text-[11px] text-slate-300 mt-1">{incident.details}</p><span className="text-[9px] text-slate-500 font-mono">{incident.sourceType} · {incident.pondId || incident.entityId} · last {new Date(incident.lastSeenAt).toLocaleString()}</span></div><div className="flex flex-wrap gap-1.5 shrink-0">{incident.status === 'OPEN' && <button disabled={busyId === incident.id} onClick={() => void action(incident.id, 'ACKNOWLEDGE')} className="action">Ack</button>}{canEscalate && <button disabled={busyId === incident.id || incident.escalationLevel >= 3} onClick={() => void action(incident.id, 'ESCALATE')} className="action text-amber-300"><ChevronUp className="w-3 h-3" />Escalate</button>}{canResolve && <button disabled={busyId === incident.id} onClick={() => { setResolveId(incident.id); setResolutionNote(''); }} className="action text-emerald-300">Resolve</button>}</div></div>{resolveId === incident.id && <div className="mt-3 flex flex-col sm:flex-row gap-2"><input autoFocus value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="اقدام اصلاحی/علت رفع رخداد" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" /><button disabled={!resolutionNote.trim() || busyId === incident.id} onClick={() => void action(incident.id, 'RESOLVE', resolutionNote)} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">ثبت Resolve</button><button onClick={() => setResolveId('')} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs">انصراف</button></div>}</article>)}</div>}
    <style>{`.action{display:flex;align-items:center;gap:.25rem;padding:.4rem .6rem;border-radius:.5rem;background:#1e293b;border:1px solid #334155;color:#cbd5e1;font-size:.65rem;font-weight:700}.action:disabled{opacity:.35}`}</style>
  </section>;
};
