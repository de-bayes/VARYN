'use client';

import type { TabComponentProps } from '../tab-registry';

export default function RConsoleTab({ tabId }: TabComponentProps) {
  return (
    <div className="flex h-full items-center justify-center text-muted/40">
      <div className="text-center space-y-2">
        <p className="text-sm">R Console</p>
        <p className="text-[11px] text-muted/30">
          Coming in Phase 4 — full R terminal with inline plots
        </p>
      </div>
    </div>
  );
}
