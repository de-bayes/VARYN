'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimePoint {
  date: Date;
  timestamp: number;
  values: Record<string, number | null>;
}

interface SeriesStats {
  min: number;
  max: number;
  mean: number;
  pctChange: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const MARGIN = { top: 28, right: 20, bottom: 40, left: 60 };
const MOVING_AVG_WINDOWS = [3, 5, 7, 10, 14, 21, 30];

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

function tryParseDate(val: string): Date | null {
  if (!val || val.trim() === '') return null;
  const s = val.trim();

  // ISO format: 2024-01-15
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d.getTime())) return d;
  }
  // US format: 01/15/2024 or 1/15/2024
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  // Year only: 2024
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s);
    if (y >= 1800 && y <= 2100) return new Date(y, 0, 1);
  }
  // Month-Year: Jan 2024, January 2024, 2024-01
  if (/^\d{4}-\d{1,2}$/.test(s)) {
    const d = new Date(s + '-01T00:00:00');
    if (!isNaN(d.getTime())) return d;
  }
  // Generic Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 1800) return d;
  return null;
}

function isDateColumn(rows: Record<string, string>[], col: string): boolean {
  const sample = rows.slice(0, 30);
  const parsed = sample.filter((r) => tryParseDate(r[col]) !== null);
  return parsed.length > sample.length * 0.6;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString();
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(2);
  return n.toFixed(2);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function niceTickValues(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const roughStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;
  let step: number;
  if (residual <= 1.5) step = mag;
  else if (residual <= 3) step = 2 * mag;
  else if (residual <= 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) ticks.push(parseFloat(v.toPrecision(10)));
  return ticks;
}

function niceDateTicks(min: number, max: number, count: number): Date[] {
  const range = max - min;
  if (range <= 0) return [new Date(min)];
  const step = range / Math.max(count, 1);
  const ticks: Date[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(new Date(min + step * i));
  }
  return ticks;
}

function computeMovingAverage(data: (number | null)[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0, count = 0;
    for (let j = i - window + 1; j <= i; j++) {
      if (data[j] !== null) { sum += data[j]!; count++; }
    }
    return count > 0 ? sum / count : null;
  });
}

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i]; sumX2 += x[i] * x[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeSeriesTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { data: sharedData } = useSpreadsheetData();
  const { tabs } = useTabs();

  const term = features.terminology;

  // Find source spreadsheet
  const spreadsheetEntry = useMemo(() => {
    const stab = tabs.find((t) => t.type === 'spreadsheet' && sharedData[t.id]?.columns.length > 0);
    return stab ? sharedData[stab.id] : null;
  }, [tabs, sharedData]);

  const columns = spreadsheetEntry?.columns ?? [];
  const rows = spreadsheetEntry?.rows ?? [];

  // Detect date and numeric columns
  const dateColumns = useMemo(() => columns.filter((c) => isDateColumn(rows, c)), [columns, rows]);
  const numericColumns = useMemo(() => {
    return columns.filter((c) => {
      if (dateColumns.includes(c)) return false;
      const vals = rows.slice(0, 50).map((r) => Number(r[c]));
      return vals.filter((v) => !isNaN(v)).length > vals.length * 0.5;
    });
  }, [columns, rows, dateColumns]);

  // State
  const [dateCol, setDateCol] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [showMovingAvg, setShowMovingAvg] = useState(false);
  const [maWindow, setMaWindow] = useState(7);
  const [showTrend, setShowTrend] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chartSize, setChartSize] = useState({ width: 600, height: 400 });

  // Auto-select first date column
  useEffect(() => {
    if (!dateCol && dateColumns.length > 0) setDateCol(dateColumns[0]);
  }, [dateColumns, dateCol]);

  // Auto-select first numeric column
  useEffect(() => {
    if (selectedValues.length === 0 && numericColumns.length > 0) setSelectedValues([numericColumns[0]]);
  }, [numericColumns, selectedValues.length]);

  // Resize observer
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setChartSize({ width: Math.max(300, width - 16), height: Math.max(200, height - 16) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toggleValueCol = useCallback((col: string) => {
    setSelectedValues((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  }, []);

  // Process data
  const processedData = useMemo<TimePoint[]>(() => {
    if (!dateCol) return [];
    const points: TimePoint[] = [];
    for (const row of rows) {
      const d = tryParseDate(row[dateCol]);
      if (!d) continue;
      const values: Record<string, number | null> = {};
      for (const col of selectedValues) {
        const n = Number(row[col]);
        values[col] = isNaN(n) ? null : n;
      }
      points.push({ date: d, timestamp: d.getTime(), values });
    }
    points.sort((a, b) => a.timestamp - b.timestamp);
    return points;
  }, [dateCol, selectedValues, rows]);

  // Scale computations
  const plotW = chartSize.width - MARGIN.left - MARGIN.right;
  const plotH = chartSize.height - MARGIN.top - MARGIN.bottom;

  const { dateMin, dateMax, yMin, yMax } = useMemo(() => {
    if (processedData.length === 0) return { dateMin: 0, dateMax: 1, yMin: 0, yMax: 1 };
    let yMin = Infinity, yMax = -Infinity;
    const dateMin = processedData[0].timestamp;
    const dateMax = processedData[processedData.length - 1].timestamp;
    for (const p of processedData) {
      for (const col of selectedValues) {
        const v = p.values[col];
        if (v !== null) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
      }
    }
    const pad = (yMax - yMin) * 0.08 || 1;
    return { dateMin, dateMax: dateMax === dateMin ? dateMax + 1 : dateMax, yMin: yMin - pad, yMax: yMax + pad };
  }, [processedData, selectedValues]);

  const scaleX = useCallback((t: number) => MARGIN.left + ((t - dateMin) / (dateMax - dateMin)) * plotW, [dateMin, dateMax, plotW]);
  const scaleY = useCallback((v: number) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH, [yMin, yMax, plotH]);

  // Moving averages
  const movingAverages = useMemo(() => {
    if (!showMovingAvg) return {};
    const result: Record<string, (number | null)[]> = {};
    for (const col of selectedValues) {
      const vals = processedData.map((p) => p.values[col]);
      result[col] = computeMovingAverage(vals, maWindow);
    }
    return result;
  }, [showMovingAvg, processedData, selectedValues, maWindow]);

  // Trend lines
  const trendLines = useMemo(() => {
    if (!showTrend || processedData.length < 2) return {};
    const t0 = processedData[0].timestamp;
    const result: Record<string, { slope: number; intercept: number }> = {};
    for (const col of selectedValues) {
      const xArr: number[] = [], yArr: number[] = [];
      for (const p of processedData) {
        const v = p.values[col];
        if (v !== null) {
          xArr.push((p.timestamp - t0) / (1000 * 60 * 60 * 24));
          yArr.push(v);
        }
      }
      if (xArr.length >= 2) result[col] = linearRegression(xArr, yArr);
    }
    return result;
  }, [showTrend, processedData, selectedValues]);

  // Series stats
  const seriesStats = useMemo(() => {
    const stats: Record<string, SeriesStats> = {};
    for (const col of selectedValues) {
      const vals = processedData.map((p) => p.values[col]).filter((v): v is number => v !== null);
      if (vals.length === 0) continue;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const first = vals[0], last = vals[vals.length - 1];
      stats[col] = {
        min: Math.min(...vals),
        max: Math.max(...vals),
        mean,
        pctChange: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0,
      };
    }
    return stats;
  }, [processedData, selectedValues]);

  // Hover
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (processedData.length === 0) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    let closest = 0, closestDist = Infinity;
    for (let i = 0; i < processedData.length; i++) {
      const px = scaleX(processedData[i].timestamp);
      const dist = Math.abs(px - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoverIdx(closest);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [processedData, scaleX]);

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  // Tick values
  const yTicks = useMemo(() => niceTickValues(yMin, yMax, 6), [yMin, yMax]);
  const dateTicks = useMemo(() => niceDateTicks(dateMin, dateMax, Math.max(3, Math.floor(plotW / 100))), [dateMin, dateMax, plotW]);

  // Build SVG paths
  const seriesPaths = useMemo(() => {
    if (processedData.length === 0) return {};
    const paths: Record<string, string> = {};
    for (const col of selectedValues) {
      let d = '', started = false;
      for (const p of processedData) {
        const v = p.values[col];
        if (v === null) { started = false; continue; }
        const x = scaleX(p.timestamp), y = scaleY(v);
        d += started ? `L${x},${y}` : `M${x},${y}`;
        started = true;
      }
      paths[col] = d;
    }
    return paths;
  }, [processedData, selectedValues, scaleX, scaleY]);

  const maPaths = useMemo(() => {
    if (!showMovingAvg || processedData.length === 0) return {};
    const paths: Record<string, string> = {};
    for (const col of selectedValues) {
      const ma = movingAverages[col];
      if (!ma) continue;
      let d = '', started = false;
      for (let i = 0; i < processedData.length; i++) {
        const v = ma[i];
        if (v === null) { started = false; continue; }
        const x = scaleX(processedData[i].timestamp), y = scaleY(v);
        d += started ? `L${x},${y}` : `M${x},${y}`;
        started = true;
      }
      paths[col] = d;
    }
    return paths;
  }, [showMovingAvg, processedData, selectedValues, movingAverages, scaleX, scaleY]);

  const trendPaths = useMemo(() => {
    if (!showTrend || processedData.length < 2) return {};
    const paths: Record<string, string> = {};
    const t0 = processedData[0].timestamp;
    for (const col of selectedValues) {
      const reg = trendLines[col];
      if (!reg) continue;
      const x2days = (processedData[processedData.length - 1].timestamp - t0) / (1000 * 60 * 60 * 24);
      const y1 = reg.intercept;
      const y2 = reg.intercept + reg.slope * x2days;
      paths[col] = `M${scaleX(processedData[0].timestamp)},${scaleY(y1)}L${scaleX(processedData[processedData.length - 1].timestamp)},${scaleY(y2)}`;
    }
    return paths;
  }, [showTrend, processedData, selectedValues, trendLines, scaleX, scaleY]);

  const showDataPoints = processedData.length > 0 && processedData.length < 120;

  // Terminology
  const labels = useMemo(() => ({
    title: term === 'friendly' ? 'Time Chart' : 'Time Series Analysis',
    dateCol: term === 'friendly' ? 'Date Column' : 'Temporal Variable',
    valueCols: term === 'friendly' ? 'Values to Plot' : 'Series Variables',
    movingAvg: term === 'friendly' ? 'Smoothing' : term === 'statistical' ? 'Moving Average' : 'MA Overlay',
    windowSize: term === 'friendly' ? 'Smoothing Window' : 'Window Size',
    trendLine: term === 'friendly' ? 'Show Trend' : term === 'statistical' ? 'Linear Trend Line' : 'OLS Trend',
    stats: term === 'friendly' ? 'Quick Stats' : 'Summary Statistics',
    min: 'Min', max: 'Max',
    mean: term === 'friendly' ? 'Average' : 'Mean',
    pctChange: term === 'friendly' ? 'Change' : '% Change',
  }), [term]);

  // Empty states
  if (!spreadsheetEntry) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-white/50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-white/70">No Data Available</div>
          <div className="text-sm">Open a spreadsheet tab with data to start time series analysis.</div>
        </div>
      </div>
    );
  }

  if (dateColumns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-white/50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-white/70">No Date Column Detected</div>
          <div className="text-sm">Your data needs at least one column with date values<br />(e.g. 2024-01-15, 01/15/2024, 2024, etc.)</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0d0f] text-white/90">
      {/* Left: Chart */}
      <div className="flex flex-1 flex-col" style={{ width: '70%' }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <span className="text-sm font-medium text-white/70">{labels.title}</span>
          {processedData.length > 0 && (
            <span className="text-xs text-white/40">{processedData.length} data points &middot; {selectedValues.length} series</span>
          )}
        </div>

        <div ref={chartContainerRef} className="relative flex-1 overflow-hidden p-2">
          {processedData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              Select a date column and at least one value column to plot.
            </div>
          ) : (
            <>
              <svg ref={svgRef} width={chartSize.width} height={chartSize.height} className="select-none" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="#111113" rx={2} />

                {/* Grid + Y axis */}
                {yTicks.map((tick, i) => {
                  const y = scaleY(tick);
                  if (y < MARGIN.top || y > MARGIN.top + plotH) return null;
                  return (
                    <g key={`yt-${i}`}>
                      <line x1={MARGIN.left} y1={y} x2={MARGIN.left + plotW} y2={y} stroke="white" strokeOpacity={0.06} />
                      <text x={MARGIN.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fill="white" fillOpacity={0.4} fontSize={11}>{fmt(tick)}</text>
                    </g>
                  );
                })}

                {/* Date axis */}
                {dateTicks.map((tick, i) => {
                  const x = scaleX(tick.getTime());
                  if (x < MARGIN.left || x > MARGIN.left + plotW) return null;
                  return (
                    <g key={`dt-${i}`}>
                      <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + plotH} stroke="white" strokeOpacity={0.06} />
                      <text x={x} y={MARGIN.top + plotH + 18} textAnchor="middle" fill="white" fillOpacity={0.4} fontSize={10}>{fmtDateShort(tick)}</text>
                    </g>
                  );
                })}

                {/* Axes */}
                <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + plotH} stroke="white" strokeOpacity={0.15} />
                <line x1={MARGIN.left} y1={MARGIN.top + plotH} x2={MARGIN.left + plotW} y2={MARGIN.top + plotH} stroke="white" strokeOpacity={0.15} />

                {/* Trend lines */}
                {showTrend && selectedValues.map((col, ci) => {
                  const d = trendPaths[col];
                  if (!d) return null;
                  return <path key={`trend-${col}`} d={d} fill="none" stroke={SERIES_COLORS[ci % SERIES_COLORS.length]} strokeWidth={1.5} strokeDasharray="8,4" strokeOpacity={0.4} />;
                })}

                {/* Moving averages */}
                {showMovingAvg && selectedValues.map((col, ci) => {
                  const d = maPaths[col];
                  if (!d) return null;
                  return <path key={`ma-${col}`} d={d} fill="none" stroke={SERIES_COLORS[ci % SERIES_COLORS.length]} strokeWidth={2} strokeDasharray="6,3" strokeOpacity={0.6} />;
                })}

                {/* Series lines */}
                {selectedValues.map((col, ci) => {
                  const d = seriesPaths[col];
                  if (!d) return null;
                  return <path key={`s-${col}`} d={d} fill="none" stroke={SERIES_COLORS[ci % SERIES_COLORS.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
                })}

                {/* Data points */}
                {showDataPoints && selectedValues.map((col, ci) =>
                  processedData.map((p, pi) => {
                    const v = p.values[col];
                    if (v === null) return null;
                    return <circle key={`pt-${col}-${pi}`} cx={scaleX(p.timestamp)} cy={scaleY(v)} r={3} fill={SERIES_COLORS[ci % SERIES_COLORS.length]} stroke="#111113" strokeWidth={1} />;
                  }),
                )}

                {/* Hover crosshair */}
                {hoverIdx !== null && (
                  <>
                    <line x1={scaleX(processedData[hoverIdx].timestamp)} y1={MARGIN.top} x2={scaleX(processedData[hoverIdx].timestamp)} y2={MARGIN.top + plotH} stroke="white" strokeOpacity={0.2} strokeDasharray="3,3" />
                    {selectedValues.map((col, ci) => {
                      const v = processedData[hoverIdx].values[col];
                      if (v === null) return null;
                      return <circle key={`h-${col}`} cx={scaleX(processedData[hoverIdx].timestamp)} cy={scaleY(v)} r={5} fill={SERIES_COLORS[ci % SERIES_COLORS.length]} stroke="white" strokeWidth={2} />;
                    })}
                  </>
                )}

                {/* Legend */}
                {selectedValues.length > 0 && (
                  <g>
                    {selectedValues.map((col, ci) => (
                      <g key={`leg-${col}`}>
                        <line x1={MARGIN.left + 12} y1={MARGIN.top + 14 + ci * 18} x2={MARGIN.left + 28} y2={MARGIN.top + 14 + ci * 18} stroke={SERIES_COLORS[ci % SERIES_COLORS.length]} strokeWidth={2} />
                        <text x={MARGIN.left + 34} y={MARGIN.top + 14 + ci * 18} dominantBaseline="middle" fill="white" fillOpacity={0.7} fontSize={11}>{col}</text>
                      </g>
                    ))}
                  </g>
                )}
              </svg>

              {/* Tooltip */}
              {hoverIdx !== null && (
                <div className="pointer-events-none absolute z-10 rounded border border-white/10 bg-[#1a1a1e] px-3 py-2 shadow-lg"
                  style={{ left: Math.min(tooltipPos.x + 12, chartSize.width - 180), top: Math.max(tooltipPos.y - 10, 4) }}>
                  <div className="mb-1 text-xs font-medium text-white/60">{fmtDate(processedData[hoverIdx].date)}</div>
                  {selectedValues.map((col, ci) => {
                    const v = processedData[hoverIdx].values[col];
                    return (
                      <div key={col} className="flex items-center gap-2 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SERIES_COLORS[ci % SERIES_COLORS.length] }} />
                        <span className="text-white/50">{col}:</span>
                        <span className="font-mono text-white/90">{v !== null ? fmt(v) : '\u2013'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Config */}
      <div className="flex flex-col overflow-y-auto border-l border-white/[0.06] bg-[#111113]" style={{ width: '30%', minWidth: 240 }}>
        <div className="border-b border-white/[0.06] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Configuration</span>
        </div>
        <div className="flex flex-col gap-4 p-4">
          {/* Date column */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">{labels.dateCol}</label>
            <select value={dateCol} onChange={(e) => setDateCol(e.target.value)}
              className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50">
              <option value="">Select column...</option>
              {dateColumns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Value columns */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">{labels.valueCols}</label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-white/[0.06] bg-[#0d0d0f] p-2">
              {numericColumns.length === 0 ? (
                <div className="text-xs text-white/30">No numeric columns found</div>
              ) : (
                numericColumns.map((col, ci) => {
                  const checked = selectedValues.includes(col);
                  const colorIdx = checked ? selectedValues.indexOf(col) : ci;
                  return (
                    <label key={col} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-white/[0.04]">
                      <input type="checkbox" checked={checked} onChange={() => toggleValueCol(col)} className="sr-only" />
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border"
                        style={{ borderColor: checked ? SERIES_COLORS[colorIdx % SERIES_COLORS.length] : 'rgba(255,255,255,0.15)', backgroundColor: checked ? SERIES_COLORS[colorIdx % SERIES_COLORS.length] : 'transparent' }}>
                        {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" /></svg>}
                      </span>
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SERIES_COLORS[colorIdx % SERIES_COLORS.length], opacity: checked ? 1 : 0.3 }} />
                      <span className={checked ? 'text-white/80' : 'text-white/40'}>{col}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Moving Average toggle */}
          <div className="rounded border border-white/[0.06] bg-[#0d0d0f] p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={showMovingAvg} onChange={(e) => setShowMovingAvg(e.target.checked)} className="sr-only" />
              <span className={`flex h-4 w-7 items-center rounded-full transition ${showMovingAvg ? 'bg-indigo-500' : 'bg-white/10'}`}>
                <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${showMovingAvg ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
              <span className="text-sm text-white/70">{labels.movingAvg}</span>
            </label>
            {showMovingAvg && (
              <div className="mt-2">
                <label className="mb-1 block text-xs text-white/40">{labels.windowSize}</label>
                <select value={maWindow} onChange={(e) => setMaWindow(Number(e.target.value))}
                  className="w-full rounded border border-white/[0.08] bg-[#111113] px-2 py-1 text-sm text-white/80 outline-none focus:border-indigo-500/50">
                  {MOVING_AVG_WINDOWS.map((w) => <option key={w} value={w}>{w} {term === 'friendly' ? 'points' : 'periods'}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Trend line toggle */}
          <div className="rounded border border-white/[0.06] bg-[#0d0d0f] p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={showTrend} onChange={(e) => setShowTrend(e.target.checked)} className="sr-only" />
              <span className={`flex h-4 w-7 items-center rounded-full transition ${showTrend ? 'bg-indigo-500' : 'bg-white/10'}`}>
                <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${showTrend ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
              <span className="text-sm text-white/70">{labels.trendLine}</span>
            </label>
          </div>

          {/* Summary stats */}
          {selectedValues.length > 0 && processedData.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">{labels.stats}</label>
              <div className="space-y-2">
                {selectedValues.map((col, ci) => {
                  const s = seriesStats[col];
                  if (!s) return null;
                  const color = SERIES_COLORS[ci % SERIES_COLORS.length];
                  return (
                    <div key={col} className="rounded border border-white/[0.06] bg-[#0d0d0f] p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium text-white/70">{col}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between text-xs"><span className="text-white/40">{labels.min}</span><span className="font-mono text-white/70">{fmt(s.min)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-white/40">{labels.max}</span><span className="font-mono text-white/70">{fmt(s.max)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-white/40">{labels.mean}</span><span className="font-mono text-white/70">{fmt(s.mean)}</span></div>
                        <div className="flex justify-between text-xs">
                          <span className="text-white/40">{labels.pctChange}</span>
                          <span className="font-mono" style={{ color: s.pctChange > 0 ? '#10b981' : s.pctChange < 0 ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>
                            {s.pctChange > 0 ? '+' : ''}{s.pctChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
