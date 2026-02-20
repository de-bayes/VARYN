'use client';

import { TableCard } from './cards/TableCard';
import { PlotCard } from './cards/PlotCard';

export interface CardData {
  id: string;
  kind: 'table' | 'plot';
  title: string;
  // Table data
  columns?: string[];
  rows?: Record<string, unknown>[];
  // Plot data
  imageUrl?: string;
}

interface CanvasProps {
  cards: CardData[];
}

export function Canvas({ cards }: CanvasProps) {
  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted/40">
        <div className="text-center space-y-2">
          <p className="text-lg">No output yet</p>
          <p className="text-xs">Run a command below to see results here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {cards.map((card) => {
        if (card.kind === 'table' && card.columns && card.rows) {
          return <TableCard key={card.id} title={card.title} columns={card.columns} rows={card.rows} />;
        }
        if (card.kind === 'plot' && card.imageUrl) {
          return <PlotCard key={card.id} title={card.title} imageUrl={card.imageUrl} />;
        }
        return null;
      })}
    </div>
  );
}
