'use client';

import { useState, useRef, useEffect } from 'react';
import { useTabs } from '@/lib/tab-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import type { TabType } from '@/lib/types/tabs';

function TabIcon({ type, size = 12 }: { type: TabType; size?: number }) {
  const s = size;
  switch (type) {
    case 'spreadsheet':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <line x1="2" y1="10" x2="14" y2="10" />
          <line x1="6" y1="2" x2="6" y2="14" />
        </svg>
      );
    case 'output':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M5 6l2 2-2 2" />
          <line x1="9" y1="10" x2="11" y2="10" />
        </svg>
      );
    case 'graph-builder':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 14V2" />
          <path d="M2 14h12" />
          <path d="M5 10l3-4 3 2 3-4" />
        </svg>
      );
    case 'monte-carlo':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M5 10c.5-4 2-6 3-6s2.5 2 3 6" />
          <line x1="4" y1="8" x2="12" y2="8" />
        </svg>
      );
    case 'r-console':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M5 6l2 2-2 2" />
        </svg>
      );
    case 'summary':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M5 5h6M5 8h4M5 11h5" />
        </svg>
      );
    case 'regression':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="4" cy="11" r="1" fill="currentColor" />
          <circle cx="6" cy="9" r="1" fill="currentColor" />
          <circle cx="8" cy="7.5" r="1" fill="currentColor" />
          <circle cx="11" cy="5" r="1" fill="currentColor" />
          <line x1="3" y1="12" x2="13" y2="4" strokeDasharray="2 1.5" />
        </svg>
      );
    case 'logistic-regression':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 13c2-0 4-.5 6-5s4-5 6-5" />
          <line x1="2" y1="8" x2="14" y2="8" strokeDasharray="1.5 1.5" opacity="0.3" />
        </svg>
      );
    case 'hypothesis-test':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12c1-3 2-8 5-8s4 5 5 8" />
          <line x1="8" y1="4" x2="8" y2="12" strokeDasharray="2 1" />
          <line x1="5" y1="10" x2="11" y2="10" opacity="0.4" />
        </svg>
      );
    case 'cross-tab':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <line x1="6" y1="2" x2="6" y2="14" />
          <line x1="10" y1="2" x2="10" y2="14" />
          <line x1="2" y1="10" x2="14" y2="10" />
        </svg>
      );
    case 'time-series':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 14V2" />
          <path d="M2 14h12" />
          <path d="M4 10l2-3 2 1 2-4 2 2 2-1" />
          <circle cx="14" cy="5" r="1" fill="currentColor" />
        </svg>
      );
    case 'data-cleaning':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2l1 4h6l1-4" />
          <path d="M5 6v7a1 1 0 001 1h4a1 1 0 001-1V6" />
          <line x1="8" y1="8" x2="8" y2="12" />
          <line x1="6" y1="8" x2="6" y2="11" />
          <line x1="10" y1="8" x2="10" y2="11" />
        </svg>
      );
    case 'data-join':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <circle cx="6" cy="8" r="4" />
          <circle cx="10" cy="8" r="4" />
        </svg>
      );
    case 'welcome':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" />
        </svg>
      );
  }
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useTabs();
  const { features } = useSkillLevel();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    if (showNewMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNewMenu]);

  const availableTypes: { type: TabType; label: string; section?: string }[] = [
    { type: 'spreadsheet', label: 'Spreadsheet', section: 'Data' },
    { type: 'graph-builder', label: 'Graph Builder', section: 'Data' },
    { type: 'summary', label: 'Data Summary', section: 'Data' },
    { type: 'data-cleaning', label: 'Data Cleaning', section: 'Data' },
    { type: 'data-join', label: 'Join Datasets', section: 'Data' },
    { type: 'cross-tab', label: 'Cross-Tabulation', section: 'Analysis' },
    { type: 'hypothesis-test', label: 'Hypothesis Test', section: 'Analysis' },
    { type: 'regression', label: 'Regression (OLS)', section: 'Analysis' },
    { type: 'logistic-regression', label: 'Logistic Regression', section: 'Analysis' },
    { type: 'time-series', label: 'Time Series', section: 'Analysis' },
    { type: 'output', label: 'Output', section: 'Other' },
  ];

  if (features.showTabMonteCarlo) {
    availableTypes.push({ type: 'monte-carlo', label: 'Monte Carlo', section: 'Analysis' });
  }
  if (features.showTabRConsole) {
    availableTypes.push({ type: 'r-console', label: 'R Console', section: 'Other' });
  }

  // Group by section
  const sections = ['Data', 'Analysis', 'Other'];
  const grouped = sections.map((section) => ({
    section,
    items: availableTypes.filter((t) => t.section === section),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-white/5 bg-[#111113]">
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex h-9 items-center gap-1.5 border-r border-white/5 px-3 text-xs transition shrink-0 ${
              tab.id === activeTabId
                ? 'bg-panel text-foreground'
                : 'text-muted/60 hover:text-muted'
            }`}
          >
            <span className={tab.id === activeTabId ? 'text-accent/70' : 'text-muted/40'}>
              <TabIcon type={tab.type} />
            </span>
            <span className="truncate max-w-[120px]">{tab.title}</span>
            {tab.closable && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded text-[10px] text-muted/30 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-foreground transition"
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>

      {/* New tab button */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setShowNewMenu(!showNewMenu)}
          className="flex h-9 w-9 items-center justify-center text-muted/40 hover:text-foreground transition"
          title="New tab"
        >
          +
        </button>
        {showNewMenu && (
          <div className="absolute right-0 top-full z-50 mt-0.5 min-w-[200px] rounded-lg border border-white/10 bg-[#1a1a1d] py-1 shadow-premium max-h-[400px] overflow-y-auto">
            {grouped.map((group, gi) => (
              <div key={group.section}>
                {gi > 0 && <div className="my-1 border-t border-white/5" />}
                <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-muted/30">
                  {group.section}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => {
                      addTab(item.type);
                      setShowNewMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <span className="text-muted/50">
                      <TabIcon type={item.type} />
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
