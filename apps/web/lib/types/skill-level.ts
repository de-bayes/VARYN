export type SkillLevel = 1 | 2 | 3 | 4;

export interface SkillLevelInfo {
  level: SkillLevel;
  name: string;
  label: string;
  description: string;
  tagline: string;
}

export const SKILL_LEVELS: Record<SkillLevel, SkillLevelInfo> = {
  1: {
    level: 1,
    name: 'Analyst',
    label: 'L1',
    description: 'No stats or coding background. Spreadsheet-first with guided wizards and friendly language.',
    tagline: 'I work with spreadsheets',
  },
  2: {
    level: 2,
    name: 'Researcher',
    label: 'L2',
    description: 'Stats knowledge, no coding. Guided forms with proper statistical terminology.',
    tagline: 'I know statistics',
  },
  3: {
    level: 3,
    name: 'Developer',
    label: 'L3',
    description: 'Stats + coding skills. Command bar, R console, and code behind operations.',
    tagline: 'I can write code',
  },
  4: {
    level: 4,
    name: 'Explorer',
    label: 'L4',
    description: 'Full R IDE experience. Multi-line terminal, all features, maximum flexibility.',
    tagline: 'Give me everything',
  },
};

export interface FeatureFlags {
  showBottomConsole: boolean;
  consoleMode: 'hidden' | 'output-only' | 'command' | 'multiline';
  showMenuEdit: boolean;
  showMenuView: boolean;
  showTabMonteCarlo: boolean;
  showTabRConsole: boolean;
  showCodeBehind: boolean;
  showSidebarModels: boolean;
  showSidebarHistory: boolean;
  terminology: 'friendly' | 'statistical' | 'technical';
}

export function getFeatureFlags(level: SkillLevel): FeatureFlags {
  switch (level) {
    case 1:
      return {
        showBottomConsole: false,
        consoleMode: 'hidden',
        showMenuEdit: false,
        showMenuView: false,
        showTabMonteCarlo: false,
        showTabRConsole: false,
        showCodeBehind: false,
        showSidebarModels: false,
        showSidebarHistory: false,
        terminology: 'friendly',
      };
    case 2:
      return {
        showBottomConsole: true,
        consoleMode: 'output-only',
        showMenuEdit: true,
        showMenuView: true,
        showTabMonteCarlo: true,
        showTabRConsole: false,
        showCodeBehind: false,
        showSidebarModels: true,
        showSidebarHistory: true,
        terminology: 'statistical',
      };
    case 3:
      return {
        showBottomConsole: true,
        consoleMode: 'command',
        showMenuEdit: true,
        showMenuView: true,
        showTabMonteCarlo: true,
        showTabRConsole: true,
        showCodeBehind: true,
        showSidebarModels: true,
        showSidebarHistory: true,
        terminology: 'technical',
      };
    case 4:
      return {
        showBottomConsole: true,
        consoleMode: 'multiline',
        showMenuEdit: true,
        showMenuView: true,
        showTabMonteCarlo: true,
        showTabRConsole: true,
        showCodeBehind: true,
        showSidebarModels: true,
        showSidebarHistory: true,
        terminology: 'technical',
      };
  }
}
