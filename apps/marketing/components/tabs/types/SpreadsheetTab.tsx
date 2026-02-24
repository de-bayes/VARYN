'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import { parseCsv } from '@/lib/csv-parser';
import type { TabComponentProps } from '../tab-registry';

type SortDir = 'asc' | 'desc' | null;

/** Evaluate a simple expression against a row. Supports: +, -, *, /, column refs, numbers. */
function evaluateFormula(expr: string, row: Record<string, string>, cols: string[]): string {
  try {
    // Replace column references with their numeric values
    let evaluated = expr;
    // Sort columns by length desc so longer names get replaced first
    const sortedCols = [...cols].sort((a, b) => b.length - a.length);
    for (const col of sortedCols) {
      // Use word boundary-like matching: replace col name with its value
      const re = new RegExp(`\\b${col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const val = row[col] ?? '';
      const num = parseFloat(val.replace(/,/g, ''));
      evaluated = evaluated.replace(re, isNaN(num) ? '0' : String(num));
    }
    // Only allow numbers, operators, parens, spaces, and decimal points
    if (!/^[\d\s+\-*/().]+$/.test(evaluated)) return 'ERR';
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${evaluated})`)();
    if (typeof result !== 'number' || !isFinite(result)) return 'ERR';
    return Number.isInteger(result) ? String(result) : result.toFixed(4);
  } catch {
    return 'ERR';
  }
}

export default function SpreadsheetTab({ tabId, datasetId, sourceUrl }: TabComponentProps) {
  const { currentProject, datasets, uploadDataset } = useWorkspace();
  const { setTabData } = useSpreadsheetData();
  const { addTab } = useTabs();
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filterText, setFilterText] = useState('');
  const [showFormulaEditor, setShowFormulaEditor] = useState(false);
  const [formulaName, setFormulaName] = useState('');
  const [formulaExpr, setFormulaExpr] = useState('');
  const [formulaError, setFormulaError] = useState<string | null>(null);

  // Derive a title from props for persistence
  const sheetTitle = sourceUrl
    ? sourceUrl.split('/').pop() ?? tabId
    : datasetId
      ? datasets.find((d) => d.id === datasetId)?.filename ?? tabId
      : tabId;

  // Register data in the shared store when it changes
  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      setTabData(tabId, columns, rows, sheetTitle);
    }
  }, [tabId, columns, rows, setTabData, sheetTitle]);

  // Load data from a direct URL (e.g. sample data)
  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(sourceUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseCsv(text);
        setColumns(parsed.columns);
        setRows(parsed.rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sourceUrl]);

  // Load data if we have a datasetId (from API)
  useEffect(() => {
    if (!datasetId || !currentProject) return;
    const dataset = datasets.find((d) => d.id === datasetId);
    if (!dataset) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    import('@/lib/api')
      .then((api) => api.getDatasetPreview(currentProject.id, datasetId))
      .then(({ downloadUrl }) => fetch(downloadUrl))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch dataset');
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseCsv(text);
        setColumns(parsed.columns);
        setRows(parsed.rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [datasetId, currentProject, datasets]);

  // Handle paste
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;
      const hasTabs = lines[0].includes('\t');
      const hasMultipleCommas = (lines[0].match(/,/g) ?? []).length >= 1;
      if (!hasTabs && !hasMultipleCommas) return;

      e.preventDefault();
      const parsed = parseCsv(text);
      setColumns(parsed.columns);
      setRows(parsed.rows);

      const blob = new Blob([text], { type: 'text/csv' });
      const file = new File([blob], `pasted-${Date.now()}.csv`, { type: 'text/csv' });
      uploadDataset(file);
    },
    [uploadDataset],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Sorting
  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Filtered + sorted rows
  const displayRows = useMemo(() => {
    let result = rows;

    // Filter
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => (row[col] ?? '').toLowerCase().includes(lower)),
      );
    }

    // Sort
    if (sortCol && sortDir) {
      const col = sortCol;
      result = [...result].sort((a, b) => {
        const aVal = a[col] ?? '';
        const bVal = b[col] ?? '';
        const aNum = parseFloat(aVal.replace(/,/g, ''));
        const bNum = parseFloat(bVal.replace(/,/g, ''));
        const isNum = !isNaN(aNum) && !isNaN(bNum);

        let cmp: number;
        if (isNum) {
          cmp = aNum - bNum;
        } else {
          cmp = aVal.localeCompare(bVal);
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }, [rows, columns, sortCol, sortDir, filterText]);

  const sortIcon = (col: string) => {
    if (sortCol !== col) return '';
    if (sortDir === 'asc') return ' ↑';
    if (sortDir === 'desc') return ' ↓';
    return '';
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted/40">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted/30 border-t-accent/60" />
          Loading data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-2">
          <p className="text-sm">Paste CSV data here or upload a file</p>
          <p className="text-[11px] text-muted/30">
            Copy from Excel, Google Sheets, or any spreadsheet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-1.5">
        <span className="text-[10px] text-muted/50">
          {displayRows.length === rows.length
            ? `${rows.length} rows`
            : `${displayRows.length} of ${rows.length} rows`}
        </span>
        <span className="text-white/10">|</span>
        <span className="text-[10px] text-muted/50">{columns.length} cols</span>
        <div className="flex-1" />
        <button
          onClick={() => {
            const csvContent = [
              columns.join(','),
              ...displayRows.map((row) =>
                columns.map((col) => {
                  const val = row[col] ?? '';
                  return val.includes(',') || val.includes('"') || val.includes('\n')
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
                }).join(',')
              ),
            ].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'export.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-muted/60 hover:border-accent/30 hover:text-foreground transition"
        >
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="opacity-60">
              <path d="M8 2v8M5 7l3 3 3-3" />
              <path d="M3 12h10" />
            </svg>
            Export
          </span>
        </button>
        <button
          onClick={() => addTab('summary', { title: 'Summary' })}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-muted/60 hover:border-accent/30 hover:text-foreground transition"
        >
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="opacity-60">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M5 5h6M5 8h4M5 11h5" />
            </svg>
            Summary
          </span>
        </button>
        <button
          onClick={() => addTab('graph-builder', { title: 'Graph' })}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-muted/60 hover:border-accent/30 hover:text-foreground transition"
        >
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none" className="opacity-60">
              <rect x="2" y="10" width="3" height="6" rx="0.5" fill="currentColor" />
              <rect x="7" y="5" width="3" height="11" rx="0.5" fill="currentColor" />
              <rect x="12" y="7" width="3" height="9" rx="0.5" fill="currentColor" />
            </svg>
            Graph
          </span>
        </button>
        <button
          onClick={() => addTab('regression', { title: 'Regression' })}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-muted/60 hover:border-accent/30 hover:text-foreground transition"
        >
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="opacity-60">
              <circle cx="4" cy="11" r="0.8" fill="currentColor" />
              <circle cx="7" cy="8" r="0.8" fill="currentColor" />
              <circle cx="11" cy="5" r="0.8" fill="currentColor" />
              <line x1="3" y1="12" x2="13" y2="4" strokeDasharray="2 1.5" />
            </svg>
            Regression
          </span>
        </button>
        <button
          onClick={() => setShowFormulaEditor(!showFormulaEditor)}
          className={`rounded border px-2 py-0.5 text-[10px] transition ${
            showFormulaEditor
              ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'
              : 'border-white/10 text-muted/60 hover:border-accent/30 hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="opacity-60">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Add Column
          </span>
        </button>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter rows..."
          className="w-40 rounded border border-white/10 bg-transparent px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted/30 focus:border-accent/40 focus:outline-none"
        />
      </div>

      {/* Computed Column Formula Editor */}
      {showFormulaEditor && (
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 bg-[#111113]">
          <span className="text-[10px] text-white/40 shrink-0">Name:</span>
          <input
            type="text"
            value={formulaName}
            onChange={(e) => setFormulaName(e.target.value)}
            placeholder="new_column"
            className="w-32 rounded border border-white/10 bg-transparent px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted/30 focus:border-indigo-500/40 focus:outline-none"
          />
          <span className="text-[10px] text-white/40 shrink-0">=</span>
          <input
            type="text"
            value={formulaExpr}
            onChange={(e) => { setFormulaExpr(e.target.value); setFormulaError(null); }}
            placeholder="e.g. dem_votes - rep_votes"
            className="flex-1 rounded border border-white/10 bg-transparent px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted/30 focus:border-indigo-500/40 focus:outline-none font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Apply formula
                if (!formulaName.trim()) { setFormulaError('Name required'); return; }
                if (!formulaExpr.trim()) { setFormulaError('Expression required'); return; }
                if (columns.includes(formulaName.trim())) { setFormulaError('Column already exists'); return; }
                // Test on first row
                const testResult = evaluateFormula(formulaExpr, rows[0] ?? {}, columns);
                if (testResult === 'ERR') { setFormulaError('Invalid expression'); return; }
                // Apply to all rows
                const newCol = formulaName.trim();
                const newRows = rows.map((row) => ({
                  ...row,
                  [newCol]: evaluateFormula(formulaExpr, row, columns),
                }));
                setColumns([...columns, newCol]);
                setRows(newRows);
                setFormulaName('');
                setFormulaExpr('');
                setShowFormulaEditor(false);
                setFormulaError(null);
              }
            }}
          />
          <button
            onClick={() => {
              if (!formulaName.trim()) { setFormulaError('Name required'); return; }
              if (!formulaExpr.trim()) { setFormulaError('Expression required'); return; }
              if (columns.includes(formulaName.trim())) { setFormulaError('Column already exists'); return; }
              const testResult = evaluateFormula(formulaExpr, rows[0] ?? {}, columns);
              if (testResult === 'ERR') { setFormulaError('Invalid expression'); return; }
              const newCol = formulaName.trim();
              const newRows = rows.map((row) => ({
                ...row,
                [newCol]: evaluateFormula(formulaExpr, row, columns),
              }));
              setColumns([...columns, newCol]);
              setRows(newRows);
              setFormulaName('');
              setFormulaExpr('');
              setShowFormulaEditor(false);
              setFormulaError(null);
            }}
            className="rounded bg-indigo-500/20 px-3 py-0.5 text-[10px] font-medium text-indigo-300 hover:bg-indigo-500/30 transition shrink-0"
          >
            Apply
          </button>
          <button
            onClick={() => { setShowFormulaEditor(false); setFormulaError(null); }}
            className="text-[10px] text-muted/40 hover:text-foreground transition shrink-0"
          >
            ×
          </button>
          {formulaError && (
            <span className="text-[10px] text-red-400 shrink-0">{formulaError}</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr className="border-b border-white/5">
              <th className="px-3 py-2 text-left font-medium text-muted/60 w-12">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-2 text-left font-medium text-muted/80 whitespace-nowrap cursor-pointer hover:text-foreground select-none transition"
                >
                  {col}
                  <span className="text-accent/60 ml-0.5">{sortIcon(col)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-1.5 text-muted/40 tabular-nums">{i + 1}</td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-foreground/90 tabular-nums whitespace-nowrap"
                  >
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
