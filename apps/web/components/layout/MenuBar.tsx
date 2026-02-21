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
      shortcut: '⌘N',
      action: () => addTab('spreadsheet'),
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
        router.push('/onboarding');
      },
    },
  ];

  const editItems: MenuItem[] = [
    { label: 'Undo', shortcut: '⌘Z', disabled: true },
    { label: 'Redo', shortcut: '⇧⌘Z', disabled: true },
    { label: '', separator: true },
    { label: 'Cut', shortcut: '⌘X', disabled: true },
    { label: 'Copy', shortcut: '⌘C', disabled: true },
    { label: 'Paste', shortcut: '⌘V', disabled: true },
  ];

  const viewItems: MenuItem[] = [
    {
      label: 'Toggle Console',
      shortcut: '⌘J',
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
      <span className="mr-3 px-2 text-[11px] font-semibold tracking-tight text-foreground">
        VARYN
      </span>
      <MenuDropdown label="File" items={fileItems} />
      {features.showMenuEdit && <MenuDropdown label="Edit" items={editItems} />}
      {features.showMenuView && <MenuDropdown label="View" items={viewItems} />}
      <MenuDropdown label="History" items={historyItems} />
    </header>
  );
}
