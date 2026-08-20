import React, { useMemo, useState } from 'react';
import { Plus, Scissors, Snowflake } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { runtimeUnitLabel } from '../../i18n/runtimeMessages';
import { domainLabel } from '../../i18n/runtimeDomainLabels';
import { ProcessingBatch } from '../../types';

export const ProcessingView: React.FC = () => {
  const { t, formatNumber, formatDate, language } = useI18n();
  const { currentUser } = useAuth();
  const { processingBatches, coldStorage, ponds, species, createProcessingBatch } = useFarm();
  const [tab, setTab] = useState<'batches' | 'cold'>('batches');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ pondId: ponds[0]?.id || '', fishCount: 0, liveBiomassKg: 0, caviarYieldKg: 0, filletYieldKg: 0, smokedYieldKg: 0, grade: 'Royal Beluga' as ProcessingBatch['caviarGrade'], cites: '' });
  const kg = runtimeUnitLabel(language, 'kg');
  const totalCaviar = useMemo(() => processingBatches.reduce((sum, row) => sum + row.caviarYieldKg, 0), [processingBatches]);
  const totalMeat = useMemo(() => processingBatches.reduce((sum, row) => sum + row.filletMeatYieldKg + row.smokedMeatYieldKg, 0), [processingBatches]);
  const sourcePond = ponds.find((pond) => pond.id === form.pondId);
  const speciesName = sourcePond ? (language === 'fa' ? species.find((item) => item.id === sourcePond.speciesId)?.faName : species.find((item) => item.id === sourcePond.speciesId)?.enName) || sourcePond.speciesId : '';

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourcePond || form.fishCount <= 0 || form.liveBiomassKg <= 0) return;
    const waste = Math.max(0, form.liveBiomassKg - form.caviarYieldKg - form.filletYieldKg - form.smokedYieldKg);
    createProcessingBatch({
      batchCode: `PROC-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      sourcePondId: sourcePond.id,
      sourcePondName: sourcePond.name,
      speciesName,
      fishCount: form.fishCount,
      liveBiomassKg: form.liveBiomassKg,
      caviarYieldKg: form.caviarYieldKg,
      caviarGrade: form.grade,
      filletMeatYieldKg: form.filletYieldKg,
      smokedMeatYieldKg: form.smokedYieldKg,
      byProductAndWasteKg: waste,
      operatorName: currentUser?.fullName || 'Local Operator',
      qualityScore: 0,
      citesPermitNumber: form.cites.trim() || undefined,
      status: 'Completed',
    });
    setShowModal(false);
    setForm((previous) => ({ ...previous, fishCount: 0, liveBiomassKg: 0, caviarYieldKg: 0, filletYieldKg: 0, smokedYieldKg: 0, cites: '' }));
  };

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Scissors className="w-6 h-6 text-amber-400" />{t('processing.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('processing.subtitle')}</p></div><button onClick={() => setShowModal(true)} disabled={!ponds.length} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex gap-1 disabled:opacity-40"><Plus className="w-4 h-4" />{t('processing.btnNewBatch')}</button></div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Metric title={t('processing.cardTotalCaviar')} value={`${formatNumber(totalCaviar)} ${kg}`} /><Metric title={t('processing.cardTotalMeat')} value={`${formatNumber(totalMeat)} ${kg}`} /></div>
    <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 w-fit text-xs"><button onClick={() => setTab('batches')} className={`px-4 py-2 rounded-lg ${tab === 'batches' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}>{t('processing.tabBatches')}</button><button onClick={() => setTab('cold')} className={`px-4 py-2 rounded-lg ${tab === 'cold' ? 'bg-blue-500 text-slate-950 font-bold' : 'text-slate-400'}`}>{t('processing.tabColdStorage')}</button></div>

    {tab === 'batches' ? <Table headers={[t('processing.thBatchCode'), t('processing.thDate'), t('processing.thSourcePond'), t('processing.thSpecies'), t('processing.thFishCount'), t('processing.thLiveBiomass'), t('processing.thCaviarYield'), t('processing.thFilletYield'), t('processing.thOperator'), t('processing.thCites'), t('status')]} rows={processingBatches.map((row) => [row.batchCode, formatDate(row.date), row.sourcePondName, row.speciesName, formatNumber(row.fishCount), `${formatNumber(row.liveBiomassKg)} ${kg}`, `${formatNumber(row.caviarYieldKg)} ${kg}`, `${formatNumber(row.filletMeatYieldKg)} ${kg}`, row.operatorName, row.citesPermitNumber || '—', domainLabel(language, row.status)])} empty={t('noData')} /> : <Table headers={[t('code'), t('processing.thDate'), t('type'), t('quantity'), t('status')]} rows={coldStorage.map((row) => [row.slotCode, formatDate(row.entryDate), row.productType, `${formatNumber(row.weightKg)} ${kg}`, domainLabel(language, row.status)])} empty={t('noData')} />}

    {showModal && <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"><div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-5 space-y-4"><h3 className="font-bold text-white">{t('processing.modalTitle')}</h3><form onSubmit={save} className="space-y-3 text-xs"><label className="block text-slate-300">{t('processing.fieldPond')}<select value={form.pondId} onChange={(e) => setForm((p) => ({ ...p, pondId: e.target.value }))} className="mt-1 w-full field">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><Num label={t('processing.fieldFishCount')} value={form.fishCount} set={(value) => setForm((p) => ({ ...p, fishCount: value }))} /><Num label={t('processing.fieldLiveBiomass')} value={form.liveBiomassKg} set={(value) => setForm((p) => ({ ...p, liveBiomassKg: value }))} /><Num label={t('processing.fieldCaviarYield')} value={form.caviarYieldKg} set={(value) => setForm((p) => ({ ...p, caviarYieldKg: value }))} /><Num label={t('processing.fieldFilletYield')} value={form.filletYieldKg} set={(value) => setForm((p) => ({ ...p, filletYieldKg: value }))} /><Num label={t('processing.fieldSmokedYield')} value={form.smokedYieldKg} set={(value) => setForm((p) => ({ ...p, smokedYieldKg: value }))} /></div><label className="block text-slate-300">{t('processing.fieldCaviarGrade')}<select value={form.grade} onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value as ProcessingBatch['caviarGrade'] }))} className="mt-1 w-full field"><option>Imperial Beluga (50g/100g)</option><option>Royal Beluga</option><option>Classic Baerii</option><option>Asetra Gold</option></select></label><label className="block text-slate-300">{t('processing.fieldCites')}<input value={form.cites} onChange={(e) => setForm((p) => ({ ...p, cites: e.target.value }))} className="mt-1 w-full field" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">{t('processing.btnSubmitBatch')}</button></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.7rem;padding:.6rem;color:white}`}</style>
  </div>;
};

const Metric: React.FC<{ title: string; value: string }> = ({ title, value }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 block">{title}</span><strong className="text-xl text-white block mt-1">{value}</strong></div>;
const Table: React.FC<{ headers: string[]; rows: React.ReactNode[][]; empty: string }> = ({ headers, rows, empty }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr>{headers.map((header, index) => <th key={index} className="p-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.length === 0 ? <tr><td colSpan={headers.length} className="p-8 text-center text-slate-500">{empty}</td></tr> : rows.map((row, rowIndex) => <tr key={rowIndex} className="text-slate-300">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}</tr>)}</tbody></table></div>;
const Num: React.FC<{ label: string; value: number; set: (value: number) => void }> = ({ label, value, set }) => <label className="block text-slate-300">{label}<input type="number" min="0" step="0.01" value={value || ''} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full field" required /></label>;
