'use client';

import type { TabComponentProps } from '../tab-registry';

export default function MonteCarloTab({ tabId }: TabComponentProps) {
  return (
    <div className="flex h-full items-center justify-center text-muted/40">
      <div className="text-center space-y-2">
        <p className="text-sm">Monte Carlo Simulation</p>
        <p className="text-[11px] text-muted/30">
          Coming in Phase 3 — define distributions and run simulations
        </p>
      </div>
    </div>
  );
}
