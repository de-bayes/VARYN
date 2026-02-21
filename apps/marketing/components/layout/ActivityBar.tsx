'use client';

import { useState } from 'react';

type ActivityItem = 'files' | 'search' | 'variables';

interface ActivityBarProps {
  active: ActivityItem;
  onChange: (item: ActivityItem) => void;
}

const items: { id: ActivityItem; label: string; icon: string }[] = [
  { id: 'files', label: 'Files', icon: 'F' },
  { id: 'search', label: 'Search', icon: 'S' },
  { id: 'variables', label: 'Variables', icon: 'V' },
];

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <div className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-[#111113] py-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          title={item.label}
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs transition ${
            active === item.id
              ? 'bg-white/[0.08] text-foreground'
              : 'text-muted/50 hover:bg-white/[0.04] hover:text-muted'
          }`}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
