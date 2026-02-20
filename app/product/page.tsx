import { AppMock } from '@/components/AppMock';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Reveal } from '@/components/Reveal';

const sections = [
  {
    title: 'Datasets',
    body: 'Import CSV and .dta files, set an active dataset, and keep data context pinned so every run stays grounded.',
    tag: 'Data foundation'
  },
  {
    title: 'Models',
    body: 'Run summarize, OLS, and robust or cluster-SE regressions with outputs that are easy to review with your team.',
    tag: 'Analysis flow'
  },
  {
    title: 'Jobs',
    body: 'Queue heavier simulations to cloud workers, monitor progress, and keep interactive work uninterrupted.',
    tag: 'Scale when needed'
  },
  {
    title: 'Presets',
    body: 'Start from common templates like fixed effects and logistic models, then branch into custom workflows as needed.',
    tag: 'Progressive power'
  }
];

const outcomes = [
  { label: 'Time to first model', value: 'Minutes' },
  { label: 'Workflow style', value: 'Calm + reproducible' },
  { label: 'Team fit', value: 'Solo to org-scale' }
];

export default function ProductPage() {
  return (
    <div className="container-shell space-y-16 pb-16">
      <section className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
        <div className="space-y-5">
          <Badge>Product</Badge>
          <h1 className="text-4xl font-medium leading-tight sm:text-5xl">
            Statistical software that feels focused, not fragile.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Varyn gives research teams a clean command-first workspace for regression and simulation, with cloud execution ready when projects get heavy.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button href="/pricing">View Pricing</Button>
            <Button href="/" variant="ghost">
              Back to Home
            </Button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 sm:p-6">
          <p className="text-xs tracking-[0.14em] text-accent uppercase">What improves immediately</p>
          <div className="mt-4 space-y-3">
            {outcomes.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-background/40 p-3">
                <p className="text-xs tracking-[0.08em] text-muted uppercase">{item.label}</p>
                <p className="mt-1 text-base font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Reveal>
        <AppMock showCallouts />
      </Reveal>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs tracking-[0.14em] text-accent uppercase">Core workflow</p>
          <h2 className="text-3xl font-medium sm:text-4xl">Everything you need for day-to-day statistical work.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Reveal key={section.title}>
              <article className="glass-panel h-full rounded-2xl p-6">
                <p className="mb-3 text-xs tracking-[0.12em] text-accent uppercase">{section.tag}</p>
                <h3 className="mb-2 text-2xl font-medium">{section.title}</h3>
                <p className="text-muted">{section.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
