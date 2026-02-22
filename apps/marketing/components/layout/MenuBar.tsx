'use client';

import { useRouter } from 'next/navigation';
import { MenuDropdown, type MenuItem } from './MenuDropdown';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useTabs } from '@/lib/tab-context';

export function MenuBar() {
  const { features, setSkillLevel } = useSkillLevel();
  const { addTab } = useTabs();
  const router = useRouter();

  const fileItems: MenuItem[] = [
    {
      label: 'New Spreadsheet',
      shortcut: '\u2318N',
      action: () => addTab('spreadsheet'),
    },
    {
      label: 'New Graph',
      shortcut: '\u2318G',
      action: () => addTab('graph-builder'),
    },
    {
      label: 'New Output',
      action: () => addTab('output'),
    },
    { label: '', separator: true },
    {
      label: 'Change Skill Level',
      action: () => {
        localStorage.removeItem('varyn_skill_level');
        router.push('/app/onboarding');
      },
    },
  ];

  const editItems: MenuItem[] = [
    { label: 'Undo', shortcut: '\u2318Z', disabled: true },
    { label: 'Redo', shortcut: '\u21E7\u2318Z', disabled: true },
    { label: '', separator: true },
    { label: 'Cut', shortcut: '\u2318X', disabled: true },
    { label: 'Copy', shortcut: '\u2318C', disabled: true },
    { label: 'Paste', shortcut: '\u2318V', disabled: true },
  ];

  const viewItems: MenuItem[] = [
    {
      label: 'Toggle Console',
      shortcut: '\u2318J',
      disabled: !features.showBottomConsole,
    },
    { label: '', separator: true },
    { label: 'Reset Layout', disabled: true },
  ];

  const historyItems: MenuItem[] = [
    { label: 'Command History', disabled: true },
    { label: 'Session Log', disabled: true },
  ];

  return (
    <header className="flex h-8 shrink-0 items-center border-b border-white/5 bg-panel px-2 gap-0.5">
      <span className="mr-3 px-2 text-[11px] font-semibold tracking-tight text-foreground flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-accent">
          <path d="M3 3v10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 10l3-4 3 2 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        VARYN
      </span>
      <MenuDropdown label="File" items={fileItems} />
      {features.showMenuEdit && <MenuDropdown label="Edit" items={editItems} />}
      {features.showMenuView && <MenuDropdown label="View" items={viewItems} />}
      <MenuDropdown label="History" items={historyItems} />
    </header>
  );
}
