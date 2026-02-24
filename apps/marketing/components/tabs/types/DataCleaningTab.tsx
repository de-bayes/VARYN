'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolTab = 'fill' | 'outliers' | 'recode' | 'bin';
type FillStrategy = 'mean' | 'median' | 'mode' | 'constant' | 'forward' | 'drop';
type OutlierMethod = 'iqr-1.5' | 'iqr-3' | 'zscore-2' | 'zscore-2.5' | 'zscore-3';
type OutlierAction = 'flag' | 'cap' | 'remove';
type BinMode = 'equal-width' | 'custom';

interface CleaningOp {
  id: string;
  type: 'fill' | 'outlier' | 'recode' | 'bin';
  column: string;
  description: string;
  params: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _opId = 0;
function nextOpId(): string { return `op-${++_opId}-${Date.now()}`; }

function getNumericValues(rows: Record<string, string>[], col: string): number[] {
  return rows.map((r) => parseFloat((r[col] ?? '').replace(/,/g, ''))).filter((v) => !isNaN(v));
}

function detectOutlierIndices(rows: Record<string, string>[], col: string, method: OutlierMethod): Set<number> {
  const indices = new Set<number>();
  const vals = rows.map((r, i) => ({ v: parseFloat((r[col] ?? '').replace(/,/g, '')), i })).filter((x) => !isNaN(x.v));
  if (vals.length < 4) return indices;

  if (method.startsWith('iqr')) {
    const sorted = vals.map((x) => x.v).sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const mult = method === 'iqr-3' ? 3 : 1.5;
    const lo = q1 - mult * iqr, hi = q3 + mult * iqr;
    for (const { v, i } of vals) {
      if (v < lo || v > hi) indices.add(i);
    }
  } else {
    const mean = vals.reduce((s, x) => s + x.v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, x) => s + (x.v - mean) ** 2, 0) / vals.length);
    const threshold = method === 'zscore-2' ? 2 : method === 'zscore-2.5' ? 2.5 : 3;
    if (sd > 0) {
      for (const { v, i } of vals) {
        if (Math.abs((v - mean) / sd) > threshold) indices.add(i);
      }
    }
  }
  return indices;
}

function applyOperations(
  columns: string[],
  rows: Record<string, string>[],
  ops: CleaningOp[],
): { columns: string[]; rows: Record<string, string>[] } {
  let cols = [...columns];
  let data = rows.map((r) => ({ ...r }));

  for (const op of ops) {
    if (op.type === 'fill') {
      const { strategy, constant } = op.params as { strategy: FillStrategy; constant: string };
      const col = op.column;
      if (strategy === 'drop') {
        data = data.filter((r) => (r[col] ?? '').trim() !== '');
      } else {
        const vals = getNumericValues(data, col);
        let fillVal = '';
        if (strategy === 'mean' && vals.length > 0) fillVal = String(vals.reduce((a, b) => a + b, 0) / vals.length);
        else if (strategy === 'median' && vals.length > 0) {
          const sorted = [...vals].sort((a, b) => a - b);
          fillVal = String(sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)]);
        } else if (strategy === 'mode') {
          const freq: Record<string, number> = {};
          data.forEach((r) => { const v = (r[col] ?? '').trim(); if (v) freq[v] = (freq[v] || 0) + 1; });
          fillVal = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        } else if (strategy === 'constant') fillVal = constant;

        for (let i = 0; i < data.length; i++) {
          if ((data[i][col] ?? '').trim() === '') {
            if (strategy === 'forward') {
              data[i][col] = i > 0 ? (data[i - 1][col] ?? '') : '';
            } else {
              data[i][col] = fillVal;
            }
          }
        }
      }
    }

    if (op.type === 'outlier') {
      const { method, action } = op.params as { method: OutlierMethod; action: OutlierAction };
      const col = op.column;
      const outliers = detectOutlierIndices(data, col, method);
      if (action === 'remove') {
        data = data.filter((_, i) => !outliers.has(i));
      } else if (action === 'flag') {
        const flagCol = `${col}_outlier`;
        if (!cols.includes(flagCol)) cols.push(flagCol);
        data.forEach((r, i) => { r[flagCol] = outliers.has(i) ? 'TRUE' : 'FALSE'; });
      } else if (action === 'cap') {
        const vals = getNumericValues(data, col);
        const sorted = [...vals].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
        for (let i = 0; i < data.length; i++) {
          const v = parseFloat((data[i][col] ?? '').replace(/,/g, ''));
          if (!isNaN(v)) {
            if (v < lo) data[i][col] = String(lo);
            else if (v > hi) data[i][col] = String(hi);
          }
        }
      }
    }

    if (op.type === 'recode') {
      const { mappings } = op.params as { mappings: { from: string; to: string }[] };
      const col = op.column;
      const newCol = `${col}_recoded`;
      if (!cols.includes(newCol)) cols.push(newCol);
      const map = new Map(mappings.map((m) => [m.from.trim(), m.to]));
      data.forEach((r) => {
        const v = (r[col] ?? '').trim();
        r[newCol] = map.has(v) ? map.get(v)! : v;
      });
    }

    if (op.type === 'bin') {
      const { mode, binCount, breakpoints } = op.params as { mode: BinMode; binCount: number; breakpoints: string };
      const col = op.column;
      const newCol = `${col}_binned`;
      if (!cols.includes(newCol)) cols.push(newCol);
      const vals = getNumericValues(data, col);
      if (vals.length > 0) {
        const min = Math.min(...vals), max = Math.max(...vals);
        let breaks: number[];
        if (mode === 'custom') {
          breaks = breakpoints.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)).sort((a, b) => a - b);
        } else {
          breaks = [];
          const step = (max - min) / binCount;
          for (let i = 1; i < binCount; i++) breaks.push(min + step * i);
        }
        const allBreaks = [min - 1, ...breaks, max + 1];
        data.forEach((r) => {
          const v = parseFloat((r[col] ?? '').replace(/,/g, ''));
          if (isNaN(v)) { r[newCol] = ''; return; }
          for (let b = 0; b < allBreaks.length - 1; b++) {
            if (v >= allBreaks[b] && v < allBreaks[b + 1]) {
              r[newCol] = `${allBreaks[b].toFixed(1)}-${allBreaks[b + 1].toFixed(1)}`;
              break;
            }
          }
        });
      }
    }
  }

  return { columns: cols, rows: data };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataCleaningTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { data, setTabData } = useSpreadsheetData();
  const { tabs } = useTabs();

  const friendly = features.terminology === 'friendly';

  // Find source spreadsheet data
  const sourceEntry = useMemo(() => {
    const spreadsheetTabs = tabs.filter((t) => t.type === 'spreadsheet');
    for (const st of spreadsheetTabs) {
      const d = data[st.id];
      if (d && d.columns.length > 0 && d.rows.length > 0) return { tabId: st.id, data: d };
    }
    return null;
  }, [tabs, data]);

  const workingData = useMemo(() => {
    if (!sourceEntry) return { columns: [] as string[], rows: [] as Record<string, string>[] };
    return { columns: [...sourceEntry.data.columns], rows: sourceEntry.data.rows.map((r) => ({ ...r })) };
  }, [sourceEntry]);

  const { columns, rows } = workingData;

  // State
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>('fill');
  const [queue, setQueue] = useState<CleaningOp[]>([]);
  const [fillColumn, setFillColumn] = useState('');
  const [fillStrategy, setFillStrategy] = useState<FillStrategy>('mean');
  const [fillConstant, setFillConstant] = useState('');
  const [outlierColumn, setOutlierColumn] = useState('');
  const [outlierMethod, setOutlierMethod] = useState<OutlierMethod>('iqr-1.5');
  const [outlierAction, setOutlierAction] = useState<OutlierAction>('flag');
  const [recodeColumn, setRecodeColumn] = useState('');
  const [recodeMappings, setRecodeMappings] = useState<{ from: string; to: string }[]>([{ from: '', to: '' }]);
  const [binColumn, setBinColumn] = useState('');
  const [binMode, setBinMode] = useState<BinMode>('equal-width');
  const [binCount, setBinCount] = useState(5);
  const [binBreakpoints, setBinBreakpoints] = useState('');

  // Derived
  const numericCols = useMemo(() => columns.filter((col) => getNumericValues(rows, col).length > rows.length * 0.5), [columns, rows]);

  const missingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const col of columns) counts[col] = rows.filter((r) => (r[col] ?? '').trim() === '').length;
    return counts;
  }, [columns, rows]);

  const fillAffectedCount = useMemo(() => fillColumn ? missingCounts[fillColumn] ?? 0 : 0, [fillColumn, missingCounts]);
  const outlierIndices = useMemo(() => outlierColumn ? detectOutlierIndices(rows, outlierColumn, outlierMethod) : new Set<number>(), [rows, outlierColumn, outlierMethod]);

  // Handlers
  const addToQueue = useCallback((op: Omit<CleaningOp, 'id'>) => {
    setQueue((prev) => [...prev, { ...op, id: nextOpId() }]);
  }, []);

  const handleAddFill = useCallback(() => {
    if (!fillColumn) return;
    const labels: Record<FillStrategy, string> = {
      mean: friendly ? 'Fill with average' : 'Impute mean',
      median: friendly ? 'Fill with middle value' : 'Impute median',
      mode: friendly ? 'Fill with most common' : 'Impute mode',
      constant: `Fill with "${fillConstant}"`,
      forward: friendly ? 'Copy from row above' : 'Forward fill',
      drop: friendly ? 'Remove incomplete rows' : 'Drop rows with missing',
    };
    addToQueue({ type: 'fill', column: fillColumn, description: labels[fillStrategy], params: { strategy: fillStrategy, constant: fillConstant } });
  }, [fillColumn, fillStrategy, fillConstant, friendly, addToQueue]);

  const handleAddOutlier = useCallback(() => {
    if (!outlierColumn) return;
    const labels: Record<OutlierAction, string> = {
      flag: friendly ? 'Mark unusual values' : 'Flag outliers',
      cap: friendly ? 'Limit extreme values' : 'Winsorize',
      remove: friendly ? 'Remove unusual rows' : 'Remove outlier rows',
    };
    addToQueue({ type: 'outlier', column: outlierColumn, description: `${labels[outlierAction]} (${outlierMethod.toUpperCase()})`, params: { method: outlierMethod, action: outlierAction } });
  }, [outlierColumn, outlierMethod, outlierAction, friendly, addToQueue]);

  const handleAddRecode = useCallback(() => {
    if (!recodeColumn) return;
    const valid = recodeMappings.filter((m) => m.from.trim() !== '');
    if (valid.length === 0) return;
    addToQueue({ type: 'recode', column: recodeColumn, description: `${valid.length} value${valid.length !== 1 ? 's' : ''} remapped`, params: { mappings: valid } });
    setRecodeMappings([{ from: '', to: '' }]);
  }, [recodeColumn, recodeMappings, addToQueue]);

  const handleAddBin = useCallback(() => {
    if (!binColumn) return;
    const desc = binMode === 'equal-width'
      ? `${binCount} ${friendly ? 'groups' : 'bins'} (equal width)`
      : `Custom ${friendly ? 'groups' : 'bins'}: ${binBreakpoints}`;
    addToQueue({ type: 'bin', column: binColumn, description: desc, params: { mode: binMode, binCount, breakpoints: binBreakpoints } });
  }, [binColumn, binMode, binCount, binBreakpoints, friendly, addToQueue]);

  const handleApplyAll = useCallback(() => {
    if (queue.length === 0 || !sourceEntry) return;
    const result = applyOperations(workingData.columns, workingData.rows, queue);
    setTabData(sourceEntry.tabId, result.columns, result.rows);
    setQueue([]);
  }, [queue, sourceEntry, workingData, setTabData]);

  const previewRows = useMemo(() => rows.slice(0, 100), [rows]);

  // Empty state
  if (!sourceEntry || columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-white/50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-white/70">No Data Available</div>
          <div className="text-sm">{friendly ? 'Open a spreadsheet first to start cleaning your data.' : 'No spreadsheet data available. Import a dataset to begin.'}</div>
        </div>
      </div>
    );
  }

  const toolLabels: Record<ToolTab, string> = {
    fill: friendly ? 'Fill Gaps' : 'Fill Missing',
    outliers: friendly ? 'Unusual Values' : 'Outliers',
    recode: friendly ? 'Change Values' : 'Recode',
    bin: friendly ? 'Group Numbers' : 'Bin',
  };

  const badgeColors: Record<CleaningOp['type'], string> = { fill: '#6366f1', outlier: '#f59e0b', recode: '#8b5cf6', bin: '#10b981' };

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0d0f] text-white/90">
      {/* Left: Data Preview */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ width: '60%' }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <span className="text-sm font-medium text-white/70">
            {friendly ? 'Data Preview' : 'Data Preview'} — {rows.length} rows, {columns.length} columns
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#111113]">
                <th className="px-2 py-1.5 text-left text-white/40 font-medium border-b border-white/[0.06] w-10">#</th>
                {columns.map((col) => (
                  <th key={col} className="px-2 py-1.5 text-left text-white/60 font-medium border-b border-white/[0.06] whitespace-nowrap">
                    {col}
                    {missingCounts[col] > 0 && (
                      <span className="ml-1 text-[9px] text-amber-400/70">({missingCounts[col]})</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, ri) => {
                const isOutlier = outlierColumn && outlierIndices.has(ri);
                return (
                  <tr key={ri} className={`border-b border-white/[0.02] ${isOutlier ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'}`}>
                    <td className="px-2 py-1 text-white/20 font-mono">{ri + 1}</td>
                    {columns.map((col) => {
                      const val = row[col] ?? '';
                      const isMissing = val.trim() === '';
                      const isThisOutlier = isOutlier && col === outlierColumn;
                      return (
                        <td key={col} className={`px-2 py-1 font-mono whitespace-nowrap ${isMissing ? 'text-white/20 italic' : isThisOutlier ? 'text-amber-300' : 'text-white/70'}`}>
                          {isMissing ? (friendly ? '(empty)' : 'NA') : val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 100 && (
            <div className="px-4 py-2 text-center text-xs text-white/30">Showing first 100 of {rows.length} rows</div>
          )}
        </div>
      </div>

      {/* Right: Cleaning Tools */}
      <div className="flex flex-col overflow-hidden border-l border-white/[0.06] bg-[#111113]" style={{ width: '40%', minWidth: 280 }}>
        {/* Tool tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(['fill', 'outliers', 'recode', 'bin'] as ToolTab[]).map((t) => (
            <button key={t} onClick={() => setActiveToolTab(t)}
              className={`flex-1 px-2 py-2 text-xs font-medium transition ${activeToolTab === t ? 'text-white/90 border-b-2 border-indigo-500' : 'text-white/40 hover:text-white/60'}`}>
              {toolLabels[t]}
            </button>
          ))}
        </div>

        {/* Tool content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Fill Missing */}
          {activeToolTab === 'fill' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Choose a column' : 'Column'}</label>
                <select value={fillColumn} onChange={(e) => setFillColumn(e.target.value)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="">Select...</option>
                  {columns.map((c) => <option key={c} value={c}>{c} {missingCounts[c] > 0 ? `(${missingCounts[c]} ${friendly ? 'empty' : 'missing'})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'How to fill' : 'Strategy'}</label>
                <select value={fillStrategy} onChange={(e) => setFillStrategy(e.target.value as FillStrategy)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="mean">{friendly ? 'Average value' : 'Mean'}</option>
                  <option value="median">{friendly ? 'Middle value' : 'Median'}</option>
                  <option value="mode">{friendly ? 'Most common value' : 'Mode'}</option>
                  <option value="constant">{friendly ? 'A specific value' : 'Constant value'}</option>
                  <option value="forward">{friendly ? 'Copy from row above' : 'Forward fill'}</option>
                  <option value="drop">{friendly ? 'Remove incomplete rows' : 'Drop rows with missing'}</option>
                </select>
              </div>
              {fillStrategy === 'constant' && (
                <input value={fillConstant} onChange={(e) => setFillConstant(e.target.value)} placeholder="Enter value..."
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50" />
              )}
              {fillColumn && (
                <div className="rounded bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                  {fillAffectedCount > 0 ? <><strong className="text-white/70">{fillAffectedCount}</strong> {friendly ? 'empty cells' : 'missing values'} will be {fillStrategy === 'drop' ? 'removed' : 'filled'}.</> : 'No missing values in this column.'}
                </div>
              )}
              <button onClick={handleAddFill} disabled={!fillColumn || fillAffectedCount === 0}
                className={`w-full rounded-md px-3 py-1.5 text-sm font-medium transition ${fillColumn && fillAffectedCount > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white/[0.04] text-white/20 cursor-not-allowed'}`}>
                {friendly ? 'Add to List' : 'Add to Queue'}
              </button>
            </div>
          )}

          {/* Outliers */}
          {activeToolTab === 'outliers' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Choose a number column' : 'Numeric column'}</label>
                <select value={outlierColumn} onChange={(e) => setOutlierColumn(e.target.value)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="">Select...</option>
                  {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Detection method' : 'Method'}</label>
                <select value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value as OutlierMethod)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="iqr-1.5">{friendly ? 'Standard range (IQR x1.5)' : 'IQR x1.5'}</option>
                  <option value="iqr-3">{friendly ? 'Wide range (IQR x3)' : 'IQR x3'}</option>
                  <option value="zscore-2">{friendly ? 'Somewhat unusual (Z > 2)' : 'Z-score > 2'}</option>
                  <option value="zscore-2.5">{friendly ? 'Quite unusual (Z > 2.5)' : 'Z-score > 2.5'}</option>
                  <option value="zscore-3">{friendly ? 'Very unusual (Z > 3)' : 'Z-score > 3'}</option>
                </select>
              </div>
              {outlierColumn && (
                <div className="rounded bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                  <strong className="text-white/70">{outlierIndices.size}</strong> {friendly ? 'unusual values' : 'outliers'} detected
                  {outlierIndices.size > 0 && ` (${((outlierIndices.size / rows.length) * 100).toFixed(1)}%)`}.
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'What to do' : 'Action'}</label>
                <select value={outlierAction} onChange={(e) => setOutlierAction(e.target.value as OutlierAction)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="flag">{friendly ? 'Mark them (add a column)' : 'Flag (add boolean column)'}</option>
                  <option value="cap">{friendly ? 'Limit to normal range' : 'Cap / Winsorize'}</option>
                  <option value="remove">{friendly ? 'Remove those rows' : 'Remove rows'}</option>
                </select>
              </div>
              <button onClick={handleAddOutlier} disabled={!outlierColumn || outlierIndices.size === 0}
                className={`w-full rounded-md px-3 py-1.5 text-sm font-medium transition ${outlierColumn && outlierIndices.size > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white/[0.04] text-white/20 cursor-not-allowed'}`}>
                {friendly ? 'Add to List' : 'Add to Queue'}
              </button>
            </div>
          )}

          {/* Recode */}
          {activeToolTab === 'recode' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Choose a column' : 'Column'}</label>
                <select value={recodeColumn} onChange={(e) => setRecodeColumn(e.target.value)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="">Select...</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="block text-xs font-medium text-white/50">{friendly ? 'Change values' : 'Value mappings'}</label>
              {recodeMappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={m.from} placeholder={friendly ? 'Old value' : 'From'}
                    onChange={(e) => { const u = [...recodeMappings]; u[i] = { ...u[i], from: e.target.value }; setRecodeMappings(u); }}
                    className="flex-1 rounded border border-white/[0.08] bg-[#0d0d0f] px-2 py-1 text-xs text-white/80 outline-none" />
                  <span className="text-white/30">{'\u2192'}</span>
                  <input value={m.to} placeholder={friendly ? 'New value' : 'To'}
                    onChange={(e) => { const u = [...recodeMappings]; u[i] = { ...u[i], to: e.target.value }; setRecodeMappings(u); }}
                    className="flex-1 rounded border border-white/[0.08] bg-[#0d0d0f] px-2 py-1 text-xs text-white/80 outline-none" />
                  {recodeMappings.length > 1 && (
                    <button onClick={() => setRecodeMappings((prev) => prev.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 text-sm">{'\u00d7'}</button>
                  )}
                </div>
              ))}
              <button onClick={() => setRecodeMappings((prev) => [...prev, { from: '', to: '' }])}
                className="text-xs text-indigo-400 hover:text-indigo-300">+ {friendly ? 'Add another' : 'Add mapping'}</button>
              <button onClick={handleAddRecode} disabled={!recodeColumn || recodeMappings.every((m) => !m.from.trim())}
                className={`w-full rounded-md px-3 py-1.5 text-sm font-medium transition ${recodeColumn && recodeMappings.some((m) => m.from.trim()) ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white/[0.04] text-white/20 cursor-not-allowed'}`}>
                {friendly ? 'Add to List' : 'Add to Queue'}
              </button>
            </div>
          )}

          {/* Bin */}
          {activeToolTab === 'bin' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Choose a number column' : 'Numeric column'}</label>
                <select value={binColumn} onChange={(e) => setBinColumn(e.target.value)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="">Select...</option>
                  {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Grouping method' : 'Binning mode'}</label>
                <select value={binMode} onChange={(e) => setBinMode(e.target.value as BinMode)}
                  className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  <option value="equal-width">{friendly ? 'Equal-sized groups' : 'Equal width'}</option>
                  <option value="custom">Custom breakpoints</option>
                </select>
              </div>
              {binMode === 'equal-width' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/50">{friendly ? 'Number of groups' : 'Number of bins'}</label>
                  <input type="number" value={binCount} min={2} max={50} onChange={(e) => setBinCount(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50" />
                </div>
              )}
              {binMode === 'custom' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/50">Breakpoints (comma separated)</label>
                  <input value={binBreakpoints} onChange={(e) => setBinBreakpoints(e.target.value)} placeholder="e.g. 10, 20, 50, 100"
                    className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50" />
                </div>
              )}
              <button onClick={handleAddBin} disabled={!binColumn}
                className={`w-full rounded-md px-3 py-1.5 text-sm font-medium transition ${binColumn ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white/[0.04] text-white/20 cursor-not-allowed'}`}>
                {friendly ? 'Add to List' : 'Add to Queue'}
              </button>
            </div>
          )}
        </div>

        {/* Queue */}
        <div className="border-t border-white/[0.06] bg-[#0d0d0f]">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold text-white/50">
              {friendly ? 'Pending Changes' : 'Operations Queue'} ({queue.length})
            </span>
            {queue.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => setQueue([])} className="px-2 py-0.5 text-xs text-red-400/70 hover:text-red-400">Clear</button>
                <button onClick={handleApplyAll} className="rounded bg-indigo-600 px-3 py-0.5 text-xs text-white hover:bg-indigo-500">
                  {friendly ? 'Apply All Changes' : 'Apply All'}
                </button>
              </div>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs text-white/20">
                {friendly ? 'No changes queued yet.' : 'Queue is empty.'}
              </div>
            ) : (
              queue.map((op) => (
                <div key={op.id} className="flex items-center gap-2 border-t border-white/[0.03] px-4 py-1.5 text-xs">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: badgeColors[op.type] + '30', color: badgeColors[op.type] }}>{op.type}</span>
                  <span className="font-medium text-indigo-300">{op.column}</span>
                  <span className="flex-1 truncate text-white/40">{op.description}</span>
                  <button onClick={() => setQueue((prev) => prev.filter((o) => o.id !== op.id))} className="text-white/20 hover:text-white/50">{'\u00d7'}</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
