'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JoinType = 'inner' | 'left' | 'right' | 'full';

interface JoinResult {
  columns: string[];
  rows: Record<string, string>[];
  keyColumn: string;
  leftColumns: string[];
  rightColumns: string[];
}

interface DatasetOption {
  tabId: string;
  title: string;
  columns: string[];
  rows: Record<string, string>[];
}

// ---------------------------------------------------------------------------
// Join metadata
// ---------------------------------------------------------------------------

const JOIN_META: Record<JoinType, { label: string; friendly: string; desc: string; techDesc: string }> = {
  inner: {
    label: 'Inner Join',
    friendly: 'Keep only matching rows',
    desc: 'Keeps rows that have matching keys in both datasets.',
    techDesc: 'Returns the intersection of both relations on the join key.',
  },
  left: {
    label: 'Left Join',
    friendly: 'Keep all from left',
    desc: 'Keeps all rows from the left dataset. Fills blanks for non-matching right rows.',
    techDesc: 'Preserves all tuples from the left relation; unmatched right attributes are NULL.',
  },
  right: {
    label: 'Right Join',
    friendly: 'Keep all from right',
    desc: 'Keeps all rows from the right dataset. Fills blanks for non-matching left rows.',
    techDesc: 'Preserves all tuples from the right relation; unmatched left attributes are NULL.',
  },
  full: {
    label: 'Full Outer',
    friendly: 'Keep everything',
    desc: 'Keeps all rows from both datasets. Fills blanks where there is no match.',
    techDesc: 'Returns the union of both relations; unmatched attributes on either side are NULL.',
  },
};

// ---------------------------------------------------------------------------
// Venn diagram SVG
// ---------------------------------------------------------------------------

function VennDiagram({ joinType }: { joinType: JoinType }) {
  const showLeft = joinType === 'left' || joinType === 'full';
  const showRight = joinType === 'right' || joinType === 'full';

  return (
    <svg viewBox="0 0 160 100" className="w-36 h-auto">
      <circle cx="55" cy="50" r="38" fill={showLeft ? 'rgba(99,102,241,0.35)' : 'transparent'} stroke="#6366f1" strokeWidth="2" />
      <circle cx="105" cy="50" r="38" fill={showRight ? 'rgba(16,185,129,0.35)' : 'transparent'} stroke="#10b981" strokeWidth="2" />
      <defs><clipPath id={`cl-${joinType}`}><circle cx="55" cy="50" r="38" /></clipPath></defs>
      <circle cx="105" cy="50" r="38" fill="rgba(251,191,36,0.5)" clipPath={`url(#cl-${joinType})`} />
      <text x="38" y="54" textAnchor="middle" fill="#9ca3af" fontSize="9">L</text>
      <text x="122" y="54" textAnchor="middle" fill="#9ca3af" fontSize="9">R</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Join engine
// ---------------------------------------------------------------------------

function performJoin(
  left: DatasetOption,
  right: DatasetOption,
  leftKey: string,
  rightKey: string,
  joinType: JoinType,
): JoinResult {
  const leftOther = left.columns.filter((c) => c !== leftKey);
  const rightOther = right.columns.filter((c) => c !== rightKey);

  const leftNameSet = new Set(leftOther);
  const rightNameSet = new Set(rightOther);

  const leftColsOut = leftOther.map((c) => rightNameSet.has(c) ? `${left.title}.${c}` : c);
  const leftColsOutSet = new Set(leftColsOut);
  const rightColsOut = rightOther.map((c) => {
    if (leftNameSet.has(c) || leftColsOutSet.has(c)) return `${right.title}.${c}`;
    return c;
  });

  const keyColName = leftKey;
  const outputColumns = [keyColName, ...leftColsOut, ...rightColsOut];

  // Index right rows by key
  const rightIndex = new Map<string, Record<string, string>[]>();
  for (const row of right.rows) {
    const key = (row[rightKey] ?? '').trim();
    if (!rightIndex.has(key)) rightIndex.set(key, []);
    rightIndex.get(key)!.push(row);
  }

  const matchedRightKeys = new Set<string>();
  const resultRows: Record<string, string>[] = [];

  const buildRow = (
    keyVal: string,
    leftRow: Record<string, string> | null,
    rightRow: Record<string, string> | null,
  ): Record<string, string> => {
    const out: Record<string, string> = { [keyColName]: keyVal };
    leftOther.forEach((col, i) => { out[leftColsOut[i]] = leftRow ? (leftRow[col] ?? '') : ''; });
    rightOther.forEach((col, i) => { out[rightColsOut[i]] = rightRow ? (rightRow[col] ?? '') : ''; });
    return out;
  };

  for (const leftRow of left.rows) {
    const keyVal = (leftRow[leftKey] ?? '').trim();
    const matches = rightIndex.get(keyVal);
    if (matches && matches.length > 0) {
      matchedRightKeys.add(keyVal);
      for (const rightRow of matches) resultRows.push(buildRow(keyVal, leftRow, rightRow));
    } else if (joinType === 'left' || joinType === 'full') {
      resultRows.push(buildRow(keyVal, leftRow, null));
    }
  }

  if (joinType === 'right' || joinType === 'full') {
    for (const rightRow of right.rows) {
      const keyVal = (rightRow[rightKey] ?? '').trim();
      if (!matchedRightKeys.has(keyVal)) resultRows.push(buildRow(keyVal, null, rightRow));
    }
  }

  return { columns: outputColumns, rows: resultRows, keyColumn: keyColName, leftColumns: leftColsOut, rightColumns: rightColsOut };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataJoinTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { data: sharedData, setTabData } = useSpreadsheetData();
  const { tabs, addTab } = useTabs();

  const isFriendly = features.terminology === 'friendly';
  const isTechnical = features.terminology === 'technical';

  // Gather available spreadsheet datasets
  const datasets: DatasetOption[] = useMemo(() => {
    return tabs
      .filter((t) => t.type === 'spreadsheet' && sharedData[t.id])
      .map((t) => ({ tabId: t.id, title: t.title, columns: sharedData[t.id].columns, rows: sharedData[t.id].rows }));
  }, [tabs, sharedData]);

  // State
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftKey, setLeftKey] = useState('');
  const [rightKey, setRightKey] = useState('');
  const [joinType, setJoinType] = useState<JoinType>('inner');

  const leftDataset = datasets.find((d) => d.tabId === leftId) ?? null;
  const rightDataset = datasets.find((d) => d.tabId === rightId) ?? null;

  const handleLeftChange = useCallback((id: string) => { setLeftId(id); setLeftKey(''); }, []);
  const handleRightChange = useCallback((id: string) => { setRightId(id); setRightKey(''); }, []);

  // Compute join result
  const joinResult = useMemo<JoinResult | null>(() => {
    if (!leftDataset || !rightDataset || !leftKey || !rightKey) return null;
    return performJoin(leftDataset, rightDataset, leftKey, rightKey, joinType);
  }, [leftDataset, rightDataset, leftKey, rightKey, joinType]);

  const previewRows = useMemo(() => joinResult ? joinResult.rows.slice(0, 20) : [], [joinResult]);

  // Open as spreadsheet
  const handleOpenAsSpreadsheet = useCallback(() => {
    if (!joinResult || joinResult.rows.length === 0) return;
    const newTab = addTab('spreadsheet', { title: isFriendly ? 'Merged Data' : 'Join Result' });
    setTimeout(() => { setTabData(newTab.id, joinResult.columns, joinResult.rows, newTab.title); }, 50);
  }, [joinResult, addTab, setTabData, isFriendly]);

  const selectClass = 'w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50';

  // Not enough datasets
  if (datasets.length < 2) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-white/50">
        <div className="text-center max-w-md space-y-3">
          <div className="text-lg font-medium text-white/70">
            {isFriendly ? 'Need More Spreadsheets' : 'Insufficient Datasets'}
          </div>
          <div className="text-sm">
            {isFriendly
              ? 'To combine data, you need at least 2 open spreadsheets. Open or import another spreadsheet first.'
              : 'Data join requires at least 2 loaded datasets. Open additional spreadsheet tabs with data.'}
          </div>
          <div className="text-xs text-white/30">
            {datasets.length === 0 ? 'No spreadsheets currently open.' : `Only ${datasets.length} spreadsheet available \u2014 need at least 2.`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0d0d0f] text-white/90">
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">
            {isFriendly ? 'Combine Spreadsheets' : isTechnical ? 'Relational Join' : 'Data Join'}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {isFriendly ? 'Merge two spreadsheets together based on a shared column.' : 'Join two datasets on a common key column.'}
          </p>
        </div>

        {/* Dataset selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400">
              {isFriendly ? 'First Spreadsheet' : 'Left Dataset'}
            </label>
            <select className={selectClass} value={leftId} onChange={(e) => handleLeftChange(e.target.value)}>
              <option value="">{isFriendly ? '\u2014 Pick a spreadsheet \u2014' : '\u2014 Select dataset \u2014'}</option>
              {datasets.map((d) => <option key={d.tabId} value={d.tabId}>{d.title} ({d.rows.length} rows, {d.columns.length} cols)</option>)}
            </select>
            {leftDataset && (
              <>
                <label className="block text-xs font-medium text-white/40 mt-2">{isFriendly ? 'Match on column' : 'Key column'}</label>
                <select className={selectClass} value={leftKey} onChange={(e) => setLeftKey(e.target.value)}>
                  <option value="">{'\u2014 Select key \u2014'}</option>
                  {leftDataset.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {leftDataset.columns.map((col) => (
                    <span key={col} className={`text-[11px] px-2 py-0.5 rounded-full border ${col === leftKey ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'}`}>{col}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {isFriendly ? 'Second Spreadsheet' : 'Right Dataset'}
            </label>
            <select className={selectClass} value={rightId} onChange={(e) => handleRightChange(e.target.value)}>
              <option value="">{isFriendly ? '\u2014 Pick a spreadsheet \u2014' : '\u2014 Select dataset \u2014'}</option>
              {datasets.map((d) => <option key={d.tabId} value={d.tabId}>{d.title} ({d.rows.length} rows, {d.columns.length} cols)</option>)}
            </select>
            {rightDataset && (
              <>
                <label className="block text-xs font-medium text-white/40 mt-2">{isFriendly ? 'Match on column' : 'Key column'}</label>
                <select className={selectClass} value={rightKey} onChange={(e) => setRightKey(e.target.value)}>
                  <option value="">{'\u2014 Select key \u2014'}</option>
                  {rightDataset.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {rightDataset.columns.map((col) => (
                    <span key={col} className={`text-[11px] px-2 py-0.5 rounded-full border ${col === rightKey ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>{col}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Join type selector */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
            {isFriendly ? 'How to combine' : 'Join Type'}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['inner', 'left', 'right', 'full'] as JoinType[]).map((jt) => {
              const meta = JOIN_META[jt];
              const active = joinType === jt;
              return (
                <button key={jt} onClick={() => setJoinType(jt)}
                  className={`relative rounded-lg border p-3 text-left transition-all ${active ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50' : 'border-white/[0.06] bg-[#111113] hover:border-white/10'}`}>
                  <div className="text-sm font-medium text-white/90">{isFriendly ? meta.friendly : meta.label}</div>
                  <div className="text-[11px] text-white/40 mt-1 leading-snug">{isTechnical ? meta.techDesc : meta.desc}</div>
                  {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center pt-2">
            <VennDiagram joinType={joinType} />
          </div>
        </div>

        {/* Result section */}
        {leftKey && rightKey && leftDataset && rightDataset && joinResult && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <div><span className="text-white/40">{isFriendly ? 'Rows:' : 'Row count:'}</span> <span className="font-mono font-semibold text-white/90">{joinResult.rows.length.toLocaleString()}</span></div>
              <div><span className="text-white/40">{isFriendly ? 'Columns:' : 'Column count:'}</span> <span className="font-mono font-semibold text-white/90">{joinResult.columns.length}</span></div>
              {joinResult.rows.length > 0 && (
                <button onClick={handleOpenAsSpreadsheet}
                  className="ml-auto flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition">
                  {isFriendly ? 'Open as Spreadsheet' : 'Export to Spreadsheet'}
                </button>
              )}
            </div>

            {/* Empty result */}
            {joinResult.rows.length === 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-center">
                <div className="text-amber-400 font-medium text-sm">{isFriendly ? 'No matches found' : 'Empty result set'}</div>
                <p className="text-xs text-white/40 mt-1 max-w-md mx-auto">
                  {isFriendly
                    ? 'The two spreadsheets don\u2019t have matching values in the chosen columns. Try different columns or "Keep everything".'
                    : `The ${JOIN_META[joinType].label.toLowerCase()} produced 0 rows. Verify key columns overlap or use Full Outer join.`}
                </p>
              </div>
            )}

            {/* Preview table */}
            {joinResult.rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    {isFriendly ? 'Preview' : 'Result Preview'}
                    {joinResult.rows.length > 20 && <span className="text-white/30 font-normal ml-2">(first 20 of {joinResult.rows.length.toLocaleString()})</span>}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-white/40">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40" /> Key</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/40" /> {isFriendly ? 'First' : 'Left'}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40" /> {isFriendly ? 'Second' : 'Right'}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {joinResult.columns.map((col) => {
                            let bg = 'bg-indigo-500/15 text-indigo-300';
                            if (col === joinResult.keyColumn) bg = 'bg-amber-500/15 text-amber-300';
                            else if (joinResult.rightColumns.includes(col)) bg = 'bg-emerald-500/15 text-emerald-300';
                            return <th key={col} className={`px-3 py-2 text-left text-xs font-semibold whitespace-nowrap border-b border-white/[0.06] ${bg}`}>{col}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {previewRows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-white/[0.02]">
                            {joinResult.columns.map((col) => {
                              const val = row[col] ?? '';
                              return <td key={col} className={`px-3 py-1.5 text-xs whitespace-nowrap font-mono ${val === '' ? 'text-white/20 italic' : 'text-white/70'}`}>{val || '\u2014'}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompt when not configured */}
        {(!leftKey || !rightKey || !leftDataset || !rightDataset) && (
          <div className="rounded-lg border border-white/[0.06] bg-[#111113] p-6 text-center">
            <p className="text-sm text-white/40">
              {isFriendly
                ? 'Pick two spreadsheets and choose which columns to match on.'
                : 'Select both datasets and their respective key columns to preview the join.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
