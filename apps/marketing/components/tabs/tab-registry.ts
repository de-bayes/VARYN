import { lazy, type ComponentType } from 'react';
import type { TabType } from '@/lib/types/tabs';

export interface TabComponentProps {
  tabId: string;
  datasetId?: string;
  sourceUrl?: string;
}

type TabComponent = ComponentType<TabComponentProps>;

const registry: Record<TabType, () => Promise<{ default: TabComponent }>> = {
  spreadsheet: () => import('./types/SpreadsheetTab'),
  output: () => import('./types/OutputTab'),
  'graph-builder': () => import('./types/GraphBuilderTab'),
  summary: () => import('./types/SummaryTab'),
  regression: () => import('./types/RegressionTab'),
  'monte-carlo': () => import('./types/MonteCarloTab'),
  'r-console': () => import('./types/RConsoleTab'),
  welcome: () => import('./types/WelcomeTab'),
};

const componentCache = new Map<TabType, ReturnType<typeof lazy>>();

export function getTabComponent(type: TabType) {
  if (!componentCache.has(type)) {
    componentCache.set(type, lazy(registry[type]));
  }
  return componentCache.get(type)!;
}
