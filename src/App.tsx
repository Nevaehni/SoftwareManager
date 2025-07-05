import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '@/components/ui/toast-container';
import { SystemInfoModal } from '@/components/SystemInfoModal';
import { PackageMatchingModal } from '@/components/PackageMatchingModal';
import { AppHeader } from '@/components/layout/AppHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { ConsolePanel } from '@/components/layout/ConsolePanel';
import { BackupTab } from '@/components/tabs/BackupTab';
import { RestoreTab } from '@/components/tabs/RestoreTab';
import { EditorTab } from '@/components/tabs/EditorTab';
import { PackagesTab } from '@/components/tabs/PackagesTab';
import { DashboardTab } from '@/components/tabs/DashboardTab';
import { useConsole } from '@/hooks/useConsole';
import { useFileOperations } from '@/hooks/useFileOperations';
import { usePackageOperations } from '@/hooks/usePackageOperations';
import { useOperations } from '@/hooks/useOperations';
import { TabType } from '@/types';

function App() {
  const [selectedTab, setSelectedTab] = useState<TabType>('dashboard');
  const { logs, addLog, clearLogs, copyAllLogs, isConsoleVisible, setIsConsoleVisible } = useConsole();
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();

  const {
    selectedPackageFile,
    selectedConfigFile,
    editingFile,
    setEditingFile,
    selectPackageFile,
    selectConfigFile,
    editPackageFile,
    editConfigMappings,
    detectDefaultFiles,
  } = useFileOperations({ addLog, setSelectedTab });

  const {
    isRunning,
    progress,
    executeOperation,
    isSystemInfoModalOpen,
    setIsSystemInfoModalOpen,
  } = useOperations({ addLog });

  const packageOperations = usePackageOperations({
    addLog,
    showError,
    showSuccess,
    showInfo,
    selectedPackageFile,
  });

  useEffect(() => {
    detectDefaultFiles();
    packageOperations.loadPackageStats();
  }, []);

  const handleTabSelect = (tab: TabType) => {
    setSelectedTab(tab);
    if (tab !== 'editor') {
      setEditingFile(null);
    }
  };
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'dashboard':
        return (
          <DashboardTab
            selectedPackageFile={selectedPackageFile}
            onTabChange={handleTabSelect}
            onEditPackageFile={editPackageFile}
            onSelectPackageFile={selectPackageFile}
            onEditConfigMappings={editConfigMappings}
          />
        );
      case 'backup':
        return (
          <BackupTab
            selectedPackageFile={selectedPackageFile}
            onSelectPackageFile={selectPackageFile}
            onExecuteOperation={executeOperation}
            isRunning={isRunning}
          />
        );
      case 'restore':
        return (
          <RestoreTab
            selectedPackageFile={selectedPackageFile}
            selectedConfigFile={selectedConfigFile}
            onSelectPackageFile={selectPackageFile}
            onSelectConfigFile={selectConfigFile}
            onExecuteOperation={executeOperation}
            isRunning={isRunning}
          />
        );
      case 'packages':
        return (
          <PackagesTab
            searchQuery={packageOperations.searchQuery}
            searchResults={packageOperations.searchResults}
            isSearching={packageOperations.isSearching}
            installedPrograms={packageOperations.installedPrograms}
            isLoadingPrograms={packageOperations.isLoadingPrograms}
            selectedPackageFile={selectedPackageFile}
            includeConfig={packageOperations.includeConfig}
            onSearchQueryChange={packageOperations.setSearchQuery}
            onSearch={packageOperations.searchChocolateyPackages}
            onIncludeConfigChange={packageOperations.setIncludeConfig}
            onAddPackage={packageOperations.addPackageToList}
            onLoadPrograms={packageOperations.loadInstalledPrograms}
            onAddToList={packageOperations.addChocolateyPackageToList}
            onSearchForProgram={packageOperations.setSelectedProgramForMatching}
          />
        );
      case 'editor':
        return (
          <EditorTab
            editingFile={editingFile}
            selectedPackageFile={selectedPackageFile}
            onLog={addLog}
            onCloseEditor={() => setEditingFile(null)}
            onEditPackageFile={editPackageFile}
            onEditConfigMappings={editConfigMappings}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <AppHeader
        isRunning={isRunning}
        progress={progress}
        onSystemInfoClick={() => setIsSystemInfoModalOpen(true)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">        <Sidebar
        selectedTab={selectedTab}
        onTabChange={handleTabSelect}
        selectedPackageFile={selectedPackageFile}
        onEditPackageFile={editPackageFile}
        onSelectPackageFile={selectPackageFile}
        onEditConfigMappings={editConfigMappings}
      />        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {renderTabContent()}
          </div>

          <ConsolePanel
            isVisible={isConsoleVisible}
            logs={logs}
            onClearLogs={clearLogs}
            onCopyAllLogs={copyAllLogs}
            onToggleVisibility={() => setIsConsoleVisible(!isConsoleVisible)}
          />
        </main>
      </div>      <SystemInfoModal
        open={isSystemInfoModalOpen}
        onClose={() => setIsSystemInfoModalOpen(false)}
        packageStats={packageOperations.packageStats}
        isLoadingStats={packageOperations.isLoadingStats}
        onLoadStats={packageOperations.loadPackageStats}
      />

      {packageOperations.selectedProgramForMatching && (
        <PackageMatchingModal
          open={!!packageOperations.selectedProgramForMatching}
          onClose={() => packageOperations.setSelectedProgramForMatching(null)}
          program={packageOperations.selectedProgramForMatching}
          searchResults={packageOperations.matchingSearchResults}
          isSearching={packageOperations.isMatchingSearching}
          onSearch={packageOperations.searchChocolateyForProgram}
          onAddToList={packageOperations.addChocolateyPackageToList}
          searchQuery={packageOperations.matchingSearchQuery}
          includeConfig={packageOperations.includeConfig}
        />
      )}

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}

export default App;
