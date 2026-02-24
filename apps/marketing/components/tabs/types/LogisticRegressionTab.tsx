'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogisticResult {
  coefficients: { name: string; estimate: number; se: number; z: number; p: number }[];
  intercept: number;
  iterations: number;
  logLikelihood: number;
  accuracy: number;
  confusionMatrix: { tp: number; fp: number; tn: number; fn: number };
  rocPoints: { fpr: number; tpr: number }[];
  auc: number;
  n: number;
  predicted: number[];
  actual: number[];
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

function gammaLn(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z;
  let tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / z);
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function zPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

// IRLS logistic regression
function fitLogistic(
  X: number[][], // each row = [1, x1, x2, ...]
  y: number[],   // 0 or 1
  maxIter = 25,
): { beta: number[]; iterations: number; logLikelihood: number; se: number[] } | null {
  const n = X.length;
  const p = X[0].length;
  const beta = new Array(p).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const mu = X.map((row) => sigmoid(row.reduce((s, x, j) => s + x * beta[j], 0)));
    const W = mu.map((m) => m * (1 - m) + 1e-10);

    // X^T W X
    const XtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
          XtWX[j][k] += X[i][j] * W[i] * X[i][k];
        }
      }
    }

    // X^T (y - mu)
    const XtR = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        XtR[j] += X[i][j] * (y[i] - mu[i]);
      }
    }

    // Solve XtWX * delta = XtR using Gaussian elimination
    const aug = XtWX.map((row, i) => [...row, XtR[i]]);
    for (let col = 0; col < p; col++) {
      let maxRow = col;
      for (let row = col + 1; row < p; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      if (Math.abs(aug[col][col]) < 1e-12) return null;
      for (let row = col + 1; row < p; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= p; j++) aug[row][j] -= factor * aug[col][j];
      }
    }
    const delta = new Array(p).fill(0);
    for (let i = p - 1; i >= 0; i--) {
      delta[i] = aug[i][p];
      for (let j = i + 1; j < p; j++) delta[i] -= aug[i][j] * delta[j];
      delta[i] /= aug[i][i];
    }

    let maxDelta = 0;
    for (let j = 0; j < p; j++) {
      beta[j] += delta[j];
      maxDelta = Math.max(maxDelta, Math.abs(delta[j]));
    }
    if (maxDelta < 1e-8) {
      const muFinal = X.map((row) => sigmoid(row.reduce((s, x, j) => s + x * beta[j], 0)));
      const ll = y.reduce((s, yi, i) => {
        const pi = Math.max(1e-15, Math.min(1 - 1e-15, muFinal[i]));
        return s + yi * Math.log(pi) + (1 - yi) * Math.log(1 - pi);
      }, 0);

      // Standard errors from inverse of XtWX
      const WFinal = muFinal.map((m) => m * (1 - m) + 1e-10);
      const info: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < p; j++) {
          for (let k = 0; k < p; k++) {
            info[j][k] += X[i][j] * WFinal[i] * X[i][k];
          }
        }
      }
      // Invert info matrix
      const inv = invertMatrix(info);
      const se = inv ? inv.map((row, i) => Math.sqrt(Math.max(0, row[i]))) : new Array(p).fill(NaN);

      return { beta, iterations: iter + 1, logLikelihood: ll, se };
    }
  }
  return null;
}

function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  const aug = m.map((row, i) => {
    const ext = new Array(n).fill(0);
    ext[i] = 1;
    return [...row, ...ext];
  });
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) return null;
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

function computeROC(actual: number[], predicted: number[]): { points: { fpr: number; tpr: number }[]; auc: number } {
  const sorted = actual.map((a, i) => ({ a, p: predicted[i] })).sort((x, y) => y.p - x.p);
  const totalPos = actual.filter((a) => a === 1).length;
  const totalNeg = actual.length - totalPos;
  if (totalPos === 0 || totalNeg === 0) return { points: [{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }], auc: 0.5 };

  const points: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }];
  let tp = 0, fp = 0;
  for (const { a } of sorted) {
    if (a === 1) tp++;
    else fp++;
    points.push({ fpr: fp / totalNeg, tpr: tp / totalPos });
  }

  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    auc += (points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr) / 2;
  }
  return { points, auc };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function fmt(n: number, digits = 4): string {
  if (isNaN(n)) return '-';
  if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(2);
  return n.toFixed(digits);
}

function sigStars(p: number): string {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LogisticRegressionTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { data: sharedData } = useSpreadsheetData();
  const { tabs } = useTabs();

  const isFriendly = features.terminology === 'friendly';

  // Find source data
  const sourceTabId = useMemo(() => {
    return tabs.find((t) => t.type === 'spreadsheet' && sharedData[t.id]?.columns.length > 0)?.id ?? '';
  }, [tabs, sharedData]);

  const tabData = useMemo(() => {
    if (!sourceTabId) return { columns: [] as string[], rows: [] as Record<string, string>[] };
    const d = sharedData[sourceTabId];
    return d ? { columns: d.columns, rows: d.rows } : { columns: [] as string[], rows: [] as Record<string, string>[] };
  }, [sourceTabId, sharedData]);

  const numericCols = useMemo(() => {
    return tabData.columns.filter((col) => {
      const vals = tabData.rows.slice(0, 50).map((r) => Number(r[col]));
      return vals.filter((v) => !isNaN(v)).length > vals.length * 0.7;
    });
  }, [tabData]);

  // Binary columns (0/1 or two unique values)
  const binaryCols = useMemo(() => {
    return tabData.columns.filter((col) => {
      const unique = new Set(tabData.rows.map((r) => r[col]).filter(Boolean));
      if (unique.size === 2) return true;
      if (unique.size <= 2) {
        const vals = [...unique];
        return vals.every((v) => v === '0' || v === '1');
      }
      return false;
    });
  }, [tabData]);

  // State
  const [outcomeVar, setOutcomeVar] = useState('');
  const [predictors, setPredictors] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState<LogisticResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const togglePredictor = useCallback((col: string) => {
    setPredictors((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }, []);

  const runModel = useCallback(() => {
    setHasRun(true);
    if (!outcomeVar || predictors.length === 0) return;

    // Build data matrix
    const validRows = tabData.rows.filter((r) => {
      if (!r[outcomeVar]) return false;
      return predictors.every((p) => r[p] && !isNaN(Number(r[p])));
    });

    if (validRows.length < predictors.length + 2) return;

    // Encode outcome as 0/1
    const outcomeValues = validRows.map((r) => r[outcomeVar]);
    const uniqueOutcomes = [...new Set(outcomeValues)].sort();
    const y = outcomeValues.map((v) => (v === uniqueOutcomes[1] || v === '1') ? 1 : 0);

    // Build X matrix with intercept
    const X = validRows.map((r) => [1, ...predictors.map((p) => Number(r[p]))]);

    const fit = fitLogistic(X, y);
    if (!fit) {
      setResult(null);
      return;
    }

    const predicted = X.map((row) => sigmoid(row.reduce((s, x, j) => s + x * fit.beta[j], 0)));
    const predicted01 = predicted.map((p) => (p >= threshold ? 1 : 0));

    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < y.length; i++) {
      if (y[i] === 1 && predicted01[i] === 1) tp++;
      if (y[i] === 0 && predicted01[i] === 1) fp++;
      if (y[i] === 0 && predicted01[i] === 0) tn++;
      if (y[i] === 1 && predicted01[i] === 0) fn++;
    }

    const roc = computeROC(y, predicted);

    const coefficients = predictors.map((name, i) => {
      const idx = i + 1;
      const z = fit.beta[idx] / (fit.se[idx] || 1);
      return { name, estimate: fit.beta[idx], se: fit.se[idx], z, p: zPValue(z) };
    });

    setResult({
      coefficients,
      intercept: fit.beta[0],
      iterations: fit.iterations,
      logLikelihood: fit.logLikelihood,
      accuracy: (tp + tn) / y.length,
      confusionMatrix: { tp, fp, tn, fn },
      rocPoints: roc.points,
      auc: roc.auc,
      n: y.length,
      predicted,
      actual: y,
    });
  }, [outcomeVar, predictors, tabData.rows, threshold]);

  // SVG dimensions for ROC curve
  const rocW = 260, rocH = 260;
  const rocMargin = { top: 24, right: 16, bottom: 36, left: 40 };
  const rocPlotW = rocW - rocMargin.left - rocMargin.right;
  const rocPlotH = rocH - rocMargin.top - rocMargin.bottom;

  if (tabData.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-white/50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-white/70">No Data Available</div>
          <div className="text-sm">Open a spreadsheet tab and load data to run logistic regression.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0d0f] text-white/90">
      {/* Left: Results */}
      <div className="flex flex-1 flex-col overflow-y-auto" style={{ width: '65%' }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <span className="text-sm font-medium text-white/70">
            {isFriendly ? 'Prediction Model' : 'Logistic Regression'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!hasRun && (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              {isFriendly
                ? 'Select an outcome and predictors, then click Run.'
                : 'Configure the model parameters and run the regression.'}
            </div>
          )}

          {hasRun && !result && (
            <div className="flex h-full items-center justify-center text-sm text-red-400/80">
              Model failed to converge. Try different variables or check your data.
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'N', value: result.n.toLocaleString() },
                  { label: isFriendly ? 'Accuracy' : 'Accuracy', value: (result.accuracy * 100).toFixed(1) + '%' },
                  { label: 'AUC', value: result.auc.toFixed(3) },
                  { label: isFriendly ? 'Steps' : 'Iterations', value: String(result.iterations) },
                ].map((card) => (
                  <div key={card.label} className="rounded-lg border border-white/[0.06] bg-[#111113] p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">{card.label}</div>
                    <div className="mt-1 text-lg font-semibold text-white/90 font-mono">{card.value}</div>
                  </div>
                ))}
              </div>

              {/* Coefficients table */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  {isFriendly ? 'Model Results' : 'Coefficients'}
                </h3>
                <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="px-3 py-2 text-left text-xs font-medium text-white/50">Variable</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-white/50">{isFriendly ? 'Effect' : 'Estimate'}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-white/50">Std Err</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-white/50">z</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-white/50">p-value</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-white/50">Odds Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/[0.04]">
                        <td className="px-3 py-1.5 text-white/60 italic">(Intercept)</td>
                        <td className="px-3 py-1.5 text-right font-mono text-white/80">{fmt(result.intercept)}</td>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-white/30">-</td>
                      </tr>
                      {result.coefficients.map((c) => (
                        <tr key={c.name} className="border-b border-white/[0.04]">
                          <td className="px-3 py-1.5 font-medium text-white/80">{c.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-white/80">{fmt(c.estimate)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-white/60">{fmt(c.se)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-white/60">{fmt(c.z, 3)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            <span className={c.p < 0.05 ? 'text-green-400' : 'text-white/60'}>
                              {fmt(c.p)} {sigStars(c.p)}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-indigo-300">
                            {fmt(Math.exp(c.estimate), 3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ROC curve + Confusion matrix row */}
              <div className="grid grid-cols-2 gap-4">
                {/* ROC Curve */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                    {isFriendly ? 'Model Performance Curve' : 'ROC Curve'}
                  </h3>
                  <div className="rounded-lg border border-white/[0.06] bg-[#111113] p-2">
                    <svg width={rocW} height={rocH} className="mx-auto block">
                      <rect x={rocMargin.left} y={rocMargin.top} width={rocPlotW} height={rocPlotH} fill="#1a1a1d" rx="4" />
                      {/* Grid */}
                      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                        <g key={v}>
                          <line
                            x1={rocMargin.left} x2={rocMargin.left + rocPlotW}
                            y1={rocMargin.top + rocPlotH * (1 - v)} y2={rocMargin.top + rocPlotH * (1 - v)}
                            stroke="white" strokeOpacity={0.06}
                          />
                          <line
                            x1={rocMargin.left + rocPlotW * v} x2={rocMargin.left + rocPlotW * v}
                            y1={rocMargin.top} y2={rocMargin.top + rocPlotH}
                            stroke="white" strokeOpacity={0.06}
                          />
                          <text x={rocMargin.left - 6} y={rocMargin.top + rocPlotH * (1 - v) + 3} textAnchor="end" fill="white" fillOpacity={0.4} fontSize="9">{v.toFixed(2)}</text>
                          <text x={rocMargin.left + rocPlotW * v} y={rocMargin.top + rocPlotH + 14} textAnchor="middle" fill="white" fillOpacity={0.4} fontSize="9">{v.toFixed(2)}</text>
                        </g>
                      ))}
                      {/* Diagonal */}
                      <line
                        x1={rocMargin.left} y1={rocMargin.top + rocPlotH}
                        x2={rocMargin.left + rocPlotW} y2={rocMargin.top}
                        stroke="white" strokeOpacity={0.15} strokeDasharray="4,3"
                      />
                      {/* ROC path */}
                      <path
                        d={result.rocPoints.map((p, i) => {
                          const x = rocMargin.left + p.fpr * rocPlotW;
                          const y = rocMargin.top + (1 - p.tpr) * rocPlotH;
                          return i === 0 ? `M${x},${y}` : `L${x},${y}`;
                        }).join('')}
                        fill="none" stroke="#6366f1" strokeWidth="2"
                      />
                      {/* AUC label */}
                      <text x={rocMargin.left + rocPlotW - 4} y={rocMargin.top + 14} textAnchor="end" fill="#6366f1" fontSize="10" fontWeight="600">
                        AUC = {result.auc.toFixed(3)}
                      </text>
                      {/* Axis labels */}
                      <text x={rocMargin.left + rocPlotW / 2} y={rocH - 4} textAnchor="middle" fill="white" fillOpacity={0.4} fontSize="10">
                        {isFriendly ? 'False Alarm Rate' : 'False Positive Rate'}
                      </text>
                      <text x={10} y={rocMargin.top + rocPlotH / 2} textAnchor="middle" fill="white" fillOpacity={0.4} fontSize="10"
                        transform={`rotate(-90, 10, ${rocMargin.top + rocPlotH / 2})`}>
                        {isFriendly ? 'Detection Rate' : 'True Positive Rate'}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Confusion Matrix */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                    {isFriendly ? 'Prediction Results' : 'Confusion Matrix'}
                  </h3>
                  <div className="rounded-lg border border-white/[0.06] bg-[#111113] p-4">
                    <div className="grid grid-cols-2 gap-2 max-w-[200px] mx-auto">
                      <div className="rounded bg-green-500/20 border border-green-500/30 p-3 text-center">
                        <div className="text-[10px] text-green-300/60 uppercase">True Pos</div>
                        <div className="text-xl font-bold text-green-300 font-mono">{result.confusionMatrix.tp}</div>
                      </div>
                      <div className="rounded bg-red-500/20 border border-red-500/30 p-3 text-center">
                        <div className="text-[10px] text-red-300/60 uppercase">False Pos</div>
                        <div className="text-xl font-bold text-red-300 font-mono">{result.confusionMatrix.fp}</div>
                      </div>
                      <div className="rounded bg-red-500/20 border border-red-500/30 p-3 text-center">
                        <div className="text-[10px] text-red-300/60 uppercase">False Neg</div>
                        <div className="text-xl font-bold text-red-300 font-mono">{result.confusionMatrix.fn}</div>
                      </div>
                      <div className="rounded bg-green-500/20 border border-green-500/30 p-3 text-center">
                        <div className="text-[10px] text-green-300/60 uppercase">True Neg</div>
                        <div className="text-xl font-bold text-green-300 font-mono">{result.confusionMatrix.tn}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-center">
                      <div>
                        <span className="text-white/40">{isFriendly ? 'Precision' : 'Precision'}: </span>
                        <span className="font-mono text-white/80">
                          {result.confusionMatrix.tp + result.confusionMatrix.fp > 0
                            ? ((result.confusionMatrix.tp / (result.confusionMatrix.tp + result.confusionMatrix.fp)) * 100).toFixed(1) + '%'
                            : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40">{isFriendly ? 'Recall' : 'Recall'}: </span>
                        <span className="font-mono text-white/80">
                          {result.confusionMatrix.tp + result.confusionMatrix.fn > 0
                            ? ((result.confusionMatrix.tp / (result.confusionMatrix.tp + result.confusionMatrix.fn)) * 100).toFixed(1) + '%'
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Log-likelihood */}
              <div className="text-xs text-white/30 text-center">
                Log-likelihood: {fmt(result.logLikelihood, 2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Config */}
      <div className="flex flex-col overflow-y-auto border-l border-white/[0.06] bg-[#111113]" style={{ width: '35%', minWidth: 240 }}>
        <div className="border-b border-white/[0.06] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Configuration</span>
        </div>
        <div className="flex flex-col gap-4 p-4">
          {/* Outcome variable */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              {isFriendly ? 'What to predict (yes/no column)' : 'Outcome Variable (Binary)'}
            </label>
            <select
              value={outcomeVar}
              onChange={(e) => setOutcomeVar(e.target.value)}
              className="w-full rounded border border-white/[0.08] bg-[#0d0d0f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-500/50"
            >
              <option value="">Select...</option>
              {(binaryCols.length > 0 ? binaryCols : tabData.columns).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {outcomeVar && (
              <div className="mt-1 text-[10px] text-white/30">
                {(() => {
                  const unique = [...new Set(tabData.rows.map((r) => r[outcomeVar]).filter(Boolean))].sort();
                  return `Values: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? '...' : ''} (${unique.length} unique)`;
                })()}
              </div>
            )}
          </div>

          {/* Predictors */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              {isFriendly ? 'Predictor columns' : 'Independent Variables'}
            </label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-white/[0.06] bg-[#0d0d0f] p-2">
              {numericCols.filter((c) => c !== outcomeVar).length === 0 ? (
                <div className="text-xs text-white/30">No numeric columns available</div>
              ) : (
                numericCols.filter((c) => c !== outcomeVar).map((col) => {
                  const checked = predictors.includes(col);
                  return (
                    <label key={col} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-white/[0.04]">
                      <input type="checkbox" checked={checked} onChange={() => togglePredictor(col)} className="sr-only" />
                      <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-white/15'}`}>
                        {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" /></svg>}
                      </span>
                      <span className={checked ? 'text-white/80' : 'text-white/40'}>{col}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              {isFriendly ? 'Cutoff point' : 'Classification Threshold'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range" min="0.1" max="0.9" step="0.05" value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-white/70 w-10 text-right">{threshold.toFixed(2)}</span>
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runModel}
            disabled={!outcomeVar || predictors.length === 0}
            className={`w-full rounded-md px-4 py-2 text-sm font-medium transition ${
              outcomeVar && predictors.length > 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-white/[0.04] text-white/20 cursor-not-allowed'
            }`}
          >
            {isFriendly ? 'Run Prediction' : 'Run Model'}
          </button>
        </div>
      </div>
    </div>
  );
}
