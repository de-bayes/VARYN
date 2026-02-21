'use client';

import { useRef } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useTabs } from '@/lib/tab-context';

interface Section {
  label: string;
  icon: string;
  key: string;
}

interface WorkspaceSidebarProps {
  activeSection: string;
  onSelect: (section: string) => void;
}

export function WorkspaceSidebar({ activeSection, onSelect }: WorkspaceSidebarProps) {
  const { datasets, activeDataset, selectDataset, uploadDataset, openDataView } =
    useWorkspace();
  const { features } = useSkillLevel();
  const { addTab } = useTabs();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sections: Section[] = [
    { label: 'Datasets', icon: 'D', key: 'datasets' },
  ];
  if (features.showSidebarModels) {
    sections.push({ label: 'Models', icon: 'M', key: 'models' });
  }
  if (features.showSidebarHistory) {
    sections.push({ label: 'History', icon: 'H', key: 'history' });
  }

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDataset(file);
      e.target.value = '';
    }
  };

  const handleDatasetClick = (id: string) => {
    selectDataset(id);
    const ds = datasets.find((d) => d.id === id);
    if (ds) {
      addTab('spreadsheet', { title: ds.filename, datasetId: ds.id });
    }
  };

  return (
    <aside className="flex h-full flex-col bg-panel text-sm">
      <div className="px-4 py-3 text-[11px] tracking-[0.14em] text-muted/70 uppercase">
        Explorer
      </div>
      <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition
              ${
                activeSection === s.key
                  ? 'bg-white/[0.06] text-foreground'
                  : 'text-muted hover:bg-white/[0.03] hover:text-foreground'
              }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded border border-white/10 text-[10px] text-muted">
              {s.icon}
            </span>
            {s.label}
          </button>
        ))}

        {/* Dataset list */}
        {activeSection === 'datasets' && (
          <div className="mt-3 space-y-0.5">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] uppercase tracking-wider text-muted/50">
                Files
              </span>
              <button
                onClick={handleUpload}
                className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted hover:border-accent/40 hover:text-foreground transition"
              >
                + Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.dta"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {datasets.length === 0 && (
              <p className="px-3 py-2 text-[10px] text-muted/40">No datasets yet</p>
            )}
            {datasets.map((ds) => (
              <button
                key={ds.id}
                onClick={() => handleDatasetClick(ds.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition
                  ${
                    activeDataset?.id === ds.id
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted/70 hover:bg-white/[0.03] hover:text-foreground'
                  }`}
              >
                <span className="text-[10px]">&#9679;</span>
                <span className="truncate">{ds.filename}</span>
              </button>
            ))}
          </div>
        )}

        {activeSection === 'models' && (
          <div className="mt-3 px-3 py-2 text-[10px] text-muted/40">
            No models yet
          </div>
        )}

        {activeSection === 'history' && (
          <div className="mt-3 px-3 py-2 text-[10px] text-muted/40">
            No history yet
          </div>
        )}
      </nav>
    </aside>
  );
}
