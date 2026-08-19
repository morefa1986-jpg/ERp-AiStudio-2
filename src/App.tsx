import React, { useState, useEffect } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
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

import { GlobalSearchModal } from './components/views/GlobalSearchModal';
import { AuthModal } from './components/views/AuthModal';

const MainAppContent: React.FC = () => {
  const { dir } = useI18n();
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Global Ctrl+K / Cmd+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onSelectNav={setActiveView} />;
      case 'ponds':
        return <PondsView onSelectNav={setActiveView} />;
      case 'feeding':
        return <FeedingView />;
      case 'biometrics':
        return <BiometricsView />;
      case 'waterQuality':
        return <WaterQualityView />;
      case 'hatchery':
        return <HatcheryView />;
      case 'processing':
        return <ProcessingView />;
      case 'warehouse':
        return <WarehouseView />;
      case 'sales':
        return <SalesCrmView />;
      case 'accounting':
        return <AccountingView />;
      case 'hr':
      case 'hrPayroll':
        return <HrPayrollView />;
      case 'aiAssistant':
        return <AiAssistantView />;
      case 'media':
      case 'caviarMarketing':
        return <CaviarMarketingView />;
      case 'platformHub':
      case 'crossPlatform':
        return <CrossPlatformView />;
      case 'securityAudit':
      case 'users':
        return <SecurityAuditView />;
      case 'backup':
      case 'backupRestore':
        return <BackupRestoreView />;
      default:
        return <DashboardView onSelectNav={setActiveView} />;
    }
  };

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[#09090B] text-[#E4E4E7] font-sans flex flex-col selection:bg-[#D4AF37] selection:text-black"
    >
      {/* Top Header */}
      <Header
        onSelectNav={setActiveView}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />

      {/* Body Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Responsive Sophisticated Dark Sidebar */}
        <Sidebar
          currentView={activeView}
          onSelectNav={(viewId) => {
            setActiveView(viewId);
            setIsMobileMenuOpen(false);
          }}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#09090B]">
          <div className="max-w-7xl mx-auto view-transition">{renderActiveView()}</div>
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNav={setActiveView}
      />

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
