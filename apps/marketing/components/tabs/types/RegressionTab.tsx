'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSpreadsheetData, type ColumnStats } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  stdError: number;
  tStat: number;
  pValue: number;
}

interface RegressionResult {
  coefficients: RegressionCoefficient[];
  rSquared: number;
  adjRSquared: number;
  fStatistic: number;
  fPValue: number;
  nObs: number;
  nPredictors: number;
  residualStdError: number;
  ssr: number;
  sse: number;
  sst: number;
  dof: number;
  fitted: number[];
  residuals: number[];
  yActual: number[];
}

// ---------------------------------------------------------------------------
// Matrix utilities
// ---------------------------------------------------------------------------

type Matrix = number[][];

function matCreate(rows: number, cols: number): Matrix {
  const m: Matrix = [];
  for (let i = 0; i < rows; i++) {
    m.push(new Array(cols).fill(0));
  }
  return m;
}

function matTranspose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0].length;
  const t = matCreate(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      t[j][i] = a[i][j];
    }
  }
  return t;
}

function matMultiply(a: Matrix, b: Matrix): Matrix {
  const aRows = a.length;
  const aCols = a[0].length;
  const bCols = b[0].length;
  const result = matCreate(aRows, bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matInverse(mat: Matrix): Matrix | null {
  const n = mat.length;
  if (n === 0 || mat[0].length !== n) return null;

  // Build augmented matrix [A | I]
  const aug = matCreate(n, 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      aug[i][j] = mat[i][j];
    }
    aug[i][n + i] = 1;
  }

  // Gauss-Jordan elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) return null; // Singular matrix

    // Swap rows
    if (maxRow !== col) {
      const temp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = temp;
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse
  const inv = matCreate(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inv[i][j] = aug[i][n + j];
    }
  }
  return inv;
}

function matVecMultiply(mat: Matrix, vec: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < mat.length; i++) {
    let sum = 0;
    for (let j = 0; j < vec.length; j++) {
      sum += mat[i][j] * vec[j];
    }
    result.push(sum);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Statistical functions
// ---------------------------------------------------------------------------

/** Standard normal CDF using rational approximation (Abramowitz & Stegun) */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/** Two-tailed p-value from t-statistic using normal approximation for large df */
function tTestPValue(tStat: number, df: number): number {
  if (df <= 0) return 1;

  // For df > 30, normal approximation is adequate
  // For smaller df, use a better approximation via the regularized incomplete beta
  // Here we use a refined approximation: t-distribution -> normal via Cornish-Fisher
  let z: number;
  if (df > 100) {
    z = tStat;
  } else {
    // Approximation: z = t * (1 - 1/(4*df)) / sqrt(1 + t^2/(2*df))
    // This is a well-known approximation that works reasonably well
    const t2 = tStat * tStat;
    z = tStat * Math.sqrt((df - 1.5) / (df * (1 + t2 / (2 * df)))) * (1 + (3 * t2 - df) / (20 * df * df));
    // Fallback for very small df: simpler approximation
    if (df <= 5) {
      z = tStat / Math.sqrt(1 + t2 / df);
    }
  }

  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return Math.max(0, Math.min(1, p));
}

/** Significance stars */
function sigStars(p: number): string {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  if (p < 0.1) return '.';
  return '';
}

// ---------------------------------------------------------------------------
// OLS Regression Engine
// ---------------------------------------------------------------------------

function olsRegression(
  rows: Record<string, string>[],
  yVar: string,
  xVars: string[],
): RegressionResult | { error: string } {
  // Parse data: only keep rows where all variables are valid numeric
  const parsedRows: { y: number; x: number[] }[] = [];
  for (const row of rows) {
    const yRaw = (row[yVar] ?? '').replace(/,/g, '');
    const yVal = parseFloat(yRaw);
    if (isNaN(yVal)) continue;

    let valid = true;
    const xVals: number[] = [];
    for (const xv of xVars) {
      const xRaw = (row[xv] ?? '').replace(/,/g, '');
      const xVal = parseFloat(xRaw);
      if (isNaN(xVal)) {
        valid = false;
        break;
      }
      xVals.push(xVal);
    }
    if (!valid) continue;
    parsedRows.push({ y: yVal, x: xVals });
  }

  const n = parsedRows.length;
  const k = xVars.length; // number of predictors (excluding intercept)

  if (n === 0) return { error: 'No valid observations. Check that selected columns contain numeric data.' };
  if (n <= k + 1) return { error: `Insufficient observations (${n}) for ${k + 1} parameters. Need at least ${k + 2}.` };

  // Build X matrix (n x (k+1)) with intercept column of 1s
  const X: Matrix = [];
  const yVec: number[] = [];
  for (const pr of parsedRows) {
    X.push([1, ...pr.x]);
    yVec.push(pr.y);
  }

  // Compute X'X
  const Xt = matTranspose(X);
  const XtX = matMultiply(Xt, X);

  // Compute (X'X)^-1
  const XtXinv = matInverse(XtX);
  if (!XtXinv) {
    return { error: 'Matrix is singular (perfect multicollinearity detected). Remove a redundant variable.' };
  }

  // Compute X'y
  const Xty: number[] = [];
  for (let j = 0; j < k + 1; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += X[i][j] * yVec[i];
    }
    Xty.push(sum);
  }

  // beta = (X'X)^-1 * X'y
  const beta = matVecMultiply(XtXinv, Xty);

  // Fitted values = X * beta
  const fitted: number[] = [];
  for (let i = 0; i < n; i++) {
    let yHat = 0;
    for (let j = 0; j < k + 1; j++) {
      yHat += X[i][j] * beta[j];
    }
    fitted.push(yHat);
  }

  // Residuals = y - fitted
  const residuals = yVec.map((y, i) => y - fitted[i]);

  // SSR (sum of squared residuals / errors)
  const sse = residuals.reduce((s, r) => s + r * r, 0);

  // SST (total sum of squares)
  const yMean = yVec.reduce((s, y) => s + y, 0) / n;
  const sst = yVec.reduce((s, y) => s + (y - yMean) ** 2, 0);

  // SSR (regression sum of squares)
  const ssr = sst - sse;

  // Degrees of freedom
  const dof = n - k - 1;

  // R-squared
  const rSquared = sst === 0 ? 1 : 1 - sse / sst;
  const adjRSquared = sst === 0 ? 1 : 1 - ((1 - rSquared) * (n - 1)) / dof;

  // Residual standard error
  const residualStdError = Math.sqrt(sse / dof);

  // Standard errors of coefficients: sqrt(diag((X'X)^-1) * s^2)
  const s2 = sse / dof;
  const stdErrors: number[] = [];
  for (let j = 0; j < k + 1; j++) {
    stdErrors.push(Math.sqrt(XtXinv[j][j] * s2));
  }

  // t-statistics and p-values
  const coefficients: RegressionCoefficient[] = [];
  const varNames = ['(Intercept)', ...xVars];
  for (let j = 0; j < k + 1; j++) {
    const tStat = stdErrors[j] === 0 ? 0 : beta[j] / stdErrors[j];
    const pValue = tTestPValue(tStat, dof);
    coefficients.push({
      variable: varNames[j],
      coefficient: beta[j],
      stdError: stdErrors[j],
      tStat,
      pValue,
    });
  }

  // F-statistic: (SSR / k) / (SSE / (n-k-1))
  const fStatistic = k > 0 && dof > 0 ? (ssr / k) / (sse / dof) : 0;
  // F p-value approximation using chi-squared / normal approximation
  // For large df, F ~ chi^2(k)/k, and we approximate with normal
  const fPValue = k > 0 ? tTestPValue(Math.sqrt(fStatistic), dof) : 1;

  return {
    coefficients,
    rSquared,
    adjRSquared,
    fStatistic,
    fPValue,
    nObs: n,
    nPredictors: k,
    residualStdError,
    ssr,
    sse,
    sst,
    dof,
    fitted,
    residuals,
    yActual: yVec,
  };
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

function fmtCoef(n: number): string {
  if (n === 0) return '0.0000';
  if (Math.abs(n) >= 1e8) return n.toExponential(4);
  if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(4);
  return n.toFixed(4);
}

function fmtSE(n: number): string {
  if (n === 0) return '0.0000';
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  if (Math.abs(n) < 0.001) return n.toExponential(3);
  return n.toFixed(4);
}

function fmtT(n: number): string {
  return n.toFixed(3);
}

function fmtP(p: number): string {
  if (p < 0.0001) return p.toExponential(2);
  if (p < 0.001) return p.toFixed(4);
  return p.toFixed(3);
}

function fmtR2(n: number): string {
  return n.toFixed(4);
}

function fmtStat(n: number): string {
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(3);
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// SVG Scatter Plot helper
// ---------------------------------------------------------------------------

interface ScatterPlotProps {
  xData: number[];
  yData: number[];
  xLabel: string;
  yLabel: string;
  title: string;
  width: number;
  height: number;
  color?: string;
  showDiagonal?: boolean;
}

function ScatterPlot({
  xData,
  yData,
  xLabel,
  yLabel,
  title,
  width,
  height,
  color = '#6366f1',
  showDiagonal = false,
}: ScatterPlotProps) {
  if (xData.length === 0) return null;

  const margin = { top: 32, right: 16, bottom: 44, left: 56 };
  const plotW = Math.max(width - margin.left - margin.right, 40);
  const plotH = Math.max(height - margin.top - margin.bottom, 40);

  const xMin = Math.min(...xData);
  const xMax = Math.max(...xData);
  const yMin = Math.min(...yData);
  const yMax = Math.max(...yData);

  const xPad = (xMax - xMin) * 0.08 || 1;
  const yPad = (yMax - yMin) * 0.08 || 1;

  const xDomMin = xMin - xPad;
  const xDomMax = xMax + xPad;
  const yDomMin = yMin - yPad;
  const yDomMax = yMax + yPad;

  const sx = (v: number) => margin.left + ((v - xDomMin) / (xDomMax - xDomMin)) * plotW;
  const sy = (v: number) => margin.top + plotH - ((v - yDomMin) / (yDomMax - yDomMin)) * plotH;

  // Generate nice tick values
  function niceTicks(min: number, max: number, count: number): number[] {
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
    for (let v = start; v <= max + step * 0.01; v += step) {
      ticks.push(parseFloat(v.toPrecision(10)));
    }
    return ticks;
  }

  function fmtTick(v: number): string {
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    if (Number.isInteger(v)) return String(v);
    if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
    return v.toFixed(2);
  }

  const xTicks = niceTicks(xDomMin, xDomMax, 5);
  const yTicks = niceTicks(yDomMin, yDomMax, 5);

  const textColor = '#e2e2e8';
  const mutedColor = '#6b6b76';
  const gridColor = 'rgba(255,255,255,0.06)';
  const axisBorder = 'rgba(255,255,255,0.15)';

  // Limit points rendered for performance
  const maxPoints = 2000;
  const step = xData.length > maxPoints ? Math.ceil(xData.length / maxPoints) : 1;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#1a1a1d" rx="6" />

      {/* Title */}
      <text x={width / 2} y={20} textAnchor="middle" fill={textColor} fontSize="11" fontWeight="600">
        {title}
      </text>

      {/* Grid */}
      {yTicks.map((t) => (
        <line
          key={`yg-${t}`}
          x1={margin.left}
          x2={margin.left + plotW}
          y1={sy(t)}
          y2={sy(t)}
          stroke={gridColor}
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
        />
      ))}

      {/* Axes */}
      <line
        x1={margin.left}
        x2={margin.left + plotW}
        y1={margin.top + plotH}
        y2={margin.top + plotH}
        stroke={axisBorder}
      />
      <line
        x1={margin.left}
        x2={margin.left}
        y1={margin.top}
        y2={margin.top + plotH}
        stroke={axisBorder}
      />

      {/* X ticks */}
      {xTicks.map((t) => (
        <g key={`xt-${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={margin.top + plotH} y2={margin.top + plotH + 4} stroke={axisBorder} />
          <text x={sx(t)} y={margin.top + plotH + 16} textAnchor="middle" fill={mutedColor} fontSize="9">
            {fmtTick(t)}
          </text>
        </g>
      ))}

      {/* Y ticks */}
      {yTicks.map((t) => (
        <g key={`yt-${t}`}>
          <line x1={margin.left - 4} x2={margin.left} y1={sy(t)} y2={sy(t)} stroke={axisBorder} />
          <text x={margin.left - 8} y={sy(t) + 3} textAnchor="end" fill={mutedColor} fontSize="9">
            {fmtTick(t)}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text
        x={margin.left + plotW / 2}
        y={height - 4}
        textAnchor="middle"
        fill={mutedColor}
        fontSize="10"
        fontWeight="500"
      >
        {xLabel}
      </text>
      <text
        x={12}
        y={margin.top + plotH / 2}
        textAnchor="middle"
        fill={mutedColor}
        fontSize="10"
        fontWeight="500"
        transform={`rotate(-90, 12, ${margin.top + plotH / 2})`}
      >
        {yLabel}
      </text>

      {/* Diagonal reference line (for actual vs predicted) */}
      {showDiagonal && (
        <line
          x1={sx(Math.max(xDomMin, yDomMin))}
          y1={sy(Math.max(xDomMin, yDomMin))}
          x2={sx(Math.min(xDomMax, yDomMax))}
          y2={sy(Math.min(xDomMax, yDomMax))}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity={0.6}
        />
      )}

      {/* Zero line for residual plots */}
      {!showDiagonal && yDomMin < 0 && yDomMax > 0 && (
        <line
          x1={margin.left}
          x2={margin.left + plotW}
          y1={sy(0)}
          y2={sy(0)}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity={0.5}
        />
      )}

      {/* Data points */}
      {xData.map((x, i) => {
        if (i % step !== 0) return null;
        return (
          <circle
            key={i}
            cx={sx(x)}
            cy={sy(yData[i])}
            r={Math.max(2, Math.min(3.5, 500 / xData.length))}
            fill={color}
            opacity={0.7}
          >
            <title>
              {xLabel}: {x.toFixed(4)}, {yLabel}: {yData[i].toFixed(4)}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function RegressionTab({ tabId }: TabComponentProps) {
  const { data } = useSpreadsheetData();
  const { tabs } = useTabs();
  const { features } = useSkillLevel();

  const isFriendly = features.terminology === 'friendly';

  // Configuration state
  const [yVar, setYVar] = useState<string>('');
  const [selectedXVars, setSelectedXVars] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RegressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Plot container sizing
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(500);

  useEffect(() => {
    const el = plotContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPlotWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Find the most recent spreadsheet tab with data
  const sourceTab = useMemo(() => {
    const spreadsheetTabs = tabs.filter(
      (t) => t.type === 'spreadsheet' && data[t.id]?.columns.length > 0,
    );
    return spreadsheetTabs.length > 0 ? spreadsheetTabs[spreadsheetTabs.length - 1] : null;
  }, [tabs, data]);

  const tabData = sourceTab ? data[sourceTab.id] : undefined;

  // Get numeric columns
  const numericColumns = useMemo(() => {
    if (!tabData) return [];
    return tabData.columnStats.filter((s) => s.type === 'numeric');
  }, [tabData]);

  // All column names (for display)
  const numericColNames = useMemo(() => numericColumns.map((c) => c.name), [numericColumns]);

  // Available X vars (all numeric except selected Y)
  const availableXVars = useMemo(() => {
    return numericColNames.filter((c) => c !== yVar);
  }, [numericColNames, yVar]);

  // When Y changes, remove it from X selections
  useEffect(() => {
    if (yVar && selectedXVars.has(yVar)) {
      setSelectedXVars((prev) => {
        const next = new Set(prev);
        next.delete(yVar);
        return next;
      });
    }
  }, [yVar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle an X variable
  const toggleXVar = useCallback((varName: string) => {
    setSelectedXVars((prev) => {
      const next = new Set(prev);
      if (next.has(varName)) {
        next.delete(varName);
      } else {
        next.add(varName);
      }
      return next;
    });
  }, []);

  // Select all / deselect all X variables
  const selectAllX = useCallback(() => {
    setSelectedXVars(new Set(availableXVars));
  }, [availableXVars]);

  const deselectAllX = useCallback(() => {
    setSelectedXVars(new Set());
  }, []);

  // Run regression
  const runRegression = useCallback(() => {
    if (!tabData || !yVar || selectedXVars.size === 0) return;

    setComputing(true);
    setError(null);
    setHasRun(true);

    // Use setTimeout to allow UI to show loading state
    setTimeout(() => {
      const xVars = Array.from(selectedXVars).filter((v) => availableXVars.includes(v));
      const res = olsRegression(tabData.rows, yVar, xVars);

      if ('error' in res) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
        setError(null);
      }
      setComputing(false);
    }, 10);
  }, [tabData, yVar, selectedXVars, availableXVars]);

  // ---------------------------------------------------------------------------
  // Labels
  // ---------------------------------------------------------------------------

  const labels = useMemo(
    () => ({
      depVar: isFriendly ? 'Which column to predict?' : 'Dependent Variable (Y)',
      indepVar: isFriendly ? 'Which columns to use?' : 'Independent Variables (X)',
      run: isFriendly ? 'Run Prediction' : 'Run Regression',
      results: isFriendly ? 'Prediction Results' : 'Regression Results',
      coeffTable: isFriendly ? 'How each column affects the prediction' : 'Coefficient Estimates',
      modelFit: isFriendly ? 'How good is the prediction?' : 'Model Fit Statistics',
      residPlot: isFriendly ? 'Prediction Errors' : 'Residuals vs Fitted',
      actVsPred: isFriendly ? 'Actual vs Predicted' : 'Actual vs Predicted Values',
      variable: isFriendly ? 'Column' : 'Variable',
      coefficient: isFriendly ? 'Effect' : 'Coefficient',
      stdError: isFriendly ? 'Uncertainty' : 'Std. Error',
      tStat: 't-statistic',
      pValue: 'p-value',
      significance: 'Sig.',
      rSquared: isFriendly ? 'Accuracy (R\u00B2)' : 'R\u00B2',
      adjRSquared: isFriendly ? 'Adjusted Accuracy' : 'Adjusted R\u00B2',
      fStat: 'F-statistic',
      nObs: isFriendly ? 'Data points used' : 'Observations (n)',
      residStdErr: isFriendly ? 'Typical error size' : 'Residual Std. Error',
      selectAll: 'Select All',
      deselectAll: 'Clear',
    }),
    [isFriendly],
  );

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!tabData || tabData.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-2">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto opacity-20">
            <path d="M8 32L16 18L24 24L32 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="32" r="2" fill="currentColor" opacity="0.5" />
            <circle cx="16" cy="18" r="2" fill="currentColor" opacity="0.5" />
            <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.5" />
            <circle cx="32" cy="8" r="2" fill="currentColor" opacity="0.5" />
          </svg>
          <p className="text-sm">{isFriendly ? 'No data to analyze' : 'No data for regression'}</p>
          <p className="text-[11px] text-muted/30">Load a dataset first, then open this tab</p>
        </div>
      </div>
    );
  }

  if (numericColumns.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-2">
          <p className="text-sm">Insufficient numeric data</p>
          <p className="text-[11px] text-muted/30">
            Regression requires at least 2 numeric columns. Found {numericColumns.length}.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canRun = yVar !== '' && selectedXVars.size > 0 && !computing;

  return (
    <div className="flex h-full">
      {/* ========== Left Panel: Results (65%) ========== */}
      <div className="flex-[65] min-w-0 overflow-y-auto" ref={plotContainerRef}>
        <div className="max-w-5xl px-6 py-5 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {isFriendly ? 'Prediction Analysis' : 'OLS Regression Analysis'}
            </h2>
            {sourceTab && (
              <p className="text-[11px] text-muted/50 mt-0.5">
                Data: {sourceTab.title} &middot; {tabData.rows.length.toLocaleString()} rows &middot;{' '}
                {numericColumns.length} numeric columns
              </p>
            )}
          </div>

          {/* No results state */}
          {!hasRun && !computing && (
            <div className="flex items-center justify-center py-20 text-muted/30">
              <div className="text-center space-y-3">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto opacity-20">
                  <path
                    d="M10 38L18 22L28 28L38 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line x1="10" y1="38" x2="38" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  <line x1="10" y1="10" x2="10" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                </svg>
                <p className="text-xs">
                  {isFriendly
                    ? 'Choose your columns on the right, then click "Run Prediction"'
                    : 'Configure dependent and independent variables, then run the regression'}
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {computing && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2 text-muted/40">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-sm">{isFriendly ? 'Computing prediction...' : 'Estimating model...'}</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !computing && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
              <p className="text-xs text-red-400 font-medium">
                {isFriendly ? 'Could not compute prediction' : 'Regression Error'}
              </p>
              <p className="text-[11px] text-red-400/70 mt-1">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && !computing && (
            <>
              {/* Coefficient Table */}
              <div>
                <h3 className="text-xs font-medium text-foreground/80 mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  {labels.coeffTable}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="px-3 py-2 text-left font-medium text-muted/50">{labels.variable}</th>
                        <th className="px-3 py-2 text-right font-medium text-muted/50">{labels.coefficient}</th>
                        <th className="px-3 py-2 text-right font-medium text-muted/50">{labels.stdError}</th>
                        {!isFriendly && (
                          <th className="px-3 py-2 text-right font-medium text-muted/50">{labels.tStat}</th>
                        )}
                        <th className="px-3 py-2 text-right font-medium text-muted/50">{labels.pValue}</th>
                        <th className="px-3 py-2 text-center font-medium text-muted/50">{labels.significance}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.coefficients.map((coef) => {
                        const stars = sigStars(coef.pValue);
                        const isSignificant = coef.pValue < 0.05;
                        return (
                          <tr
                            key={coef.variable}
                            className={`border-b border-white/[0.03] ${
                              isSignificant ? 'bg-indigo-500/[0.03]' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className="px-3 py-1.5 font-medium text-foreground/80 whitespace-nowrap font-mono text-[11px]">
                              {coef.variable}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-foreground/90 font-mono">
                              {fmtCoef(coef.coefficient)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted/60 font-mono">
                              {fmtSE(coef.stdError)}
                            </td>
                            {!isFriendly && (
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted/60 font-mono">
                                {fmtT(coef.tStat)}
                              </td>
                            )}
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted/60 font-mono">
                              {fmtP(coef.pValue)}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {stars && (
                                <span
                                  className={`font-bold ${
                                    stars === '***'
                                      ? 'text-emerald-400'
                                      : stars === '**'
                                        ? 'text-emerald-400/80'
                                        : stars === '*'
                                          ? 'text-amber-400'
                                          : 'text-muted/40'
                                  }`}
                                >
                                  {stars}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Significance legend */}
                <p className="text-[9px] text-muted/30 mt-1.5 tracking-wide">
                  Signif. codes: &lsquo;***&rsquo; 0.001 &lsquo;**&rsquo; 0.01 &lsquo;*&rsquo; 0.05 &lsquo;.&rsquo; 0.1
                </p>
              </div>

              {/* Model Fit Statistics */}
              <div>
                <h3 className="text-xs font-medium text-foreground/80 mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {labels.modelFit}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted/40 uppercase tracking-wider">{labels.rSquared}</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums mt-1">
                      {fmtR2(result.rSquared)}
                    </p>
                    {isFriendly && (
                      <p className="text-[9px] text-muted/30 mt-0.5">
                        {result.rSquared >= 0.8
                          ? 'Very good fit'
                          : result.rSquared >= 0.5
                            ? 'Moderate fit'
                            : 'Weak fit'}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted/40 uppercase tracking-wider">{labels.adjRSquared}</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums mt-1">
                      {fmtR2(result.adjRSquared)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted/40 uppercase tracking-wider">{labels.fStat}</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums mt-1">
                      {fmtStat(result.fStatistic)}
                    </p>
                    <p className="text-[9px] text-muted/30 mt-0.5">
                      on {result.nPredictors} and {result.dof} df
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted/40 uppercase tracking-wider">{labels.nObs}</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums mt-1">
                      {result.nObs.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted/40 uppercase tracking-wider">{labels.residStdErr}</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums mt-1">
                      {fmtStat(result.residualStdError)}
                    </p>
                    <p className="text-[9px] text-muted/30 mt-0.5">{result.dof} df</p>
                  </div>
                </div>

                {/* Additional model details for statistical users */}
                {!isFriendly && (
                  <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-3">
                    <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-muted/40">SSR (Regression)</span>
                        <span className="text-muted/60 tabular-nums font-mono">{fmtStat(result.ssr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted/40">SSE (Residual)</span>
                        <span className="text-muted/60 tabular-nums font-mono">{fmtStat(result.sse)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted/40">SST (Total)</span>
                        <span className="text-muted/60 tabular-nums font-mono">{fmtStat(result.sst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted/40">Predictors (k)</span>
                        <span className="text-muted/60 tabular-nums font-mono">{result.nPredictors}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted/40">Residual df</span>
                        <span className="text-muted/60 tabular-nums font-mono">{result.dof}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted/40">F p-value</span>
                        <span className="text-muted/60 tabular-nums font-mono">{fmtP(result.fPValue)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic Plots */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Residuals vs Fitted */}
                <div>
                  <h3 className="text-xs font-medium text-foreground/80 mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    {labels.residPlot}
                  </h3>
                  <ScatterPlot
                    xData={result.fitted}
                    yData={result.residuals}
                    xLabel="Fitted Values"
                    yLabel="Residuals"
                    title={labels.residPlot}
                    width={Math.max(280, Math.floor((plotWidth - 64) / 2))}
                    height={280}
                    color="#ef4444"
                  />
                  {isFriendly && (
                    <p className="text-[9px] text-muted/30 mt-1.5">
                      Points should be randomly scattered around the red dashed line (zero). Patterns suggest the model
                      is missing something.
                    </p>
                  )}
                </div>

                {/* Actual vs Predicted */}
                <div>
                  <h3 className="text-xs font-medium text-foreground/80 mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" />
                    {labels.actVsPred}
                  </h3>
                  <ScatterPlot
                    xData={result.fitted}
                    yData={result.yActual}
                    xLabel="Predicted"
                    yLabel="Actual"
                    title={labels.actVsPred}
                    width={Math.max(280, Math.floor((plotWidth - 64) / 2))}
                    height={280}
                    color="#6366f1"
                    showDiagonal
                  />
                  {isFriendly && (
                    <p className="text-[9px] text-muted/30 mt-1.5">
                      Points close to the dashed diagonal line mean more accurate predictions.
                    </p>
                  )}
                </div>
              </div>

              {/* Equation display (non-friendly mode) */}
              {!isFriendly && (
                <div>
                  <h3 className="text-xs font-medium text-foreground/80 mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Estimated Equation
                  </h3>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 overflow-x-auto">
                    <code className="text-[11px] text-foreground/70 font-mono whitespace-nowrap">
                      {yVar} = {fmtCoef(result.coefficients[0].coefficient)}
                      {result.coefficients.slice(1).map((c) => {
                        const sign = c.coefficient >= 0 ? ' + ' : ' - ';
                        return (
                          <span key={c.variable}>
                            {sign}
                            {fmtCoef(Math.abs(c.coefficient))}
                            <span className="text-indigo-400"> * {c.variable}</span>
                          </span>
                        );
                      })}
                    </code>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========== Right Panel: Configuration (35%) ========== */}
      <div className="flex-[35] min-w-[240px] max-w-[360px] border-l border-white/5 bg-[#111113] overflow-y-auto p-4 space-y-5">
        {/* Panel Header */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {isFriendly ? 'Setup' : 'Model Configuration'}
          </p>
        </div>

        {/* Dependent Variable (Y) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {labels.depVar}
          </label>
          <select
            value={yVar}
            onChange={(e) => setYVar(e.target.value)}
            className="w-full rounded-md px-3 py-1.5 text-xs outline-none transition-colors bg-white/[0.05] text-white/80 border border-white/10 focus:border-indigo-500/40"
          >
            <option value="">-- select --</option>
            {numericColNames.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
          {isFriendly && yVar && (
            <p className="text-[9px] text-white/25">
              The model will try to predict &ldquo;{yVar}&rdquo; using the selected columns below.
            </p>
          )}
        </div>

        {/* Independent Variables (X) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              {labels.indepVar}
            </label>
            <div className="flex gap-1">
              <button
                onClick={selectAllX}
                className="text-[9px] text-indigo-400/70 hover:text-indigo-400 transition-colors"
              >
                {labels.selectAll}
              </button>
              <span className="text-[9px] text-white/15">/</span>
              <button
                onClick={deselectAllX}
                className="text-[9px] text-white/30 hover:text-white/50 transition-colors"
              >
                {labels.deselectAll}
              </button>
            </div>
          </div>

          {!yVar && (
            <p className="text-[10px] text-white/20 italic py-2">
              {isFriendly ? 'Pick a column to predict first' : 'Select dependent variable first'}
            </p>
          )}

          {yVar && availableXVars.length === 0 && (
            <p className="text-[10px] text-white/20 italic py-2">
              No other numeric columns available
            </p>
          )}

          {yVar && (
            <div className="space-y-0.5 max-h-[280px] overflow-y-auto rounded-md border border-white/[0.06] bg-white/[0.02]">
              {availableXVars.map((varName) => {
                const isSelected = selectedXVars.has(varName);
                return (
                  <label
                    key={varName}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-500/[0.08] hover:bg-indigo-500/[0.12]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleXVar(varName)}
                      className="rounded border-white/20 bg-white/[0.05] text-indigo-500 focus:ring-indigo-500/30 focus:ring-offset-0 h-3 w-3"
                    />
                    <span
                      className={`text-xs truncate ${
                        isSelected ? 'text-white/80' : 'text-white/50'
                      }`}
                    >
                      {varName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {selectedXVars.size > 0 && (
            <p className="text-[9px] text-white/25">
              {selectedXVars.size} variable{selectedXVars.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Run button */}
        <button
          onClick={runRegression}
          disabled={!canRun}
          className={`w-full py-2 rounded-md text-xs font-medium transition-all ${
            canRun
              ? 'bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600 shadow-lg shadow-indigo-500/20'
              : 'bg-white/[0.05] text-white/20 cursor-not-allowed'
          }`}
        >
          {computing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {isFriendly ? 'Computing...' : 'Estimating...'}
            </span>
          ) : (
            labels.run
          )}
        </button>

        {/* Quick model summary (if result exists) */}
        {result && !computing && (
          <div className="pt-3 border-t border-white/5 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              {isFriendly ? 'Quick Summary' : 'Model Summary'}
            </p>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">{labels.rSquared}</span>
                <span className="text-white/70 tabular-nums font-mono">{fmtR2(result.rSquared)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">{labels.adjRSquared}</span>
                <span className="text-white/70 tabular-nums font-mono">{fmtR2(result.adjRSquared)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">{labels.nObs}</span>
                <span className="text-white/70 tabular-nums font-mono">{result.nObs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">Significant vars</span>
                <span className="text-white/70 tabular-nums font-mono">
                  {result.coefficients.filter((c) => c.pValue < 0.05 && c.variable !== '(Intercept)').length}
                  {' / '}
                  {result.nPredictors}
                </span>
              </div>
            </div>

            {/* R-squared bar visualization */}
            <div className="mt-2">
              <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, result.rSquared * 100))}%`,
                    backgroundColor:
                      result.rSquared >= 0.8
                        ? '#10b981'
                        : result.rSquared >= 0.5
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                />
              </div>
              <p className="text-[9px] text-white/20 mt-1 text-center">
                {isFriendly
                  ? `Model explains ${(result.rSquared * 100).toFixed(1)}% of variation`
                  : `R\u00B2 = ${(result.rSquared * 100).toFixed(1)}% variance explained`}
              </p>
            </div>
          </div>
        )}

        {/* Data info */}
        <div className="pt-3 border-t border-white/5 space-y-1">
          <p className="text-[10px] text-white/25">
            {tabData.rows.length.toLocaleString()} rows &middot; {numericColumns.length} numeric{' '}
            {isFriendly ? 'columns' : 'variables'}
          </p>
          {sourceTab && (
            <p className="text-[10px] text-white/15 truncate" title={sourceTab.title}>
              Source: {sourceTab.title}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
