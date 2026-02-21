'use client';

import { useState, useEffect, useCallback } from 'react';

interface DataViewProps {
  downloadUrl: string;
  filename: string;
  onPasteUpload?: (file: File) => void;
}

function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const columns = lines[0].split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(delimiter).map((v) => v.replace(/^"|"$/g, '').trim());
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = vals[i] ?? '';
    });
    return row;
  });
  return { columns, rows };
}

export function DataView({ downloadUrl, filename, onPasteUpload }: DataViewProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(downloadUrl)
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
  }, [downloadUrl]);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (!text || !onPasteUpload) return;

      // Check if it looks like tabular data (has tabs or multiple commas per line)
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;
      const hasTabs = lines[0].includes('\t');
      const hasMultipleCommas = (lines[0].match(/,/g) ?? []).length >= 1;
      if (!hasTabs && !hasMultipleCommas) return;

      e.preventDefault();
      const blob = new Blob([text], { type: 'text/csv' });
      const file = new File([blob], `pasted-${Date.now()}.csv`, { type: 'text/csv' });
      onPasteUpload(file);
    },
    [onPasteUpload],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted/40">
        Loading data…
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="text-xs font-medium text-foreground">{filename}</span>
        <span className="text-[10px] text-muted/50">{rows.length} rows</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr className="border-b border-white/5">
              <th className="px-3 py-2 text-left font-medium text-muted/60 w-12">#</th>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-muted/80 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-muted/40 tabular-nums">{i + 1}</td>
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-foreground/90 tabular-nums whitespace-nowrap">
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
