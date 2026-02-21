'use client';

import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import type { ColumnMeta } from '@varyn/shared';

function friendlyType(type: string): string {
  const map: Record<string, string> = {
    numeric: 'Number',
    integer: 'Number',
    double: 'Number',
    character: 'Text',
    factor: 'Category',
    logical: 'Yes/No',
    Date: 'Date',
  };
  return map[type] ?? type;
}

export function VariablesPanel() {
  const { activeDataset } = useWorkspace();
  const { features } = useSkillLevel();

  const isFriendly = features.terminology === 'friendly';

  if (!activeDataset) {
    return (
      <aside className="flex h-full items-center justify-center bg-panel text-xs text-muted/40 p-4">
        <p className="text-center">
          {isFriendly
            ? 'Upload a file to see your columns here'
            : 'Upload a dataset to see variables here'}
        </p>
      </aside>
    );
  }

  const columns = activeDataset.columns ?? [];

  return (
    <aside className="h-full overflow-y-auto bg-panel text-sm">
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[11px] tracking-[0.14em] text-muted/70 uppercase">
          {isFriendly ? 'Columns' : 'Variables'}
        </p>
        <p className="mt-1 text-xs text-foreground">{activeDataset.filename}</p>
        {activeDataset.rowCount != null && (
          <p className="text-[10px] text-muted/50">
            {activeDataset.rowCount.toLocaleString()} rows
          </p>
        )}
      </div>
      {columns.length === 0 ? (
        <div className="px-4 py-3 text-[10px] text-muted/40">
          {isFriendly ? 'Column info not yet available' : 'Column metadata not yet available'}
        </div>
      ) : (
        <div className="px-2 py-2 space-y-0.5">
          {columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-white/[0.03]"
            >
              <span className="text-foreground/90">{col.name}</span>
              <div className="flex items-center gap-2">
                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/60">
                  {isFriendly ? friendlyType(col.type) : col.type}
                </span>
                {col.missing > 0 && (
                  <span className="text-[10px] text-muted/40">
                    {col.missing} {isFriendly ? 'empty' : 'NA'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
