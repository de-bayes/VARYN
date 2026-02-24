'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DisplayMode = 'counts' | 'rowPct' | 'colPct' | 'totalPct';
type AggFunction = 'count' | 'sum' | 'mean' | 'min' | 'max' | 'median';

interface CrossTabResult {
  rowLabels: string[];
  colLabels: string[];
  matrix: number[][];
  displayMatrix: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
  maxVal: number;
  chiSquare: { statistic: number; df: number; pValue: number; cramersV: number } | null;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function gammaLn(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function lowerGamma(s: number, x: number): number {
  if (x < 0) return 0;
  let sum = 0, term = 1 / s;
  for (let n = 1; n < 200; n++) {
    term *= x / (s + n);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  return (1 / s + sum) * Math.exp(-x + s * Math.log(x) - gammaLn(s));
}

function chiSquarePValue(x: number, df: number): number {
  if (x <= 0) return 1;
  return 1 - lowerGamma(df / 2, x / 2) / Math.exp(gammaLn(df / 2));
}

function medianArr(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fmt(v: number, decimals = 3): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e6) return v.toLocaleString();
  return v.toFixed(decimals);
}

function fmtPct(v: number): string {
  return v.toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CrossTabTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { data: sharedData } = useSpreadsheetData();
  const { tabs } = useTabs();
  const terminology = features.terminology ?? 'friendly';

  // Find source data
  const sourceTabId = useMemo(() =>
    tabs.find((t) => t.type === 'spreadsheet' && sharedData[t.id]?.columns.length > 0)?.id ?? '',
    [tabs, sharedData]);

  const tabData = useMemo(() => {
    if (!sourceTabId) return { columns: [] as string[], rows: [] as Record<string, string>[] };
    const d = sharedData[sourceTabId];
    return d ? { columns: d.columns, rows: d.rows } : { columns: [] as string[], rows: [] as Record<string, string>[] };
  }, [sourceTabId, sharedData]);

  const categoricalCols = useMemo(() =>
    tabData.columns.filter((col) => {
      const unique = new Set(tabData.rows.map((r) => r[col]).filter(Boolean));
      return unique.size >= 2 && unique.size <= 30;
    }),
    [tabData]);

  const numericCols = useMemo(() =>
    tabData.columns.filter((col) => {
      const vals = tabData.rows.slice(0, 50).map((r) => Number(r[col]));
      return vals.filter((v) => !isNaN(v)).length > vals.length * 0.7;
    }),
    [tabData]);

  // State
  const [rowVariable, setRowVariable] = useState<string>('');
  const [colVariable, setColVariable] = useState<string>('');
  const [valueVariable, setValueVariable] = useState<string>('');
  const [aggFunction, setAggFunction] = useState<AggFunction>('count');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('counts');

  // Compute cross-tab
  const crossTabResult = useMemo<CrossTabResult | null>(() => {
    if (!rowVariable || !colVariable) return null;
    const rowLabels = [...new Set(tabData.rows.map((r) => r[rowVariable]).filter(Boolean))].sort();
    const colLabels = [...new Set(tabData.rows.map((r) => r[colVariable]).filter(Boolean))].sort();
    if (rowLabels.length === 0 || colLabels.length === 0) return null;

    const rowIdx: Record<string, number> = {};
    rowLabels.forEach((v, i) => (rowIdx[v] = i));
    const colIdx: Record<string, number> = {};
    colLabels.forEach((v, i) => (colIdx[v] = i));

    // Build aggregation cell data
    const cellData: number[][][] = rowLabels.map(() => colLabels.map(() => []));
    for (const row of tabData.rows) {
      const ri = rowIdx[row[rowVariable]];
      const ci = colIdx[row[colVariable]];
      if (ri === undefined || ci === undefined) continue;
      const val = valueVariable ? Number(row[valueVariable]) : 1;
      if (!isNaN(val)) cellData[ri][ci].push(val);
    }

    // Aggregate
    function agg(arr: number[]): number {
      if (arr.length === 0) return 0;
      switch (aggFunction) {
        case 'count': return arr.length;
        case 'sum': return arr.reduce((a, b) => a + b, 0);
        case 'mean': return arr.reduce((a, b) => a + b, 0) / arr.length;
        case 'min': return Math.min(...arr);
        case 'max': return Math.max(...arr);
        case 'median': return medianArr(arr);
      }
    }

    const matrix = cellData.map((row) => row.map((cell) => agg(cell)));
    const rowTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
    const colTotals = colLabels.map((_, ci) => matrix.reduce((a, row) => a + row[ci], 0));
    const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

    // Display matrix based on mode
    let displayMatrix: number[][];
    switch (displayMode) {
      case 'rowPct':
        displayMatrix = matrix.map((row, ri) => row.map((v) => rowTotals[ri] > 0 ? (v / rowTotals[ri]) * 100 : 0));
        break;
      case 'colPct':
        displayMatrix = matrix.map((row) => row.map((v, ci) => colTotals[ci] > 0 ? (v / colTotals[ci]) * 100 : 0));
        break;
      case 'totalPct':
        displayMatrix = matrix.map((row) => row.map((v) => grandTotal > 0 ? (v / grandTotal) * 100 : 0));
        break;
      default:
        displayMatrix = matrix;
    }

    // Chi-square (only for counts)
    let chiSquare: CrossTabResult['chiSquare'] = null;
    if (aggFunction === 'count' && grandTotal > 0) {
      let chi2 = 0;
      for (let i = 0; i < rowLabels.length; i++) {
        for (let j = 0; j < colLabels.length; j++) {
          const expected = (rowTotals[i] * colTotals[j]) / grandTotal;
          if (expected > 0) chi2 += (matrix[i][j] - expected) ** 2 / expected;
        }
      }
      const df = (rowLabels.length - 1) * (colLabels.length - 1);
      const pValue = chiSquarePValue(chi2, df);
      const k = Math.min(rowLabels.length, colLabels.length);
      const cramersV = Math.sqrt(chi2 / (grandTotal * (k - 1)));
      chiSquare = { statistic: chi2, df, pValue, cramersV };
    }

    return {
      rowLabels, colLabels, matrix, displayMatrix,
      rowTotals, colTotals, grandTotal,
      maxVal: Math.max(...matrix.flat(), 1),
      chiSquare,
    };
  }, [rowVariable, colVariable, valueVariable, aggFunction, displayMode, tabData]);

  function heatmapColor(intensity: number): string {
    const alpha = Math.max(0, Math.min(0.25, intensity * 0.25));
    return `rgba(99, 102, 241, ${alpha})`;
  }

  if (tabData.columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-white/30">
        Open a spreadsheet with data to create cross-tabulations.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0d0f]">
      {/* Results (left 70%) */}
      <div className="flex-[7] overflow-auto p-6">
        <h2 className="text-sm font-semibold text-white/90">
          {terminology === 'friendly' ? 'Cross-Tabulation' : 'Contingency Table'}
        </h2>
        {rowVariable && colVariable && (
          <p className="mt-1 text-xs text-white/40">
            {rowVariable} &times; {colVariable}
            {valueVariable ? ` (${aggFunction} of ${valueVariable})` : ''}
          </p>
        )}

        {!crossTabResult ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-white/30 italic">Select row and column variables to begin.</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Table */}
            <div className="overflow-auto rounded-lg border border-white/[0.06]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/40 bg-white/[0.02] border-b border-r border-white/[0.06] sticky left-0 z-10">
                      {rowVariable} \ {colVariable}
                    </th>
                    {crossTabResult.colLabels.map((cl) => (
                      <th key={cl} className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-white/50 bg-white/[0.02] border-b border-white/[0.06] whitespace-nowrap">
                        {cl}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-indigo-400/60 bg-white/[0.02] border-b border-l border-white/[0.06]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {crossTabResult.rowLabels.map((rl, ri) => (
                    <tr key={rl} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-1.5 text-xs font-medium text-white/70 bg-white/[0.02] border-b border-r border-white/[0.06] sticky left-0 z-10 whitespace-nowrap">
                        {rl}
                      </td>
                      {crossTabResult.displayMatrix[ri].map((val, ci) => {
                        const rawVal = crossTabResult.matrix[ri][ci];
                        const intensity = crossTabResult.maxVal > 0 ? rawVal / crossTabResult.maxVal : 0;
                        return (
                          <td key={ci} className="px-3 py-1.5 text-xs text-center text-white/80 border-b border-white/[0.06] tabular-nums"
                            style={{ backgroundColor: heatmapColor(intensity) }}>
                            {displayMode === 'counts' ? fmt(val, 2) : fmtPct(val)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-xs text-center font-medium text-indigo-300/70 border-b border-l border-white/[0.06] bg-white/[0.02] tabular-nums">
                        {displayMode === 'counts' ? fmt(crossTabResult.rowTotals[ri], 2) : fmtPct(displayMode === 'rowPct' ? 100 : (crossTabResult.grandTotal > 0 ? (crossTabResult.rowTotals[ri] / crossTabResult.grandTotal) * 100 : 0))}
                      </td>
                    </tr>
                  ))}
                  {/* Column totals */}
                  <tr className="bg-white/[0.02]">
                    <td className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-indigo-400/60 border-r border-white/[0.06] sticky left-0 z-10 bg-white/[0.03]">
                      Total
                    </td>
                    {crossTabResult.colTotals.map((ct, ci) => (
                      <td key={ci} className="px-3 py-2 text-xs text-center font-medium text-indigo-300/70 border-white/[0.06] tabular-nums">
                        {displayMode === 'counts' ? fmt(ct, 2) : fmtPct(displayMode === 'colPct' ? 100 : (crossTabResult.grandTotal > 0 ? (ct / crossTabResult.grandTotal) * 100 : 0))}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs text-center font-bold text-indigo-300/90 border-l border-white/[0.06] tabular-nums">
                      {fmt(crossTabResult.grandTotal, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 text-[10px] text-white/30">
              <span>{crossTabResult.rowLabels.length} rows &times; {crossTabResult.colLabels.length} columns</span>
              <span className="text-white/10">|</span>
              <span>Total: {fmt(crossTabResult.grandTotal, 0)}</span>
            </div>

            {/* Chi-Square */}
            {crossTabResult.chiSquare && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-3">
                  Chi-Square Test
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-white/30">Statistic</div>
                    <div className="text-sm font-mono text-white/80 tabular-nums">&chi;&sup2; = {fmt(crossTabResult.chiSquare.statistic)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30">df</div>
                    <div className="text-sm font-mono text-white/80 tabular-nums">{crossTabResult.chiSquare.df}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30">p-value</div>
                    <div className={`text-sm font-mono tabular-nums ${crossTabResult.chiSquare.pValue < 0.05 ? 'text-emerald-400' : 'text-white/80'}`}>
                      {crossTabResult.chiSquare.pValue < 0.001 ? '< 0.001' : fmt(crossTabResult.chiSquare.pValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30">Cramer&apos;s V</div>
                    <div className="text-sm font-mono text-white/80 tabular-nums">{fmt(crossTabResult.chiSquare.cramersV, 4)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${crossTabResult.chiSquare.pValue < 0.05 ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  <span className="text-xs text-white/50">
                    {crossTabResult.chiSquare.pValue < 0.05 ? 'Significant' : 'Not significant'} at &alpha; = 0.05
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Config (right 30%) */}
      <div className="flex-[3] overflow-auto border-l border-white/5 bg-[#111113] p-4 space-y-6">
        <div className="pb-3 border-b border-white/[0.06]">
          <h3 className="text-xs font-semibold text-white/70">Configuration</h3>
        </div>

        {/* Row Variable */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">Row Variable</label>
          <select value={rowVariable} onChange={(e) => setRowVariable(e.target.value)}
            className="w-full rounded-md bg-white/[0.05] text-white/80 text-xs border border-white/10 px-3 py-2 focus:border-indigo-500/40 focus:outline-none">
            <option value="" className="bg-[#111113]">Select...</option>
            {categoricalCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
          </select>
        </div>

        {/* Column Variable */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">Column Variable</label>
          <select value={colVariable} onChange={(e) => setColVariable(e.target.value)}
            className="w-full rounded-md bg-white/[0.05] text-white/80 text-xs border border-white/10 px-3 py-2 focus:border-indigo-500/40 focus:outline-none">
            <option value="" className="bg-[#111113]">Select...</option>
            {categoricalCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
          </select>
        </div>

        {/* Value Variable */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">Value Variable</label>
          <select value={valueVariable} onChange={(e) => setValueVariable(e.target.value)}
            className="w-full rounded-md bg-white/[0.05] text-white/80 text-xs border border-white/10 px-3 py-2 focus:border-indigo-500/40 focus:outline-none">
            <option value="" className="bg-[#111113]">None (count)</option>
            {numericCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
          </select>
        </div>

        {/* Aggregation */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">Aggregation</label>
          <div className="grid grid-cols-3 gap-1">
            {(['count', 'sum', 'mean', 'min', 'max', 'median'] as AggFunction[]).map((fn) => (
              <button key={fn} onClick={() => setAggFunction(fn)}
                disabled={fn !== 'count' && !valueVariable}
                className={`px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                  aggFunction === fn
                    ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : fn !== 'count' && !valueVariable
                      ? 'bg-white/[0.02] text-white/15 cursor-not-allowed'
                      : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.06]'
                }`}>
                {fn}
              </button>
            ))}
          </div>
        </div>

        {/* Display Mode */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">Display</label>
          <div className="grid grid-cols-2 gap-1">
            {([
              { key: 'counts', label: 'Counts' },
              { key: 'rowPct', label: 'Row %' },
              { key: 'colPct', label: 'Col %' },
              { key: 'totalPct', label: 'Total %' },
            ] as { key: DisplayMode; label: string }[]).map((btn) => (
              <button key={btn.key} onClick={() => setDisplayMode(btn.key)}
                className={`px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                  displayMode === btn.key
                    ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.06]'
                }`}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
