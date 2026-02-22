'use client';

import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';

export function ConsolePanel() {
  const { logs, isExecuting, executeCommand, activeDataset } = useWorkspace();
  const { features } = useSkillLevel();
  const { data } = useSpreadsheetData();
  const { activeTab } = useTabs();
  const [value, setValue] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const canInput =
    features.consoleMode === 'command' || features.consoleMode === 'multiline';

  const tabData = activeTab ? data[activeTab.id] : undefined;

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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-wider text-muted/50">
          Console
        </span>
        {tabData && tabData.columns.length > 0 && (
          <span className="text-[10px] text-muted/30">
            {tabData.rows.length} rows / {tabData.columns.length} cols loaded
          </span>
        )}
      </div>

      {/* Log output area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
        {logs.length === 0 && (
          <div className="text-muted/25 text-[11px] space-y-1 py-2">
            <p>VARYN Console</p>
            {features.consoleMode === 'output-only' && (
              <p>Output from your operations will appear here.</p>
            )}
            {canInput && (
              <>
                <p>Type commands to interact with your data.</p>
                <p className="text-muted/15">Tip: Load a dataset first, then try commands like summary(), plot(), etc.</p>
              </>
            )}
          </div>
        )}
        {logs.map((entry, i) => (
          <div key={i} className="py-0.5">
            {entry.type === 'command' && (
              <div className="text-accent/60">
                <span className="mr-1 text-accent/40">&gt;</span>
                {entry.text}
              </div>
            )}
            {entry.type === 'output' && (
              <pre className="whitespace-pre-wrap break-words text-muted/70">
                {entry.text}
              </pre>
            )}
            {entry.type === 'error' && (
              <pre className="whitespace-pre-wrap break-words text-red-400/80">
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
          className="flex items-center gap-2 border-t border-white/5 px-4 py-2"
        >
          <span className="text-accent/50 text-sm select-none font-mono">&gt;</span>
          {activeDataset && (
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/40 shrink-0">
              {activeDataset.filename}
            </span>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isExecuting ? 'Running...' : 'Enter command...'}
            disabled={isExecuting}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/20 focus:outline-none disabled:opacity-50 font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={isExecuting || !value.trim()}
            className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-muted/60 transition hover:border-accent/40 hover:text-foreground disabled:opacity-30"
          >
            {isExecuting ? (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 animate-spin rounded-full border border-muted/30 border-t-accent/60" />
                Running
              </span>
            ) : (
              'Run'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
