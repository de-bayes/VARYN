'use client';

import { useSkillLevel } from '@/lib/skill-level-context';
import { useTabs } from '@/lib/tab-context';
import { useWorkspace } from '@/lib/workspace-context';
import { useRef } from 'react';
import type { TabComponentProps } from '../tab-registry';

interface SampleDataset {
  id: string;
  title: string;
  friendlyTitle: string;
  description: string;
  friendlyDescription: string;
  file: string;
  rows: number;
  cols: number;
  tags: string[];
  color: string;
  icon: 'ballot' | 'globe' | 'scale' | 'capitol' | 'chart' | 'dollar';
}

function DatasetIcon({ icon, color }: { icon: SampleDataset['icon']; color: string }) {
  const s = 18;
  switch (icon) {
    case 'ballot':
      return (
        <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="2" width="12" height="14" rx="1.5" />
          <path d="M6 6h6M6 9h6M6 12h4" />
          <circle cx="13" cy="13" r="2" fill={color} stroke="none" opacity="0.3" />
        </svg>
      );
    case 'globe':
      return (
        <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round">
          <circle cx="9" cy="9" r="6.5" />
          <ellipse cx="9" cy="9" rx="3" ry="6.5" />
          <path d="M3 9h12" />
          <path d="M4 5.5h10M4 12.5h10" />
        </svg>
      );
    case 'scale':
      return (
        <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2v14" />
          <path d="M3 6l6-2 6 2" />
          <path d="M3 6l-1 5h4l-1-5" />
          <path d="M15 6l-1 5h4l-1-5" />
        </svg>
      );
    case 'capitol':
      return (
        <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 16h12" />
          <path d="M5 16V9M8 16V9M10 16V9M13 16V9" />
          <path d="M4 9h10" />
          <path d="M9 3l6 6H3z" />
        </svg>
      );
    case 'chart':
      return (
        <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 15V3" />
          <path d="M3 15h12" />
          <path d="M6 11l3-4 3 2 3-4" />
          <circle cx="6" cy="11" r="1" fill={color} stroke="none" opacity="0.5" />
          <circle cx="9" cy="7" r="1" fill={color} stroke="none" opacity="0.5" />
          <circle cx="12" cy="9" r="1" fill={color} stroke="none" opacity="0.5" />
        </svg>
      );
    case 'dollar':
      return (
        <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M9 4v10" />
          <path d="M6.5 7c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2c0 1.5-2.5 1.5-2.5 3 0 1.1 1.1 2 2.5 2" />
        </svg>
      );
  }
}

const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'elections',
    title: 'US Presidential Elections',
    friendlyTitle: 'US Election Results',
    description: 'State-level presidential election results 1976\u20132024. Party, vote share, electoral votes.',
    friendlyDescription: 'See who won each state in every presidential election since 1976.',
    file: '/sample-data/us_elections.csv',
    rows: 522,
    cols: 9,
    tags: ['elections', 'US politics'],
    color: '#6366f1',
    icon: 'ballot',
  },
  {
    id: 'democracy',
    title: 'Democracy Index',
    friendlyTitle: 'World Democracy Scores',
    description: 'EIU Democracy Index for 40 countries (2006\u20132023). Electoral process, civil liberties, participation.',
    friendlyDescription: 'How democratic is each country? Scores and rankings over time.',
    file: '/sample-data/democracy_index.csv',
    rows: 215,
    cols: 9,
    tags: ['governance', 'international'],
    color: '#10b981',
    icon: 'globe',
  },
  {
    id: 'inequality',
    title: 'Income Inequality',
    friendlyTitle: 'Income Inequality by Country',
    description: 'Gini index, top-10 share, bottom-50 share for 30 countries (2000\u20132020).',
    friendlyDescription: 'How is income distributed in different countries?',
    file: '/sample-data/inequality.csv',
    rows: 135,
    cols: 8,
    tags: ['economics', 'inequality'],
    color: '#f59e0b',
    icon: 'scale',
  },
  {
    id: 'congress',
    title: 'Congressional Voting',
    friendlyTitle: 'How Congress Votes',
    description: 'Party loyalty, ideology scores, and bill sponsorship for 115th\u2013118th Congress.',
    friendlyDescription: 'How often do members of Congress vote with their party?',
    file: '/sample-data/congress_votes.csv',
    rows: 169,
    cols: 10,
    tags: ['Congress', 'US politics'],
    color: '#ef4444',
    icon: 'capitol',
  },
  {
    id: 'polling',
    title: 'Presidential Polling',
    friendlyTitle: 'Election Polls',
    description: 'State-level polling data for 2020 and 2024 presidential races. Swing states, margins.',
    friendlyDescription: 'What did the polls say before the last two elections?',
    file: '/sample-data/polling.csv',
    rows: 129,
    cols: 11,
    tags: ['polls', 'elections'],
    color: '#8b5cf6',
    icon: 'chart',
  },
  {
    id: 'gdp',
    title: 'GDP Per Capita',
    friendlyTitle: 'Country Wealth Over Time',
    description: 'GDP per capita, population, life expectancy for 20 countries (1960\u20132020).',
    friendlyDescription: 'How rich are different countries and how has it changed?',
    file: '/sample-data/gdp_pcap.csv',
    rows: 133,
    cols: 6,
    tags: ['economics', 'development'],
    color: '#14b8a6',
    icon: 'dollar',
  },
];

export default function WelcomeTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { addTab } = useTabs();
  const { uploadDataset } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFriendly = features.terminology === 'friendly';

  const handleFileUpload = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDataset(file);
      addTab('spreadsheet', { title: file.name });
      e.target.value = '';
    }
  };

  const handleLoadDataset = (ds: SampleDataset) => {
    addTab('spreadsheet', {
      title: ds.id === 'gdp' ? 'gdp_pcap.csv' : `${ds.id}.csv`,
      sourceUrl: ds.file,
    });
  };

  const handleGraphDataset = (ds: SampleDataset, e: React.MouseEvent) => {
    e.stopPropagation();
    addTab('graph-builder', {
      title: `Graph: ${isFriendly ? ds.friendlyTitle : ds.title}`,
      sourceUrl: ds.file,
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 mb-4 text-[10px] text-muted/40 uppercase tracking-widest">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-accent/60">
              <path d="M3 3v10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 10l3-4 3 2 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Political Data Analysis
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            {isFriendly ? 'What would you like to explore?' : 'VARYN Workspace'}
          </h2>
          <p className="mt-2 text-sm text-muted/50 max-w-md mx-auto">
            {isFriendly
              ? 'Pick a dataset to start exploring, or bring your own data.'
              : 'Load a political dataset to analyze, or import your own.'}
          </p>
        </div>

        {/* Dataset grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {SAMPLE_DATASETS.map((ds) => (
            <div
              key={ds.id}
              className="group relative flex flex-col items-start rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.04] cursor-pointer"
              onClick={() => handleLoadDataset(ds)}
            >
              <div className="flex items-center gap-2.5 mb-2 w-full">
                <span className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  <DatasetIcon icon={ds.icon} color={ds.color} />
                </span>
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {isFriendly ? ds.friendlyTitle : ds.title}
                </span>
              </div>
              <p className="text-[11px] text-muted/45 leading-relaxed mb-3">
                {isFriendly ? ds.friendlyDescription : ds.description}
              </p>
              <div className="flex items-center gap-1.5 mt-auto flex-wrap">
                <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-muted/35 tabular-nums">
                  {ds.rows} rows
                </span>
                <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-muted/35 tabular-nums">
                  {ds.cols} cols
                </span>
                {ds.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded px-1.5 py-0.5 text-[9px]"
                    style={{
                      backgroundColor: `${ds.color}12`,
                      color: ds.color,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Hover actions */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleGraphDataset(ds, e)}
                  className="flex h-6 items-center gap-1 rounded border border-white/10 bg-panel/90 px-2 text-[9px] text-muted/60 hover:text-foreground hover:border-white/20 transition"
                  title="Open in Graph Builder"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 14V2" />
                    <path d="M2 14h12" />
                    <path d="M5 10l3-4 3 2 3-4" />
                  </svg>
                  Graph
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-white/5" />
          <span className="text-[10px] text-muted/25 uppercase tracking-wider">or</span>
          <div className="flex-1 border-t border-white/5" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleFileUpload}
            className="group flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-muted/70 hover:border-accent/30 hover:text-foreground transition"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-muted/40 group-hover:text-accent/60 transition">
              <path d="M8 12V4M5 7l3-3 3 3" />
              <path d="M3 13h10" />
            </svg>
            {isFriendly ? 'Upload a file' : 'Upload dataset'}
          </button>
          <button
            onClick={() => addTab('spreadsheet', { title: 'Untitled' })}
            className="group flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-muted/70 hover:border-accent/30 hover:text-foreground transition"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-muted/40 group-hover:text-accent/60 transition">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <line x1="2" y1="6" x2="14" y2="6" />
              <line x1="6" y1="2" x2="6" y2="14" />
            </svg>
            {isFriendly ? 'Paste data' : 'Paste from clipboard'}
          </button>
          <button
            onClick={() => addTab('graph-builder')}
            className="group flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-muted/70 hover:border-accent/30 hover:text-foreground transition"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40 group-hover:text-accent/60 transition">
              <path d="M2 14V2" />
              <path d="M2 14h12" />
              <path d="M5 10l3-4 3 2 3-4" />
            </svg>
            {isFriendly ? 'Make a chart' : 'Graph Builder'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.dta"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
