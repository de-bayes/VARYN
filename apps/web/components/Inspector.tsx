'use client';

interface InspectorProps {
  activeDataset: {
    filename: string;
    rowCount: number | null;
    columns: { name: string; type: string; missing: number }[];
  } | null;
}

export function Inspector({ activeDataset }: InspectorProps) {
  if (!activeDataset) {
    return (
      <aside className="flex h-full items-center justify-center bg-panel text-xs text-muted/40 p-4">
        <p className="text-center">Upload a dataset to see variables here</p>
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto bg-panel text-sm">
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[11px] tracking-[0.14em] text-muted/70 uppercase">Inspector</p>
        <p className="mt-1 text-xs text-foreground">{activeDataset.filename}</p>
        {activeDataset.rowCount && (
          <p className="text-[10px] text-muted/50">{activeDataset.rowCount.toLocaleString()} rows</p>
        )}
      </div>
      <div className="px-2 py-2 space-y-0.5">
        {activeDataset.columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-white/[0.03]"
          >
            <span className="text-foreground/90">{col.name}</span>
            <div className="flex items-center gap-2">
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/60">
                {col.type}
              </span>
              {col.missing > 0 && (
                <span className="text-[10px] text-muted/40">{col.missing} NA</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
