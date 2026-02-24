'use client';

import { useState, useMemo } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';
import { useTabs } from '@/lib/tab-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestType = 'one-sample' | 'two-sample' | 'paired' | 'chi-square' | 'anova';
type Alternative = 'two-sided' | 'less' | 'greater';

interface TestResult {
  testName: string;
  statistic: number;
  statisticLabel: string;
  df: number | string;
  pValue: number;
  effectSize?: number;
  effectSizeLabel?: string;
  details: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Stats Helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

// t-distribution CDF approximation (Hill's algorithm)
function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  let prob = 0.5 * incompleteBeta(df / 2, 0.5, x);
  return t < 0 ? prob : 1 - prob;
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0 || x === 1) return x;
  const maxIter = 200;
  const eps = 1e-10;
  const lnBeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= maxIter; i++) {
    let m = i;
    let numerator: number;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      m = i / 2;
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      m = (i - 1) / 2;
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d;
    f *= cd;
    if (Math.abs(cd - 1) < eps) break;
  }
  return front * (f - 1);
}

function gammaLn(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function tPValue(t: number, df: number, alt: Alternative): number {
  const p2 = 2 * (1 - tCDF(Math.abs(t), df));
  if (alt === 'two-sided') return p2;
  if (alt === 'greater') return t > 0 ? p2 / 2 : 1 - p2 / 2;
  return t < 0 ? p2 / 2 : 1 - p2 / 2;
}

// Chi-square CDF approximation
function chiSquarePValue(x: number, df: number): number {
  if (x <= 0) return 1;
  return 1 - lowerGamma(df / 2, x / 2) / Math.exp(gammaLn(df / 2));
}

function lowerGamma(s: number, x: number): number {
  if (x < 0) return 0;
  let sum = 0, term = 1 / s;
  for (let n = 1; n < 200; n++) {
    term *= x / (s + n);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  return (1 / s + sum) * Math.exp(-x + s * Math.log(x) - gammaLn(s));
}

// F-distribution p-value via incomplete beta
function fPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1;
  const x = df2 / (df2 + df1 * f);
  return incompleteBeta(df2 / 2, df1 / 2, x);
}

function formatPValue(p: number): string {
  if (p < 0.001) return '< 0.001';
  return p.toFixed(4);
}

function sigStars(p: number): string {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  if (p < 0.1) return '.';
  return '';
}

// ---------------------------------------------------------------------------
// Test Config
// ---------------------------------------------------------------------------

const TEST_TYPES: { id: TestType; label: string; icon: string }[] = [
  { id: 'one-sample', label: 'One-Sample t', icon: 't₁' },
  { id: 'two-sample', label: 'Two-Sample t', icon: 't₂' },
  { id: 'paired', label: 'Paired t', icon: 'tₚ' },
  { id: 'chi-square', label: 'Chi-Square', icon: 'χ²' },
  { id: 'anova', label: 'One-Way ANOVA', icon: 'F' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HypothesisTestTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { data: sharedData } = useSpreadsheetData();
  const { tabs } = useTabs();

  const isStatistical = features.terminology !== 'friendly';

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

  const categoricalCols = useMemo(() => {
    return tabData.columns.filter((col) => {
      const unique = new Set(tabData.rows.map((r) => r[col]).filter(Boolean));
      return unique.size >= 2 && unique.size <= 20;
    });
  }, [tabData]);

  // State
  const [testType, setTestType] = useState<TestType>('one-sample');
  const [selectedVar, setSelectedVar] = useState('');
  const [selectedVar2, setSelectedVar2] = useState('');
  const [groupVar, setGroupVar] = useState('');
  const [alternative, setAlternative] = useState<Alternative>('two-sided');
  const [hypothesizedMean, setHypothesizedMean] = useState('0');
  const [result, setResult] = useState<TestResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Helper to get numeric values for a column
  function getNumericVals(col: string): number[] {
    return tabData.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
  }

  // Run test
  function runTest() {
    setHasRun(true);

    if (testType === 'one-sample') {
      const vals = getNumericVals(selectedVar);
      if (vals.length < 2) return;
      const n = vals.length;
      const m = mean(vals);
      const s = stdDev(vals);
      const mu0 = parseFloat(hypothesizedMean) || 0;
      const t = (m - mu0) / (s / Math.sqrt(n));
      const df = n - 1;
      const p = tPValue(t, df, alternative);
      const d = Math.abs(m - mu0) / s;
      setResult({
        testName: 'One-Sample t-Test',
        statistic: t, statisticLabel: 't', df, pValue: p,
        effectSize: d, effectSizeLabel: "Cohen's d",
        details: { n, mean: parseFloat(m.toFixed(4)), sd: parseFloat(s.toFixed(4)), mu0 },
      });
    }

    if (testType === 'two-sample') {
      const vals = getNumericVals(selectedVar);
      if (!groupVar || vals.length < 4) return;
      const groups = [...new Set(tabData.rows.map((r) => r[groupVar]).filter(Boolean))].slice(0, 2);
      if (groups.length < 2) return;
      const g1 = tabData.rows.filter((r) => r[groupVar] === groups[0]).map((r) => Number(r[selectedVar])).filter((v) => !isNaN(v));
      const g2 = tabData.rows.filter((r) => r[groupVar] === groups[1]).map((r) => Number(r[selectedVar])).filter((v) => !isNaN(v));
      if (g1.length < 2 || g2.length < 2) return;
      const m1 = mean(g1), m2 = mean(g2);
      const v1 = variance(g1), v2 = variance(g2);
      const se = Math.sqrt(v1 / g1.length + v2 / g2.length);
      const t = (m1 - m2) / se;
      const dfNum = (v1 / g1.length + v2 / g2.length) ** 2;
      const dfDen = (v1 / g1.length) ** 2 / (g1.length - 1) + (v2 / g2.length) ** 2 / (g2.length - 1);
      const df = dfNum / dfDen;
      const p = tPValue(t, df, alternative);
      const pooledSD = Math.sqrt(((g1.length - 1) * v1 + (g2.length - 1) * v2) / (g1.length + g2.length - 2));
      const d = Math.abs(m1 - m2) / pooledSD;
      setResult({
        testName: `Welch's Two-Sample t-Test`,
        statistic: t, statisticLabel: 't', df: parseFloat(df.toFixed(2)), pValue: p,
        effectSize: d, effectSizeLabel: "Cohen's d",
        details: { [`${groups[0]} (n)`]: g1.length, [`${groups[0]} mean`]: parseFloat(m1.toFixed(4)), [`${groups[1]} (n)`]: g2.length, [`${groups[1]} mean`]: parseFloat(m2.toFixed(4)) },
      });
    }

    if (testType === 'paired') {
      const v1 = getNumericVals(selectedVar);
      const v2 = getNumericVals(selectedVar2);
      const n = Math.min(v1.length, v2.length);
      if (n < 2) return;
      const diffs = Array.from({ length: n }, (_, i) => v1[i] - v2[i]);
      const m = mean(diffs);
      const s = stdDev(diffs);
      const t = m / (s / Math.sqrt(n));
      const df = n - 1;
      const p = tPValue(t, df, alternative);
      const d = Math.abs(m) / s;
      setResult({
        testName: 'Paired t-Test',
        statistic: t, statisticLabel: 't', df, pValue: p,
        effectSize: d, effectSizeLabel: "Cohen's d",
        details: { n, 'mean diff': parseFloat(m.toFixed(4)), 'sd diff': parseFloat(s.toFixed(4)) },
      });
    }

    if (testType === 'chi-square') {
      if (!selectedVar || !selectedVar2) return;
      const rowVals = [...new Set(tabData.rows.map((r) => r[selectedVar]).filter(Boolean))];
      const colVals = [...new Set(tabData.rows.map((r) => r[selectedVar2]).filter(Boolean))];
      if (rowVals.length < 2 || colVals.length < 2) return;
      const observed: number[][] = rowVals.map((rv) =>
        colVals.map((cv) => tabData.rows.filter((r) => r[selectedVar] === rv && r[selectedVar2] === cv).length)
      );
      const total = observed.flat().reduce((a, b) => a + b, 0);
      const rowTotals = observed.map((row) => row.reduce((a, b) => a + b, 0));
      const colTotals = colVals.map((_, ci) => observed.reduce((a, row) => a + row[ci], 0));
      let chi2 = 0;
      for (let i = 0; i < rowVals.length; i++) {
        for (let j = 0; j < colVals.length; j++) {
          const expected = (rowTotals[i] * colTotals[j]) / total;
          if (expected > 0) chi2 += (observed[i][j] - expected) ** 2 / expected;
        }
      }
      const df = (rowVals.length - 1) * (colVals.length - 1);
      const p = chiSquarePValue(chi2, df);
      const k = Math.min(rowVals.length, colVals.length);
      const cramersV = Math.sqrt(chi2 / (total * (k - 1)));
      setResult({
        testName: 'Chi-Square Test of Independence',
        statistic: chi2, statisticLabel: '\u03C7\u00B2', df, pValue: p,
        effectSize: cramersV, effectSizeLabel: "Cramer's V",
        details: { 'rows': rowVals.length, 'cols': colVals.length, 'total n': total },
      });
    }

    if (testType === 'anova') {
      if (!selectedVar || !groupVar) return;
      const groups: Record<string, number[]> = {};
      for (const row of tabData.rows) {
        const g = row[groupVar];
        const v = Number(row[selectedVar]);
        if (!g || isNaN(v)) continue;
        if (!groups[g]) groups[g] = [];
        groups[g].push(v);
      }
      const groupNames = Object.keys(groups);
      if (groupNames.length < 2) return;
      const allVals = groupNames.flatMap((g) => groups[g]);
      const grandMean = mean(allVals);
      const k = groupNames.length;
      const N = allVals.length;
      let ssBetween = 0, ssWithin = 0;
      for (const g of groupNames) {
        const gm = mean(groups[g]);
        ssBetween += groups[g].length * (gm - grandMean) ** 2;
        for (const v of groups[g]) ssWithin += (v - gm) ** 2;
      }
      const dfBetween = k - 1;
      const dfWithin = N - k;
      const msBetween = ssBetween / dfBetween;
      const msWithin = ssWithin / dfWithin;
      const fStat = msBetween / msWithin;
      const p = fPValue(fStat, dfBetween, dfWithin);
      const eta2 = ssBetween / (ssBetween + ssWithin);
      setResult({
        testName: 'One-Way ANOVA',
        statistic: fStat, statisticLabel: 'F',
        df: `${dfBetween}, ${dfWithin}`, pValue: p,
        effectSize: eta2, effectSizeLabel: '\u03B7\u00B2',
        details: { groups: k, N, 'SS Between': parseFloat(ssBetween.toFixed(4)), 'SS Within': parseFloat(ssWithin.toFixed(4)) },
      });
    }
  }

  // No data state
  if (tabData.columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-white/30">
        Open a spreadsheet with data to run hypothesis tests.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0d0f]">
      {/* Results Panel (left 65%) */}
      <div className="flex-[65] overflow-auto p-6">
        <h2 className="text-sm font-semibold text-white/90 mb-1">
          {isStatistical ? 'Hypothesis Testing' : 'Statistical Tests'}
        </h2>
        <p className="text-xs text-white/35 mb-6">
          {isStatistical
            ? 'Configure and run parametric hypothesis tests'
            : 'Test whether differences in your data are meaningful'}
        </p>

        {!result ? (
          <div className="flex items-center justify-center h-48 text-sm text-white/20 italic">
            {hasRun ? 'Not enough data for this test.' : 'Configure a test and click Run.'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Test header */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-3">
                {result.testName}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-white/30">{result.statisticLabel}-statistic</p>
                  <p className="text-lg font-mono text-white/90 tabular-nums">{result.statistic.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30">df</p>
                  <p className="text-lg font-mono text-white/90 tabular-nums">{result.df}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30">p-value</p>
                  <p className={`text-lg font-mono tabular-nums ${result.pValue < 0.05 ? 'text-emerald-400' : 'text-white/90'}`}>
                    {formatPValue(result.pValue)}
                    <span className="ml-1 text-xs">{sigStars(result.pValue)}</span>
                  </p>
                </div>
                {result.effectSize !== undefined && (
                  <div>
                    <p className="text-[10px] text-white/30">{result.effectSizeLabel}</p>
                    <p className="text-lg font-mono text-white/90 tabular-nums">{result.effectSize.toFixed(4)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-3">
                Sample Statistics
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(result.details).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-white/40">{k}</span>
                    <span className="text-white/70 font-mono tabular-nums">{typeof v === 'number' ? v.toLocaleString() : v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conclusion */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-3">Conclusion</div>
              <p className="text-sm text-white/80 leading-relaxed">
                {result.pValue < 0.05 ? (
                  <>
                    <span className="text-green-400 font-medium">
                      {isStatistical ? <>Reject H<sub>0</sub></> : 'The difference IS statistically significant.'}
                    </span>{' '}
                    {isStatistical
                      ? `The ${result.statisticLabel}-statistic of ${result.statistic.toFixed(4)} yields p = ${formatPValue(result.pValue)}, providing evidence against the null hypothesis.`
                      : `There is strong evidence that the result is not due to random chance (p = ${formatPValue(result.pValue)}).`}
                  </>
                ) : (
                  <>
                    <span className="text-red-400 font-medium">
                      {isStatistical ? <>Fail to reject H<sub>0</sub></> : 'The difference IS NOT statistically significant.'}
                    </span>{' '}
                    {isStatistical
                      ? `The ${result.statisticLabel}-statistic of ${result.statistic.toFixed(4)} yields p = ${formatPValue(result.pValue)}, insufficient evidence to reject the null hypothesis.`
                      : `We did not find strong enough evidence to conclude there is a real difference (p = ${formatPValue(result.pValue)}).`}
                  </>
                )}
              </p>
              {result.effectSize !== undefined && (
                <p className="text-xs text-white/50 mt-2">
                  Effect size ({result.effectSizeLabel}): {result.effectSize.toFixed(4)} —{' '}
                  {result.effectSize < 0.2 ? 'negligible' : result.effectSize < 0.5 ? 'small' : result.effectSize < 0.8 ? 'medium' : 'large'} practical significance.
                </p>
              )}
            </div>

            <div className="text-[10px] text-white/30 font-mono">
              Signif. codes: &apos;***&apos; 0.001 &apos;**&apos; 0.01 &apos;*&apos; 0.05 &apos;.&apos; 0.1
            </div>
          </div>
        )}
      </div>

      {/* Config Panel (right 35%) */}
      <div className="flex-[35] border-l border-white/5 bg-[#111113] overflow-y-auto p-5 space-y-6">
        {/* Test Type */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-3">Test Type</div>
          <div className="grid grid-cols-1 gap-2">
            {TEST_TYPES.map((tt) => (
              <button
                key={tt.id}
                onClick={() => { setTestType(tt.id); setResult(null); setHasRun(false); setSelectedVar(''); setSelectedVar2(''); setGroupVar(''); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  testType === tt.id
                    ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
                }`}
              >
                <span className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-mono font-semibold ${
                  testType === tt.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/[0.05] text-white/40'
                }`}>
                  {tt.icon}
                </span>
                <span className="text-sm font-medium">{tt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Variables */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-3">Variables</div>
          <div className="space-y-3">
            {/* One-Sample */}
            {testType === 'one-sample' && (
              <>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Variable (numeric)</label>
                  <select value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {numericCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">{isStatistical ? 'Hypothesized Mean (\u03BC\u2080)' : 'Expected Average'}</label>
                  <input type="number" value={hypothesizedMean} onChange={(e) => setHypothesizedMean(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500/40 focus:outline-none" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Alternative</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([{ id: 'two-sided', label: '\u2260' }, { id: 'less', label: '<' }, { id: 'greater', label: '>' }] as const).map((alt) => (
                      <button key={alt.id} onClick={() => setAlternative(alt.id)}
                        className={`px-2 py-1.5 rounded-md text-sm font-mono transition-all ${
                          alternative === alt.id ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30' : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.06]'
                        }`}>
                        \u03BC {alt.label} {hypothesizedMean || '0'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Two-Sample */}
            {testType === 'two-sample' && (
              <>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Variable (numeric)</label>
                  <select value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {numericCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Grouping Variable</label>
                  <select value={groupVar} onChange={(e) => setGroupVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {categoricalCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Paired */}
            {testType === 'paired' && (
              <>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Variable 1</label>
                  <select value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {numericCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Variable 2</label>
                  <select value={selectedVar2} onChange={(e) => setSelectedVar2(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {numericCols.filter((c) => c !== selectedVar).map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Chi-Square */}
            {testType === 'chi-square' && (
              <>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Row Variable (categorical)</label>
                  <select value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {categoricalCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Column Variable (categorical)</label>
                  <select value={selectedVar2} onChange={(e) => setSelectedVar2(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {categoricalCols.filter((c) => c !== selectedVar).map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* ANOVA */}
            {testType === 'anova' && (
              <>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Response Variable (numeric)</label>
                  <select value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {numericCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Factor Variable (categorical)</label>
                  <select value={groupVar} onChange={(e) => setGroupVar(e.target.value)}
                    className="w-full bg-white/[0.05] text-white/80 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/40 focus:outline-none">
                    <option value="" className="bg-[#111113]">Select...</option>
                    {categoricalCols.map((c) => <option key={c} value={c} className="bg-[#111113]">{c}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Run Button */}
        <button onClick={runTest}
          disabled={
            (testType === 'one-sample' && !selectedVar) ||
            (testType === 'two-sample' && (!selectedVar || !groupVar)) ||
            (testType === 'paired' && (!selectedVar || !selectedVar2)) ||
            (testType === 'chi-square' && (!selectedVar || !selectedVar2)) ||
            (testType === 'anova' && (!selectedVar || !groupVar))
          }
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-30 disabled:cursor-not-allowed">
          Run Test
        </button>

        {/* Significance note */}
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">Significance Level</div>
          <p className="text-xs text-white/50">
            {isStatistical ? '\u03B1 = 0.05. P-values computed using client-side approximations.' : 'Using a 5% significance level.'}
          </p>
        </div>
      </div>
    </div>
  );
}
