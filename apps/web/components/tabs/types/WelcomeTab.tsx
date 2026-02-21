'use client';

import { useSkillLevel } from '@/lib/skill-level-context';
import { useTabs } from '@/lib/tab-context';
import { useWorkspace } from '@/lib/workspace-context';
import { useRef } from 'react';
import type { TabComponentProps } from '../tab-registry';

export default function WelcomeTab({ tabId }: TabComponentProps) {
  const { features } = useSkillLevel();
  const { addTab } = useTabs();
  const { uploadDataset } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFriendly = features.terminology === 'friendly';

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDataset(file);
      addTab('spreadsheet', { title: file.name });
      e.target.value = '';
    }
  };

  const handleLoadExample = () => {
    addTab('spreadsheet', {
      title: 'gdp_pcap.csv',
      sourceUrl: '/sample-data/gdp_pcap.csv',
    });
  };

  const actions = [
    {
      label: isFriendly ? 'Try an example' : 'Load example dataset',
      description: isFriendly
        ? 'Explore GDP per capita data for 20 countries (1960–2020)'
        : 'GDP per capita, population, life expectancy — 20 countries, 7 decades',
      action: handleLoadExample,
    },
    {
      label: isFriendly ? 'Upload a file' : 'Upload dataset',
      description: isFriendly
        ? 'Open a CSV or data file from your computer'
        : 'Import a CSV or Stata .dta file',
      action: handleFileUpload,
    },
    {
      label: isFriendly ? 'Paste data' : 'Paste from clipboard',
      description: isFriendly
        ? 'Copy data from Excel or Google Sheets and paste it here'
        : 'Paste tabular data (CSV/TSV) from clipboard',
      action: () => addTab('spreadsheet', { title: 'Untitled' }),
    },
    {
      label: isFriendly ? 'View results' : 'Open output',
      description: isFriendly
        ? 'See tables and charts from your analysis'
        : 'Open a new output tab for command results',
      action: () => addTab('output'),
    },
  ];

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-foreground">
          {isFriendly ? 'Ready to explore your data?' : 'VARYN Workspace'}
        </h2>
        <p className="mt-2 text-xs text-muted/60">
          {isFriendly
            ? 'Start by uploading a file or pasting data from a spreadsheet.'
            : 'Get started by importing a dataset or opening a new tab.'}
        </p>

        <div className="mt-8 space-y-2">
          {actions.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex w-full items-start gap-3 rounded-lg border border-white/10 px-4 py-3 text-left transition hover:border-accent/30 hover:bg-white/[0.03]"
            >
              <div>
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted/50">{item.description}</p>
              </div>
            </button>
          ))}
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
