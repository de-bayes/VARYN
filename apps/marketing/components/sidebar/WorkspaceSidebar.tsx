'use client';

import { useRef, useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-context';
import { useSkillLevel } from '@/lib/skill-level-context';
import { useTabs } from '@/lib/tab-context';
import { useSpreadsheetData } from '@/lib/spreadsheet-data-store';

interface WorkspaceSidebarProps {
  activeSection: string;
  onSelect: (section: string) => void;
}

const SAMPLE_FILES = [
  { name: 'us_elections.csv', file: '/sample-data/us_elections.csv', color: '#6366f1' },
  { name: 'democracy_index.csv', file: '/sample-data/democracy_index.csv', color: '#10b981' },
  { name: 'inequality.csv', file: '/sample-data/inequality.csv', color: '#f59e0b' },
  { name: 'congress_votes.csv', file: '/sample-data/congress_votes.csv', color: '#ef4444' },
  { name: 'polling.csv', file: '/sample-data/polling.csv', color: '#8b5cf6' },
  { name: 'gdp_pcap.csv', file: '/sample-data/gdp_pcap.csv', color: '#14b8a6' },
];

function FileIcon({ color = '#6b6b76' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 1.5h5l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z"
        stroke={color}
        strokeWidth="1"
        fill="none"
      />
      <path d="M8 1.5v3h3" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function FolderIcon({ open = false }: { open?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M2 4v7a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1H7L5.5 3.5H3A1 1 0 002 4.5" />
          <path d="M2 7h10" opacity="0.3" />
        </>
      ) : (
        <path d="M2 4.5A1 1 0 013 3.5h2.5L7 5h4a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z" />
      )}
    </svg>
  );
}

export function WorkspaceSidebar({ activeSection, onSelect }: WorkspaceSidebarProps) {
  const { datasets, activeDataset, selectDataset, uploadDataset } = useWorkspace();
  const { features } = useSkillLevel();
  const { addTab, tabs } = useTabs();
  const { data: sharedData, savedSheets, deleteSavedSheet } = useSpreadsheetData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFriendly = features.terminology === 'friendly';

  // Track which files are currently open as tabs
  const openFiles = useMemo(() => {
    return tabs
      .filter((t) => t.type === 'spreadsheet')
      .map((t) => ({
        tabId: t.id,
        title: t.title,
        hasData: sharedData[t.id]?.columns.length > 0,
      }));
  }, [tabs, sharedData]);

  // Saved sheets that aren't currently open
  const closedSavedSheets = useMemo(() => {
    const openTabIds = new Set(tabs.map((t) => t.id));
    return savedSheets.filter((s) => !openTabIds.has(s.id));
  }, [savedSheets, tabs]);

  const handleUpload = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDataset(file);
      addTab('spreadsheet', { title: file.name });
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

  const handleSampleClick = (sample: (typeof SAMPLE_FILES)[0]) => {
    addTab('spreadsheet', { title: sample.name, sourceUrl: sample.file });
  };

  return (
    <aside className="flex h-full flex-col bg-panel text-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted/70 uppercase">
          Explorer
        </span>
        <button
          onClick={handleUpload}
          className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted/50 hover:border-accent/30 hover:text-foreground transition"
          title="Upload file"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <path d="M8 12V4M5 7l3-3 3 3" />
            <path d="M3 13h10" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.dta"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-3">
        {/* Open Files section */}
        {openFiles.length > 0 && (
          <div>
            <button
              onClick={() => onSelect('open')}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted/50 hover:text-muted/70"
            >
              <FolderIcon open={activeSection === 'open'} />
              Open Files
            </button>
            <div className="mt-0.5 space-y-px">
              {openFiles.map((f) => (
                <div
                  key={f.tabId}
                  className="flex items-center gap-2 rounded-md px-3 py-1 text-xs text-muted/60"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${f.hasData ? 'bg-emerald-400/60' : 'bg-white/10'}`} />
                  <span className="truncate">{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved Sheets (from IndexedDB) */}
        {closedSavedSheets.length > 0 && (
          <div>
            <button
              onClick={() => onSelect('saved')}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted/50 hover:text-muted/70"
            >
              <FolderIcon open={activeSection === 'saved'} />
              {isFriendly ? 'Recent Files' : 'Saved Sheets'}
            </button>
            <div className="mt-0.5 space-y-px">
              {closedSavedSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  className="group flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-xs text-muted/50 hover:bg-white/[0.03] hover:text-foreground transition"
                >
                  <button
                    onClick={() =>
                      addTab('spreadsheet', { title: sheet.title, sourceUrl: undefined })
                    }
                    className="flex flex-1 items-center gap-2 truncate"
                  >
                    <FileIcon color="#6366f1" />
                    <span className="truncate">{sheet.title}</span>
                    <span className="text-[9px] text-muted/30 ml-auto shrink-0">
                      {sheet.rows.length} rows
                    </span>
                  </button>
                  <button
                    onClick={() => deleteSavedSheet(sheet.id)}
                    className="flex h-4 w-4 items-center justify-center rounded text-[10px] text-muted/20 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition"
                    title="Remove saved sheet"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded Datasets (from API) */}
        {datasets.length > 0 && (
          <div>
            <button
              onClick={() => onSelect('datasets')}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted/50 hover:text-muted/70"
            >
              <FolderIcon open={activeSection === 'datasets'} />
              {isFriendly ? 'Your Files' : 'Datasets'}
            </button>
            <div className="mt-0.5 space-y-px">
              {datasets.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => handleDatasetClick(ds.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-xs transition ${
                    activeDataset?.id === ds.id
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted/60 hover:bg-white/[0.03] hover:text-foreground'
                  }`}
                >
                  <FileIcon />
                  <span className="truncate">{ds.filename}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sample Datasets */}
        <div>
          <button
            onClick={() => onSelect('samples')}
            className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted/50 hover:text-muted/70"
          >
            <FolderIcon open={activeSection === 'samples'} />
            {isFriendly ? 'Example Data' : 'Sample Datasets'}
          </button>
          <div className="mt-0.5 space-y-px">
            {SAMPLE_FILES.map((sample) => (
              <button
                key={sample.name}
                onClick={() => handleSampleClick(sample)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-xs text-muted/50 hover:bg-white/[0.03] hover:text-foreground transition"
              >
                <FileIcon color={sample.color} />
                <span className="truncate">{sample.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Models section (skill-gated) */}
        {features.showSidebarModels && (
          <div>
            <button
              onClick={() => onSelect('models')}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted/50 hover:text-muted/70"
            >
              <FolderIcon open={activeSection === 'models'} />
              Models
            </button>
            {activeSection === 'models' && (
              <p className="px-3 py-2 text-[10px] text-muted/30">No models yet</p>
            )}
          </div>
        )}

        {/* History section (skill-gated) */}
        {features.showSidebarHistory && (
          <div>
            <button
              onClick={() => onSelect('history')}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted/50 hover:text-muted/70"
            >
              <FolderIcon open={activeSection === 'history'} />
              History
            </button>
            {activeSection === 'history' && (
              <p className="px-3 py-2 text-[10px] text-muted/30">No history yet</p>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
