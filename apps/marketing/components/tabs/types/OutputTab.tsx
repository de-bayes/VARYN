'use client';

import { useWorkspace } from '@/lib/workspace-context';
import { TableCard } from '@/components/cards/TableCard';
import { PlotCard } from '@/components/cards/PlotCard';
import type { TabComponentProps } from '../tab-registry';

export default function OutputTab({ tabId }: TabComponentProps) {
  const { cards } = useWorkspace();

  // Get cards for this specific output tab
  const tabCards = cards[tabId] ?? [];

  if (tabCards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-2">
          <p className="text-sm">No output yet</p>
          <p className="text-[11px] text-muted/30">
            Run a command to see results here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {tabCards.map((card) => {
        if (card.kind === 'table' && card.columns && card.rows) {
          return (
            <TableCard
              key={card.id}
              title={card.title}
              columns={card.columns}
              rows={card.rows}
            />
          );
        }
        if (card.kind === 'plot' && card.imageUrl) {
          return (
            <PlotCard key={card.id} title={card.title} imageUrl={card.imageUrl} />
          );
        }
        return null;
      })}
    </div>
  );
}
