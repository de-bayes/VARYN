'use client';

import { useState, useRef } from 'react';

interface CommandBarProps {
  onExecute: (command: string) => void;
  isLoading: boolean;
}

export function CommandBar({ onExecute, isLoading }: CommandBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = value.trim();
    if (!cmd || isLoading) return;
    onExecute(cmd);
    setValue('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-white/10 bg-panel px-4 py-2.5"
    >
      <span className="text-accent/60 text-sm select-none">$</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isLoading ? 'Running...' : 'reg y x1 x2, robust'}
        disabled={isLoading}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/30 focus:outline-none disabled:opacity-50"
        autoFocus
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-muted transition
          hover:border-accent/40 hover:text-foreground disabled:opacity-30"
      >
        {isLoading ? 'Running' : 'Run'}
      </button>
    </form>
  );
}
