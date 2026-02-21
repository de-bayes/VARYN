'use client';

import { useState, useRef, useEffect } from 'react';
import { useTabs } from '@/lib/tab-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import type { TabType } from '@/lib/types/tabs';
import { TAB_TYPE_LABELS } from '@/lib/types/tabs';

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

  const availableTypes: { type: TabType; label: string }[] = [
    { type: 'spreadsheet', label: 'Spreadsheet' },
    { type: 'output', label: 'Output' },
    { type: 'graph-builder', label: 'Graph Builder' },
  ];

  if (features.showTabMonteCarlo) {
    availableTypes.push({ type: 'monte-carlo', label: 'Monte Carlo' });
  }
  if (features.showTabRConsole) {
    availableTypes.push({ type: 'r-console', label: 'R Console' });
  }

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-white/5 bg-[#111113]">
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex h-9 items-center gap-2 border-r border-white/5 px-3 text-xs transition shrink-0 ${
              tab.id === activeTabId
                ? 'bg-panel text-foreground'
                : 'text-muted/60 hover:text-muted'
            }`}
          >
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
          <div className="absolute right-0 top-full z-50 mt-0.5 min-w-[160px] rounded-lg border border-white/10 bg-[#1a1a1d] py-1 shadow-premium">
            {availableTypes.map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  addTab(item.type);
                  setShowNewMenu(false);
                }}
                className="flex w-full items-center px-3 py-1.5 text-xs text-muted hover:bg-white/[0.06] hover:text-foreground"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
