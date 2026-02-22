'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSkillLevel } from '@/lib/skill-level-context';
import type { TabComponentProps } from '../tab-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DistributionType = 'normal' | 'uniform' | 'binomial' | 'exponential' | 'poisson';

interface RandomVariable {
  id: string;
  name: string;
  distribution: DistributionType;
  params: Record<string, number>;
}

interface SimulationResult {
  values: number[];
  convergence: number[];
  expression: string;
  variables: RandomVariable[];
}

type SimulationState = 'idle' | 'running' | 'done';

// ---------------------------------------------------------------------------
// Distribution parameter definitions
// ---------------------------------------------------------------------------

const DISTRIBUTION_PARAMS: Record<DistributionType, { key: string; label: string; friendlyLabel: string; defaultVal: number }[]> = {
  normal: [
    { key: 'mean', label: 'Mean', friendlyLabel: 'Average', defaultVal: 0 },
    { key: 'sd', label: 'Std Dev', friendlyLabel: 'Spread', defaultVal: 1 },
  ],
  uniform: [
    { key: 'min', label: 'Min', friendlyLabel: 'Minimum', defaultVal: 0 },
    { key: 'max', label: 'Max', friendlyLabel: 'Maximum', defaultVal: 1 },
  ],
  binomial: [
    { key: 'n', label: 'n (trials)', friendlyLabel: 'Number of trials', defaultVal: 10 },
    { key: 'p', label: 'p (prob)', friendlyLabel: 'Probability', defaultVal: 0.5 },
  ],
  exponential: [
    { key: 'rate', label: 'Rate', friendlyLabel: 'Rate', defaultVal: 1 },
  ],
  poisson: [
    { key: 'lambda', label: 'Lambda', friendlyLabel: 'Average rate', defaultVal: 5 },
  ],
};

const DISTRIBUTION_LABELS: Record<DistributionType, { stat: string; friendly: string }> = {
  normal: { stat: 'Normal', friendly: 'Bell curve' },
  uniform: { stat: 'Uniform', friendly: 'Equal chance' },
  binomial: { stat: 'Binomial', friendly: 'Yes/No trials' },
  exponential: { stat: 'Exponential', friendly: 'Wait time' },
  poisson: { stat: 'Poisson', friendly: 'Count events' },
};

const ITERATION_OPTIONS = [1000, 5000, 10000, 50000, 100000];

// ---------------------------------------------------------------------------
// Quick Start presets
// ---------------------------------------------------------------------------

interface Preset {
  name: string;
  description: string;
  variables: RandomVariable[];
  expression: string;
  iterations: number;
}

const PRESETS: Preset[] = [
  {
    name: 'Sum of Dice',
    description: 'Roll two dice and add them',
    variables: [
      { id: 'v1', name: 'X', distribution: 'uniform', params: { min: 1, max: 6 } },
      { id: 'v2', name: 'Y', distribution: 'uniform', params: { min: 1, max: 6 } },
    ],
    expression: 'X + Y',
    iterations: 10000,
  },
  {
    name: 'Portfolio Return',
    description: '60/40 stock-bond portfolio',
    variables: [
      { id: 'v1', name: 'X', distribution: 'normal', params: { mean: 0.08, sd: 0.15 } },
      { id: 'v2', name: 'Y', distribution: 'normal', params: { mean: 0.05, sd: 0.08 } },
    ],
    expression: '0.6 * X + 0.4 * Y',
    iterations: 10000,
  },
  {
    name: 'Election Margin',
    description: 'Popular vote margin estimate',
    variables: [
      { id: 'v1', name: 'X', distribution: 'normal', params: { mean: 0.02, sd: 0.03 } },
    ],
    expression: 'X * 1000000',
    iterations: 10000,
  },
];

// ---------------------------------------------------------------------------
// Random Number Generators (from scratch)
// ---------------------------------------------------------------------------

/** Box-Muller transform for normal distribution */
function sampleNormal(mean: number, sd: number): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + sd * z;
}

/** Uniform distribution: scaled Math.random() */
function sampleUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Binomial: sum of Bernoulli trials, with normal approx for large n */
function sampleBinomial(n: number, p: number): number {
  const trials = Math.round(n);
  if (trials <= 0) return 0;
  if (trials > 200) {
    // Normal approximation for large n
    const mean = trials * p;
    const sd = Math.sqrt(trials * p * (1 - p));
    return Math.round(Math.max(0, Math.min(trials, sampleNormal(mean, sd))));
  }
  let successes = 0;
  for (let i = 0; i < trials; i++) {
    if (Math.random() < p) successes++;
  }
  return successes;
}

/** Exponential: inverse CDF */
function sampleExponential(rate: number): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return -Math.log(u) / rate;
}

/** Poisson: Knuth algorithm */
function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Normal approximation for large lambda
    return Math.round(Math.max(0, sampleNormal(lambda, Math.sqrt(lambda))));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function sampleVariable(v: RandomVariable): number {
  switch (v.distribution) {
    case 'normal':
      return sampleNormal(v.params.mean ?? 0, v.params.sd ?? 1);
    case 'uniform':
      return sampleUniform(v.params.min ?? 0, v.params.max ?? 1);
    case 'binomial':
      return sampleBinomial(v.params.n ?? 10, v.params.p ?? 0.5);
    case 'exponential':
      return sampleExponential(v.params.rate ?? 1);
    case 'poisson':
      return samplePoisson(v.params.lambda ?? 5);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Safe Expression Evaluator (no eval!)
// ---------------------------------------------------------------------------

type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'unaryMinus'; operand: ASTNode }
  | { type: 'binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'call'; fn: string; arg: ASTNode };

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ' || expr[i] === '\t') { i++; continue; }
    if ('+-*/^(),'.includes(expr[i])) {
      tokens.push(expr[i]);
      i++;
      continue;
    }
    // Number
    if (/[0-9.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[0-9.eE\-+]/.test(expr[i])) {
        // handle scientific notation carefully
        if ((expr[i] === '-' || expr[i] === '+') && num.length > 0 && !/[eE]/.test(num[num.length - 1])) break;
        num += expr[i];
        i++;
      }
      tokens.push(num);
      continue;
    }
    // Identifier (variable or function)
    if (/[a-zA-Z_]/.test(expr[i])) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i];
        i++;
      }
      tokens.push(id);
      continue;
    }
    // Unknown character - skip
    i++;
  }
  return tokens;
}

const KNOWN_FUNCTIONS = new Set(['sqrt', 'abs', 'log', 'exp', 'sin', 'cos', 'ln']);

function parseExpression(tokens: string[], pos: { i: number }): ASTNode {
  return parseAddSub(tokens, pos);
}

function parseAddSub(tokens: string[], pos: { i: number }): ASTNode {
  let left = parseMulDiv(tokens, pos);
  while (pos.i < tokens.length && (tokens[pos.i] === '+' || tokens[pos.i] === '-')) {
    const op = tokens[pos.i];
    pos.i++;
    const right = parseMulDiv(tokens, pos);
    left = { type: 'binary', op, left, right };
  }
  return left;
}

function parseMulDiv(tokens: string[], pos: { i: number }): ASTNode {
  let left = parsePower(tokens, pos);
  while (pos.i < tokens.length && (tokens[pos.i] === '*' || tokens[pos.i] === '/')) {
    const op = tokens[pos.i];
    pos.i++;
    const right = parsePower(tokens, pos);
    left = { type: 'binary', op, left, right };
  }
  return left;
}

function parsePower(tokens: string[], pos: { i: number }): ASTNode {
  let left = parseUnary(tokens, pos);
  while (pos.i < tokens.length && tokens[pos.i] === '^') {
    pos.i++;
    const right = parseUnary(tokens, pos);
    left = { type: 'binary', op: '^', left, right };
  }
  return left;
}

function parseUnary(tokens: string[], pos: { i: number }): ASTNode {
  if (pos.i < tokens.length && tokens[pos.i] === '-') {
    pos.i++;
    const operand = parseAtom(tokens, pos);
    return { type: 'unaryMinus', operand };
  }
  if (pos.i < tokens.length && tokens[pos.i] === '+') {
    pos.i++;
    return parseAtom(tokens, pos);
  }
  return parseAtom(tokens, pos);
}

function parseAtom(tokens: string[], pos: { i: number }): ASTNode {
  if (pos.i >= tokens.length) {
    return { type: 'number', value: 0 };
  }

  const token = tokens[pos.i];

  // Parenthesized expression
  if (token === '(') {
    pos.i++;
    const node = parseExpression(tokens, pos);
    if (pos.i < tokens.length && tokens[pos.i] === ')') pos.i++;
    return node;
  }

  // Number
  if (/^[0-9.]/.test(token)) {
    pos.i++;
    return { type: 'number', value: parseFloat(token) || 0 };
  }

  // Identifier (function or variable)
  if (/^[a-zA-Z_]/.test(token)) {
    pos.i++;
    const lower = token.toLowerCase();
    // Function call
    if (KNOWN_FUNCTIONS.has(lower) && pos.i < tokens.length && tokens[pos.i] === '(') {
      pos.i++; // skip (
      const arg = parseExpression(tokens, pos);
      if (pos.i < tokens.length && tokens[pos.i] === ')') pos.i++;
      return { type: 'call', fn: lower === 'ln' ? 'log' : lower, arg };
    }
    // Variable
    return { type: 'variable', name: token };
  }

  // Fallback
  pos.i++;
  return { type: 'number', value: 0 };
}

function evaluateAST(node: ASTNode, vars: Record<string, number>): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'variable':
      return vars[node.name] ?? 0;
    case 'unaryMinus':
      return -evaluateAST(node.operand, vars);
    case 'binary': {
      const l = evaluateAST(node.left, vars);
      const r = evaluateAST(node.right, vars);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r !== 0 ? l / r : 0;
        case '^': return Math.pow(l, r);
        default: return 0;
      }
    }
    case 'call': {
      const a = evaluateAST(node.arg, vars);
      switch (node.fn) {
        case 'sqrt': return Math.sqrt(Math.max(0, a));
        case 'abs': return Math.abs(a);
        case 'log': return a > 0 ? Math.log(a) : 0;
        case 'exp': return Math.exp(Math.min(a, 700));
        case 'sin': return Math.sin(a);
        case 'cos': return Math.cos(a);
        default: return 0;
      }
    }
    default:
      return 0;
  }
}

function safeEvaluate(expression: string, vars: Record<string, number>): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;
  const pos = { i: 0 };
  const ast = parseExpression(tokens, pos);
  const result = evaluateAST(ast, vars);
  if (!isFinite(result)) return 0;
  return result;
}

// ---------------------------------------------------------------------------
// Simulation Engine
// ---------------------------------------------------------------------------

function runSimulation(
  variables: RandomVariable[],
  expression: string,
  iterations: number,
): SimulationResult {
  const values: number[] = new Array(iterations);
  const convergenceSampleInterval = Math.max(1, Math.floor(iterations / 200));
  const convergence: number[] = [];
  let runningSum = 0;

  for (let i = 0; i < iterations; i++) {
    const vars: Record<string, number> = {};
    for (const v of variables) {
      vars[v.name] = sampleVariable(v);
    }
    const result = safeEvaluate(expression, vars);
    values[i] = result;
    runningSum += result;

    if ((i + 1) % convergenceSampleInterval === 0 || i === iterations - 1) {
      convergence.push(runningSum / (i + 1));
    }
  }

  return { values, convergence, expression, variables };
}

// ---------------------------------------------------------------------------
// Statistics Helpers
// ---------------------------------------------------------------------------

function computeStats(values: number[]) {
  const n = values.length;
  if (n === 0) return { mean: 0, median: 0, stdDev: 0, p5: 0, p95: 0, pPositive: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const p5 = sorted[Math.floor(n * 0.05)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const pPositive = values.filter((v) => v > 0).length / n;

  return { mean, median, stdDev, p5, p95, pPositive };
}

// ---------------------------------------------------------------------------
// Chart Helpers
// ---------------------------------------------------------------------------

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
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
  return v.toFixed(2);
}

function formatStat(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(3);
  return v.toFixed(4);
}

// ---------------------------------------------------------------------------
// Histogram SVG Component
// ---------------------------------------------------------------------------

interface HistogramProps {
  values: number[];
  width: number;
  height: number;
}

function HistogramChart({ values, width, height }: HistogramProps) {
  const margin = { top: 32, right: 20, bottom: 52, left: 60 };
  const plotW = Math.max(width - margin.left - margin.right, 40);
  const plotH = Math.max(height - margin.top - margin.bottom, 40);

  const bins = useMemo(() => {
    if (values.length === 0) return [];
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const binCount = Math.min(50, Math.max(30, Math.ceil(Math.sqrt(values.length) * 0.8)));
    const binWidth = (vMax - vMin) / binCount || 1;

    const result: { start: number; end: number; count: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      result.push({
        start: vMin + i * binWidth,
        end: vMin + (i + 1) * binWidth,
        count: 0,
      });
    }
    for (const v of values) {
      let idx = Math.floor((v - vMin) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      result[idx].count++;
    }
    return result;
  }, [values]);

  if (bins.length === 0) return null;

  const vMin = bins[0].start;
  const vMax = bins[bins.length - 1].end;
  const maxCount = Math.max(...bins.map((b) => b.count));
  const yDomMax = maxCount * 1.1 || 1;

  const xTicks = niceTickValues(vMin, vMax, 6);
  const yTicks = niceTickValues(0, yDomMax, 5);

  const sx = (v: number) => margin.left + ((v - vMin) / (vMax - vMin || 1)) * plotW;
  const sy = (v: number) => margin.top + plotH - (v / yDomMax) * plotH;

  const gridColor = 'rgba(255,255,255,0.06)';
  const axisBorderColor = 'rgba(255,255,255,0.15)';
  const mutedColor = '#6b6b76';

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#1a1a1d" rx="8" />
      {/* Title */}
      <text x={width / 2} y={20} textAnchor="middle" fill="#e2e2e8" fontSize="13" fontWeight="600">
        Distribution of Results
      </text>
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
      {/* Axes */}
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
            fill="#6366f1"
            opacity={0.8}
            rx="1"
          >
            <title>
              {bin.start.toFixed(2)} - {bin.end.toFixed(2)}: {bin.count}
            </title>
          </rect>
        );
      })}
      {/* Mean line */}
      {(() => {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const mx = sx(mean);
        if (mx >= margin.left && mx <= margin.left + plotW) {
          return (
            <g>
              <line
                x1={mx}
                x2={mx}
                y1={margin.top}
                y2={margin.top + plotH}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4,3"
                opacity={0.8}
              />
              <text
                x={mx + 4}
                y={margin.top + 12}
                fill="#f59e0b"
                fontSize="9"
                fontWeight="500"
              >
                mean
              </text>
            </g>
          );
        }
        return null;
      })()}
      {/* Axis labels */}
      <text
        x={margin.left + plotW / 2}
        y={height - 6}
        textAnchor="middle"
        fill={mutedColor}
        fontSize="11"
        fontWeight="500"
      >
        Value
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

// ---------------------------------------------------------------------------
// Convergence Plot SVG Component
// ---------------------------------------------------------------------------

interface ConvergenceProps {
  convergence: number[];
  totalIterations: number;
  width: number;
  height: number;
}

function ConvergencePlot({ convergence, totalIterations, width, height }: ConvergenceProps) {
  const margin = { top: 32, right: 20, bottom: 52, left: 60 };
  const plotW = Math.max(width - margin.left - margin.right, 40);
  const plotH = Math.max(height - margin.top - margin.bottom, 40);

  if (convergence.length < 2) return null;

  const yMin = Math.min(...convergence);
  const yMax = Math.max(...convergence);
  const yPad = (yMax - yMin) * 0.1 || Math.abs(yMin) * 0.1 || 1;
  const yDomMin = yMin - yPad;
  const yDomMax = yMax + yPad;

  const step = totalIterations / convergence.length;
  const xMax = totalIterations;

  const sx = (i: number) => margin.left + ((i * step) / xMax) * plotW;
  const sy = (v: number) => margin.top + plotH - ((v - yDomMin) / (yDomMax - yDomMin)) * plotH;

  const xTicks = niceTickValues(0, xMax, 5);
  const yTicks = niceTickValues(yDomMin, yDomMax, 5);

  const pathD = convergence
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(v)}`)
    .join(' ');

  const gridColor = 'rgba(255,255,255,0.06)';
  const axisBorderColor = 'rgba(255,255,255,0.15)';
  const mutedColor = '#6b6b76';

  // Final mean line
  const finalMean = convergence[convergence.length - 1];

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#1a1a1d" rx="8" />
      {/* Title */}
      <text x={width / 2} y={20} textAnchor="middle" fill="#e2e2e8" fontSize="13" fontWeight="600">
        Running Mean Convergence
      </text>
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
      {/* Axes */}
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
      {/* X ticks + labels */}
      {xTicks.map((t) => {
        const xPos = margin.left + (t / xMax) * plotW;
        return (
          <g key={`xt-${t}`}>
            <line
              x1={xPos}
              x2={xPos}
              y1={margin.top + plotH}
              y2={margin.top + plotH + 5}
              stroke={axisBorderColor}
              strokeWidth="1"
            />
            <text
              x={xPos}
              y={margin.top + plotH + 18}
              textAnchor="middle"
              fill={mutedColor}
              fontSize="10"
            >
              {formatTick(t)}
            </text>
          </g>
        );
      })}
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
      {/* Final mean dashed line */}
      <line
        x1={margin.left}
        x2={margin.left + plotW}
        y1={sy(finalMean)}
        y2={sy(finalMean)}
        stroke="#f59e0b"
        strokeWidth="1"
        strokeDasharray="4,3"
        opacity={0.6}
      />
      <text
        x={margin.left + plotW + 2}
        y={sy(finalMean) + 3}
        fill="#f59e0b"
        fontSize="8"
        fontWeight="500"
      >
        {formatTick(finalMean)}
      </text>
      {/* Convergence line */}
      <path
        d={pathD}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      {/* Axis labels */}
      <text
        x={margin.left + plotW / 2}
        y={height - 6}
        textAnchor="middle"
        fill={mutedColor}
        fontSize="11"
        fontWeight="500"
      >
        Iteration
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
        Running Mean
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

let nextVarId = 1;
function makeVarId() {
  return `v${nextVarId++}`;
}

const DEFAULT_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U', 'T', 'S'];

export default function MonteCarloTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const isFriendly = features.terminology === 'friendly';

  // Configuration state
  const [variables, setVariables] = useState<RandomVariable[]>([
    { id: makeVarId(), name: 'X', distribution: 'normal', params: { mean: 0, sd: 1 } },
  ]);
  const [expression, setExpression] = useState('X');
  const [iterations, setIterations] = useState(10000);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Labels based on skill level
  const labels = useMemo(() => ({
    expression: isFriendly ? 'What to calculate?' : 'Expression',
    iterations: isFriendly ? 'How many times to run?' : 'Iterations',
    variables: isFriendly ? 'Random inputs' : 'Random Variables',
    distribution: isFriendly ? 'Type' : 'Distribution',
    run: isFriendly ? 'Run Simulation' : 'Run',
    addVariable: isFriendly ? 'Add another input' : 'Add Variable',
    presets: isFriendly ? 'Quick Start' : 'Presets',
    results: isFriendly ? 'Results' : 'Simulation Results',
    config: isFriendly ? 'Setup' : 'Configuration',
  }), [isFriendly]);

  // Computed stats
  const stats = useMemo(() => {
    if (!result) return null;
    return computeStats(result.values);
  }, [result]);

  // Add variable
  const addVariable = useCallback(() => {
    setVariables((prev) => {
      const usedNames = new Set(prev.map((v) => v.name));
      const nextName = DEFAULT_NAMES.find((n) => !usedNames.has(n)) || `V${prev.length + 1}`;
      return [...prev, {
        id: makeVarId(),
        name: nextName,
        distribution: 'normal' as DistributionType,
        params: { mean: 0, sd: 1 },
      }];
    });
  }, []);

  // Remove variable
  const removeVariable = useCallback((id: string) => {
    setVariables((prev) => prev.length > 1 ? prev.filter((v) => v.id !== id) : prev);
  }, []);

  // Update variable
  const updateVariable = useCallback((id: string, updates: Partial<RandomVariable>) => {
    setVariables((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const updated = { ...v, ...updates };
      // Reset params when distribution changes
      if (updates.distribution && updates.distribution !== v.distribution) {
        const defaults: Record<string, number> = {};
        for (const p of DISTRIBUTION_PARAMS[updates.distribution]) {
          defaults[p.key] = p.defaultVal;
        }
        updated.params = defaults;
      }
      return updated;
    }));
  }, []);

  // Update variable param
  const updateVariableParam = useCallback((id: string, key: string, value: number) => {
    setVariables((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      return { ...v, params: { ...v.params, [key]: value } };
    }));
  }, []);

  // Load preset
  const loadPreset = useCallback((preset: Preset) => {
    // Reset var id counter to avoid collisions
    const newVars = preset.variables.map((v) => ({ ...v, id: makeVarId() }));
    setVariables(newVars);
    setExpression(preset.expression);
    setIterations(preset.iterations);
    setResult(null);
    setSimState('idle');
  }, []);

  // Run simulation
  const runSim = useCallback(() => {
    if (variables.length === 0 || !expression.trim()) return;
    setSimState('running');
    setProgress(0);

    // Use setTimeout to allow UI to update before blocking computation
    setTimeout(() => {
      setProgress(30);
      setTimeout(() => {
        const simResult = runSimulation(variables, expression, iterations);
        setProgress(100);
        setTimeout(() => {
          setResult(simResult);
          setSimState('done');
        }, 80);
      }, 50);
    }, 50);
  }, [variables, expression, iterations]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full">
      {/* ---------- Results Display (left 60%) ---------- */}
      <div className="flex-[6] min-w-0 p-4 overflow-y-auto space-y-4">
        {/* Empty state */}
        {simState === 'idle' && !result && (
          <div className="flex h-full items-center justify-center text-muted/40">
            <div className="text-center space-y-4">
              <svg
                width="56"
                height="56"
                viewBox="0 0 56 56"
                fill="none"
                className="mx-auto opacity-25"
              >
                {/* Dice / randomness icon */}
                <rect x="8" y="8" width="40" height="40" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="20" cy="20" r="2.5" fill="currentColor" />
                <circle cx="36" cy="20" r="2.5" fill="currentColor" />
                <circle cx="28" cy="28" r="2.5" fill="currentColor" />
                <circle cx="20" cy="36" r="2.5" fill="currentColor" />
                <circle cx="36" cy="36" r="2.5" fill="currentColor" />
              </svg>
              <div className="space-y-1.5">
                <p className="text-sm text-foreground/50">
                  {isFriendly ? 'Monte Carlo Simulation' : 'Monte Carlo Simulation Engine'}
                </p>
                <p className="text-[11px] text-muted/30 max-w-[280px]">
                  {isFriendly
                    ? 'Define your random inputs, write a formula, and run thousands of experiments to see what happens.'
                    : 'Define random variables, specify an expression, and run stochastic simulations to explore the output distribution.'}
                </p>
              </div>
              <div className="pt-2">
                <p className="text-[10px] text-muted/25 uppercase tracking-wider mb-2">
                  {labels.presets}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => loadPreset(preset)}
                      className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-white/50 hover:bg-white/[0.06] hover:text-white/70 hover:border-white/15 transition-all"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Running state */}
        {simState === 'running' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4">
              <svg className="animate-spin h-8 w-8 mx-auto text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  opacity="0.2"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="space-y-2">
                <p className="text-sm text-foreground/60">
                  {isFriendly ? 'Running simulation...' : `Simulating ${iterations.toLocaleString()} iterations...`}
                </p>
                {/* Progress bar */}
                <div className="w-48 mx-auto h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {simState === 'done' && result && stats && (
          <div className="space-y-4">
            {/* Expression display */}
            <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
              <p className="text-[10px] text-muted/40 uppercase tracking-wider mb-1">
                {isFriendly ? 'Formula' : 'Expression'}
              </p>
              <p className="text-sm text-foreground/80 font-mono">{result.expression}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                {result.variables.map((v) => (
                  <span key={v.id} className="text-[10px] text-muted/35 font-mono">
                    {v.name} ~ {v.distribution === 'normal' ? `N(${v.params.mean}, ${v.params.sd})` :
                      v.distribution === 'uniform' ? `U(${v.params.min}, ${v.params.max})` :
                      v.distribution === 'binomial' ? `Bin(${v.params.n}, ${v.params.p})` :
                      v.distribution === 'exponential' ? `Exp(${v.params.rate})` :
                      `Pois(${v.params.lambda})`}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Mean', value: formatStat(stats.mean) },
                { label: 'Median', value: formatStat(stats.median) },
                { label: 'Std Dev', value: formatStat(stats.stdDev) },
                { label: '5th Percentile', value: formatStat(stats.p5) },
                { label: '95th Percentile', value: formatStat(stats.p95) },
                { label: 'P(result > 0)', value: (stats.pPositive * 100).toFixed(1) + '%' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5"
                >
                  <p className="text-[10px] text-muted/40 uppercase tracking-wider">{card.label}</p>
                  <p className="text-lg text-foreground/90 font-mono font-semibold mt-0.5">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Histogram */}
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <HistogramChart
                values={result.values}
                width={Math.max(400, 600)}
                height={320}
              />
            </div>

            {/* Convergence Plot */}
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <ConvergencePlot
                convergence={result.convergence}
                totalIterations={iterations}
                width={Math.max(400, 600)}
                height={240}
              />
            </div>

            {/* Iteration count */}
            <p className="text-[10px] text-muted/25 text-center">
              {result.values.length.toLocaleString()} iterations completed
            </p>
          </div>
        )}
      </div>

      {/* ---------- Configuration Panel (right 40%) ---------- */}
      <div className="flex-[4] min-w-[260px] max-w-[380px] border-l border-white/5 bg-[#111113] overflow-y-auto p-4 space-y-5">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {labels.config}
          </p>
        </div>

        {/* Quick Start Presets */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {labels.presets}
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => loadPreset(preset)}
                className="text-left px-3 py-2 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all group"
              >
                <p className="text-[11px] text-white/70 font-medium group-hover:text-white/90 transition-colors">
                  {preset.name}
                </p>
                <p className="text-[10px] text-white/30 group-hover:text-white/40 transition-colors">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-white/5" />

        {/* Random Variables */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              {labels.variables}
            </label>
            <button
              onClick={addVariable}
              className="text-[10px] text-indigo-400/80 hover:text-indigo-400 transition-colors"
            >
              + {labels.addVariable}
            </button>
          </div>

          {variables.map((v) => (
            <div
              key={v.id}
              className="rounded-md border border-white/8 bg-white/[0.02] p-3 space-y-2.5"
            >
              {/* Variable header: name + remove */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariable(v.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  className="w-16 rounded px-2 py-1 text-xs font-mono bg-white/[0.05] text-white/80 border border-white/10 outline-none focus:border-indigo-500/40 transition-colors"
                  placeholder="Name"
                />
                <select
                  value={v.distribution}
                  onChange={(e) => updateVariable(v.id, { distribution: e.target.value as DistributionType })}
                  className="flex-1 rounded px-2 py-1 text-xs bg-white/[0.05] text-white/80 border border-white/10 outline-none focus:border-indigo-500/40 transition-colors"
                >
                  {(Object.keys(DISTRIBUTION_PARAMS) as DistributionType[]).map((dist) => (
                    <option key={dist} value={dist}>
                      {isFriendly ? DISTRIBUTION_LABELS[dist].friendly : DISTRIBUTION_LABELS[dist].stat}
                    </option>
                  ))}
                </select>
                {variables.length > 1 && (
                  <button
                    onClick={() => removeVariable(v.id)}
                    className="text-white/20 hover:text-red-400/80 transition-colors p-0.5"
                    title="Remove variable"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Distribution parameters */}
              <div className="flex gap-2">
                {DISTRIBUTION_PARAMS[v.distribution].map((param) => (
                  <div key={param.key} className="flex-1 space-y-0.5">
                    <label className="text-[9px] text-white/30">
                      {isFriendly ? param.friendlyLabel : param.label}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={v.params[param.key] ?? param.defaultVal}
                      onChange={(e) => updateVariableParam(v.id, param.key, parseFloat(e.target.value) || 0)}
                      className="w-full rounded px-2 py-1 text-xs font-mono bg-white/[0.05] text-white/80 border border-white/10 outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-white/5" />

        {/* Expression */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {labels.expression}
          </label>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder={isFriendly ? 'e.g. X + Y' : 'e.g. X^2 + 2*X + 1'}
            className="w-full rounded-md px-3 py-2 text-xs font-mono bg-white/[0.05] text-white/80 border border-white/10 outline-none focus:border-indigo-500/40 placeholder:text-white/15 transition-colors"
          />
          <p className="text-[9px] text-white/20">
            {isFriendly
              ? 'Use +, -, *, / and your variable names above'
              : 'Supports: + - * / ^ sqrt() abs() log() exp()'}
          </p>
        </div>

        {/* Iterations */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {labels.iterations}
          </label>
          <div className="grid grid-cols-5 gap-1">
            {ITERATION_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setIterations(n)}
                className={`py-1.5 rounded-md text-[10px] font-medium transition-all ${
                  iterations === n
                    ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                }`}
              >
                {n >= 1000 ? `${n / 1000}K` : n}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runSim}
          disabled={simState === 'running' || variables.length === 0 || !expression.trim()}
          className={`w-full py-2.5 rounded-md text-sm font-medium transition-all ${
            simState === 'running'
              ? 'bg-indigo-500/10 text-indigo-400/50 cursor-wait'
              : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200 border border-indigo-500/20 hover:border-indigo-500/30'
          }`}
        >
          {simState === 'running' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {isFriendly ? 'Running...' : 'Simulating...'}
            </span>
          ) : (
            labels.run
          )}
        </button>

        {/* Separator */}
        <div className="border-t border-white/5" />

        {/* Info / help text */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/25">
            {isFriendly
              ? 'This runs your formula thousands of times with random numbers to see all the possible outcomes.'
              : 'Monte Carlo methods use repeated random sampling to obtain numerical results. The running mean should converge as iterations increase.'}
          </p>
        </div>

        {/* Result summary (in config panel too, for quick reference) */}
        {stats && result && (
          <>
            <div className="border-t border-white/5" />
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                {isFriendly ? 'Quick Summary' : 'Summary'}
              </label>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/30">Mean</span>
                  <span className="text-white/70 font-mono">{formatStat(stats.mean)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/30">Std Dev</span>
                  <span className="text-white/70 font-mono">{formatStat(stats.stdDev)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/30">90% CI</span>
                  <span className="text-white/70 font-mono">
                    [{formatStat(stats.p5)}, {formatStat(stats.p95)}]
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/30">P(&gt;0)</span>
                  <span className="text-white/70 font-mono">{(stats.pPositive * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
