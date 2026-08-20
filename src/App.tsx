import React, { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import { PermissionModule } from './types';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { PondsView } from './components/views/PondsView';
import { FeedingView } from './components/views/FeedingView';
import { HatcheryView } from './components/views/HatcheryView';
import { ProcessingView } from './components/views/ProcessingView';
import { SalesCrmView } from './components/views/SalesCrmView';
import { AccountingView } from './components/views/AccountingView';
import { HrPayrollView } from './components/views/HrPayrollView';
import { WarehouseView } from './components/views/WarehouseView';
import { BiometricsView } from './components/views/BiometricsView';
import { WaterQualityView } from './components/views/WaterQualityView';
import { AiAssistantView } from './components/views/AiAssistantView';
import { CaviarMarketingView } from './components/views/CaviarMarketingView';
import { CrossPlatformView } from './components/views/CrossPlatformView';
import { SecurityAuditView } from './components/views/SecurityAuditView';
import { BackupRestoreView } from './components/views/BackupRestoreView';
import { OperationsModuleId, OperationsModuleView } from './components/views/OperationsModuleView';
import { GlobalSearchModal } from './components/views/GlobalSearchModal';
import { AuthModal } from './components/views/AuthModal';

const VIEW_PERMISSIONS: Record<string, PermissionModule> = {
  dashboard: 'dashboard',
  farmHalls: 'halls',
  ponds: 'ponds',
  feeding: 'feeding',
  biometrics: 'biometrics',
  waterQuality: 'water_quality',
  mortality: 'mortality',
  treatments: 'treatments',
  transfers: 'transfers',
  hatchery: 'hatchery',
  nursery: 'nursery',
  feedFactory: 'feed_factory',
  warehouse: 'warehouse',
  laboratory: 'laboratory',
  processing: 'processing',
  coldStorage: 'cold_storage',
  crm: 'crm',
  sales: 'sales',
  accounting: 'accounting',
  hr: 'hr',
  hrPayroll: 'hr',
  aiAssistant: 'ai_assistant',
  mediaStudio: 'media',
  media: 'media',
  caviarMarketing: 'media',
  maintenance: 'settings',
  reports: 'reports',
  securityAudit: 'users',
  users: 'users',
  backup: 'backup',
  backupRestore: 'backup',
  platformHub: 'settings',
  crossPlatform: 'settings',
};

const OPERATIONS_VIEWS = new Set<OperationsModuleId>([
  'farmHalls',
  'mortality',
  'treatments',
  'transfers',
  'nursery',
  'feedFactory',
  'laboratory',
  'coldStorage',
  'crm',
  'maintenance',
  'reports',
]);

const MainAppContent: React.FC = () => {
  const { dir } = useI18n();
  const { isAuthenticated, currentUser, hasPermission } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen((previous) => !previous);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectView = (viewId: string) => {
    const module = VIEW_PERMISSIONS[viewId];
    if (module && !hasPermission(module, 'view')) return;
    setActiveView(viewId);
  };

  const renderActiveView = () => {
    const requiredModule = VIEW_PERMISSIONS[activeView];
    if (requiredModule && !hasPermission(requiredModule, 'view')) {
      return <DashboardView onSelectNav={selectView} />;
    }

    if (OPERATIONS_VIEWS.has(activeView as OperationsModuleId)) {
      return <OperationsModuleView moduleId={activeView as OperationsModuleId} />;
    }

    switch (activeView) {
      case 'dashboard': return <DashboardView onSelectNav={selectView} />;
      case 'ponds': return <PondsView onSelectNav={selectView} />;
      case 'feeding': return <FeedingView />;
      case 'biometrics': return <BiometricsView />;
      case 'waterQuality': return <WaterQualityView />;
      case 'hatchery': return <HatcheryView />;
      case 'processing': return <ProcessingView />;
      case 'warehouse': return <WarehouseView />;
      case 'sales': return <SalesCrmView />;
      case 'accounting': return <AccountingView />;
      case 'hr':
      case 'hrPayroll': return <HrPayrollView />;
      case 'aiAssistant': return <AiAssistantView />;
      case 'mediaStudio':
      case 'media':
      case 'caviarMarketing': return <CaviarMarketingView />;
      case 'platformHub':
      case 'crossPlatform': return <CrossPlatformView />;
      case 'securityAudit':
      case 'users': return <SecurityAuditView />;
      case 'backup':
      case 'backupRestore': return <BackupRestoreView />;
      default: return <DashboardView onSelectNav={selectView} />;
    }
  };

  if (!isAuthenticated || !currentUser) {
    return (
      <div dir={dir} className="min-h-screen bg-[#09090B] text-[#E4E4E7] font-sans flex items-center justify-center p-4">
        <AuthModal isOpen isBlocking onClose={() => {}} />
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-[#09090B] text-[#E4E4E7] font-sans flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <Header
        onSelectNav={selectView}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen((previous) => !previous)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={activeView}
          onSelectNav={(viewId) => {
            selectView(viewId);
            setIsMobileMenuOpen(false);
          }}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#09090B]">
          <div className="max-w-7xl mx-auto view-transition">{renderActiveView()}</div>
        </main>
      </div>

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelectNav={selectView} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <FarmProvider>
          <MainAppContent />
        </FarmProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
