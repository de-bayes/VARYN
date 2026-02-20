import { AppMock } from '@/components/AppMock';
import { Reveal } from '@/components/Reveal';

const sections = [
  {
    title: 'Datasets',
    body: 'Upload CSV and .dta files, set an active dataset, and keep the data context visible in every run.'
  },
  {
    title: 'Models',
    body: 'Run summarize and OLS regressions with robust or cluster standard errors inside a clean, traceable workflow.'
  },
  {
    title: 'Jobs',
    body: 'Queue simulation runs and monitor progress with cloud-native execution tiers built around outcomes, not infrastructure jargon.'
  },
  {
    title: 'Presets',
    body: 'Scaffold common workflows like fixed effects, logistic regression, and election-style modeling without overwhelming the core UI.'
  }
];

export default function ProductPage() {
  return (
    <div className="container-shell space-y-14 pb-16">
      <section className="space-y-4">
        <p className="text-sm tracking-[0.14em] text-accent uppercase">Product</p>
        <h1 className="text-4xl font-medium sm:text-5xl">Built for serious statistical work.</h1>
        <p className="max-w-2xl text-muted">
          Varyn is a cloud-native R workspace with progressive power scaling: calm for new analysts, uncompromising for advanced modeling teams.
        </p>
      </section>

      <Reveal>
        <AppMock showCallouts />
      </Reveal>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="glass-panel rounded-2xl p-6">
            <h2 className="mb-2 text-2xl font-medium">{section.title}</h2>
            <p className="text-muted">{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
