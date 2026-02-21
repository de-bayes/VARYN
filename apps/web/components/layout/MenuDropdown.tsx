'use client';

import { useState, useRef, useEffect } from 'react';

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface MenuDropdownProps {
  label: string;
  items: MenuItem[];
}

export function MenuDropdown({ label, items }: MenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2.5 py-1 text-xs transition rounded ${
          open
            ? 'bg-white/[0.08] text-foreground'
            : 'text-muted hover:bg-white/[0.04] hover:text-foreground'
        }`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[180px] rounded-lg border border-white/10 bg-[#1a1a1d] py-1 shadow-premium">
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} className="my-1 border-t border-white/5" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  if (!item.disabled && item.action) {
                    item.action();
                    setOpen(false);
                  }
                }}
                disabled={item.disabled}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-muted hover:bg-white/[0.06] hover:text-foreground disabled:opacity-30 disabled:cursor-default"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="ml-6 text-[10px] text-muted/40">{item.shortcut}</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
