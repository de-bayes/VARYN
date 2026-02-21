'use client';

import { useSkillLevel } from '@/lib/skill-level-context';
import { useWorkspace } from '@/lib/workspace-context';
import { SKILL_LEVELS } from '@/lib/types/skill-level';

export function StatusBar() {
  const { skillLevel } = useSkillLevel();
  const { currentProject, activeDataset } = useWorkspace();

  const levelInfo = skillLevel ? SKILL_LEVELS[skillLevel] : null;

  return (
    <footer className="flex h-[22px] shrink-0 items-center justify-between border-t border-white/5 bg-[#111113] px-3 text-[10px]">
      <div className="flex items-center gap-3">
        {currentProject && (
          <span className="text-muted/60">{currentProject.name}</span>
        )}
        {activeDataset && (
          <span className="text-muted/40">{activeDataset.filename}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {activeDataset?.rowCount != null && (
          <span className="text-muted/40">
            {activeDataset.rowCount.toLocaleString()} rows
          </span>
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
