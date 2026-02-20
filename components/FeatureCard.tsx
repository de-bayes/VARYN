import { ReactNode } from 'react';

export function FeatureCard({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <article className="glass-panel rounded-2xl p-6 shadow-premium">
      <div className="mb-4 text-accent">{icon}</div>
      <h3 className="mb-2 text-lg font-medium">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}
