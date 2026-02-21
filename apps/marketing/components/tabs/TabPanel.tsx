'use client';

import { Suspense } from 'react';
import { useTabs } from '@/lib/tab-context';
import { getTabComponent } from './tab-registry';

export function TabPanel() {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="relative flex-1 overflow-hidden">
      {tabs.map((tab) => {
        const Component = getTabComponent(tab.type);
        return (
          <div
            key={tab.id}
            className={`absolute inset-0 ${
              tab.id === activeTabId ? 'z-10' : 'z-0 hidden'
            }`}
          >
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-muted/40">
                  Loading...
                </div>
              }
            >
              <Component tabId={tab.id} datasetId={tab.datasetId} sourceUrl={tab.sourceUrl} />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
