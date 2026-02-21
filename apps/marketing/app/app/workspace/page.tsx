'use client';

import { useState, useEffect } from 'react';
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
  const { activeTab } = useTabs();

  // Track the active output tab for card routing
  useEffect(() => {
    if (activeTab?.type === 'output') {
      setActiveOutputTabId(activeTab.id);
    }
  }, [activeTab, setActiveOutputTabId]);

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
