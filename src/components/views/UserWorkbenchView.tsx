import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock, DoorOpen, FileText, MessageSquare, Stethoscope, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';

type WorkType = 'all' | 'crm' | 'documents' | 'gatehouse' | 'treatments' | 'water' | 'audit';
type WorkItem = {
  id: string;
  type: Exclude<WorkType, 'all'>;
  title: string;
  subtitle: string;
  dueAt?: string;
  status: 'overdue' | 'today' | 'open' | 'info';
  owner?: string;
  nav: string;
};

const TYPE_LABELS: Record<WorkType, string> = {
  all: 'همه',
  crm: 'CRM',
  documents: 'دبیرخانه',
  gatehouse: 'نگهبانی',
  treatments: 'درمان',
  water: 'کیفیت آب',
  audit: 'ممیزی',
};

const TYPE_ICONS: Record<Exclude<WorkType, 'all'>, React.ElementType> = {
  crm: Users,
  documents: FileText,
  gatehouse: DoorOpen,
  treatments: Stethoscope,
  water: AlertTriangle,
  audit: UserCheck,
};

function isToday(value?: string): boolean {
  if (!value) return false;
  return value.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function isOverdue(value?: string): boolean {
  if (!value) return false;
  const due = new Date(value).getTime();
  const start = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Number.isFinite(due) && due < start;
}

function assignedToMe(value: string | undefined, name: string, username: string): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === name.trim().toLowerCase() || normalized === username.trim().toLowerCase();
}

export const UserWorkbenchView: React.FC<{ onSelectNav?: (viewId: string) => void }> = ({ onSelectNav }) => {
  const farm = useFarm();
  const { currentUser, hasPermission } = useAuth();
  const [filter, setFilter] = useState<WorkType>('all');
  const [mineOnly, setMineOnly] = useState(true);
  const fullName = currentUser?.fullName || '';
  const username = currentUser?.username || '';

  const items = useMemo<WorkItem[]>(() => {
    const rows: WorkItem[] = [];
    if (hasPermission('crm', 'view')) {
      for (const reminder of farm.crmReminders.filter((row) => row.status === 'Open')) {
        if (mineOnly && !assignedToMe(reminder.assignedTo, fullName, username)) continue;
        rows.push({ id: reminder.id, type: 'crm', title: reminder.title, subtitle: `${reminder.customerName} · ${reminder.priority} · ${reminder.assignedTo || 'بدون مسئول'}`, dueAt: reminder.dueAt, status: isOverdue(reminder.dueAt) ? 'overdue' : isToday(reminder.dueAt) ? 'today' : 'open', owner: reminder.assignedTo, nav: 'crm' });
      }
    }
    if (hasPermission('documents', 'view')) {
      for (const doc of farm.officeDocuments.filter((row) => !['Archived', 'Cancelled'].includes(row.status))) {
        if (mineOnly && !assignedToMe(doc.assignedTo, fullName, username)) continue;
        rows.push({ id: doc.id, type: 'documents', title: `${doc.indicatorNumber} · ${doc.subject}`, subtitle: `${doc.direction} · ${doc.status} · ${doc.priority}`, dueAt: doc.dueDate, status: isOverdue(doc.dueDate) ? 'overdue' : isToday(doc.dueDate) ? 'today' : 'open', owner: doc.assignedTo, nav: 'documents' });
      }
    }
    if (hasPermission('gatehouse', 'view')) {
      for (const pass of farm.gatePasses.filter((row) => row.status === 'Registered' || row.status === 'Approved for Exit')) {
        rows.push({ id: pass.id, type: 'gatehouse', title: `${pass.passNumber} · ${pass.vehiclePlateNumber}`, subtitle: `${pass.direction} · ${pass.cargoType} · راننده: ${pass.driverName}`, dueAt: pass.registeredAt, status: pass.status === 'Approved for Exit' ? 'today' : 'open', owner: pass.registeredBy, nav: 'gatehouse' });
      }
    }
    if (hasPermission('treatments', 'view')) {
      for (const treatment of farm.treatments.filter((row) => row.status === 'ACTIVE')) {
        rows.push({ id: treatment.id, type: 'treatments', title: `${treatment.pondName} · ${treatment.drugName}`, subtitle: `دامپزشک: ${treatment.veterinarian} · پایان withdrawal: ${treatment.withdrawalEndDate}`, dueAt: treatment.endDate, status: isOverdue(treatment.endDate) ? 'overdue' : isToday(treatment.endDate) ? 'today' : 'open', owner: treatment.veterinarian, nav: 'treatments' });
      }
    }
    if (hasPermission('water_quality', 'view')) {
      for (const pond of farm.ponds.filter((row) => row.feedingStatus === 'ACTIVE' && (row.sensorQuality !== 'VALID' || row.dissolvedOxygen < 5 || row.waterTemperature <= 0))) {
        rows.push({ id: pond.id, type: 'water', title: `${pond.name} · هشدار کیفیت آب/تله‌متری`, subtitle: `DO ${pond.dissolvedOxygen} · دما ${pond.waterTemperature} · سنسور ${pond.sensorQuality || 'نامشخص'}`, dueAt: pond.lastTelemetryTimestamp, status: 'overdue', nav: 'waterQuality' });
      }
    }
    if (hasPermission('users', 'view')) {
      for (const log of farm.auditLogs.slice(0, 8)) {
        rows.push({ id: log.id, type: 'audit', title: `${log.action} · ${log.entity}`, subtitle: `${log.userName} · ${log.userRole} · ${log.entityId}`, dueAt: log.timestamp, status: 'info', owner: log.userName, nav: 'securityAudit' });
      }
    }
    return rows.sort((a, b) => {
      const rank = { overdue: 0, today: 1, open: 2, info: 3 };
      const byRank = rank[a.status] - rank[b.status];
      if (byRank) return byRank;
      return new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime();
    });
  }, [farm, fullName, username, hasPermission, mineOnly]);

  const visible = filter === 'all' ? items : items.filter((item) => item.type === filter);
  const counts = {
    overdue: items.filter((item) => item.status === 'overdue').length,
    today: items.filter((item) => item.status === 'today').length,
    open: items.filter((item) => item.status === 'open').length,
    info: items.filter((item) => item.status === 'info').length,
  };

  return <div className="space-y-5 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Bell className="w-6 h-6 text-amber-400" />کارتابل روزانه کاربران</h1><p className="text-xs text-slate-400 mt-1">کارهای امروز، عقب‌افتاده‌ها، پیگیری‌ها، ارجاع‌ها و هشدارهای مدیریتی در یک صفحه.</p></div>
      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />فقط کارهای من / بدون مسئول</label>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
      ['عقب‌افتاده', counts.overdue, 'text-rose-300'], ['امروز/فوری', counts.today, 'text-amber-300'], ['باز', counts.open, 'text-cyan-300'], ['رخداد ممیزی', counts.info, 'text-slate-300'],
    ].map(([label, value, color]) => <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[11px] text-slate-500">{label}</span><strong className={`block text-2xl mt-1 ${color}`}>{value}</strong></div>)}</div>
    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-2 text-xs">{(Object.keys(TYPE_LABELS) as WorkType[]).map((type) => <button key={type} onClick={() => setFilter(type)} className={`px-3 py-2 rounded-xl font-bold ${filter === type ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}>{TYPE_LABELS[type]}</button>)}</div>
    <div className="space-y-2">{visible.length ? visible.map((item) => {
      const Icon = TYPE_ICONS[item.type];
      return <button key={`${item.type}-${item.id}`} onClick={() => onSelectNav?.(item.nav)} className={`w-full text-start rounded-2xl border p-4 transition ${item.status === 'overdue' ? 'bg-rose-950/20 border-rose-500/30' : item.status === 'today' ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-start gap-3"><Icon className="w-5 h-5 mt-0.5 text-amber-300" /><div><strong className="text-white text-sm">{item.title}</strong><div className="text-xs text-slate-400 mt-1">{item.subtitle}</div></div></div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500"><Clock className="w-4 h-4" />{item.dueAt ? item.dueAt.replace('T', ' ').slice(0, 16) : 'بدون تاریخ'}{item.status === 'overdue' && <span className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-200">عقب‌افتاده</span>}{item.status === 'today' && <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200">امروز</span>}</div>
        </div>
      </button>;
    }) : <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-xs text-slate-500"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />کاری برای این فیلتر وجود ندارد.</div>}</div>
  </div>;
};
