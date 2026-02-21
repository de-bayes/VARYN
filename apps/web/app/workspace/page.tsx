'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from '@/components/Sidebar';
import { Canvas } from '@/components/Canvas';
import { Inspector } from '@/components/Inspector';
import { CommandBar } from '@/components/CommandBar';
import { LogPanel } from '@/components/LogPanel';
import { useWorkspace } from '@/lib/workspace-context';

export default function WorkspacePage() {
  const [activeSection, setActiveSection] = useState('Datasets');
  const {
    currentProject,
    activeDataset,
    dataViewUrl,
    showDataView,
    closeDataView,
    cards,
    logs,
    logStatus,
    logDuration,
    isExecuting,
    executeCommand,
    uploadDataset,
  } = useWorkspace();

  const handleExecute = async (command: string) => {
    closeDataView();
    await executeCommand(command);
  };

  const inspectorData = activeDataset
    ? {
        filename: activeDataset.filename,
        rowCount: activeDataset.rowCount,
        columns: activeDataset.columns,
      }
    : null;

  const dataViewProps = showDataView && activeDataset && dataViewUrl
    ? {
        downloadUrl: dataViewUrl,
        filename: activeDataset.filename,
        onPasteUpload: uploadDataset,
      }
    : null;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 bg-panel px-4">
        <span className="text-sm font-semibold tracking-tight">VARYN</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted/50">
            {currentProject?.name ?? ''}
            {activeDataset ? ` / ${activeDataset.filename}` : ''}
          </span>
        </div>
      </header>

      {/* Main workspace */}
      <PanelGroup direction="vertical" className="flex-1">
        <Panel defaultSize={92} minSize={60}>
          <PanelGroup direction="horizontal">
            {/* Sidebar */}
            <Panel defaultSize={14} minSize={10} maxSize={25}>
              <Sidebar activeSection={activeSection} onSelect={setActiveSection} />
            </Panel>
            <PanelResizeHandle />

            {/* Canvas (output cards or data view) */}
            <Panel defaultSize={60} minSize={30}>
              <Canvas cards={cards} dataView={dataViewProps} />
            </Panel>
            <PanelResizeHandle />

            {/* Inspector */}
            <Panel defaultSize={26} minSize={15} maxSize={40}>
              <Inspector activeDataset={inspectorData} />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle />

        {/* Command bar + logs at bottom */}
        <Panel defaultSize={8} minSize={5} maxSize={40}>
          <div className="flex h-full flex-col">
            <LogPanel logs={logs} status={logStatus} durationMs={logDuration} />
            <CommandBar
              onExecute={handleExecute}
              isLoading={isExecuting}
              activeDatasetName={activeDataset?.filename}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
