'use client';

import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';

export function ConsolePanel() {
  const { logs, isExecuting, executeCommand, activeDataset } = useWorkspace();
  const { features } = useSkillLevel();
  const [value, setValue] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const canInput =
    features.consoleMode === 'command' || features.consoleMode === 'multiline';

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = value.trim();
    if (!cmd || isExecuting) return;
    executeCommand(cmd);
    setValue('');
  };

  return (
    <div className="flex h-full flex-col border-t border-white/5 bg-panel">
      {/* Log output area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted/50">
            Console
          </span>
        </div>
        {logs.map((entry, i) => (
          <div key={i} className="py-0.5">
            {entry.type === 'command' && (
              <div className="text-accent/60">
                <span className="mr-1">$</span>
                {entry.text}
              </div>
            )}
            {entry.type === 'output' && (
              <pre className="whitespace-pre-wrap break-words text-muted/70">
                {entry.text}
              </pre>
            )}
            {entry.type === 'error' && (
              <pre className="whitespace-pre-wrap break-words text-red-300">
                {entry.text}
              </pre>
            )}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Command input */}
      {canInput && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-white/10 px-4 py-2"
        >
          <span className="text-accent/60 text-sm select-none">$</span>
          {activeDataset && (
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/50 shrink-0">
              {activeDataset.filename}
            </span>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isExecuting ? 'Running...' : 'Enter command...'}
            disabled={isExecuting}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/30 focus:outline-none disabled:opacity-50 font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={isExecuting || !value.trim()}
            className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-30"
          >
            {isExecuting ? 'Running' : 'Run'}
          </button>
        </form>
      )}
    </div>
  );
}
