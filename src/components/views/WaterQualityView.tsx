import React, { useMemo, useState } from 'react';
import { Activity, Droplets, Layers, Plus, Thermometer, Wind } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { runtimeValueLabel } from '../../i18n/runtimeMessages';

export const WaterQualityView: React.FC = () => {
  const { t, formatNumber, formatDate, formatTime, language } = useI18n();
  const { currentUser } = useAuth();
  const { ponds, halls, waterLogs, recordWaterTest } = useFarm();
  const [selectedPondId, setSelectedPondId] = useState<string>(ponds[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [testDO, setTestDO] = useState(6.5);
  const [testTemp, setTestTemp] = useState(16.2);
  const [testPh, setTestPh] = useState(7.4);
  const [testAmmonia, setTestAmmonia] = useState(0.02);
  const [testNitrite, setTestNitrite] = useState(0.01);
  const [testNitrate, setTestNitrate] = useState(12);
  const [testSalinity, setTestSalinity] = useState(0.3);
  const [tester, setTester] = useState(currentUser?.fullName || '');

  const selectedPond = ponds.find((pond) => pond.id === selectedPondId);
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const metrics = useMemo(() => {
    const validPonds = ponds.filter((pond) => Number.isFinite(pond.dissolvedOxygen) && Number.isFinite(pond.waterTemperature) && Number.isFinite(pond.ph));
    const ammoniaValues = waterLogs.map((row) => row.ammonia).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return {
      doValue: average(validPonds.map((pond) => pond.dissolvedOxygen)),
      tempValue: average(validPonds.map((pond) => pond.waterTemperature)),
      phValue: average(validPonds.map((pond) => pond.ph)),
      ammoniaValue: average(ammoniaValues),
    };
  }, [ponds, waterLogs]);

  const handleRecordTest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPond) return;
    const hallName = halls.find((hall) => hall.id === selectedPond.hallId)?.name || selectedPond.hallId;
    recordWaterTest({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      hallName,
      dissolvedOxygen: Number(testDO),
      temperature: Number(testTemp),
      ph: Number(testPh),
      ammonia: Number(testAmmonia),
      nitrite: Number(testNitrite),
      nitrate: Number(testNitrate),
      salinity: Number(testSalinity),
      operator: tester.trim() || currentUser?.fullName || 'Local Operator',
      sensorStatus: 'VALID',
      severity: Number(testDO) < 4 ? 'CRITICAL' : Number(testDO) < 5 ? 'WARNING' : 'INFO',
    });
    setShowAddModal(false);
  };

  const metricText = (value: number | null, suffix = '') => value === null ? t('noData') : `${formatNumber(value, { maximumFractionDigits: 2 })}${suffix}`;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Droplets className="w-6 h-6 text-cyan-400" />{t('waterQuality.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('waterQuality.subtitle')}</p></div>
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"><Plus className="w-4 h-4" />{t('waterQuality.btnRecordTest')}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          [t('waterQuality.avgDoTitle'), metricText(metrics.doValue, ' mg/L'), t('waterQuality.avgDoSafe'), Wind, 'text-cyan-400'],
          [t('waterQuality.avgTempTitle'), metricText(metrics.tempValue, ' °C'), t('waterQuality.avgTempDesc'), Thermometer, 'text-orange-400'],
          [t('waterQuality.avgPhTitle'), metricText(metrics.phValue), t('waterQuality.avgPhDesc'), Activity, 'text-emerald-400'],
          [t('waterQuality.avgAmmoniaTitle'), metricText(metrics.ammoniaValue, ' mg/L'), t('waterQuality.avgAmmoniaSafe'), Layers, 'text-slate-200'],
        ].map(([label, value, desc, Icon, color], index) => {
          const MetricIcon = Icon as React.ElementType;
          return <div key={index} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between"><div><span className="text-xs text-slate-400 block">{String(label)}</span><span className={`text-xl font-black ${String(color)}`}>{String(value)}</span><span className="text-[11px] text-slate-400 block mt-1">{String(desc)}</span></div><MetricIcon className="w-6 h-6 text-cyan-400" /></div>;
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" />{t('waterQuality.historyTitle')} <span className="text-slate-500">{t('waterQuality.recordsCount', { count: waterLogs.length })}</span></h3>
        <div className="overflow-x-auto"><table className="w-full text-xs text-start text-slate-300"><thead className="bg-slate-800/80 text-slate-400"><tr><th className="p-3">{t('waterQuality.thPond')}</th><th className="p-3">{t('waterQuality.thTime')}</th><th className="p-3">{t('waterQuality.thDo')}</th><th className="p-3">{t('waterQuality.thTemp')}</th><th className="p-3">{t('waterQuality.thPh')}</th><th className="p-3">{t('waterQuality.thAmmonia')}</th><th className="p-3">{t('waterQuality.thNitrite')}</th><th className="p-3">{t('waterQuality.thSalinity')}</th><th className="p-3">{t('waterQuality.thTester')}</th><th className="p-3">{t('status')}</th></tr></thead><tbody className="divide-y divide-slate-800">{waterLogs.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : waterLogs.map((log) => <tr key={log.id} className="hover:bg-slate-800/40"><td className="p-3 font-bold text-white">{log.pondName}</td><td className="p-3 text-slate-400">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td><td className="p-3">{formatNumber(log.dissolvedOxygen)}</td><td className="p-3">{formatNumber(log.temperature)}</td><td className="p-3">{formatNumber(log.ph)}</td><td className="p-3">{log.ammonia == null ? '—' : formatNumber(log.ammonia)}</td><td className="p-3">{log.nitrite == null ? '—' : formatNumber(log.nitrite)}</td><td className="p-3">{log.salinity == null ? '—' : formatNumber(log.salinity)}</td><td className="p-3">{log.operator}</td><td className="p-3">{runtimeValueLabel(language, log.sensorStatus)}</td></tr>)}</tbody></table></div>
      </div>

      {showAddModal && <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"><h3 className="font-bold text-base text-white flex items-center gap-2"><Droplets className="w-5 h-5 text-cyan-400" />{t('waterQuality.modalTitle')}</h3><form onSubmit={handleRecordTest} className="space-y-3 text-xs">
        <label className="block text-slate-300 font-bold">{t('waterQuality.fieldPond')}<select value={selectedPondId} onChange={(e) => setSelectedPondId(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.number} — {pond.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><Numeric label={t('waterQuality.fieldDo')} value={testDO} setValue={setTestDO} /><Numeric label={t('waterQuality.fieldTemp')} value={testTemp} setValue={setTestTemp} /><Numeric label={t('waterQuality.fieldPh')} value={testPh} setValue={setTestPh} /><Numeric label={t('waterQuality.fieldAmmonia')} value={testAmmonia} setValue={setTestAmmonia} /><Numeric label={t('waterQuality.fieldNitrite')} value={testNitrite} setValue={setTestNitrite} /><Numeric label={t('waterQuality.fieldNitrate')} value={testNitrate} setValue={setTestNitrate} /><Numeric label={t('waterQuality.fieldSalinity')} value={testSalinity} setValue={setTestSalinity} /></div>
        <label className="block text-slate-300 font-bold">{t('waterQuality.fieldTester')}<input value={tester} onChange={(e) => setTester(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" required /></label>
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl">{t('waterQuality.btnSubmitTest')}</button></div>
      </form></div></div>}
    </div>
  );
};

const Numeric: React.FC<{ label: string; value: number; setValue: (value: number) => void }> = ({ label, value, setValue }) => <label className="block text-slate-300 font-bold">{label}<input type="number" step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" required /></label>;
