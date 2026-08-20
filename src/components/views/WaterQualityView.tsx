import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  Droplets,
  Plus,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Thermometer,
  Wind,
  Layers,
} from 'lucide-react';
import { WaterQualityLog } from '../../types';

export const WaterQualityView: React.FC = () => {
  const { t, formatNumber, formatDate, formatTime } = useI18n();
  const { ponds, waterLogs, recordWaterTest } = useFarm();

  const [selectedPondId, setSelectedPondId] = useState<string>(ponds[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form State
  const [testDO, setTestDO] = useState<number>(6.5);
  const [testTemp, setTestTemp] = useState<number>(16.2);
  const [testPh, setTestPh] = useState<number>(7.4);
  const [testAmmonia, setTestAmmonia] = useState<number>(0.02);
  const [testNitrite, setTestNitrite] = useState<number>(0.01);
  const [testNitrate, setTestNitrate] = useState<number>(12);
  const [testSalinity, setTestSalinity] = useState<number>(0.3);
  const [tester, setTester] = useState<string>('دکتر معتمدی (آزمایشگاه آب)');

  const selectedPond = ponds.find((p) => p.id === selectedPondId);

  const handleRecordTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPond) return;

    recordWaterTest({
      pondId: selectedPond.id,
      pondName: selectedPond.name,
      hallName: 'سالن ۱ - پرورش ماهیان خاویاری',
      dissolvedOxygen: Number(testDO),
      temperature: Number(testTemp),
      ph: Number(testPh),
      ammonia: Number(testAmmonia),
      nitrite: Number(testNitrite),
      nitrate: Number(testNitrate),
      salinity: Number(testSalinity),
      operator: tester,
      sensorStatus: 'VALID',
      severity: Number(testDO) < 4.0 ? 'CRITICAL' : Number(testDO) < 5.0 ? 'WARNING' : 'INFO',
    });

    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Droplets className="w-6 h-6 text-cyan-400" />
            {t('waterQuality.title')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('waterQuality.subtitle')}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/20"
        >
          <Plus className="w-4 h-4" />
          {t('waterQuality.newTest')}
        </button>
      </div>

      {/* Real-time Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">{t('waterQuality.avgDo')}</span>
            <span className="text-2xl font-black text-cyan-400">6.4 mg/L</span>
            <span className="text-[11px] text-emerald-400 block mt-1">{t('waterQuality.avgDoStatus')}</span>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Wind className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">{t('waterQuality.avgTemp')}</span>
            <span className="text-2xl font-black text-orange-400">16.3 °C</span>
            <span className="text-[11px] text-slate-400 block mt-1">{t('waterQuality.avgTempStatus')}</span>
          </div>
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl">
            <Thermometer className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">{t('waterQuality.avgPh')}</span>
            <span className="text-2xl font-black text-emerald-400">7.42</span>
            <span className="text-[11px] text-emerald-400 block mt-1">{t('waterQuality.avgPhStatus')}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">{t('waterQuality.toxicAmmonia')}</span>
            <span className="text-2xl font-black text-slate-200">0.01 mg/L</span>
            <span className="text-[11px] text-emerald-400 block mt-1">{t('waterQuality.ammoniaStatus')}</span>
          </div>
          <div className="p-3 bg-slate-800 text-slate-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Water Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          {t('waterQuality.historyTitle')}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase border-b border-slate-700">
              <tr>
                <th className="p-3">{t('waterQuality.thPond')}</th>
                <th className="p-3">{t('waterQuality.thTime')}</th>
                <th className="p-3">{t('waterQuality.thDo')}</th>
                <th className="p-3">{t('waterQuality.thTemp')}</th>
                <th className="p-3">{t('waterQuality.thPh')}</th>
                <th className="p-3">{t('waterQuality.thAmmonia')}</th>
                <th className="p-3">{t('waterQuality.thNitrite')}</th>
                <th className="p-3">{t('waterQuality.thSalinity')}</th>
                <th className="p-3">{t('waterQuality.thOperator')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {waterLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-white">{log.pondName}</td>
                  <td className="p-3 text-slate-400">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td>
                  <td className="p-3 font-black text-cyan-300">{log.dissolvedOxygen}</td>
                  <td className="p-3 font-bold text-orange-300">{log.temperature}</td>
                  <td className="p-3 text-slate-200">{log.ph}</td>
                  <td className="p-3 text-slate-300">{log.ammonia ?? '---'}</td>
                  <td className="p-3 text-slate-300">{log.nitrite ?? '---'}</td>
                  <td className="p-3 text-slate-300">{log.salinity ?? '---'}</td>
                  <td className="p-3 text-slate-400">{log.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Water Test */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Droplets className="w-5 h-5 text-cyan-400" />
              {t('waterQuality.modalTitle')}
            </h3>

            <form onSubmit={handleRecordTest} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">{t('waterQuality.selectPond')}:</label>
                <select
                  value={selectedPondId}
                  onChange={(e) => setSelectedPondId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {ponds.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">{t('waterQuality.doField')}:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testDO}
                    onChange={(e) => setTestDO(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">{t('waterQuality.tempField')}:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testTemp}
                    onChange={(e) => setTestTemp(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-orange-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">{t('waterQuality.phField')}:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={testPh}
                    onChange={(e) => setTestPh(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">{t('waterQuality.ammoniaField')}:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={testAmmonia}
                    onChange={(e) => setTestAmmonia(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">{t('waterQuality.operatorField')}:</label>
                <input
                  type="text"
                  value={tester}
                  onChange={(e) => setTester(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  {t('waterQuality.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl"
                >
                  {t('waterQuality.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
