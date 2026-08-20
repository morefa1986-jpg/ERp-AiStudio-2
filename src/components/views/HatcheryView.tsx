import React, { useMemo, useState } from 'react';
import { Egg, GitBranch, Plus, Search } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { runtimeUnitLabel } from '../../i18n/runtimeMessages';
import { domainLabel } from '../../i18n/runtimeDomainLabels';
import { BroodstockFish } from '../../types';

export const HatcheryView: React.FC = () => {
  const { t, formatNumber, formatDate, language } = useI18n();
  const { broodstock, fertilizations, incubators, larvae, species, addBroodstock } = useFarm();
  const [tab, setTab] = useState<'broodstock' | 'fertilization' | 'incubators' | 'larvae' | 'trace'>('broodstock');
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ chipNumber: '', plateNumber: '', sex: 'Female' as BroodstockFish['sex'], speciesId: species[0]?.id || '', weightKg: 0, eggDiameter: 0, pi: 0, motility: 0 });
  const kg = runtimeUnitLabel(language, 'kg');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return broodstock.filter((fish) => !q || fish.chipNumber.toLowerCase().includes(q) || fish.plateNumber.toLowerCase().includes(q));
  }, [broodstock, query]);
  const displaySpecies = (id: string, fallback = '') => {
    const item = species.find((row) => row.id === id);
    return language === 'fa' ? item?.faName || item?.enName || fallback : item?.enName || item?.scientificName || fallback;
  };

  const saveBroodstock = (event: React.FormEvent) => {
    event.preventDefault();
    const sp = species.find((row) => row.id === form.speciesId);
    if (!sp || !form.chipNumber.trim() || !form.plateNumber.trim() || form.weightKg <= 0) return;
    addBroodstock({
      chipNumber: form.chipNumber.trim(), plateNumber: form.plateNumber.trim(), sex: form.sex,
      speciesId: sp.id, speciesName: displaySpecies(sp.id, sp.scientificName), geneticLine: '', origin: '',
      estimatedAgeYears: 0, weightKg: form.weightKg, lengthCm: 0, maturityStage: 'Stage II',
      ultrasoundEggDiameterMm: form.sex === 'Female' && form.eggDiameter > 0 ? form.eggDiameter : undefined,
      ultrasoundPolarizationIndex: form.sex === 'Female' && form.pi > 0 ? form.pi : undefined,
      spermMotilityPercent: form.sex === 'Male' && form.motility > 0 ? form.motility : undefined,
      status: 'Active Broodstock', historyNotes: '',
    });
    setShowModal(false);
    setForm({ chipNumber: '', plateNumber: '', sex: 'Female', speciesId: species[0]?.id || '', weightKg: 0, eggDiameter: 0, pi: 0, motility: 0 });
  };

  const tabs = [
    ['broodstock', t('hatchery.broodstockTab')], ['fertilization', t('hatchery.fertilizationTab')],
    ['incubators', t('hatchery.incubatorsTab')], ['larvae', t('hatchery.larvaeTab')], ['trace', t('hatchery.traceabilityTab')],
  ] as const;

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Egg className="w-6 h-6 text-amber-400" />{t('hatchery.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('hatchery.subtitle')}</p></div><button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex gap-1"><Plus className="w-4 h-4" />{t('hatchery.btnAddBroodstock')}</button></div>
    <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 overflow-x-auto">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-lg text-xs whitespace-nowrap ${tab === id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}>{label}</button>)}</div>

    {tab === 'broodstock' && <div className="space-y-4"><div className="relative max-w-sm"><Search className="w-4 h-4 absolute start-3 top-2.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('hatchery.searchChipPlaceholder')} className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-3 py-2 text-xs text-white" /></div><Table headers={[t('hatchery.chipNumber'), t('hatchery.plateNumber'), t('hatchery.gender'), t('hatchery.maturity'), t('hatchery.fieldSpecies'), t('hatchery.fieldWeight'), t('status')]} rows={filtered.map((fish) => [fish.chipNumber, fish.plateNumber, domainLabel(language, fish.sex), fish.maturityStage, displaySpecies(fish.speciesId, fish.speciesName), `${formatNumber(fish.weightKg)} ${kg}`, domainLabel(language, fish.status)])} empty={t('noData')} /></div>}

    {tab === 'fertilization' && <Table headers={[t('code'), t('date'), t('hatchery.fieldSpecies'), t('hatchery.traceMother'), t('hatchery.traceFather'), t('status')]} rows={fertilizations.map((row) => [row.batchCode, formatDate(row.date), row.speciesName, row.femaleIds.join(', '), row.maleIds.join(', '), domainLabel(language, row.status)])} empty={t('noData')} />}
    {tab === 'incubators' && <Table headers={[t('hatchery.incubatorCode'), t('quantity'), t('waterQuality.fieldTemp'), t('waterQuality.fieldDo'), t('status')]} rows={incubators.map((row) => [row.code, formatNumber(row.eggCount), `${formatNumber(row.temperatureC)}°C`, `${formatNumber(row.doMgL)} mg/L`, domainLabel(language, row.status)])} empty={t('noData')} />}
    {tab === 'larvae' && <Table headers={[t('hatchery.larvalBatchCode'), t('hatchery.traceHatchDate'), t('quantity'), t('status')]} rows={larvae.map((row) => [row.batchCode, formatDate(row.hatchDate), formatNumber(row.larvalCount), domainLabel(language, row.status)])} empty={t('noData')} />}
    {tab === 'trace' && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h3 className="font-bold text-white flex items-center gap-2"><GitBranch className="w-4 h-4 text-amber-400" />{t('hatchery.traceTitle')}</h3><div className="mt-4"><Table headers={[t('hatchery.larvalBatchCode'), t('hatchery.traceMother'), t('hatchery.traceFather'), t('hatchery.traceHatchDate')]} rows={larvae.map((row) => [row.batchCode, row.motherBroodstockIds.join(', '), row.fatherBroodstockIds.join(', '), formatDate(row.hatchDate)])} empty={t('noData')} /></div></div>}

    {showModal && <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"><div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-5 space-y-4"><h3 className="font-bold text-white">{t('hatchery.modalAddBroodTitle')}</h3><form onSubmit={saveBroodstock} className="space-y-3 text-xs"><div className="grid grid-cols-2 gap-2"><Text label={t('hatchery.fieldChip')} value={form.chipNumber} set={(value) => setForm((p) => ({ ...p, chipNumber: value }))} /><Text label={t('hatchery.fieldPlate')} value={form.plateNumber} set={(value) => setForm((p) => ({ ...p, plateNumber: value }))} /></div><label className="block text-slate-300">{t('hatchery.fieldSex')}<select value={form.sex} onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value as BroodstockFish['sex'] }))} className="mt-1 w-full field"><option value="Female">{t('hatchery.sexFemale')}</option><option value="Male">{t('hatchery.sexMale')}</option></select></label><label className="block text-slate-300">{t('hatchery.fieldSpecies')}<select value={form.speciesId} onChange={(e) => setForm((p) => ({ ...p, speciesId: e.target.value }))} className="mt-1 w-full field">{species.map((item) => <option key={item.id} value={item.id}>{displaySpecies(item.id, item.scientificName)}</option>)}</select></label><NumberField label={t('hatchery.fieldWeight')} value={form.weightKg} set={(value) => setForm((p) => ({ ...p, weightKg: value }))} />{form.sex === 'Female' ? <div className="grid grid-cols-2 gap-2"><NumberField label={t('hatchery.fieldEggDia')} value={form.eggDiameter} set={(value) => setForm((p) => ({ ...p, eggDiameter: value }))} /><NumberField label={t('hatchery.fieldPi')} value={form.pi} set={(value) => setForm((p) => ({ ...p, pi: value }))} /></div> : <NumberField label={t('hatchery.fieldMotility')} value={form.motility} set={(value) => setForm((p) => ({ ...p, motility: value }))} />}<div className="flex justify-end gap-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">{t('hatchery.btnSaveBrood')}</button></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.7rem;padding:.6rem;color:white}`}</style>
  </div>;
};

const Table: React.FC<{ headers: string[]; rows: React.ReactNode[][]; empty: string }> = ({ headers, rows, empty }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr>{headers.map((header, index) => <th key={index} className="p-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.length === 0 ? <tr><td colSpan={headers.length} className="p-8 text-center text-slate-500">{empty}</td></tr> : rows.map((row, rowIndex) => <tr key={rowIndex} className="text-slate-300">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}</tr>)}</tbody></table></div>;
const Text: React.FC<{ label: string; value: string; set: (value: string) => void }> = ({ label, value, set }) => <label className="block text-slate-300">{label}<input value={value} onChange={(e) => set(e.target.value)} className="mt-1 w-full field" required /></label>;
const NumberField: React.FC<{ label: string; value: number; set: (value: number) => void }> = ({ label, value, set }) => <label className="block text-slate-300">{label}<input type="number" min="0" step="0.01" value={value || ''} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full field" /></label>;
