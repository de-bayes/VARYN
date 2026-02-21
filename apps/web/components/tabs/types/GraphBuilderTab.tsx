'use client';

import type { TabComponentProps } from '../tab-registry';

export default function GraphBuilderTab({ tabId }: TabComponentProps) {
  return (
    <div className="flex h-full items-center justify-center text-muted/40">
      <div className="text-center space-y-2">
        <p className="text-sm">Graph Builder</p>
        <p className="text-[11px] text-muted/30">
          Coming in Phase 2 — drag variables to build publication-quality charts
        </p>
      </div>
    </div>
  );
}
