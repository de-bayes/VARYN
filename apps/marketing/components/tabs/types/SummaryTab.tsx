'use client';

import { useMemo } from 'react';
import { useSpreadsheetData, type ColumnStats } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import type { TabComponentProps } from '../tab-registry';

function fmt(n: number | undefined): string {
  if (n === undefined) return '\u2013';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function MiniHistogram({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const w = 120;
  const h = 32;
  const barW = w / values.length;
  return (
    <svg width={w} height={h} className="shrink-0">
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * barW}
          y={h - (v / max) * (h - 2)}
          width={barW * 0.85}
          height={(v / max) * (h - 2)}
          fill={color}
          opacity={0.7}
          rx={1}
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
  const bins = 15;
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[idx]++;
  }
  return counts;
}

function computeFreqBars(rows: Record<string, string>[], col: string): { value: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const r of rows) {
    const v = r[col] ?? '';
    if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count }));
}

function CorrelationMatrix({ stats, rows }: { stats: ColumnStats[]; rows: Record<string, string>[] }) {
  const numericCols = stats.filter((s) => s.type === 'numeric').slice(0, 8);
  if (numericCols.length < 2) return null;

  const correlations = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const a of numericCols) {
      result[a.name] = {};
      for (const b of numericCols) {
        if (a.name === b.name) {
          result[a.name][b.name] = 1;
          continue;
        }
        const pairs: { x: number; y: number }[] = [];
        for (const row of rows) {
          const x = parseFloat((row[a.name] ?? '').replace(/,/g, ''));
          const y = parseFloat((row[b.name] ?? '').replace(/,/g, ''));
          if (!isNaN(x) && !isNaN(y)) pairs.push({ x, y });
        }
        if (pairs.length < 3) {
          result[a.name][b.name] = 0;
          continue;
        }
        const n = pairs.length;
        const sumX = pairs.reduce((s, p) => s + p.x, 0);
        const sumY = pairs.reduce((s, p) => s + p.y, 0);
        const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
        const sumX2 = pairs.reduce((s, p) => s + p.x ** 2, 0);
        const sumY2 = pairs.reduce((s, p) => s + p.y ** 2, 0);
        const denom = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
        result[a.name][b.name] = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      }
    }
    return result;
  }, [numericCols, rows]);

  function corrColor(r: number): string {
    const abs = Math.abs(r);
    if (r > 0) return `rgba(99, 102, 241, ${abs * 0.6})`;
    return `rgba(239, 68, 68, ${abs * 0.6})`;
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-foreground/80 mb-2">Correlation Matrix</h3>
      <div className="overflow-x-auto">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="px-2 py-1 text-muted/40" />
              {numericCols.map((c) => (
                <th key={c.name} className="px-2 py-1 text-muted/50 font-normal whitespace-nowrap max-w-[60px] truncate">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numericCols.map((row) => (
              <tr key={row.name}>
                <td className="px-2 py-1 text-muted/50 whitespace-nowrap max-w-[60px] truncate">{row.name}</td>
                {numericCols.map((col) => {
                  const r = correlations[row.name]?.[col.name] ?? 0;
                  return (
                    <td
                      key={col.name}
                      className="px-2 py-1 text-center tabular-nums"
                      style={{ backgroundColor: corrColor(r) }}
                    >
                      <span className="text-foreground/80">{r.toFixed(2)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SummaryTab({ tabId }: TabComponentProps) {
  const { data } = useSpreadsheetData();
  const { tabs } = useTabs();
  const { features } = useSkillLevel();

  const isFriendly = features.terminology === 'friendly';

  // Find the most recent spreadsheet tab with data
  const sourceTab = useMemo(() => {
    const spreadsheetTabs = tabs.filter(
      (t) => t.type === 'spreadsheet' && data[t.id]?.columns.length > 0,
    );
    return spreadsheetTabs.length > 0 ? spreadsheetTabs[spreadsheetTabs.length - 1] : null;
  }, [tabs, data]);

  const tabData = sourceTab ? data[sourceTab.id] : undefined;

  if (!tabData || tabData.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-2">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto opacity-20">
            <rect x="6" y="6" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14 20h12M20 14v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm">No data to summarize</p>
          <p className="text-[11px] text-muted/30">Load a dataset first, then open this tab</p>
        </div>
      </div>
    );
  }

  const { columns, rows, columnStats } = tabData;
  const numericStats = columnStats.filter((s) => s.type === 'numeric');
  const textStats = columnStats.filter((s) => s.type === 'text');
  const totalMissing = columnStats.reduce((s, c) => s + c.missingCount, 0);
  const totalCells = rows.length * columns.length;
  const completeness = totalCells > 0 ? ((totalCells - totalMissing) / totalCells) * 100 : 100;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {isFriendly ? 'Data Overview' : 'Dataset Summary'}
          </h2>
          {sourceTab && (
            <p className="text-[11px] text-muted/50 mt-1">{sourceTab.title}</p>
          )}
        </div>

        {/* Quick stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-[10px] text-muted/40 uppercase tracking-wider">{isFriendly ? 'Rows' : 'Observations'}</p>
            <p className="text-lg font-semibold text-foreground tabular-nums mt-1">{rows.length.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-[10px] text-muted/40 uppercase tracking-wider">{isFriendly ? 'Columns' : 'Variables'}</p>
            <p className="text-lg font-semibold text-foreground tabular-nums mt-1">{columns.length}</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-[10px] text-muted/40 uppercase tracking-wider">Completeness</p>
            <p className="text-lg font-semibold text-foreground tabular-nums mt-1">{completeness.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-[10px] text-muted/40 uppercase tracking-wider">Types</p>
            <p className="text-lg font-semibold text-foreground mt-1">
              <span className="text-indigo-400">{numericStats.length}</span>
              <span className="text-muted/30 text-xs mx-1">/</span>
              <span className="text-amber-400">{textStats.length}</span>
            </p>
          </div>
        </div>

        {/* Numeric Variables */}
        {numericStats.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-foreground/80 mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              {isFriendly ? 'Number Columns' : 'Numeric Variables'} ({numericStats.length})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-3 py-2 text-left font-medium text-muted/50">Name</th>
                    <th className="px-3 py-2 text-right font-medium text-muted/50">{isFriendly ? 'Average' : 'Mean'}</th>
                    <th className="px-3 py-2 text-right font-medium text-muted/50">Median</th>
                    <th className="px-3 py-2 text-right font-medium text-muted/50">Min</th>
                    <th className="px-3 py-2 text-right font-medium text-muted/50">Max</th>
                    <th className="px-3 py-2 text-right font-medium text-muted/50">{isFriendly ? 'Spread' : 'Std Dev'}</th>
                    <th className="px-3 py-2 text-right font-medium text-muted/50">{isFriendly ? 'Empty' : 'Missing'}</th>
                    <th className="px-3 py-2 font-medium text-muted/50">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {numericStats.map((col) => (
                    <tr key={col.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-1.5 font-medium text-foreground/80 whitespace-nowrap">{col.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted/70">{fmt(col.mean)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted/70">{fmt(col.median)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted/70">{fmt(col.min)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted/70">{fmt(col.max)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted/70">{fmt(col.stdDev)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted/70">{col.missingCount}</td>
                      <td className="px-3 py-1.5">
                        <MiniHistogram values={computeHistogram(rows, col.name)} color="#6366f1" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Text Variables */}
        {textStats.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-foreground/80 mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {isFriendly ? 'Text Columns' : 'Categorical Variables'} ({textStats.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {textStats.map((col) => {
                const topVals = computeFreqBars(rows, col.name);
                const maxCount = topVals.length > 0 ? topVals[0].count : 1;
                return (
                  <div key={col.name} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground/80">{col.name}</span>
                      <span className="text-[10px] text-muted/40">{col.uniqueCount} unique</span>
                    </div>
                    <div className="space-y-1">
                      {topVals.map((tv) => (
                        <div key={tv.value} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="h-1.5 rounded-full bg-amber-400/15 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-400/50"
                                style={{ width: `${(tv.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-muted/50 truncate max-w-[80px]">{tv.value}</span>
                          <span className="text-[10px] text-muted/30 tabular-nums shrink-0">{tv.count}</span>
                        </div>
                      ))}
                    </div>
                    {col.missingCount > 0 && (
                      <p className="text-[10px] text-muted/30 mt-1.5">
                        {col.missingCount} {isFriendly ? 'empty' : 'missing'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Correlation Matrix (for numeric columns) */}
        {numericStats.length >= 2 && (
          <CorrelationMatrix stats={columnStats} rows={rows} />
        )}
      </div>
    </div>
  );
}
