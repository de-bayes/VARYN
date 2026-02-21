'use client';

import { useRouter } from 'next/navigation';
import { useSkillLevel } from '@/lib/skill-level-context';
import { SKILL_LEVELS, type SkillLevel } from '@/lib/types/skill-level';

const LEVEL_ICONS: Record<SkillLevel, string> = {
  1: 'A',
  2: 'R',
  3: 'D',
  4: 'E',
};

export function SkillLevelPicker() {
  const { setSkillLevel } = useSkillLevel();
  const router = useRouter();

  const handleSelect = (level: SkillLevel) => {
    setSkillLevel(level);
    router.push('/app/workspace');
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl w-full">
      {([1, 2, 3, 4] as SkillLevel[]).map((level) => {
        const info = SKILL_LEVELS[level];
        return (
          <button
            key={level}
            onClick={() => handleSelect(level)}
            className="group flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-panel p-6 text-left transition hover:border-accent/40 hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-muted group-hover:border-accent/30 group-hover:text-foreground transition">
                {LEVEL_ICONS[level]}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{info.name}</p>
                <p className="text-[11px] text-muted/60">{info.tagline}</p>
              </div>
            </div>
            <p className="text-xs text-muted/70 leading-relaxed">
              {info.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
