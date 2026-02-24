export type TabType =
  | 'spreadsheet'
  | 'output'
  | 'graph-builder'
  | 'summary'
  | 'regression'
  | 'logistic-regression'
  | 'hypothesis-test'
  | 'cross-tab'
  | 'time-series'
  | 'data-cleaning'
  | 'data-join'
  | 'monte-carlo'
  | 'r-console'
  | 'welcome';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  /** Dataset ID if this tab is associated with a specific dataset */
  datasetId?: string;
  /** Direct URL to load data from (e.g. sample data in /public) */
  sourceUrl?: string;
  closable: boolean;
}

export const TAB_TYPE_LABELS: Record<TabType, string> = {
  spreadsheet: 'Spreadsheet',
  output: 'Output',
  'graph-builder': 'Graph Builder',
  summary: 'Summary',
  regression: 'Regression',
  'logistic-regression': 'Logistic Regression',
  'hypothesis-test': 'Hypothesis Test',
  'cross-tab': 'Cross-Tabulation',
  'time-series': 'Time Series',
  'data-cleaning': 'Data Cleaning',
  'data-join': 'Data Join',
  'monte-carlo': 'Monte Carlo',
  'r-console': 'R Console',
  welcome: 'Welcome',
};
