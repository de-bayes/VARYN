'use client';

type ActivityItem = 'files' | 'search' | 'variables';

interface ActivityBarProps {
  active: ActivityItem;
  onChange: (item: ActivityItem) => void;
}

function FilesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5A1.5 1.5 0 014.5 3h3.172a1 1 0 01.707.293L9.5 4.414a1 1 0 00.707.293H15.5A1.5 1.5 0 0117 6.207V15.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15.5V4.5z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="9" cy="9" r="5.5" />
      <line x1="13" y1="13" x2="17" y2="17" />
    </svg>
  );
}

function VariablesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12" />
      <path d="M4 8h8" />
      <path d="M4 12h10" />
      <path d="M4 16h6" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
      <circle cx="14" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

const items: { id: ActivityItem; label: string; Icon: () => JSX.Element }[] = [
  { id: 'files', label: 'Datasets', Icon: FilesIcon },
  { id: 'search', label: 'Search', Icon: SearchIcon },
  { id: 'variables', label: 'Variables', Icon: VariablesIcon },
];

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <div className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-[#111113] py-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          title={item.label}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
            active === item.id
              ? 'bg-white/[0.08] text-foreground'
              : 'text-muted/50 hover:bg-white/[0.04] hover:text-muted'
          }`}
        >
          <item.Icon />
        </button>
      ))}
    </div>
  );
}
