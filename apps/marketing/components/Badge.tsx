import { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs tracking-[0.16em] text-accent uppercase">
      {children}
    </span>
  );
}
