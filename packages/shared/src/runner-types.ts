// ── Runner contract ──────────────────────────────────
// The API sends this to the R runner via HTTP POST /execute
export interface RunnerRequest {
  runId: string;
  projectId: string;
  command: string;               // Stata-like command string
  datasetUrl: string;            // Pre-signed URL to download the dataset
  datasetFilename: string;       // Original filename (for haven/readr dispatch)
  timeoutSeconds: number;        // Hard kill limit
}

// The runner returns this synchronously
export interface RunnerResponse {
  status: 'success' | 'error';
  tables: RunnerTable[];         // JSON tables for TableCards
  plots: RunnerPlot[];           // Base64-encoded PNGs for PlotCards
  logs: string;                  // Captured R console output
  durationMs: number;
}

export interface RunnerTable {
  title: string;                 // e.g. "OLS Regression" or "Summary Statistics"
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface RunnerPlot {
  title: string;
  pngBase64: string;             // Base64-encoded PNG
}
