'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import { parseCsv } from '@/lib/csv-parser';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartType = 'scatter' | 'bar' | 'line' | 'histogram';
type Theme = 'dark' | 'light';

interface ChartConfig {
  chartType: ChartType;
  xVar: string;
  yVar: string;
  colorVar: string;
  title: string;
  theme: Theme;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const PALETTE = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNumeric(value: string): boolean {
  if (value === '') return false;
  return !isNaN(Number(value));
}

function columnIsNumeric(rows: Record<string, string>[], col: string): boolean {
  if (rows.length === 0) return false;
  let numCount = 0;
  const sample = rows.slice(0, Math.min(rows.length, 50));
  for (const row of sample) {
    if (isNumeric(row[col])) numCount++;
  }
  return numCount / sample.length > 0.7;
}

function niceTickValues(min: number, max: number, approxCount: number): number[] {
  if (min === max) return [min];
  const range = max - min;
  const roughStep = range / approxCount;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;
  let niceStep: number;
  if (residual <= 1.5) niceStep = 1 * mag;
  else if (residual <= 3) niceStep = 2 * mag;
  else if (residual <= 7) niceStep = 5 * mag;
  else niceStep = 10 * mag;

  const start = Math.floor(min / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(parseFloat(v.toPrecision(10)));
  }
  return ticks;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

// ---------------------------------------------------------------------------
// Chart type icons (simple SVG)
// ---------------------------------------------------------------------------

function ScatterIcon({ active }: { active: boolean }) {
  const c = active ? '#6366f1' : 'currentColor';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="5" cy="13" r="1.5" fill={c} />
      <circle cx="8" cy="8" r="1.5" fill={c} />
      <circle cx="13" cy="5" r="1.5" fill={c} />
      <circle cx="11" cy="10" r="1.5" fill={c} />
      <circle cx="6" cy="6" r="1.5" fill={c} />
    </svg>
  );
}

function BarIcon({ active }: { active: boolean }) {
  const c = active ? '#6366f1' : 'currentColor';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="10" width="3" height="6" rx="0.5" fill={c} />
      <rect x="7" y="5" width="3" height="11" rx="0.5" fill={c} />
      <rect x="12" y="7" width="3" height="9" rx="0.5" fill={c} />
    </svg>
  );
}

function LineIcon({ active }: { active: boolean }) {
  const c = active ? '#6366f1' : 'currentColor';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <polyline
        points="2,14 6,8 10,10 14,4"
        stroke={c}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="14" r="1.2" fill={c} />
      <circle cx="6" cy="8" r="1.2" fill={c} />
      <circle cx="10" cy="10" r="1.2" fill={c} />
      <circle cx="14" cy="4" r="1.2" fill={c} />
    </svg>
  );
}

function HistogramIcon({ active }: { active: boolean }) {
  const c = active ? '#6366f1' : 'currentColor';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="12" width="3" height="4" fill={c} />
      <rect x="4.5" y="8" width="3" height="8" fill={c} />
      <rect x="8" y="4" width="3" height="12" fill={c} />
      <rect x="11.5" y="9" width="3" height="7" fill={c} />
      <rect x="15" y="13" width="2" height="3" fill={c} />
    </svg>
  );
}

const CHART_ICONS: Record<ChartType, typeof ScatterIcon> = {
  scatter: ScatterIcon,
  bar: BarIcon,
  line: LineIcon,
  histogram: HistogramIcon,
};

// ---------------------------------------------------------------------------
// SVG Chart Renderer
// ---------------------------------------------------------------------------

interface ChartSvgProps {
  columns: string[];
  rows: Record<string, string>[];
  config: ChartConfig;
  width: number;
  height: number;
}

function ChartSvg({ columns, rows, config, width, height }: ChartSvgProps) {
  const { chartType, xVar, yVar, colorVar, title, theme } = config;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1a1a1d' : '#ffffff';
  const textColor = isDark ? '#e2e2e8' : '#1a1a1d';
  const mutedColor = isDark ? '#6b6b76' : '#9ca3af';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const axisBorderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)';

  // Margins
  const margin = { top: title ? 48 : 24, right: 24, bottom: 56, left: 64 };
  const plotW = Math.max(width - margin.left - margin.right, 40);
  const plotH = Math.max(height - margin.top - margin.bottom, 40);

  // All hooks called unconditionally at top level
  const colorGroups = useMemo(() => {
    if (!colorVar) return null;
    const unique = [...new Set(rows.map((r) => r[colorVar]).filter(Boolean))];
    const map: Record<string, string> = {};
    unique.forEach((val, i) => {
      map[val] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [rows, colorVar]);

  // Parse numeric points for scatter/line
  const scatterLinePoints = useMemo(() => {
    if ((chartType !== 'scatter' && chartType !== 'line') || !xVar || !yVar) return [];
    const pts: { x: number; y: number; row: Record<string, string> }[] = [];
    for (const row of rows) {
      const xv = Number(row[xVar]);
      const yv = Number(row[yVar]);
      if (!isNaN(xv) && !isNaN(yv)) pts.push({ x: xv, y: yv, row });
    }
    return pts;
  }, [chartType, xVar, yVar, rows]);

  // Sorted points for line chart
  const sortedPoints = useMemo(() => {
    if (chartType !== 'line') return scatterLinePoints;
    return [...scatterLinePoints].sort((a, b) => a.x - b.x);
  }, [chartType, scatterLinePoints]);

  // Line groups (for color-grouped lines)
  const lineGroups = useMemo(() => {
    if (chartType !== 'line' || sortedPoints.length === 0) return null;
    if (!colorVar || !colorGroups) {
      return { _all: { color: PALETTE[0], points: sortedPoints } };
    }
    const groups: Record<string, { color: string; points: typeof sortedPoints }> = {};
    for (const pt of sortedPoints) {
      const key = pt.row[colorVar] || '_none';
      if (!groups[key]) {
        const colorIdx = Object.keys(groups).length;
        groups[key] = {
          color: colorGroups[key] || PALETTE[colorIdx % PALETTE.length],
          points: [],
        };
      }
      groups[key].points.push(pt);
    }
    return groups;
  }, [sortedPoints, colorVar, colorGroups, chartType]);

  // Bar chart grouping
  const barGrouped = useMemo(() => {
    if (chartType !== 'bar' || !xVar || !yVar) return {};
    const map: Record<string, { total: number; count: number; byColor: Record<string, number> }> = {};
    for (const row of rows) {
      const xVal = row[xVar] || '(empty)';
      const yVal = Number(row[yVar]);
      if (isNaN(yVal)) continue;
      if (!map[xVal]) map[xVal] = { total: 0, count: 0, byColor: {} };
      map[xVal].total += yVal;
      map[xVal].count += 1;
      if (colorVar) {
        const cv = row[colorVar] || '(none)';
        map[xVal].byColor[cv] = (map[xVal].byColor[cv] || 0) + yVal;
      }
    }
    return map;
  }, [chartType, rows, xVar, yVar, colorVar]);

  // Helper function
  function getColor(row: Record<string, string>, fallbackIdx: number): string {
    if (colorGroups && colorVar && row[colorVar] && colorGroups[row[colorVar]]) {
      return colorGroups[row[colorVar]];
    }
    return PALETTE[fallbackIdx % PALETTE.length];
  }

  // Shared empty message renderer
  function renderEmpty(msg: string) {
    return (
      <svg width={width} height={height}>
        <rect width={width} height={height} fill={bgColor} rx="8" />
        <text x={width / 2} y={height / 2} textAnchor="middle" fill={mutedColor} fontSize="13">
          {msg}
        </text>
      </svg>
    );
  }

  // Shared title element
  function renderTitle() {
    if (!title) return null;
    return (
      <text
        x={width / 2}
        y={24}
        textAnchor="middle"
        fill={textColor}
        fontSize="14"
        fontWeight="600"
      >
        {title}
      </text>
    );
  }

  // Shared axes
  function renderAxes() {
    return (
      <>
        <line
          x1={margin.left}
          x2={margin.left + plotW}
          y1={margin.top + plotH}
          y2={margin.top + plotH}
          stroke={axisBorderColor}
          strokeWidth="1"
        />
        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={margin.top + plotH}
          stroke={axisBorderColor}
          strokeWidth="1"
        />
      </>
    );
  }

  // Shared legend
  function renderLegend(groups: Record<string, string>) {
    return (
      <g>
        {Object.entries(groups).map(([label, color], i) => (
          <g
            key={label}
            transform={`translate(${margin.left + plotW - 10}, ${margin.top + 8 + i * 18})`}
          >
            <rect x={-50} y={-6} width="10" height="10" rx="2" fill={color} />
            <text x={-36} y={3} fill={mutedColor} fontSize="9">
              {label.length > 12 ? label.slice(0, 12) + '...' : label}
            </text>
          </g>
        ))}
      </g>
    );
  }

  // --- SCATTER / LINE ---
  if (chartType === 'scatter' || chartType === 'line') {
    if (!xVar || !yVar) return renderEmpty('Select both X and Y variables');

    const points = chartType === 'line' ? sortedPoints : scatterLinePoints;
    if (points.length === 0) return renderEmpty('No numeric data for selected variables');

    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const yMin = Math.min(...points.map((p) => p.y));
    const yMax = Math.max(...points.map((p) => p.y));

    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;

    const xDomMin = xMin - xPad;
    const xDomMax = xMax + xPad;
    const yDomMin = yMin - yPad;
    const yDomMax = yMax + yPad;

    const sx = (v: number) => margin.left + ((v - xDomMin) / (xDomMax - xDomMin)) * plotW;
    const sy = (v: number) => margin.top + plotH - ((v - yDomMin) / (yDomMax - yDomMin)) * plotH;

    const xTicks = niceTickValues(xDomMin, xDomMax, 6);
    const yTicks = niceTickValues(yDomMin, yDomMax, 5);

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <rect width={width} height={height} fill={bgColor} rx="8" />
        {renderTitle()}
        {/* Grid lines */}
        {yTicks.map((t) => (
          <line
            key={`yg-${t}`}
            x1={margin.left}
            x2={margin.left + plotW}
            y1={sy(t)}
            y2={sy(t)}
            stroke={gridColor}
            strokeWidth="1"
          />
        ))}
        {xTicks.map((t) => (
          <line
            key={`xg-${t}`}
            x1={sx(t)}
            x2={sx(t)}
            y1={margin.top}
            y2={margin.top + plotH}
            stroke={gridColor}
            strokeWidth="1"
          />
        ))}
        {renderAxes()}
        {/* X ticks + labels */}
        {xTicks.map((t) => (
          <g key={`xt-${t}`}>
            <line
              x1={sx(t)}
              x2={sx(t)}
              y1={margin.top + plotH}
              y2={margin.top + plotH + 5}
              stroke={axisBorderColor}
              strokeWidth="1"
            />
            <text
              x={sx(t)}
              y={margin.top + plotH + 18}
              textAnchor="middle"
              fill={mutedColor}
              fontSize="10"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        {/* Y ticks + labels */}
        {yTicks.map((t) => (
          <g key={`yt-${t}`}>
            <line
              x1={margin.left - 5}
              x2={margin.left}
              y1={sy(t)}
              y2={sy(t)}
              stroke={axisBorderColor}
              strokeWidth="1"
            />
            <text
              x={margin.left - 10}
              y={sy(t) + 3.5}
              textAnchor="end"
              fill={mutedColor}
              fontSize="10"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        {/* Axis labels */}
        <text
          x={margin.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="500"
        >
          {xVar}
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="500"
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          {yVar}
        </text>
        {/* Scatter data points */}
        {chartType === 'scatter' &&
          scatterLinePoints.map((pt, i) => (
            <circle
              key={i}
              cx={sx(pt.x)}
              cy={sy(pt.y)}
              r={4}
              fill={getColor(pt.row, 0)}
              opacity={0.8}
            >
              <title>
                {xVar}: {pt.x}, {yVar}: {pt.y}
              </title>
            </circle>
          ))}
        {/* Line chart paths + dots */}
        {chartType === 'line' &&
          lineGroups &&
          Object.entries(lineGroups).map(([key, group]) => {
            const pathD = group.points
              .map((pt, i) => `${i === 0 ? 'M' : 'L'}${sx(pt.x)},${sy(pt.y)}`)
              .join(' ');
            return (
              <g key={key}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={group.color}
                  strokeWidth="2"
                  opacity={0.9}
                />
                {group.points.map((pt, i) => (
                  <circle key={i} cx={sx(pt.x)} cy={sy(pt.y)} r={3} fill={group.color}>
                    <title>
                      {xVar}: {pt.x}, {yVar}: {pt.y}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        {/* Legend */}
        {colorGroups && renderLegend(colorGroups)}
      </svg>
    );
  }

  // --- BAR ---
  if (chartType === 'bar') {
    if (!xVar || !yVar) return renderEmpty('Select both X and Y variables');

    const categories = Object.keys(barGrouped);
    if (categories.length === 0) return renderEmpty('No data for selected variables');

    const values = categories.map((cat) => barGrouped[cat].total);
    const yMin = Math.min(0, ...values);
    const yMax = Math.max(...values);
    const yPad = (yMax - yMin) * 0.05 || 1;
    const yDomMin = Math.min(0, yMin - yPad);
    const yDomMax = yMax + yPad;

    const yTicks = niceTickValues(yDomMin, yDomMax, 5);

    const barGap = Math.max(2, (plotW * 0.1) / categories.length);
    const barWidth = Math.max(4, (plotW - barGap * (categories.length + 1)) / categories.length);

    const sy = (v: number) => margin.top + plotH - ((v - yDomMin) / (yDomMax - yDomMin)) * plotH;
    const zeroY = sy(0);

    const allColorKeys = colorVar
      ? [...new Set(rows.map((r) => r[colorVar] || '(none)').filter(Boolean))]
      : [];

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <rect width={width} height={height} fill={bgColor} rx="8" />
        {renderTitle()}
        {/* Grid */}
        {yTicks.map((t) => (
          <line
            key={`yg-${t}`}
            x1={margin.left}
            x2={margin.left + plotW}
            y1={sy(t)}
            y2={sy(t)}
            stroke={gridColor}
            strokeWidth="1"
          />
        ))}
        {renderAxes()}
        {/* Y ticks */}
        {yTicks.map((t) => (
          <g key={`yt-${t}`}>
            <line
              x1={margin.left - 5}
              x2={margin.left}
              y1={sy(t)}
              y2={sy(t)}
              stroke={axisBorderColor}
              strokeWidth="1"
            />
            <text
              x={margin.left - 10}
              y={sy(t) + 3.5}
              textAnchor="end"
              fill={mutedColor}
              fontSize="10"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        {/* Bars */}
        {categories.map((cat, i) => {
          const bx = margin.left + barGap + i * (barWidth + barGap);

          if (colorVar && allColorKeys.length > 0) {
            let cumY = 0;
            return (
              <g key={cat}>
                {allColorKeys.map((ck, ci) => {
                  const val = barGrouped[cat].byColor[ck] || 0;
                  const barH = (val / (yDomMax - yDomMin)) * plotH;
                  const rectY = zeroY - cumY - barH;
                  cumY += barH;
                  return (
                    <rect
                      key={ck}
                      x={bx}
                      y={rectY}
                      width={barWidth}
                      height={Math.max(0, barH)}
                      fill={PALETTE[ci % PALETTE.length]}
                      rx="2"
                      opacity={0.85}
                    >
                      <title>
                        {cat} / {ck}: {val}
                      </title>
                    </rect>
                  );
                })}
                <text
                  x={bx + barWidth / 2}
                  y={margin.top + plotH + 16}
                  textAnchor="middle"
                  fill={mutedColor}
                  fontSize={Math.min(10, barWidth * 0.6)}
                >
                  {cat.length > 8 ? cat.slice(0, 8) + '..' : cat}
                </text>
              </g>
            );
          }

          const val = barGrouped[cat].total;
          const barH = ((val - Math.min(0, yDomMin)) / (yDomMax - yDomMin)) * plotH;
          const rectY = zeroY - barH;

          return (
            <g key={cat}>
              <rect
                x={bx}
                y={rectY}
                width={barWidth}
                height={Math.max(0, zeroY - rectY)}
                fill={PALETTE[i % PALETTE.length]}
                rx="2"
                opacity={0.85}
              >
                <title>
                  {cat}: {val}
                </title>
              </rect>
              <text
                x={bx + barWidth / 2}
                y={margin.top + plotH + 16}
                textAnchor="middle"
                fill={mutedColor}
                fontSize={Math.min(10, Math.max(7, barWidth * 0.5))}
              >
                {cat.length > 8 ? cat.slice(0, 8) + '..' : cat}
              </text>
            </g>
          );
        })}
        {/* Axis labels */}
        <text
          x={margin.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="500"
        >
          {xVar}
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="500"
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          {yVar}
        </text>
        {/* Legend for stacked bars */}
        {colorVar &&
          allColorKeys.length > 0 &&
          renderLegend(
            Object.fromEntries(allColorKeys.map((ck, i) => [ck, PALETTE[i % PALETTE.length]])),
          )}
      </svg>
    );
  }

  // --- HISTOGRAM ---
  if (chartType === 'histogram') {
    const histVar = xVar || yVar;
    if (!histVar) return renderEmpty('Select a variable for the histogram');

    const numericVals = rows.map((r) => Number(r[histVar])).filter((v) => !isNaN(v));
    if (numericVals.length === 0) return renderEmpty(`No numeric data for "${histVar}"`);

    const vMin = Math.min(...numericVals);
    const vMax = Math.max(...numericVals);
    const binCount = Math.min(30, Math.max(5, Math.ceil(Math.sqrt(numericVals.length))));
    const binWidth = (vMax - vMin) / binCount || 1;
    const bins: { start: number; end: number; count: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      bins.push({
        start: vMin + i * binWidth,
        end: vMin + (i + 1) * binWidth,
        count: 0,
      });
    }
    for (const v of numericVals) {
      let idx = Math.floor((v - vMin) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx].count++;
    }

    const maxCount = Math.max(...bins.map((b) => b.count));
    const yDomMax = maxCount * 1.1 || 1;

    const yTicks = niceTickValues(0, yDomMax, 5);
    const xTicks = niceTickValues(vMin, vMax, 6);

    const sx = (v: number) => margin.left + ((v - vMin) / (vMax - vMin || 1)) * plotW;
    const sy = (v: number) => margin.top + plotH - (v / yDomMax) * plotH;

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <rect width={width} height={height} fill={bgColor} rx="8" />
        {renderTitle()}
        {/* Grid */}
        {yTicks.map((t) => (
          <line
            key={`yg-${t}`}
            x1={margin.left}
            x2={margin.left + plotW}
            y1={sy(t)}
            y2={sy(t)}
            stroke={gridColor}
            strokeWidth="1"
          />
        ))}
        {renderAxes()}
        {/* X ticks */}
        {xTicks.map((t) => (
          <g key={`xt-${t}`}>
            <line
              x1={sx(t)}
              x2={sx(t)}
              y1={margin.top + plotH}
              y2={margin.top + plotH + 5}
              stroke={axisBorderColor}
              strokeWidth="1"
            />
            <text
              x={sx(t)}
              y={margin.top + plotH + 18}
              textAnchor="middle"
              fill={mutedColor}
              fontSize="10"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        {/* Y ticks */}
        {yTicks.map((t) => (
          <g key={`yt-${t}`}>
            <line
              x1={margin.left - 5}
              x2={margin.left}
              y1={sy(t)}
              y2={sy(t)}
              stroke={axisBorderColor}
              strokeWidth="1"
            />
            <text
              x={margin.left - 10}
              y={sy(t) + 3.5}
              textAnchor="end"
              fill={mutedColor}
              fontSize="10"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        {/* Histogram bars */}
        {bins.map((bin, i) => {
          const bx = sx(bin.start);
          const bw = sx(bin.end) - sx(bin.start);
          const barH = (bin.count / yDomMax) * plotH;
          return (
            <rect
              key={i}
              x={bx + 0.5}
              y={margin.top + plotH - barH}
              width={Math.max(0, bw - 1)}
              height={Math.max(0, barH)}
              fill={PALETTE[0]}
              opacity={0.8}
              rx="1"
            >
              <title>
                {bin.start.toFixed(2)} - {bin.end.toFixed(2)}: {bin.count}
              </title>
            </rect>
          );
        })}
        {/* Axis labels */}
        <text
          x={margin.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="500"
        >
          {histVar}
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="500"
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          Frequency
        </text>
      </svg>
    );
  }

  // Fallback
  return renderEmpty('Unsupported chart type');
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GraphBuilderTab({ tabId, datasetId, sourceUrl }: TabComponentProps) {
  const { datasets, activeDataset, currentProject } = useWorkspace();
  const { features } = useSkillLevel();
  const { data: sharedData } = useSpreadsheetData();
  const { tabs } = useTabs();

  // Data state
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('');

  // Available spreadsheet tabs for the data source picker
  const spreadsheetTabs = useMemo(() => {
    return tabs
      .filter((t) => t.type === 'spreadsheet' && sharedData[t.id]?.columns.length > 0)
      .map((t) => ({ id: t.id, title: t.title, rowCount: sharedData[t.id]?.rows.length ?? 0 }));
  }, [tabs, sharedData]);

  // Chart config
  const [config, setConfig] = useState<ChartConfig>({
    chartType: 'scatter',
    xVar: '',
    yVar: '',
    colorVar: '',
    title: '',
    theme: 'dark',
  });

  // Container sizing
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setChartSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load data from sourceUrl
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

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  // Load data from datasetId
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

    return () => {
      cancelled = true;
    };
  }, [datasetId, currentProject, datasets]);

  // Auto-load from shared spreadsheet store if no explicit source
  useEffect(() => {
    if (sourceUrl || datasetId) return;
    if (columns.length > 0) return; // Already have data

    // Find the first spreadsheet tab with data
    const firstTab = spreadsheetTabs[0];
    if (firstTab) {
      const tabData = sharedData[firstTab.id];
      if (tabData) {
        setColumns(tabData.columns);
        setRows(tabData.rows);
        setDataSource(firstTab.id);
      }
    }
  }, [sourceUrl, datasetId, spreadsheetTabs, sharedData, columns.length]);

  // Allow switching data source from open spreadsheets
  const handleSwitchDataSource = useCallback(
    (tabSourceId: string) => {
      const tabData = sharedData[tabSourceId];
      if (tabData) {
        setColumns(tabData.columns);
        setRows(tabData.rows);
        setDataSource(tabSourceId);
      }
    },
    [sharedData],
  );

  // Analyze columns
  const numericColumns = useMemo(
    () => columns.filter((col) => columnIsNumeric(rows, col)),
    [columns, rows],
  );
  const categoricalColumns = useMemo(
    () => columns.filter((col) => !columnIsNumeric(rows, col)),
    [columns, rows],
  );

  // Auto-select variables when data loads
  useEffect(() => {
    if (columns.length === 0) return;
    setConfig((prev) => {
      const updates: Partial<ChartConfig> = {};
      if (!prev.xVar || !columns.includes(prev.xVar)) {
        updates.xVar = numericColumns[0] || columns[0] || '';
      }
      if (!prev.yVar || !columns.includes(prev.yVar)) {
        updates.yVar = numericColumns[1] || numericColumns[0] || columns[1] || columns[0] || '';
      }
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [columns, numericColumns]);

  // Terminology labels
  const labels = useMemo(() => {
    const t = features.terminology;
    return {
      chartType: t === 'friendly' ? 'Chart Style' : 'Chart Type',
      xAxis: t === 'friendly' ? 'Horizontal' : 'X Variable',
      yAxis: t === 'friendly' ? 'Vertical' : 'Y Variable',
      colorBy: t === 'friendly' ? 'Color by' : 'Group / Color',
      title: 'Title',
      theme: 'Theme',
      scatter: t === 'friendly' ? 'Dots' : 'Scatter',
      bar: 'Bar',
      line: 'Line',
      histogram: t === 'friendly' ? 'Distribution' : 'Histogram',
    };
  }, [features.terminology]);

  const updateConfig = useCallback(
    <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Determine chart type labels
  const chartTypes: { type: ChartType; label: string }[] = [
    { type: 'scatter', label: labels.scatter },
    { type: 'bar', label: labels.bar },
    { type: 'line', label: labels.line },
    { type: 'histogram', label: labels.histogram },
  ];

  // Determine which columns to show in dropdowns based on chart type
  const xOptions = useMemo(() => {
    if (config.chartType === 'bar') return columns;
    if (config.chartType === 'histogram') return numericColumns;
    return numericColumns.length > 0 ? numericColumns : columns;
  }, [config.chartType, columns, numericColumns]);

  const yOptions = useMemo(() => {
    if (config.chartType === 'histogram') return [];
    return numericColumns.length > 0 ? numericColumns : columns;
  }, [config.chartType, columns, numericColumns]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted/40">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.25"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Loading data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">{error}</div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-3">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            className="mx-auto opacity-30"
          >
            <rect x="8" y="32" width="6" height="10" rx="1" fill="currentColor" />
            <rect x="18" y="22" width="6" height="20" rx="1" fill="currentColor" />
            <rect x="28" y="14" width="6" height="28" rx="1" fill="currentColor" />
            <rect x="38" y="26" width="6" height="16" rx="1" fill="currentColor" />
          </svg>
          <p className="text-sm">Graph Builder</p>
          <p className="text-[11px] text-muted/30">
            Open a dataset or load data to start building charts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ---------- Chart Preview (left 70%) ---------- */}
      <div ref={chartContainerRef} className="flex-[7] min-w-0 p-3 overflow-hidden">
        <ChartSvg
          columns={columns}
          rows={rows}
          config={config}
          width={chartSize.width}
          height={chartSize.height}
        />
      </div>

      {/* ---------- Config Panel (right 30%) ---------- */}
      <div
        className={`flex-[3] min-w-[220px] max-w-[320px] border-l overflow-y-auto p-4 space-y-5 ${
          config.theme === 'dark'
            ? 'border-white/5 bg-[#111113]'
            : 'border-black/10 bg-gray-50'
        }`}
      >
        {/* Data Source Picker (when multiple spreadsheets open) */}
        {spreadsheetTabs.length > 1 && (
          <div className="space-y-1.5">
            <label
              className={`text-[10px] font-medium uppercase tracking-wider ${
                config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
              }`}
            >
              Data Source
            </label>
            <select
              value={dataSource}
              onChange={(e) => handleSwitchDataSource(e.target.value)}
              className={`w-full rounded-md px-3 py-1.5 text-xs outline-none transition-colors ${
                config.theme === 'dark'
                  ? 'bg-white/[0.05] text-white/80 border border-white/10 focus:border-indigo-500/40'
                  : 'bg-white text-gray-800 border border-gray-200 focus:border-indigo-300'
              }`}
            >
              {spreadsheetTabs.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.title} ({st.rowCount} rows)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Chart Type */}
        <div className="space-y-2">
          <label
            className={`text-[10px] font-medium uppercase tracking-wider ${
              config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
            }`}
          >
            {labels.chartType}
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {chartTypes.map(({ type, label }) => {
              const Icon = CHART_ICONS[type];
              const isActive = config.chartType === type;
              return (
                <button
                  key={type}
                  onClick={() => updateConfig('chartType', type)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-md text-[9px] font-medium transition-all ${
                    isActive
                      ? config.theme === 'dark'
                        ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                        : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'
                      : config.theme === 'dark'
                        ? 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                        : 'bg-white text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                >
                  <Icon active={isActive} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* X Variable */}
        <div className="space-y-1.5">
          <label
            className={`text-[10px] font-medium uppercase tracking-wider ${
              config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
            }`}
          >
            {labels.xAxis}
          </label>
          <select
            value={config.xVar}
            onChange={(e) => updateConfig('xVar', e.target.value)}
            className={`w-full rounded-md px-3 py-1.5 text-xs outline-none transition-colors ${
              config.theme === 'dark'
                ? 'bg-white/[0.05] text-white/80 border border-white/10 focus:border-indigo-500/40'
                : 'bg-white text-gray-800 border border-gray-200 focus:border-indigo-300'
            }`}
          >
            <option value="">-- select --</option>
            {xOptions.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        {/* Y Variable (hidden for histogram) */}
        {config.chartType !== 'histogram' && (
          <div className="space-y-1.5">
            <label
              className={`text-[10px] font-medium uppercase tracking-wider ${
                config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
              }`}
            >
              {labels.yAxis}
            </label>
            <select
              value={config.yVar}
              onChange={(e) => updateConfig('yVar', e.target.value)}
              className={`w-full rounded-md px-3 py-1.5 text-xs outline-none transition-colors ${
                config.theme === 'dark'
                  ? 'bg-white/[0.05] text-white/80 border border-white/10 focus:border-indigo-500/40'
                  : 'bg-white text-gray-800 border border-gray-200 focus:border-indigo-300'
              }`}
            >
              <option value="">-- select --</option>
              {yOptions.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color / Group by */}
        <div className="space-y-1.5">
          <label
            className={`text-[10px] font-medium uppercase tracking-wider ${
              config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
            }`}
          >
            {labels.colorBy}
          </label>
          <select
            value={config.colorVar}
            onChange={(e) => updateConfig('colorVar', e.target.value)}
            className={`w-full rounded-md px-3 py-1.5 text-xs outline-none transition-colors ${
              config.theme === 'dark'
                ? 'bg-white/[0.05] text-white/80 border border-white/10 focus:border-indigo-500/40'
                : 'bg-white text-gray-800 border border-gray-200 focus:border-indigo-300'
            }`}
          >
            <option value="">None</option>
            {categoricalColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
            {numericColumns.map((col) => (
              <option key={`num-${col}`} value={col}>
                {col} (numeric)
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label
            className={`text-[10px] font-medium uppercase tracking-wider ${
              config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
            }`}
          >
            {labels.title}
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => updateConfig('title', e.target.value)}
            placeholder="Chart title..."
            className={`w-full rounded-md px-3 py-1.5 text-xs outline-none transition-colors ${
              config.theme === 'dark'
                ? 'bg-white/[0.05] text-white/80 border border-white/10 focus:border-indigo-500/40 placeholder:text-white/20'
                : 'bg-white text-gray-800 border border-gray-200 focus:border-indigo-300 placeholder:text-gray-300'
            }`}
          />
        </div>

        {/* Theme toggle */}
        <div className="space-y-1.5">
          <label
            className={`text-[10px] font-medium uppercase tracking-wider ${
              config.theme === 'dark' ? 'text-white/40' : 'text-gray-500'
            }`}
          >
            {labels.theme}
          </label>
          <div className="flex gap-1.5">
            {(['dark', 'light'] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => updateConfig('theme', t)}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                  config.theme === t
                    ? t === 'dark'
                      ? 'bg-white/10 text-white ring-1 ring-white/20'
                      : 'bg-gray-800 text-white ring-1 ring-gray-600'
                    : config.theme === 'dark'
                      ? 'bg-white/[0.03] text-white/30 hover:bg-white/[0.06]'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>

        {/* Data info */}
        <div
          className={`pt-3 border-t space-y-1 ${
            config.theme === 'dark' ? 'border-white/5' : 'border-gray-200'
          }`}
        >
          <p
            className={`text-[10px] ${
              config.theme === 'dark' ? 'text-white/25' : 'text-gray-400'
            }`}
          >
            {rows.length.toLocaleString()} rows &middot; {columns.length} columns
          </p>
          <p
            className={`text-[10px] ${
              config.theme === 'dark' ? 'text-white/25' : 'text-gray-400'
            }`}
          >
            {numericColumns.length} numeric &middot; {categoricalColumns.length} categorical
          </p>
        </div>

        {/* Export */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const svgEl = chartContainerRef.current?.querySelector('svg');
              if (!svgEl) return;
              const svgData = new XMLSerializer().serializeToString(svgEl);
              const blob = new Blob([svgData], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${config.title || 'chart'}.svg`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              config.theme === 'dark'
                ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/70'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            Export SVG
          </button>
          <button
            onClick={() => {
              const svgEl = chartContainerRef.current?.querySelector('svg');
              if (!svgEl) return;
              const svgData = new XMLSerializer().serializeToString(svgEl);
              const canvas = document.createElement('canvas');
              const scale = 2; // 2x for high DPI
              canvas.width = chartSize.width * scale;
              canvas.height = chartSize.height * scale;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const url = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = url;
                a.download = `${config.title || 'chart'}.png`;
                a.click();
              };
              img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            }}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              config.theme === 'dark'
                ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/70'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}
