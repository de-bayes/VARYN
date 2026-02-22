'use client';

import { useState } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData, type ColumnStats } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';

function friendlyType(type: string): string {
  const map: Record<string, string> = {
    numeric: 'Number',
    integer: 'Number',
    double: 'Number',
    character: 'Text',
    text: 'Text',
    factor: 'Category',
    logical: 'Yes/No',
    Date: 'Date',
    date: 'Date',
  };
  return map[type] ?? type;
}

function fmt(n: number | undefined): string {
  if (n === undefined) return '–';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function MiniBar({ values, color = '#6366f1' }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const barW = 100 / values.length;
  return (
    <svg viewBox="0 0 100 20" className="w-full h-4 mt-1" preserveAspectRatio="none">
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * barW}
          y={20 - (v / max) * 18}
          width={barW * 0.8}
          height={(v / max) * 18}
          fill={color}
          opacity={0.7}
          rx={0.5}
        />
      ))}
    </svg>
  );
}

function computeHistogram(rows: Record<string, string>[], col: string): number[] {
  const values = rows
    .map((r) => parseFloat((r[col] ?? '').replace(/,/g, '')))
    .filter((n) => !isNaN(n));
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [values.length];

  const bins = 12;
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[idx]++;
  }
  return counts;
}

function computeFreqBars(rows: Record<string, string>[], col: string): number[] {
  const freq = new Map<string, number>();
  for (const r of rows) {
    const v = r[col] ?? '';
    if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([, count]) => count);
}

export function VariablesPanel() {
  const { activeDataset } = useWorkspace();
  const { features } = useSkillLevel();
  const { data } = useSpreadsheetData();
  const { activeTabId } = useTabs();
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  const isFriendly = features.terminology === 'friendly';

  // Get data from the active spreadsheet tab
  const tabData = data[activeTabId];
  const hasTabData = tabData && tabData.columns.length > 0;

  // If we have tab data, use computed stats; otherwise fall back to API metadata
  const apiColumns = activeDataset?.columns ?? [];

  if (!hasTabData && apiColumns.length === 0) {
    return (
      <aside className="flex h-full items-center justify-center bg-panel text-xs text-muted/40 p-4">
        <p className="text-center">
          {isFriendly
            ? 'Open a dataset to see your columns here'
            : 'Load a dataset to see variables here'}
        </p>
      </aside>
    );
  }

  const stats: ColumnStats[] = hasTabData
    ? tabData.columnStats
    : apiColumns.map((col) => ({
        name: col.name,
        type: col.type === 'character' || col.type === 'factor' ? 'text' as const : 'numeric' as const,
        uniqueCount: 0,
        missingCount: col.missing,
      }));

  const datasetName = hasTabData
    ? undefined // title shown in tab already
    : activeDataset?.filename;

  const rowCount = hasTabData ? tabData.rows.length : activeDataset?.rowCount;

  return (
    <aside className="h-full overflow-y-auto bg-panel text-sm">
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[11px] tracking-[0.14em] text-muted/70 uppercase">
          {isFriendly ? 'Columns' : 'Variables'}
        </p>
        {datasetName && (
          <p className="mt-1 text-xs text-foreground">{datasetName}</p>
        )}
        {rowCount != null && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted/50">
              {rowCount.toLocaleString()} rows
            </span>
            <span className="text-[10px] text-muted/50">
              {stats.length} {isFriendly ? 'columns' : 'variables'}
            </span>
          </div>
        )}
      </div>

      <div className="px-2 py-2 space-y-0.5">
        {stats.map((col) => {
          const isExpanded = expandedCol === col.name;
          const isNumeric = col.type === 'numeric';

          return (
            <div key={col.name}>
              <button
                onClick={() => setExpandedCol(isExpanded ? null : col.name)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-left transition ${
                  isExpanded
                    ? 'bg-white/[0.05] text-foreground'
                    : 'hover:bg-white/[0.03] text-foreground/90'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isNumeric ? 'bg-indigo-400' : 'bg-amber-400'
                  }`} />
                  <span className="truncate">{col.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/60">
                    {isFriendly ? friendlyType(col.type) : col.type}
                  </span>
                  <span className="text-[10px] text-muted/30">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="mx-2 mb-1 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
                  {isNumeric ? (
                    <>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-muted/50">{isFriendly ? 'Average' : 'Mean'}</span>
                          <span className="text-foreground/80 tabular-nums">{fmt(col.mean)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted/50">Median</span>
                          <span className="text-foreground/80 tabular-nums">{fmt(col.median)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted/50">Min</span>
                          <span className="text-foreground/80 tabular-nums">{fmt(col.min)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted/50">Max</span>
                          <span className="text-foreground/80 tabular-nums">{fmt(col.max)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted/50">{isFriendly ? 'Spread' : 'Std Dev'}</span>
                          <span className="text-foreground/80 tabular-nums">{fmt(col.stdDev)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted/50">Unique</span>
                          <span className="text-foreground/80 tabular-nums">{col.uniqueCount}</span>
                        </div>
                      </div>
                      {hasTabData && (
                        <MiniBar
                          values={computeHistogram(tabData.rows, col.name)}
                          color="#6366f1"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-1">
                        <div className="flex justify-between">
                          <span className="text-muted/50">Unique</span>
                          <span className="text-foreground/80 tabular-nums">{col.uniqueCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted/50">{isFriendly ? 'Empty' : 'Missing'}</span>
                          <span className="text-foreground/80 tabular-nums">{col.missingCount}</span>
                        </div>
                      </div>
                      {col.topValues && col.topValues.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {col.topValues.map((tv) => (
                            <div key={tv.value} className="flex items-center gap-2 text-[10px]">
                              <div className="flex-1 min-w-0">
                                <div className="h-1.5 rounded-full bg-amber-400/20 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-amber-400/60"
                                    style={{
                                      width: `${(tv.count / (hasTabData ? tabData.rows.length : 1)) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-muted/60 truncate max-w-[60px]">{tv.value}</span>
                              <span className="text-muted/40 tabular-nums shrink-0">{tv.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasTabData && (
                        <MiniBar
                          values={computeFreqBars(tabData.rows, col.name)}
                          color="#f59e0b"
                        />
                      )}
                    </>
                  )}
                  {col.missingCount > 0 && (
                    <div className="mt-1 text-[10px] text-muted/40">
                      {col.missingCount} {isFriendly ? 'empty values' : 'missing'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
