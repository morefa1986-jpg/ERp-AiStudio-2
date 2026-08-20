import React, { useMemo, useState } from 'react';
import { Plus, Scale, TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { runtimeUnitLabel } from '../../i18n/runtimeMessages';

export const BiometricsView: React.FC = () => {
  const { t, formatNumber, formatDate, language } = useI18n();
  const { currentUser } = useAuth();
  const { ponds, biometricSessions, recordBiometry } = useFarm();
  const [selectedPondId, setSelectedPondId] = useState(ponds[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sampleSize, setSampleSize] = useState(30);
  const [avgWeightKg, setAvgWeightKg] = useState(0);
  const [operator, setOperator] = useState(currentUser?.fullName || '');
  const selectedPond = ponds.find((pond) => pond.id === selectedPondId);
  const kg = runtimeUnitLabel(language, 'kg');

  const metrics = useMemo(() => {
    const latestByPond = ponds.map((pond) => biometricSessions.filter((session) => session.pondId === pond.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]).filter(Boolean);
    const avgWeight = latestByPond.length ? latestByPond.reduce((sum, row) => sum + row.averageWeightKg, 0) / latestByPond.length : null;
    const avgSgr = latestByPond.length ? latestByPond.reduce((sum, row) => sum + row.sgr, 0) / latestByPond.length : null;
    const samples = biometricSessions.reduce((sum, row) => sum + row.sampleCount, 0);
    return { avgWeight, avgSgr, samples };
  }, [ponds, biometricSessions]);

  const handleAddBiometry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPond || !Number.isInteger(sampleSize) || sampleSize <= 0 || !Number.isFinite(avgWeightKg) || avgWeightKg <= 0) return;
    const samples = Array.from({ length: sampleSize }, () => ({ weightKg: avgWeightKg }));
    recordBiometry({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      speciesId: selectedPond.speciesId,
      date: new Date().toISOString().slice(0, 10),
      sampleCount: sampleSize,
      samples,
      previousAvgWeightKg: selectedPond.averageWeightKg,
      daysSinceLastBiometry: 0,
      operatorName: operator.trim() || currentUser?.fullName || 'Local Operator',
      notes: '',
    });
    setShowAddModal(false);
  };

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Scale className="w-6 h-6 text-amber-400" />{t('biometrics.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('biometrics.subtitle')}</p></div><button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"><Plus className="w-4 h-4" />{t('biometrics.btnNewBiometry')}</button></div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Metric title={t('biometrics.cardAvgWeight')} value={metrics.avgWeight == null ? t('noData') : `${formatNumber(metrics.avgWeight, { maximumFractionDigits: 3 })} ${kg}`} />
      <Metric title={t('biometrics.cardSgr')} value={metrics.avgSgr == null ? t('noData') : `${formatNumber(metrics.avgSgr, { maximumFractionDigits: 3 })}%`} />
      <Metric title={t('biometrics.cardSampled')} value={formatNumber(metrics.samples)} />
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs"><div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400"><TrendingUp className="w-5 h-5" /></div><div><div className="font-bold text-white">SGR</div><span className="font-mono text-slate-400">SGR (%/day) = [(ln(W2) - ln(W1)) / Days] × 100</span></div></div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"><h3 className="font-bold text-sm text-white">{t('biometrics.historyTitle')} <span className="text-slate-500">{t('biometrics.recordsCount', { count: biometricSessions.length })}</span></h3><div className="overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('biometrics.thPond')}</th><th className="p-3">{t('biometrics.thDate')}</th><th className="p-3">{t('biometrics.thSampleSize')}</th><th className="p-3">{t('biometrics.thAvgWeight')}</th><th className="p-3">{t('biometrics.thPrevWeight')}</th><th className="p-3">{t('biometrics.thGrowthRate')}</th><th className="p-3">{t('biometrics.thOperator')}</th></tr></thead><tbody className="divide-y divide-slate-800">{biometricSessions.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : biometricSessions.map((row) => <tr key={row.id} className="text-slate-300"><td className="p-3 font-bold text-white">{row.pondName}</td><td className="p-3">{formatDate(row.date)}</td><td className="p-3">{formatNumber(row.sampleCount)}</td><td className="p-3">{formatNumber(row.averageWeightKg)} {kg}</td><td className="p-3">{formatNumber(row.previousAvgWeightKg)} {kg}</td><td className="p-3">{formatNumber(row.sgr)}%</td><td className="p-3">{row.operatorName}</td></tr>)}</tbody></table></div></div>

    {showAddModal && <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"><h3 className="font-bold text-base text-white flex items-center gap-2"><Scale className="w-5 h-5 text-amber-400" />{t('biometrics.modalTitle')}</h3><form onSubmit={handleAddBiometry} className="space-y-3 text-xs"><label className="block text-slate-300 font-bold">{t('biometrics.fieldPond')}<select value={selectedPondId} onChange={(e) => setSelectedPondId(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="block text-slate-300 font-bold">{t('biometrics.fieldSampleSize')}<input type="number" min={1} value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label><label className="block text-slate-300 font-bold">{t('biometrics.fieldAvgWeight')}<input type="number" min={0.001} step="0.001" value={avgWeightKg || ''} onChange={(e) => setAvgWeightKg(Number(e.target.value))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label></div><label className="block text-slate-300 font-bold">{t('biometrics.fieldOperator')}<input value={operator} onChange={(e) => setOperator(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">{t('biometrics.btnSubmitBiometry')}</button></div></form></div></div>}
  </div>;
};

const Metric: React.FC<{ title: string; value: string }> = ({ title, value }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 block">{title}</span><span className="text-xl font-black text-white mt-1 block">{value}</span></div>;
