import { Badge } from './Badge';

type AppMockProps = {
  showCallouts?: boolean;
};

export function AppMock({ showCallouts = false }: AppMockProps) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-4 shadow-premium sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[180px_1fr_220px]">
        <aside className="rounded-xl border border-white/10 bg-background/50 p-4 text-xs text-muted">
          <p className="mb-3 text-[11px] tracking-[0.14em] uppercase text-accent">Workspace</p>
          {['Datasets', 'Models', 'Jobs', 'Exports'].map((item) => (
            <div key={item} className="mb-2 rounded-md border border-white/10 p-2 hover:border-accent/40">
              {item}
            </div>
          ))}
        </aside>

        <main className="space-y-3 rounded-xl border border-white/10 bg-background/40 p-4">
          {[
            'summarize wage tenure education',
            'regress wage education tenure i.region, robust',
            'simulate 2500: regress turnout age income ideology'
          ].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-panel/80 p-3 text-sm text-foreground">
              {item}
            </div>
          ))}
          <div className="rounded-xl border border-accent/35 bg-accent/10 p-3 text-xs text-muted">
            <span className="text-accent">$</span> varyn run model --dataset panel_q3 --cluster state --save project
          </div>
        </main>

        <aside className="rounded-xl border border-white/10 bg-background/50 p-4 text-sm text-muted">
          <p className="mb-3 text-xs tracking-[0.14em] uppercase text-accent">Output preview</p>
          <div className="mb-3 h-24 rounded-md border border-white/10 bg-gradient-to-r from-accent/15 to-transparent" />
          <p>OLS R²: 0.81</p>
          <p className="mt-2">Simulation jobs: 2,500</p>
        </aside>
      </div>

      {showCallouts && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Regression-first UX</Badge>
          <Badge>Progressive complexity</Badge>
          <Badge>Cloud-ready jobs</Badge>
        </div>
      )}
    </div>
  );
}
