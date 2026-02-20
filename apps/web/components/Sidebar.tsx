'use client';

const sections = [
  { label: 'Datasets', icon: 'D' },
  { label: 'Models', icon: 'M' },
  { label: 'Jobs', icon: 'J' },
  { label: 'History', icon: 'H' },
];

interface SidebarProps {
  activeSection: string;
  onSelect: (section: string) => void;
}

export function Sidebar({ activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="flex h-full flex-col bg-panel text-sm">
      <div className="px-4 py-3 text-[11px] tracking-[0.14em] text-muted/70 uppercase">
        Workspace
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {sections.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.label)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition
              ${activeSection === s.label
                ? 'bg-white/[0.06] text-foreground'
                : 'text-muted hover:bg-white/[0.03] hover:text-foreground'
              }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded border border-white/10 text-[10px] text-muted">
              {s.icon}
            </span>
            {s.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-white/5 px-4 py-3 text-[10px] text-muted/50">
        VARYN MVP
      </div>
    </aside>
  );
}
