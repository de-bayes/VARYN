'use client';

interface LogPanelProps {
  logs: string | null;
  status?: 'success' | 'error';
  durationMs?: number;
}

export function LogPanel({ logs, status, durationMs }: LogPanelProps) {
  if (!logs) return null;

  const isError = status === 'error';

  return (
    <div
      className={`border-t px-4 py-2 text-xs font-mono overflow-y-auto max-h-48 ${
        isError ? 'border-red-500/30 bg-red-950/20' : 'border-white/5 bg-panel'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] uppercase tracking-wider ${isError ? 'text-red-400' : 'text-muted/50'}`}>
          Console
        </span>
        {durationMs != null && (
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/50">
            {durationMs}ms
          </span>
        )}
      </div>
      <pre className={`whitespace-pre-wrap break-words ${isError ? 'text-red-300' : 'text-muted/70'}`}>
        {logs}
      </pre>
    </div>
  );
}
