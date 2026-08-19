import React from 'react';
import { useI18n } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import {
  LayoutDashboard,
  Building2,
  Fish,
  Utensils,
  TrendingUp,
  Activity,
  Skull,
  Stethoscope,
  ArrowLeftRight,
  Egg,
  Sparkles,
  Factory,
  Package,
  FlaskConical,
  Scissors,
  Snowflake,
  Users,
  Receipt,
  Calculator,
  UserCheck,
  Bot,
  Megaphone,
  Wrench,
  FileSpreadsheet,
  ShieldCheck,
  Database,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { PermissionModule } from '../../types';

interface SidebarProps {
  currentView: string;
  onSelectNav: (viewId: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  module: PermissionModule;
  badge?: number | string;
  badgeColor?: string;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectNav,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { t, dir } = useI18n();
  const { hasPermission, currentUser } = useAuth();
  const { ponds, proformas, coldStorage } = useFarm();

  const stoppedPondsCount = ponds.filter((p) => p.feedingStatus === 'STOPPED').length;
  const pendingProformasCount = proformas.filter((p) => p.stage === 'Proforma (پیش‌فاکتور)').length;
  const coldStorageWeightKg = coldStorage.reduce((s, p) => s + p.weightKg, 0);

  const sections: NavSection[] = [
    {
      titleKey: 'nav.sectionBreeding',
      items: [
        { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
        { id: 'farmHalls', labelKey: 'nav.farmHalls', icon: Building2, module: 'halls' },
        {
          id: 'ponds',
          labelKey: 'nav.ponds',
          icon: Fish,
          module: 'ponds',
          badge: stoppedPondsCount > 0 ? t('nav.stoppedBadge', { count: stoppedPondsCount }) : undefined,
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        },
        { id: 'feeding', labelKey: 'nav.feeding', icon: Utensils, module: 'feeding' },
        { id: 'biometrics', labelKey: 'nav.biometrics', icon: TrendingUp, module: 'biometrics' },
        { id: 'waterQuality', labelKey: 'nav.waterQuality', icon: Activity, module: 'water_quality' },
        { id: 'mortality', labelKey: 'nav.mortality', icon: Skull, module: 'mortality' },
        { id: 'treatments', labelKey: 'nav.treatments', icon: Stethoscope, module: 'treatments' },
        { id: 'transfers', labelKey: 'nav.transfers', icon: ArrowLeftRight, module: 'transfers' },
      ],
    },
    {
      titleKey: 'nav.sectionHatchery',
      items: [
        { id: 'hatchery', labelKey: 'nav.hatchery', icon: Egg, module: 'hatchery' },
        { id: 'nursery', labelKey: 'nav.nursery', icon: Sparkles, module: 'nursery' },
        { id: 'feedFactory', labelKey: 'nav.feedFactory', icon: Factory, module: 'feed_factory' },
        { id: 'warehouse', labelKey: 'nav.warehouse', icon: Package, module: 'warehouse' },
        { id: 'laboratory', labelKey: 'nav.laboratory', icon: FlaskConical, module: 'laboratory' },
        { id: 'processing', labelKey: 'nav.processing', icon: Scissors, module: 'processing' },
        {
          id: 'coldStorage',
          labelKey: 'nav.coldStorage',
          icon: Snowflake,
          module: 'cold_storage',
          badge: `${coldStorageWeightKg.toFixed(0)} kg`,
          badgeColor: 'bg-[#18181B] text-[#D4AF37] border-[#D4AF37]/40',
        },
      ],
    },
    {
      titleKey: 'nav.sectionCommercial',
      items: [
        { id: 'crm', labelKey: 'nav.crm', icon: Users, module: 'crm' },
        {
          id: 'sales',
          labelKey: 'nav.sales',
          icon: Receipt,
          module: 'sales',
          badge: pendingProformasCount > 0 ? `${pendingProformasCount}` : undefined,
          badgeColor: 'bg-[#18181B] text-[#D4AF37] border-[#D4AF37]/40',
        },
        { id: 'accounting', labelKey: 'nav.accounting', icon: Calculator, module: 'accounting' },
        { id: 'hr', labelKey: 'nav.hr', icon: UserCheck, module: 'hr' },
      ],
    },
    {
      titleKey: 'nav.sectionSystem',
      items: [
        { id: 'aiAssistant', labelKey: 'nav.aiAssistant', icon: Bot, module: 'ai_assistant' },
        { id: 'mediaStudio', labelKey: 'nav.mediaStudio', icon: Megaphone, module: 'media' },
        { id: 'maintenance', labelKey: 'nav.maintenance', icon: Wrench, module: 'settings' },
        { id: 'reports', labelKey: 'nav.reports', icon: FileSpreadsheet, module: 'reports' },
        { id: 'securityAudit', labelKey: 'nav.securityAudit', icon: ShieldCheck, module: 'users' },
        { id: 'backup', labelKey: 'nav.backup', icon: Database, module: 'backup' },
        { id: 'platformHub', labelKey: 'nav.platformHub', icon: Smartphone, module: 'settings' },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed lg:sticky top-[64px] bottom-0 ${
          dir === 'rtl' ? 'right-0' : 'left-0'
        } z-40 w-[245px] flex-shrink-0 bg-[#121214] border-r border-l border-[#1F1F22] text-[#A1A1AA] flex flex-col h-[calc(100vh-64px)] transition-transform duration-300 ease-in-out ${
          isOpenMobile
            ? 'translate-x-0'
            : dir === 'rtl'
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation items list */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5 scrollbar-thin">
          {sections.map((sec, secIdx) => {
            const visibleItems = sec.items.filter((item) => hasPermission(item.module, 'view'));
            if (visibleItems.length === 0) return null;

            return (
              <div key={secIdx}>
                <h3 className="px-3 text-[10px] uppercase tracking-widest font-semibold text-[#71717A] mb-1.5">
                  {t(sec.titleKey)}
                </h3>
                <nav className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectNav(item.id);
                          onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#1F1F22] text-[#D4AF37] border border-[#D4AF37]/30 font-semibold shadow-sm'
                            : 'text-[#A1A1AA] hover:bg-[#1F1F22] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isActive ? (
                            <div className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" />
                          ) : (
                            <Icon className="w-4 h-4 shrink-0 text-[#71717A]" />
                          )}
                          <span className="truncate">{t(item.labelKey)}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${
                              item.badgeColor || 'bg-[#18181B] text-[#A1A1AA] border-[#27272A]'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        {/* Footer info widget */}
        <div className="p-3 border-t border-[#1F1F22] mt-auto">
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3">
            <div className="text-[10px] text-[#71717A] uppercase tracking-widest mb-1">Active Session</div>
            <div className="text-xs font-semibold text-white truncate">
              {currentUser?.fullName || 'Dr. Fathi'}
            </div>
            <div className="text-[10px] text-[#52525B] font-mono mt-0.5 flex items-center justify-between">
              <span>Enterprise v6.0</span>
              <span className="text-emerald-400 font-semibold">● Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
