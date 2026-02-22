'use client';

import { useSkillLevel } from '@/lib/skill-level-context';
import { useWorkspace } from '@/lib/workspace-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import { SKILL_LEVELS } from '@/lib/types/skill-level';

export function StatusBar() {
  const { skillLevel } = useSkillLevel();
  const { currentProject } = useWorkspace();
  const { data } = useSpreadsheetData();
  const { activeTab } = useTabs();

  const levelInfo = skillLevel ? SKILL_LEVELS[skillLevel] : null;

  // Get current tab's data info
  const tabData = activeTab ? data[activeTab.id] : undefined;
  const hasData = tabData && tabData.columns.length > 0;

  return (
    <footer className="flex h-[22px] shrink-0 items-center justify-between border-t border-white/5 bg-[#111113] px-3 text-[10px]">
      <div className="flex items-center gap-3">
        {currentProject && (
          <span className="text-muted/60">{currentProject.name}</span>
        )}
        {activeTab && (
          <span className="text-muted/40">{activeTab.title}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {hasData && (
          <>
            <span className="text-muted/40">
              {tabData.rows.length.toLocaleString()} rows
            </span>
            <span className="text-muted/40">
              {tabData.columns.length} cols
            </span>
          </>
        )}
        {levelInfo && (
          <span className="text-muted/50">
            {levelInfo.label} {levelInfo.name}
          </span>
        )}
      </div>
    </footer>
  );
}
