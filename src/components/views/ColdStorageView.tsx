import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, Move, RefreshCcw, Scale, Snowflake, Thermometer } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import {
  ColdStorageEventRecord,
  cycleCountColdStoragePallet,
  holdColdStoragePallet,
  listColdStorageEvents,
  moveColdStoragePallet,
  recordColdStorageTemperature,
  releaseColdStoragePallet,
} from '../../services/coldStorageService';
import type { ColdStoragePallet } from '../../types';

type OperationalPallet = ColdStoragePallet & { qualityHold?: boolean; qualityHoldReason?: string; qualityHoldSince?: string };

export const ColdStorageView: React.FC = () => {
  const farm = useFarm();
  const { hasPermission } = useAuth();
  const { formatNumber, formatDate } = useI18n();
  const [pallets, setPallets] = useState<OperationalPallet[]>(farm.coldStorage as OperationalPallet[]);
  const [selectedId, setSelectedId] = useState<string>(farm.coldStorage[0]?.id || '');
  const [events, setEvents] = useState<ColdStorageEventRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [slotCode, setSlotCode] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [minAllowedC, setMinAllowedC] = useState('');
  const [maxAllowedC, setMaxAllowedC] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [releaseReason, setReleaseReason] = useState('');
  const [countUnits, setCountUnits] = useState('');
  const [countWeight, setCountWeight] = useState('');
  const [countReason, setCountReason] = useState('');

  const canEdit = hasPermission('cold_storage', 'edit');
  const canApprove = hasPermission('cold_storage', 'approve');
  const selected = pallets.find((row) => row.id === selectedId);

  useEffect(() => { setPallets(farm.coldStorage as OperationalPallet[]); }, [farm.coldStorage]);
  useEffect(() => {
    if (!selected) return;
    setSlotCode(selected.slotCode || '');
    setTemperatureC(String(selected.temperatureC ?? ''));
    setCountUnits(String(selected.unitsCount ?? ''));
    setCountWeight(String(selected.weightKg ?? ''));
  }, [selectedId]);

  const refreshEvents = async (palletId = selectedId) => {
    if (!palletId) { setEvents([]); return; }
    try { setEvents(await listColdStorageEvents(palletId)); } catch { setEvents([]); }
  };
  useEffect(() => { void refreshEvents(); }, [selectedId]);

  const summary = useMemo(() => ({
    lots: pallets.length,
    holds: pallets.filter((row) => row.qualityHold).length,
    expired: pallets.filter((row) => new Date(row.expiryDate).getTime() < Date.now()).length,
    weight: pallets.reduce((sum, row) => sum + Number(row.weightKg || 0), 0),
  }), [pallets]);

  const applyResult = async (payload: any, successText: string) => {
    if (payload?.pallet?.id) setPallets((previous) => previous.map((row) => row.id === payload.pallet.id ? payload.pallet : row));
    setMessage(successText); setError('');
    await refreshEvents(payload?.pallet?.id || selectedId);
  };

  const execute = async (task: () => Promise<any>, successText: string) => {
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try { await applyResult(await task(), successText); }
    catch (e) { setError(e instanceof Error ? e.message : 'COLD_STORAGE_REQUEST_FAILED'); }
    finally { setBusy(false); }
  };

  const card = (label: string, value: React.ReactNode, icon: React.ReactNode) => <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#A1A1AA]">{label}</span><span className="text-[#D4AF37]">{icon}</span></div><div className="mt-2 text-xl font-black text-white">{value}</div></div>;

  return <div className="space-y-5 pb-12">
    <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 flex items-center justify-between gap-4">
      <div><h1 className="text-lg font-black text-white flex items-center gap-2"><Snowflake className="w-5 h-5 text-[#D4AF37]" />مرکز عملیات سردخانه</h1><p className="text-xs text-[#71717A] mt-1">جابجایی، کنترل دما، قرنطینه کیفی، شمارش دوره‌ای و تاریخچه قابل ممیزی</p></div>
      <button type="button" onClick={() => void refreshEvents()} className="px-3 py-2 rounded-xl border border-[#3F3F46] text-xs text-[#D4D4D8] flex items-center gap-2"><RefreshCcw className="w-4 h-4" />تازه‌سازی تاریخچه</button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {card('تعداد لات', formatNumber(summary.lots), <Snowflake className="w-4 h-4" />)}
      {card('Quality Hold', formatNumber(summary.holds), <AlertTriangle className="w-4 h-4" />)}
      {card('منقضی', formatNumber(summary.expired), <AlertTriangle className="w-4 h-4" />)}
      {card('وزن ثبت‌شده', `${formatNumber(summary.weight)} kg`, <Scale className="w-4 h-4" />)}
    </div>

    {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{message}</div>}
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

    <div className="grid xl:grid-cols-[1.35fr_1fr] gap-5">
      <div className="bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#27272A] text-sm font-bold text-white">لات‌های سردخانه</div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#0C0C0E] text-[#71717A]"><tr><th className="p-3 text-start">Slot</th><th className="p-3 text-start">Batch / SKU</th><th className="p-3 text-start">محصول</th><th className="p-3 text-start">موجودی</th><th className="p-3 text-start">دما</th><th className="p-3 text-start">وضعیت</th></tr></thead><tbody className="divide-y divide-[#27272A]">{pallets.map((row) => <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer ${selectedId === row.id ? 'bg-[#D4AF37]/10' : 'hover:bg-[#18181B]'}`}><td className="p-3 font-bold text-white">{row.slotCode}</td><td className="p-3">{row.batchCode}<div className="text-[#71717A]">{row.sku || '—'}</div></td><td className="p-3">{row.productType}</td><td className="p-3">{formatNumber(row.unitsCount)} / {formatNumber(row.weightKg)} kg</td><td className="p-3">{formatNumber(row.temperatureC)}°C</td><td className="p-3">{row.qualityHold ? <span className="text-red-300 font-bold">QUALITY HOLD</span> : <span className="text-emerald-300">{row.status}</span>}</td></tr>)}</tbody></table></div>
      </div>

      <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 space-y-4">
        <div className="text-sm font-bold text-white">عملیات روی لات انتخاب‌شده</div>
        {!selected ? <div className="text-xs text-[#71717A]">لاتی انتخاب نشده است.</div> : <>
          <div className="rounded-xl bg-[#0C0C0E] border border-[#27272A] p-3 text-xs text-[#A1A1AA]">{selected.batchCode} · {selected.slotCode}{selected.qualityHold && <div className="mt-2 text-red-300">Hold: {selected.qualityHoldReason || '—'}</div>}</div>

          <div className="space-y-2"><div className="text-xs font-bold text-white flex items-center gap-2"><Move className="w-4 h-4" />جابجایی Slot</div><div className="flex gap-2"><input value={slotCode} onChange={(e) => setSlotCode(e.target.value)} className="flex-1 bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" /><button disabled={!canEdit || busy} onClick={() => void execute(() => moveColdStoragePallet(selected.id, { slotCode }), 'جابجایی با Audit ثبت شد.')} className="px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-bold disabled:opacity-40">ثبت</button></div></div>

          <div className="space-y-2"><div className="text-xs font-bold text-white flex items-center gap-2"><Thermometer className="w-4 h-4" />کنترل دما</div><div className="grid grid-cols-3 gap-2"><input type="number" step="0.1" value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} placeholder="Actual" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><input type="number" step="0.1" value={minAllowedC} onChange={(e) => setMinAllowedC(e.target.value)} placeholder="Min" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><input type="number" step="0.1" value={maxAllowedC} onChange={(e) => setMaxAllowedC(e.target.value)} placeholder="Max" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /></div><button disabled={!canEdit || busy} onClick={() => void execute(() => recordColdStorageTemperature(selected.id, { temperatureC: Number(temperatureC), minAllowedC: Number(minAllowedC), maxAllowedC: Number(maxAllowedC) }), 'کنترل دما ثبت شد.')} className="w-full px-3 py-2 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold disabled:opacity-40">ثبت کنترل دما</button></div>

          <div className="space-y-2"><div className="text-xs font-bold text-white">قرنطینه کیفی</div>{selected.qualityHold ? <div className="flex gap-2"><input value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} placeholder="دلیل Release" className="flex-1 bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" /><button disabled={!canApprove || busy} onClick={() => void execute(() => releaseColdStoragePallet(selected.id, { reason: releaseReason }), 'Quality Hold با ثبت دلیل آزاد شد.')} className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold disabled:opacity-40">Release</button></div> : <div className="flex gap-2"><input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="دلیل Hold" className="flex-1 bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" /><button disabled={!canEdit || busy} onClick={() => void execute(() => holdColdStoragePallet(selected.id, { reason: holdReason }), 'Lot روی Quality Hold قرار گرفت و برای فروش مسدود شد.')} className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold disabled:opacity-40">Hold</button></div>}</div>

          <div className="space-y-2"><div className="text-xs font-bold text-white flex items-center gap-2"><Scale className="w-4 h-4" />Cycle Count</div><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="1" value={countUnits} onChange={(e) => setCountUnits(e.target.value)} placeholder="Units" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /><input type="number" min="0" step="0.001" value={countWeight} onChange={(e) => setCountWeight(e.target.value)} placeholder="kg" className="bg-[#09090B] border border-[#3F3F46] rounded-lg px-2 py-2 text-xs" /></div><input value={countReason} onChange={(e) => setCountReason(e.target.value)} placeholder="دلیل اختلاف/شمارش" className="w-full bg-[#09090B] border border-[#3F3F46] rounded-lg px-3 py-2 text-xs" /><button disabled={!canEdit || busy} onClick={() => void execute(() => cycleCountColdStoragePallet(selected.id, { unitsCount: Number(countUnits), weightKg: Number(countWeight), reason: countReason }), 'Cycle Count با تاریخچه ثبت شد.')} className="w-full px-3 py-2 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold disabled:opacity-40">ثبت شمارش</button></div>
        </>}
      </div>
    </div>

    <div className="bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-[#27272A] text-sm font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-[#D4AF37]" />تاریخچه عملیات لات</div>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#0C0C0E] text-[#71717A]"><tr><th className="p-3 text-start">زمان</th><th className="p-3 text-start">عملیات</th><th className="p-3 text-start">کاربر</th><th className="p-3 text-start">جزئیات</th></tr></thead><tbody className="divide-y divide-[#27272A]">{events.length ? events.map((event) => <tr key={event.id}><td className="p-3 whitespace-nowrap">{formatDate(event.timestamp)}</td><td className="p-3 font-bold">{event.eventType}</td><td className="p-3">{event.actor}</td><td className="p-3">{event.reason || event.notes || (event.eventType === 'MOVE' ? `${event.previousSlotCode} → ${event.nextSlotCode}` : event.temperatureC !== undefined ? `${event.temperatureC}°C ${event.withinRange ? '✓' : '⚠'}` : '—')}</td></tr>) : <tr><td colSpan={4} className="p-8 text-center text-[#71717A]">تاریخچه‌ای ثبت نشده است.</td></tr>}</tbody></table></div>
    </div>

    <div className="rounded-xl border border-[#27272A] bg-[#0C0C0E] p-3 text-[11px] text-[#71717A] flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400" />بازه مجاز دما در هر کنترل توسط مسئول همان فرآیند ثبت می‌شود؛ ERP هیچ threshold ای را به‌صورت فرضی جایگزین دستورالعمل مصوب مجموعه نمی‌کند.</div>
  </div>;
};
