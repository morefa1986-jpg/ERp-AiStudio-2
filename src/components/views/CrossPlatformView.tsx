import React from 'react';
import { Apple, CheckCircle2, Laptop, Layers, Smartphone } from 'lucide-react';
import { useI18n } from '../../i18n';

export const CrossPlatformView: React.FC = () => {
  const { t } = useI18n();

  const platforms = [
    {
      key: 'windows',
      title: t('platform.windowsTab'),
      icon: Laptop,
      status: t('active'),
      detail: 'FathiAquaSuperERP-Setup-6.1.0-x64.exe',
      ready: true,
    },
    {
      key: 'ios',
      title: t('platform.iosTab'),
      icon: Apple,
      status: t('inactive'),
      detail: t('noData'),
      ready: false,
    },
    {
      key: 'android',
      title: t('platform.androidTab'),
      icon: Smartphone,
      status: t('inactive'),
      detail: t('noData'),
      ready: false,
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h1 className="text-xl font-black text-white flex items-center gap-2.5"><Layers className="w-6 h-6 text-amber-400" />{t('platform.title')}</h1>
        <p className="text-xs text-slate-400 mt-1">{t('platform.syncBadge')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <div key={platform.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center"><Icon className="w-6 h-6" /></div>
              <div>
                <h3 className="font-black text-base text-white">{platform.title}</h3>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <CheckCircle2 className={`w-4 h-4 ${platform.ready ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className={platform.ready ? 'text-emerald-300' : 'text-slate-400'}>{platform.status}</span>
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono break-all">{platform.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
