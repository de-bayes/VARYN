'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import { parseCsv } from '@/lib/csv-parser';
import type { TabComponentProps } from '../tab-registry';

type SortDir = 'asc' | 'desc' | null;

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

  // Register data in the shared store when it changes
  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      setTabData(tabId, columns, rows);
    }
  }, [tabId, columns, rows, setTabData]);

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
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter rows..."
          className="w-40 rounded border border-white/10 bg-transparent px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted/30 focus:border-accent/40 focus:outline-none"
        />
      </div>

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
