'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MenuBar } from '@/components/layout/MenuBar';
import { ActivityBar } from '@/components/layout/ActivityBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TabBar } from '@/components/tabs/TabBar';
import { TabPanel } from '@/components/tabs/TabPanel';
import { WorkspaceSidebar } from '@/components/sidebar/WorkspaceSidebar';
import { VariablesPanel } from '@/components/panels/VariablesPanel';
import { ConsolePanel } from '@/components/panels/ConsolePanel';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useWorkspace } from '@/lib/workspace-context';
import { useTabs } from '@/lib/tab-context';

export default function WorkspacePage() {
  const [activeSection, setActiveSection] = useState('datasets');
  const [activityItem, setActivityItem] = useState<'files' | 'search' | 'variables'>('files');
  const { features } = useSkillLevel();
  const { setActiveOutputTabId } = useWorkspace();
  const { activeTab, addTab, closeTab, tabs, setActiveTab } = useTabs();

  // Track the active output tab for card routing
  useEffect(() => {
    if (activeTab?.type === 'output') {
      setActiveOutputTabId(activeTab.id);
    }
  }, [activeTab, setActiveOutputTabId]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+N: New spreadsheet
      if (isMeta && e.key === 'n') {
        e.preventDefault();
        addTab('spreadsheet');
      }

      // Cmd+G: New graph
      if (isMeta && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        addTab('graph-builder');
      }

      // Cmd+W: Close current tab
      if (isMeta && e.key === 'w') {
        e.preventDefault();
        if (activeTab?.closable) {
          closeTab(activeTab.id);
        }
      }

      // Cmd+Tab / Ctrl+Tab: Next tab
      if (isMeta && e.key === 'Tab') {
        e.preventDefault();
        const currentIdx = tabs.findIndex((t) => t.id === activeTab?.id);
        if (currentIdx !== -1) {
          const nextIdx = e.shiftKey
            ? (currentIdx - 1 + tabs.length) % tabs.length
            : (currentIdx + 1) % tabs.length;
          setActiveTab(tabs[nextIdx].id);
        }
      }
    },
    [activeTab, addTab, closeTab, tabs, setActiveTab],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen flex-col">
      {/* Menu Bar */}
      <MenuBar />

      {/* Main workspace area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar active={activityItem} onChange={setActivityItem} />

        {/* Content area with optional bottom console */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <PanelGroup direction="vertical">
            {/* Top section: sidebar + tabs + variables */}
            <Panel defaultSize={features.showBottomConsole ? 75 : 100} minSize={40}>
              <PanelGroup direction="horizontal">
                {/* Sidebar */}
                <Panel defaultSize={15} minSize={10} maxSize={25}>
                  <WorkspaceSidebar
                    activeSection={activeSection}
                    onSelect={setActiveSection}
                  />
                </Panel>
                <PanelResizeHandle />

                {/* Tab area */}
                <Panel defaultSize={60} minSize={30}>
                  <div className="flex h-full flex-col">
                    <TabBar />
                    <TabPanel />
                  </div>
                </Panel>
                <PanelResizeHandle />

                {/* Variables Panel */}
                <Panel defaultSize={25} minSize={15} maxSize={35}>
                  <VariablesPanel />
                </Panel>
              </PanelGroup>
            </Panel>

            {/* Bottom Console */}
            {features.showBottomConsole && (
              <>
                <PanelResizeHandle />
                <Panel defaultSize={25} minSize={10} maxSize={50}>
                  <ConsolePanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
