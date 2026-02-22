'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { Tab, TabType } from './types/tabs';

// --- State ---

interface TabState {
  tabs: Tab[];
  activeTabId: string;
}

// --- Actions ---

type TabAction =
  | { type: 'ADD_TAB'; tab: Tab }
  | { type: 'CLOSE_TAB'; tabId: string }
  | { type: 'SET_ACTIVE'; tabId: string }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'UPDATE_TAB'; tabId: string; updates: Partial<Pick<Tab, 'title' | 'datasetId'>> };

function tabReducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case 'ADD_TAB': {
      const exists = state.tabs.find((t) => t.id === action.tab.id);
      if (exists) {
        return { ...state, activeTabId: exists.id };
      }
      return {
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
      };
    }
    case 'CLOSE_TAB': {
      const idx = state.tabs.findIndex((t) => t.id === action.tabId);
      if (idx === -1) return state;
      const tab = state.tabs[idx];
      if (!tab.closable) return state;

      const newTabs = state.tabs.filter((t) => t.id !== action.tabId);
      if (newTabs.length === 0) {
        // Always keep at least one tab — re-add welcome
        const welcomeTab = createWelcomeTab();
        return { tabs: [welcomeTab], activeTabId: welcomeTab.id };
      }
      let newActive = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        // Activate the tab to the left, or the first tab
        newActive = newTabs[Math.max(0, idx - 1)].id;
      }
      return { tabs: newTabs, activeTabId: newActive };
    }
    case 'SET_ACTIVE': {
      if (!state.tabs.find((t) => t.id === action.tabId)) return state;
      return { ...state, activeTabId: action.tabId };
    }
    case 'REORDER': {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(action.fromIndex, 1);
      newTabs.splice(action.toIndex, 0, moved);
      return { ...state, tabs: newTabs };
    }
    case 'UPDATE_TAB': {
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, ...action.updates } : t,
        ),
      };
    }
    default:
      return state;
  }
}

// --- Helpers ---

let tabCounter = 0;

export function generateTabId(type: TabType): string {
  return `${type}-${++tabCounter}-${Date.now()}`;
}

export function createWelcomeTab(): Tab {
  return {
    id: generateTabId('welcome'),
    type: 'welcome',
    title: 'Welcome',
    closable: true,
  };
}

// --- Context ---

interface TabContextValue {
  tabs: Tab[];
  activeTabId: string;
  activeTab: Tab | undefined;
  dispatch: Dispatch<TabAction>;
  addTab: (type: TabType, options?: { title?: string; datasetId?: string; sourceUrl?: string }) => Tab;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const welcomeTab = createWelcomeTab();

  const [state, dispatch] = useReducer(tabReducer, {
    tabs: [welcomeTab],
    activeTabId: welcomeTab.id,
  });

  const addTab = useCallback(
    (type: TabType, options?: { title?: string; datasetId?: string; sourceUrl?: string }): Tab => {
      const tab: Tab = {
        id: generateTabId(type),
        type,
        title: options?.title ?? typeToDefaultTitle(type),
        datasetId: options?.datasetId,
        sourceUrl: options?.sourceUrl,
        closable: true,
      };
      dispatch({ type: 'ADD_TAB', tab });
      return tab;
    },
    [],
  );

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', tabId });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE', tabId });
  }, []);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

  return (
    <TabContext.Provider
      value={{
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        activeTab,
        dispatch,
        addTab,
        closeTab,
        setActiveTab,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabs(): TabContextValue {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabs must be used within TabProvider');
  return ctx;
}

function typeToDefaultTitle(type: TabType): string {
  const titles: Record<TabType, string> = {
    spreadsheet: 'Spreadsheet',
    output: 'Output',
    'graph-builder': 'Graph Builder',
    summary: 'Summary',
    'monte-carlo': 'Monte Carlo',
    'r-console': 'R Console',
    welcome: 'Welcome',
  };
  return titles[type];
}
