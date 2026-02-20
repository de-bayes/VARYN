// Supported Stata-like commands for MVP
export const SUPPORTED_COMMANDS = [
  'describe',
  'summarize',
  'tab',
  'gen',
  'replace',
  'keep',
  'drop',
  'reg',
  'scatter',
] as const;

export type SupportedCommand = typeof SUPPORTED_COMMANDS[number];

// R packages allowlisted in the runner sandbox
export const ALLOWED_R_PACKAGES = [
  'haven',
  'readr',
  'dplyr',
  'tidyr',
  'ggplot2',
  'fixest',
  'estimatr',
  'broom',
  'modelsummary',
  'jsonlite',
  'base64enc',
] as const;

// Execution limits
export const RUNNER_TIMEOUT_SECONDS = 30;
export const MAX_DATASET_SIZE_MB = 100;
export const MAX_ROWS_PREVIEW = 100;

// Object storage key prefixes
export const STORAGE_PREFIX = {
  datasets: 'datasets',
  plots: 'plots',
  exports: 'exports',
} as const;
