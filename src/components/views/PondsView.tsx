import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Droplets, Fish, Play, Search, Skull, Square, Thermometer, Utensils } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { DynamicTranslatedText } from '../common/DynamicTranslatedText';
import { runtimeUnitLabel } from '../../i18n/runtimeMessages';
import { Pond } from '../../types';

interface PondsViewProps { onSelectNav: (viewId: string) => void; }
type ModalKind = 'stop' | 'feed' | 'mortality' | 'transfer' | null;

export const PondsView: React.FC<PondsViewProps> = ({ onSelectNav }) => {
  const { t, formatNumber, language } = useI18n();
  const { currentUser } = useAuth();
  const { ponds, halls, species, inventory, stopPondFeeding, resumePondFeeding, recordFeeding, recordMortality, executeAtomicTransfer } = useFarm();
  const [selectedHall, setSelectedHall] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<{ kind: ModalKind; pond: Pond | null }>({ kind: null, pond: null });
  const [error, setError] = useState('');
  const [stopReason, setStopReason] = useState<Pond['stopFeedingReason']>('Handling');
  const [stopDetails, setStopDetails] = useState('');
  const [feedSku, setFeedSku] = useState('');
  const [feedAmount, setFeedAmount] = useState(0);
  const [mortalityCount, setMortalityCount] = useState(0);
  const [mortalityWeight, setMortalityWeight] = useState(0);
  const [mortalityReason, setMortalityReason] = useState('');
  const [destPondId, setDestPondId] = useState('');
  const [transferCount, setTransferCount] = useState(0);
  const [transferReason, setTransferReason] = useState('');
  const kg = runtimeUnitLabel(language, 'kg');
  const feedItems = inventory.filter((item) => item.category.includes('Feed'));
  const operator = currentUser?.fullName || 'Local Operator';

  const filteredPonds = useMemo(() => ponds.filter((pond) => {
    const hallMatch = selectedHall === 'all' || pond.hallId === selectedHall;
    const query = searchQuery.trim().toLowerCase();
    return hallMatch && (!query || pond.name.toLowerCase().includes(query) || pond.number.toLowerCase().includes(query));
  }), [ponds, selectedHall, searchQuery]);

  const speciesName = (pond: Pond) => {
    const item = species.find((row) => row.id === pond.speciesId);
    return language === 'fa' ? item?.faName || item?.enName || pond.speciesId : item?.enName || item?.scientificName || pond.speciesId;
  };
  const hallName = (pond: Pond) => halls.find((hall) => hall.id === pond.hallId)?.name || pond.hallId;

  const open = (kind: Exclude<ModalKind, null>, pond: Pond) => {
    setError(''); setModal({ kind, pond });
    if (kind === 'feed') { setFeedSku(feedItems[0]?.sku || ''); setFeedAmount(0); }
    if (kind === 'transfer') setDestPondId(ponds.find((item) => item.id !== pond.id)?.id || '');
  };
  const close = () => { setModal({ kind: null, pond: null }); setError(''); };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const pond = modal.pond;
    if (!pond || !modal.kind) return;
    if (modal.kind === 'stop') { stopPondFeeding(pond.id, stopReason, stopDetails, operator); close(); return; }
    if (modal.kind === 'feed') {
      const feedItem = feedItems.find((item) => item.sku === feedSku);
      if (!feedItem) { setError(t('noData')); return; }
      const result = recordFeeding({ pondId: pond.id, pondName: pond.name, hallName: hallName(pond), speciesName: speciesName(pond), biomassKg: pond.biomassKg, recommendedAmountKg: feedAmount, actualAmountKg: feedAmount, unit: 'kg', feedTypeSku: feedItem.sku, feedTypeName: feedItem.name, waterTemperature: pond.waterTemperature, dissolvedOxygen: pond.dissolvedOxygen, feedingStatus: 'ACTIVE', operatorName: operator, notes: '' });
      if (!result.success) { setError(result.error || t('error')); return; }
      close(); return;
    }
    if (modal.kind === 'mortality') {
      if (!mortalityReason.trim()) { setError(t('description')); return; }
      recordMortality({ pondId: pond.id, pondName: pond.name, speciesId: pond.speciesId, speciesName: speciesName(pond), count: mortalityCount, estimatedWeightKg: mortalityWeight, reason: mortalityReason.trim(), description: '', recordedBy: operator });
      close(); return;
    }
    const destination = ponds.find((item) => item.id === destPondId);
    if (!destination || !transferReason.trim()) { setError(t('description')); return; }
    const result = executeAtomicTransfer({ sourceType: 'Pond', sourceId: pond.id, sourceName: pond.name, destinationType: 'Pond', destinationId: destination.id, destinationName: destination.name, speciesId: pond.speciesId, speciesName: speciesName(pond), fishCount: transferCount, averageWeightKg: pond.averageWeightKg, totalBiomassKg: transferCount * pond.averageWeightKg, date: new Date().toISOString().slice(0, 10), operator, reason: transferReason.trim() });
    if (!result.success) { setError(result.error || t('error')); return; }
    close();
  };

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Fish className="w-6 h-6 text-amber-400" />{t('pond.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('pond.subtitle')}</p></div><div className="flex gap-2"><select value={selectedHall} onChange={(e) => setSelectedHall(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"><option value="all">{t('all')}</option>{halls.map((hall) => <option key={hall.id} value={hall.id}>{hall.name}</option>)}</select><div className="relative"><Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('pond.searchPlaceholder')} className="bg-slate-800 border border-slate-700 text-white rounded-xl ps-9 pe-3 py-2 text-xs w-48" /></div></div></div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{filteredPonds.map((pond) => {
      const stopped = pond.feedingStatus === 'STOPPED';
      return <div key={pond.id} className={`rounded-2xl border bg-slate-900 overflow-hidden ${stopped ? 'border-rose-500/40' : 'border-slate-800'}`}>
        <div className="p-4 border-b border-slate-800 flex justify-between gap-3"><div><div className="text-white font-bold">{pond.number} — {pond.name}</div><div className="text-[11px] text-slate-400 mt-1">{t('pond.hall')}: {hallName(pond)} · {t('pond.species')}: {speciesName(pond)}</div></div><span className={`text-[10px] px-2 py-1 rounded-full border h-fit ${stopped ? 'text-rose-300 border-rose-500/40' : 'text-emerald-300 border-emerald-500/40'}`}>{stopped ? t('pond.stopped') : t('pond.active')}</span></div>
        <div className="p-4 space-y-3">
          {stopped && <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><div><div>{pond.stopFeedingReason || t('pond.stopReason')}</div><DynamicTranslatedText text={pond.stopFeedingDetails || t('noData')} recordId={pond.id} fieldName="stopFeedingDetails" inline /></div></div>}
          <div className="grid grid-cols-2 gap-2"><Metric label={t('pond.biomass')} value={`${formatNumber(pond.biomassKg)} ${kg}`} /><Metric label={t('pond.count')} value={formatNumber(pond.fishCount)} /><Metric label={t('pond.avgWeight')} value={`${formatNumber(pond.averageWeightKg)} ${kg}`} /><Metric label={t('pond.fcr')} value={formatNumber(pond.fcr)} /></div>
          <div className="grid grid-cols-2 gap-2 text-xs"><div className="bg-slate-950 rounded-xl p-2.5 text-cyan-300 flex items-center gap-2"><Droplets className="w-4 h-4" /><span>{t('pond.do')}: {formatNumber(pond.dissolvedOxygen)} mg/L</span></div><div className="bg-slate-950 rounded-xl p-2.5 text-orange-300 flex items-center gap-2"><Thermometer className="w-4 h-4" /><span>{t('pond.waterTemp')}: {formatNumber(pond.waterTemperature)}°C</span></div></div>
        </div>
        <div className="p-3 border-t border-slate-800 grid grid-cols-3 gap-2">{stopped ? <button onClick={() => { const result = resumePondFeeding(pond.id, operator); if (!result.success) setError(result.error || t('error')); }} className="col-span-3 bg-emerald-600 text-white rounded-lg py-2 text-xs flex justify-center gap-1"><Play className="w-3.5 h-3.5" />{t('pond.resumeFeedingBtn')}</button> : <button onClick={() => open('stop', pond)} className="col-span-3 bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-lg py-2 text-xs flex justify-center gap-1"><Square className="w-3.5 h-3.5" />{t('pond.stopFeedingBtn')}</button>}<button onClick={() => open('feed', pond)} disabled={stopped} className="bg-slate-800 text-slate-200 rounded-lg py-2 text-xs disabled:opacity-40"><Utensils className="w-3.5 h-3.5 inline me-1" />{t('pond.quickFeed')}</button><button onClick={() => open('mortality', pond)} className="bg-slate-800 text-slate-200 rounded-lg py-2 text-xs"><Skull className="w-3.5 h-3.5 inline me-1" />{t('pond.quickMortality')}</button><button onClick={() => open('transfer', pond)} className="bg-slate-800 text-slate-200 rounded-lg py-2 text-xs"><ArrowLeftRight className="w-3.5 h-3.5 inline me-1" />{t('pond.quickTransfer')}</button><button onClick={() => onSelectNav('waterQuality')} className="col-span-3 bg-slate-950 text-cyan-300 rounded-lg py-2 text-xs">{t('pond.quickWaterTest')}</button></div>
      </div>;
    })}</div>

    {error && !modal.kind && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">{error}</div>}
    {modal.kind && modal.pond && <Modal title={modal.kind === 'stop' ? t('pond.stopModalTitle', { pondName: modal.pond.name }) : modal.kind === 'feed' ? t('pond.feedModalTitle', { pondName: modal.pond.name }) : modal.kind === 'mortality' ? t('pond.mortalityModalTitle', { pondName: modal.pond.name }) : t('pond.transferModalTitle', { pondName: modal.pond.name })} onClose={close}><form onSubmit={submit} className="space-y-3 text-xs">{error && <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300">{error}</div>}{modal.kind === 'stop' && <><label className="block text-slate-300">{t('pond.stopReason')}<select value={stopReason} onChange={(e) => setStopReason(e.target.value as Pond['stopFeedingReason'])} className="mt-1 w-full field"><option value="Handling">{t('pond.reasonHandling')}</option><option value="Low Oxygen">{t('pond.reasonHypoxia')}</option><option value="Treatment">{t('pond.reasonMedication')}</option><option value="Other">{t('pond.reasonOther')}</option></select></label><label className="block text-slate-300">{t('details')}<textarea value={stopDetails} onChange={(e) => setStopDetails(e.target.value)} placeholder={t('pond.stopDetailsPlaceholder')} className="mt-1 w-full field" /></label></>}{modal.kind === 'feed' && <><label className="block text-slate-300">{t('feeding.feedTypeSku')}<select value={feedSku} onChange={(e) => setFeedSku(e.target.value)} className="mt-1 w-full field">{feedItems.map((item) => <option key={item.id} value={item.sku}>{item.name} — {formatNumber(item.quantity)} {item.unit}</option>)}</select></label><NumberField label={t('pond.feedAmountLabel')} value={feedAmount} setValue={setFeedAmount} /></>}{modal.kind === 'mortality' && <><NumberField label={t('pond.mortalityCountLabel')} value={mortalityCount} setValue={setMortalityCount} /><NumberField label={t('pond.mortalityWeightLabel')} value={mortalityWeight} setValue={setMortalityWeight} /><TextField label={t('pond.mortalityReasonLabel')} value={mortalityReason} setValue={setMortalityReason} /></>}{modal.kind === 'transfer' && <><label className="block text-slate-300">{t('pond.destPondLabel')}<select value={destPondId} onChange={(e) => setDestPondId(e.target.value)} className="mt-1 w-full field">{ponds.filter((item) => item.id !== modal.pond!.id).map((item) => <option key={item.id} value={item.id}>{item.number} — {item.name}</option>)}</select></label><NumberField label={t('pond.transferCountLabel')} value={transferCount} setValue={setTransferCount} /><TextField label={t('pond.transferReasonLabel')} value={transferReason} setValue={setTransferReason} /></>}<div className="flex justify-end gap-2"><button type="button" onClick={close} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">{t('confirm')}</button></div></form></Modal>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}`}</style>
  </div>;
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="bg-slate-800/60 p-2.5 rounded-xl"><span className="text-[11px] text-slate-400 block">{label}</span><span className="text-sm font-black text-white">{value}</span></div>;
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4"><div className="flex justify-between"><h3 className="font-bold text-white">{title}</h3><button type="button" onClick={onClose} className="text-slate-400">×</button></div>{children}</div></div>;
const NumberField: React.FC<{ label: string; value: number; setValue: (value: number) => void }> = ({ label, value, setValue }) => <label className="block text-slate-300">{label}<input type="number" min="0" step="0.01" value={value || ''} onChange={(e) => setValue(Number(e.target.value))} className="mt-1 w-full field" required /></label>;
const TextField: React.FC<{ label: string; value: string; setValue: (value: string) => void }> = ({ label, value, setValue }) => <label className="block text-slate-300">{label}<input value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full field" required /></label>;
