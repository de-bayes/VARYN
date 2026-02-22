'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import React from 'react';

export interface ColumnStats {
  name: string;
  type: 'numeric' | 'text' | 'date';
  uniqueCount: number;
  missingCount: number;
  // Numeric stats
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  stdDev?: number;
  // Text stats
  topValues?: { value: string; count: number }[];
}

export interface SpreadsheetData {
  columns: string[];
  rows: Record<string, string>[];
  columnStats: ColumnStats[];
}

interface SpreadsheetDataStore {
  /** Data keyed by tab ID */
  data: Record<string, SpreadsheetData>;
  setTabData: (tabId: string, columns: string[], rows: Record<string, string>[]) => void;
  getTabData: (tabId: string) => SpreadsheetData | undefined;
}

function computeColumnStats(columns: string[], rows: Record<string, string>[]): ColumnStats[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col] ?? '').filter((v) => v !== '');
    const missing = rows.length - values.length;

    // Determine type
    const numericValues = values
      .map((v) => parseFloat(v.replace(/,/g, '')))
      .filter((n) => !isNaN(n));
    const isNumeric = numericValues.length > values.length * 0.7 && numericValues.length > 0;

    if (isNumeric) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const mean = sum / sorted.length;
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      const variance =
        sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length;

      return {
        name: col,
        type: 'numeric' as const,
        uniqueCount: new Set(numericValues).size,
        missingCount: missing,
        mean,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        stdDev: Math.sqrt(variance),
      };
    }

    // Text column
    const freq = new Map<string, number>();
    for (const v of values) {
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    const topValues = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    return {
      name: col,
      type: 'text' as const,
      uniqueCount: freq.size,
      missingCount: missing,
      topValues,
    };
  });
}

const SpreadsheetDataContext = createContext<SpreadsheetDataStore | null>(null);

export function SpreadsheetDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Record<string, SpreadsheetData>>({});

  const setTabData = useCallback(
    (tabId: string, columns: string[], rows: Record<string, string>[]) => {
      const columnStats = computeColumnStats(columns, rows);
      setData((prev) => ({
        ...prev,
        [tabId]: { columns, rows, columnStats },
      }));
    },
    [],
  );

  const getTabData = useCallback(
    (tabId: string) => data[tabId],
    [data],
  );

  return React.createElement(
    SpreadsheetDataContext.Provider,
    { value: { data, setTabData, getTabData } },
    children,
  );
}

export function useSpreadsheetData(): SpreadsheetDataStore {
  const ctx = useContext(SpreadsheetDataContext);
  if (!ctx) throw new Error('useSpreadsheetData must be used within SpreadsheetDataProvider');
  return ctx;
}
