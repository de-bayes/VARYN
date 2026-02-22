'use client';

import { useRouter } from 'next/navigation';
import { useSkillLevel } from '@/lib/skill-level-context';
import { SKILL_LEVELS, type SkillLevel } from '@/lib/types/skill-level';

function AnalystIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </svg>
  );
}

function ResearcherIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-6" />
    </svg>
  );
}

function DeveloperIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="14" y1="4" x2="10" y2="20" />
    </svg>
  );
}

function ExplorerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M2 7h20" />
      <path d="M6 21V7" />
      <path d="M10 11h4M10 15h6" />
    </svg>
  );
}

const LEVEL_ICONS: Record<SkillLevel, () => JSX.Element> = {
  1: AnalystIcon,
  2: ResearcherIcon,
  3: DeveloperIcon,
  4: ExplorerIcon,
};

const LEVEL_COLORS: Record<SkillLevel, { border: string; glow: string; text: string }> = {
  1: { border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10', text: 'text-emerald-400' },
  2: { border: 'border-blue-500/30', glow: 'shadow-blue-500/10', text: 'text-blue-400' },
  3: { border: 'border-purple-500/30', glow: 'shadow-purple-500/10', text: 'text-purple-400' },
  4: { border: 'border-amber-500/30', glow: 'shadow-amber-500/10', text: 'text-amber-400' },
};

const LEVEL_FEATURES: Record<SkillLevel, string[]> = {
  1: ['Spreadsheet viewer', 'Point-and-click charts', 'Sample datasets', 'Friendly language'],
  2: ['Statistical terminology', 'Monte Carlo simulation', 'Guided analysis forms', 'Output console'],
  3: ['R console access', 'Command bar', 'Code behind operations', 'Full menu system'],
  4: ['Multi-line terminal', 'All features unlocked', 'Maximum flexibility', 'Power user mode'],
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
        const Icon = LEVEL_ICONS[level];
        const colors = LEVEL_COLORS[level];
        const feats = LEVEL_FEATURES[level];

        return (
          <button
            key={level}
            onClick={() => handleSelect(level)}
            className={`group relative flex flex-col items-start gap-4 rounded-xl border bg-panel/80 p-6 text-left transition-all duration-200 hover:bg-white/[0.04] hover:shadow-lg ${colors.border} hover:${colors.glow}`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 w-full">
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 transition-colors group-hover:border-white/20 ${colors.text}`}>
                <Icon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{info.name}</p>
                <p className="text-[11px] text-muted/50 mt-0.5">{info.tagline}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-muted/60 leading-relaxed">
              {info.description}
            </p>

            {/* Feature list */}
            <div className="space-y-1.5 w-full">
              {feats.map((f) => (
                <div key={f} className="flex items-center gap-2 text-[11px] text-muted/50">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={colors.text} style={{ opacity: 0.6 }}>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </div>
              ))}
            </div>

            {/* Hover indicator */}
            <div className={`mt-auto pt-2 w-full text-center text-[10px] font-medium tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity ${colors.text}`}>
              Select
            </div>
          </button>
        );
      })}
    </div>
  );
}
