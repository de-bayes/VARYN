'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from '@/components/Sidebar';
import { Canvas, CardData } from '@/components/Canvas';
import { Inspector } from '@/components/Inspector';
import { CommandBar } from '@/components/CommandBar';

// Mock data for initial scaffold — replaced by API calls once wired up
const MOCK_CARDS: CardData[] = [
  {
    id: '1',
    kind: 'table',
    title: 'Summary Statistics',
    columns: ['Variable', 'N', 'Mean', 'SD', 'Min', 'Max'],
    rows: [
      { Variable: 'wage', N: 2246, Mean: 6.31, SD: 3.62, Min: 0.53, Max: 24.98 },
      { Variable: 'education', N: 2246, Mean: 12.68, SD: 2.74, Min: 0, Max: 18 },
      { Variable: 'tenure', N: 2246, Mean: 5.28, SD: 5.07, Min: 0, Max: 44 },
    ],
  },
  {
    id: '2',
    kind: 'table',
    title: 'OLS Regression: wage ~ education + tenure',
    columns: ['Term', 'Estimate', 'Std. Error', 't value', 'p value'],
    rows: [
      { Term: '(Intercept)', Estimate: -1.568, 'Std. Error': 0.452, 't value': -3.47, 'p value': 0.001 },
      { Term: 'education', Estimate: 0.541, 'Std. Error': 0.035, 't value': 15.54, 'p value': 0.000 },
      { Term: 'tenure', Estimate: 0.133, 'Std. Error': 0.021, 't value': 6.24, 'p value': 0.000 },
    ],
  },
];

const MOCK_DATASET = {
  filename: 'wages_2024.csv',
  rowCount: 2246,
  columns: [
    { name: 'wage', type: 'numeric', missing: 0 },
    { name: 'education', type: 'numeric', missing: 3 },
    { name: 'tenure', type: 'numeric', missing: 0 },
    { name: 'region', type: 'factor', missing: 0 },
    { name: 'female', type: 'logical', missing: 0 },
    { name: 'age', type: 'numeric', missing: 12 },
  ],
};

export default function WorkspacePage() {
  const [activeSection, setActiveSection] = useState('Datasets');
  const [cards, setCards] = useState<CardData[]>(MOCK_CARDS);
  const [isLoading, setIsLoading] = useState(false);

  const handleExecute = async (command: string) => {
    setIsLoading(true);
    // TODO: Wire to API POST /projects/:id/execute
    // For now, add a mock card
    setTimeout(() => {
      setCards((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          kind: 'table',
          title: `Result: ${command}`,
          columns: ['output'],
          rows: [{ output: `Executed: ${command}` }],
        },
      ]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 bg-panel px-4">
        <span className="text-sm font-semibold tracking-tight">VARYN</span>
        <span className="text-[10px] text-muted/50">wages_2024.csv</span>
      </header>

      {/* Main workspace */}
      <PanelGroup direction="vertical" className="flex-1">
        <Panel defaultSize={92} minSize={60}>
          <PanelGroup direction="horizontal">
            {/* Sidebar */}
            <Panel defaultSize={14} minSize={10} maxSize={25}>
              <Sidebar activeSection={activeSection} onSelect={setActiveSection} />
            </Panel>
            <PanelResizeHandle />

            {/* Canvas (output cards) */}
            <Panel defaultSize={60} minSize={30}>
              <Canvas cards={cards} />
            </Panel>
            <PanelResizeHandle />

            {/* Inspector */}
            <Panel defaultSize={26} minSize={15} maxSize={40}>
              <Inspector activeDataset={MOCK_DATASET} />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle />

        {/* Command bar at bottom */}
        <Panel defaultSize={8} minSize={5} maxSize={40}>
          <CommandBar onExecute={handleExecute} isLoading={isLoading} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
